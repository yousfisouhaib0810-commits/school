import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
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

  fastify.patch("/tenants/:tenantId/status", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid tenant ID" });

    const body = statusSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid status body" });

    try {
      const updated = await fastify.prisma.tenant.update({
        where: { id: params.data.tenantId },
        data: { status: body.data.status },
      });

      return reply.send({ success: true, status: updated.status });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Record to update not found")) {
        return reply.status(404).send({ error: "Tenant not found" });
      }
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
};

export default superAdminRoutes;