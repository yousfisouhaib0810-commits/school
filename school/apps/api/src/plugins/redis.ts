import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../env.js";
import { retryAsync } from "../lib/retry.js";

const STARTUP_CONNECT_ATTEMPTS = 5;
const STARTUP_CONNECT_DELAY_MS = 1_000;

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  await retryAsync(
    async () => {
      await redis.connect();
    },
    { attempts: STARTUP_CONNECT_ATTEMPTS, delayMs: STARTUP_CONNECT_DELAY_MS }
  );

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin);
