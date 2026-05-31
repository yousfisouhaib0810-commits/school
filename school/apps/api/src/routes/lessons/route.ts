import { FastifyPluginAsync } from "fastify";
import { lessonSchema, lessonUpdateSchema, reorderSchema } from "@school/shared";
import { z } from "zod";

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
    const count = await fastify.prisma.lesson.count({ where: { stageId: data.stageId, tenantId: request.tenantId } });
    
    const lesson = await fastify.prisma.lesson.create({
      data: {
        ...data,
        tenantId: request.tenantId,
        sortOrder: count,
      },
    });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    return reply.status(201).send(lesson);
  });

  fastify.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const data = lessonUpdateSchema.parse(request.body);
    
    await fastify.prisma.lesson.updateMany({
      where: { id, tenantId: request.tenantId },
      data,
    });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    return fastify.prisma.lesson.findFirst({
      where: { id, tenantId: request.tenantId }
    });
  });

  fastify.delete("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await fastify.prisma.lesson.deleteMany({ where: { id, tenantId: request.tenantId } });
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    return { success: true };
  });

  fastify.patch("/reorder", async (request) => {
    const items = reorderSchema.parse(request.body);
    
    await fastify.prisma.$transaction(
      items.map((item) =>
        fastify.prisma.lesson.updateMany({
          where: { id: item.id, tenantId: request.tenantId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);
    return { success: true };
  });
};

export default lessonRoutes;
