import { FastifyPluginAsync } from "fastify";
import { stageSchema, stageUpdateSchema, reorderSchema } from "@school/shared";
import { z } from "zod";
import { createTenantAuditLog } from "../../services/audit-log.js";

const paramsSchema = z.object({ id: z.string().uuid() });

const stageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);
  
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
      return reply.status(403).send({ error: "Forbidden" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const data = stageSchema.parse(request.body);
    const subject = await fastify.prisma.subject.findFirst({
      where: { id: data.subjectId, tenantId: request.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!subject) {
      return reply.status(404).send({ error: "Subject not found" });
    }

    const count = await fastify.prisma.stage.count({
      where: { subjectId: data.subjectId, tenantId: request.tenantId, deletedAt: null },
    });
    
    const stage = await fastify.prisma.stage.create({
      data: {
        ...data,
        tenantId: request.tenantId,
        sortOrder: count,
      },
    });
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "STAGE_CREATED",
      entityType: "STAGE",
      entityId: stage.id,
      metadata: { subjectId: stage.subjectId, title: stage.title },
    });
    return reply.status(201).send(stage);
  });

  fastify.patch("/reorder", async (request) => {
    const items = reorderSchema.parse(request.body);

    await fastify.prisma.$transaction(
      items.map((item) =>
        fastify.prisma.stage.updateMany({
          where: { id: item.id, tenantId: request.tenantId, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "STAGES_REORDERED",
      entityType: "STAGE",
      entityId: request.tenantId,
      metadata: { itemCount: items.length },
    });
    return { success: true };
  });

  fastify.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const data = stageUpdateSchema.parse(request.body);
    
    await fastify.prisma.stage.updateMany({
      where: { id, tenantId: request.tenantId, deletedAt: null },
      data,
    });
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "STAGE_UPDATED",
      entityType: "STAGE",
      entityId: id,
    });
    return fastify.prisma.stage.findFirst({
      where: { id, tenantId: request.tenantId, deletedAt: null }
    });
  });

  fastify.delete("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await fastify.prisma.$transaction([
      fastify.prisma.stage.updateMany({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      fastify.prisma.lesson.updateMany({
        where: { stageId: id, tenantId: request.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "STAGE_DELETED",
      entityType: "STAGE",
      entityId: id,
    });
    return { success: true };
  });

};

export default stageRoutes;
