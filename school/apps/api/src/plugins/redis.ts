import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin);