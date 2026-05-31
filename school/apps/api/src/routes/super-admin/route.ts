import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const auditLogsQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(50).default(25),
});

const superAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    try {
      await fastify.authenticate(request, reply);
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (request.userRole !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden: Super Admin only" });
    }
  });

  fastify.get("/tenants", async (request, reply) => {
    // We intentionally run this OUTSIDE the tenantContext 
    // to bypass RLS and fetch across all tenants.
    // The query block in prisma.ts only applies RLS if `tenantContext.getStore()` is truthy.
    
    // 1. Get raw tenant list
    const tenants = await fastify.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 2. We can manually augment it by fetching related stats.
    // Since prisma.js plugin enforces RLS for "User" table IF tenantId is set,
    // and since tenantContext is UNDEFINED here (because we added /api/super-admin to PUBLIC_PATH_PREFIXES),
    // we can query the users table across the DB without RLS kicking in.
    
    const userCounts = await fastify.prisma.user.groupBy({
      by: ["tenantId"],
      _count: { id: true },
    });

    const enrichedTenants = tenants.map((tenant) => {
      const count = userCounts.find(u => u.tenantId === tenant.id)?._count.id || 0;
      return { ...tenant, usersCount: count };
    });

    return reply.send(enrichedTenants);
  });

  fastify.get("/audit-logs", async (request, reply) => {
    const query = auditLogsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid audit log query" });
    }

    const logs = await fastify.prisma.auditLog.findMany({
      where: {
        ...(query.data.tenantId ? { tenantId: query.data.tenantId } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        tenant: {
          select: {
            subdomain: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.data.take,
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
    });

    return reply.send({
      data: logs,
      nextCursor: logs.length === query.data.take ? logs[logs.length - 1]?.id ?? null : null,
    });
  });

  fastify.patch("/tenants/:tenantId/status", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid tenant ID" });

    const body = statusSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid status body" });

    try {
      const updated = await fastify.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: params.data.tenantId },
          select: { id: true, status: true },
        });

        if (!tenant) {
          return null;
        }

        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: { status: body.data.status },
        });

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: request.userId,
            action: "TENANT_STATUS_UPDATED",
            entityType: "TENANT",
            entityId: tenant.id,
            metadata: {
              previousStatus: tenant.status,
              newStatus: updatedTenant.status,
            },
          },
        });

        return updatedTenant;
      });

      if (!updated) {
        return reply.status(404).send({ error: "Tenant not found" });
      }

      return reply.send({ success: true, status: updated.status });
    } catch (err: unknown) {
      request.log.error({ err }, "Failed to update tenant status");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
};

export default superAdminRoutes;
