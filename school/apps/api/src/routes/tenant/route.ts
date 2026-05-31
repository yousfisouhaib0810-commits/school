import { FastifyPluginAsync } from "fastify";
import { tenantUpdateSchema } from "@school/shared";

const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: {
        id: true,
        subdomain: true,
        name: true,
        logoUrl: true,
        status: true,
        plan: true,
        createdAt: true,
      },
    });

    return tenant;
  });

  fastify.patch("/me", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = tenantUpdateSchema.parse(request.body);

    const tenant = await fastify.prisma.tenant.update({
      where: { id: request.tenantId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl ?? null }),
      },
    });

    return tenant;
  });
};

export default tenantRoutes;
