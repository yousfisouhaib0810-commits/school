import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
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

async function verifySuperAdminActor(fastify: FastifyInstance, request: FastifyRequest): Promise<boolean> {
  if (request.userRole !== "SUPER_ADMIN") {
    return false;
  }

  const actor = await fastify.prisma.user.findFirst({
    where: {
      id: request.userId,
      tenantId: request.tenantId,
      role: "SUPER_ADMIN",
      deletedAt: null,
      emailVerifiedAt: { not: null },
      tenant: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  return actor !== null;
}

async function createSuperAdminAuditLog(
  fastify: FastifyInstance,
  request: FastifyRequest,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const userAgentHeader = request.headers["user-agent"];
  const userAgent = typeof userAgentHeader === "string" ? userAgentHeader : null;

  await fastify.prisma.auditLog.create({
    data: {
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: {
        ip: request.ip,
        userAgent,
        ...input.metadata,
      },
    },
  });
}

const superAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    try {
      await fastify.authenticate(request, reply);
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!(await verifySuperAdminActor(fastify, request))) {
      return reply.status(403).send({ error: "Forbidden: Super Admin only" });
    }
  });

  fastify.get("/tenants", async (request, reply) => {
    const tenants = await fastify.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });

    const userCounts = await fastify.prisma.user.groupBy({
      by: ["tenantId"],
      _count: { id: true },
    });

    const enrichedTenants = tenants.map((tenant) => {
      const count = userCounts.find(u => u.tenantId === tenant.id)?._count.id || 0;
      return { ...tenant, usersCount: count };
    });

    await createSuperAdminAuditLog(fastify, request, {
      action: "SUPER_ADMIN_TENANTS_VIEWED",
      entityType: "SUPER_ADMIN_DASHBOARD",
      entityId: request.tenantId,
      metadata: { resultCount: enrichedTenants.length },
    });

    return reply.send(enrichedTenants);
  });

  fastify.get("/audit-logs", async (request, reply) => {
    const query = auditLogsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid audit log query" });
    }

    await createSuperAdminAuditLog(fastify, request, {
      action: "SUPER_ADMIN_AUDIT_LOGS_VIEWED",
      entityType: "AUDIT_LOG",
      entityId: request.tenantId,
      metadata: {
        filteredTenantId: query.data.tenantId ?? null,
        take: query.data.take,
      },
    });

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
