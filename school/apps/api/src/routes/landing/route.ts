import { FastifyPluginAsync } from "fastify";
import { landingPageSchema } from "@school/shared";
import type { Prisma } from "@school/database";
import { createTenantAuditLog } from "../../services/audit-log.js";

export const landingRoutes: FastifyPluginAsync = async (fastify) => {
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

        const blocksJson: Prisma.InputJsonValue = parsed.data.blocks;

        if (existing) {
          await fastify.prisma.landingPage.updateMany({
            where: { id: existing.id, tenantId: request.tenantId, deletedAt: null },
            data: {
              blocks: blocksJson,
              published: parsed.data.published,
            },
          });
          const updated = await fastify.prisma.landingPage.findFirst({
            where: { id: existing.id, tenantId: request.tenantId, deletedAt: null },
          });
          await createTenantAuditLog({
            prisma: fastify.prisma,
            tenantId: request.tenantId,
            actorUserId: request.userId,
            action: "LANDING_PAGE_UPDATED",
            entityType: "LANDING_PAGE",
            entityId: existing.id,
            metadata: { published: parsed.data.published, blockCount: parsed.data.blocks.length },
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
          await createTenantAuditLog({
            prisma: fastify.prisma,
            tenantId: request.tenantId,
            actorUserId: request.userId,
            action: "LANDING_PAGE_CREATED",
            entityType: "LANDING_PAGE",
            entityId: created.id,
            metadata: { published: created.published, blockCount: parsed.data.blocks.length },
          });
          return { data: created };
        }
      } catch {
        return reply.status(500).send({ error: "Failed to update landing page" });
      }
    }
  );

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
