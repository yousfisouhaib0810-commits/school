import { FastifyPluginAsync } from "fastify";
import { subjectSchema, subjectUpdateSchema, reorderSchema } from "@school/shared";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

const subjectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);
  
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
      return reply.status(403).send({ error: "Forbidden" });
    }
  });

  fastify.get("/", async (request) => {
    return fastify.prisma.subject.findMany({
      where: { tenantId: request.tenantId, deletedAt: null },
      take: 100,
      orderBy: { sortOrder: "asc" },
      include: {
        stages: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
  });

  fastify.post("/", async (request, reply) => {
    const data = subjectSchema.parse(request.body);
    const count = await fastify.prisma.subject.count({ where: { tenantId: request.tenantId, deletedAt: null } });
    
    const subject = await fastify.prisma.subject.create({
      data: {
        ...data,
        tenantId: request.tenantId,
        sortOrder: count,
      },
    });
    return reply.status(201).send(subject);
  });

  fastify.patch("/reorder", async (request) => {
    const items = reorderSchema.parse(request.body);

    await fastify.prisma.$transaction(
      items.map((item) =>
        fastify.prisma.subject.updateMany({
          where: { id: item.id, tenantId: request.tenantId, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    return { success: true };
  });

  fastify.patch("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const data = subjectUpdateSchema.parse(request.body);
    
    await fastify.prisma.subject.updateMany({
      where: { id, tenantId: request.tenantId, deletedAt: null },
      data,
    });
    
    return fastify.prisma.subject.findFirst({
      where: { id, tenantId: request.tenantId, deletedAt: null }
    });
  });

  fastify.delete("/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await fastify.prisma.$transaction([
      fastify.prisma.subject.updateMany({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      fastify.prisma.stage.updateMany({
        where: { subjectId: id, tenantId: request.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      fastify.prisma.lesson.updateMany({
        where: { stage: { subjectId: id }, tenantId: request.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
    return { success: true };
  });

};

export default subjectRoutes;
