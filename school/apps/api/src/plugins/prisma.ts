import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { PrismaClient } from "@school/database";
import { AsyncLocalStorage } from "node:async_hooks";

export const tenantContext = new AsyncLocalStorage<string>();

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const basePrisma = new PrismaClient();

  await basePrisma.$connect();

  const prisma = basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const tenantId = tenantContext.getStore();
          if (tenantId) {
            const [, result] = await basePrisma.$transaction([
              basePrisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`),
              query(args),
            ]);
            return result;
          }
          return query(args);
        },
      },
    },
  });

  fastify.decorate("prisma", prisma as unknown as PrismaClient);

  fastify.addHook("onClose", async (_instance) => {
    await basePrisma.$disconnect();
  });
};

export default fp(prismaPlugin);
