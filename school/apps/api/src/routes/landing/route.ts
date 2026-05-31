import { FastifyPluginAsync } from "fastify";
import { landingPageSchema } from "@school/shared";

export const landingRoutes: FastifyPluginAsync = async (fastify) => {
  // Public route to get the landing page
  fastify.get("/", async (request, reply) => {
    try {
      const page = await fastify.prisma.landingPage.findFirst({
        where: { tenantId: request.tenantId, published: true, deletedAt: null },
      });

      if (!page) {
        return { data: { blocks: [], published: false } };
      }

      return { data: { blocks: page.blocks, published: page.published } };
    } catch {
      return reply.status(500).send({ error: "Failed to fetch landing page" });
    }
  });

  // Protected route to update the landing page
  fastify.put(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parsed = landingPageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid landing page data" });
      }

      try {
        const existing = await fastify.prisma.landingPage.findFirst({
          where: { tenantId: request.tenantId, deletedAt: null },
        });

        // Ensure Prisma compatibility representing blocks as a JSON-serializable array
        const blocksJson = parsed.data.blocks as unknown as NonNullable<unknown>[];

        if (existing) {
          const updated = await fastify.prisma.landingPage.update({
            where: { id: existing.id },
            data: {
              blocks: blocksJson,
              published: parsed.data.published,
            },
          });
          return { data: updated };
        } else {
          const created = await fastify.prisma.landingPage.create({
            data: {
              tenantId: request.tenantId,
              blocks: blocksJson,
              published: parsed.data.published,
            },
          });
          return { data: created };
        }
      } catch {
        return reply.status(500).send({ error: "Failed to update landing page" });
      }
    }
  );

  // Protected route to get the draft/admin version
  fastify.get(
    "/admin",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const page = await fastify.prisma.landingPage.findFirst({
          where: { tenantId: request.tenantId, deletedAt: null },
        });

        return { data: page || { blocks: [], published: false } };
      } catch {
         return reply.status(500).send({ error: "Failed to fetch landing page admin mode" });
      }
    }
  );
};

export default landingRoutes;
