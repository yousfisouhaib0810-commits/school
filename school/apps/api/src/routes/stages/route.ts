import { FastifyPluginAsync } from "fastify";
import { stageSchema, stageUpdateSchema, reorderSchema } from "@school/shared";
import { z } from "zod";

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
    return { success: true };
  });

  fastify.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const data = stageUpdateSchema.parse(request.body);
    
    await fastify.prisma.stage.updateMany({
      where: { id, tenantId: request.tenantId, deletedAt: null },
      data,
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
    return { success: true };
  });

};

export default stageRoutes;
