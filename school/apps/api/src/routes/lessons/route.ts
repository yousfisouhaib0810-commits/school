import { FastifyPluginAsync } from "fastify";
import { lessonSchema, lessonUpdateSchema, reorderSchema } from "@school/shared";
import { z } from "zod";
import { createTenantAuditLog } from "../../services/audit-log.js";

const paramsSchema = z.object({ id: z.string().uuid() });

const lessonRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);
  
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
      return reply.status(403).send({ error: "Forbidden" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const data = lessonSchema.parse(request.body);
    const stage = await fastify.prisma.stage.findFirst({
      where: { id: data.stageId, tenantId: request.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!stage) {
      return reply.status(404).send({ error: "Stage not found" });
    }

    const count = await fastify.prisma.lesson.count({
      where: { stageId: data.stageId, tenantId: request.tenantId, deletedAt: null },
    });
    
    const lesson = await fastify.prisma.lesson.create({
      data: {
        ...data,
        tenantId: request.tenantId,
        sortOrder: count,
      },
    });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "LESSON_CREATED",
      entityType: "LESSON",
      entityId: lesson.id,
      metadata: { stageId: lesson.stageId, title: lesson.title },
    });
    return reply.status(201).send(lesson);
  });

  fastify.patch("/reorder", async (request) => {
    const items = reorderSchema.parse(request.body);

    await fastify.prisma.$transaction(
      items.map((item) =>
        fastify.prisma.lesson.updateMany({
          where: { id: item.id, tenantId: request.tenantId, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "LESSONS_REORDERED",
      entityType: "LESSON",
      entityId: request.tenantId,
      metadata: { itemCount: items.length },
    });
    return { success: true };
  });

  fastify.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const data = lessonUpdateSchema.parse(request.body);
    
    await fastify.prisma.lesson.updateMany({
      where: { id, tenantId: request.tenantId, deletedAt: null },
      data,
    });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "LESSON_UPDATED",
      entityType: "LESSON",
      entityId: id,
    });
    return fastify.prisma.lesson.findFirst({
      where: { id, tenantId: request.tenantId, deletedAt: null }
    });
  });

  fastify.delete("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await fastify.prisma.lesson.updateMany({
      where: { id, tenantId: request.tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    await createTenantAuditLog({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      actorUserId: request.userId,
      action: "LESSON_DELETED",
      entityType: "LESSON",
      entityId: id,
    });
    return { success: true };
  });

};

export default lessonRoutes;
