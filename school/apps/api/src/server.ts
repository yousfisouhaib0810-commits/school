import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { Socket } from "node:net";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import tenantPlugin from "./plugins/tenant.js";
import authPlugin from "./plugins/auth.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import authRoutes from "./routes/auth/route.js";
import tenantRoutes from "./routes/tenant/route.js";
import videoRoutes from "./routes/video/route.js";
import subjectRoutes from "./routes/subjects/route.js";
import stageRoutes from "./routes/stages/route.js";
import lessonRoutes from "./routes/lessons/route.js";
import liveRoutes from "./routes/live/route.js";
import paymentsRoutes from "./routes/payments/route.js";
import chargilyWebhookRoute from "./routes/webhooks/chargily.js";
import landingRoutes from "./routes/landing/route.js";
import superAdminRoutes from "./routes/super-admin/route.js";

const REDIS_CHECK_TIMEOUT_MS = 2_000;

function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    // Allow localhost for local development
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
    // Allow all Vercel preview and production deployments
    if (hostname.endsWith(".vercel.app")) return true;
    // Allow a custom production domain set via environment variable
    const allowedOrigin = process.env.ALLOWED_ORIGIN;
    if (allowedOrigin) {
      try {
        const allowedHostname = new URL(allowedOrigin).hostname;
        if (hostname === allowedHostname) return true;
      } catch {
        // Invalid ALLOWED_ORIGIN format — ignore
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function checkRedisConnectivity(redisUrl: string): Promise<void> {
  const { hostname, port } = new URL(redisUrl);
  const redisPort = Number(port || 6379);

  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(REDIS_CHECK_TIMEOUT_MS, () => fail(new Error("Redis health check timed out")));
    socket.once("error", fail);
    socket.connect(redisPort, hostname, () => {
      socket.end();
      resolve();
    });
  });
}

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed"), false);
    },
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(cookie);

  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);
  await fastify.register(tenantPlugin);
  await fastify.register(errorHandlerPlugin);

  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(tenantRoutes, { prefix: "/api/tenant" });
  fastify.register(videoRoutes, { prefix: "/api/video" });
  fastify.register(subjectRoutes, { prefix: "/api/subjects" });
  fastify.register(stageRoutes, { prefix: "/api/stages" });
  fastify.register(lessonRoutes, { prefix: "/api/lessons" });
  fastify.register(liveRoutes, { prefix: "/api/live" });
  fastify.register(paymentsRoutes, { prefix: "/api/payments" });
  fastify.register(chargilyWebhookRoute, { prefix: "/api/webhooks/chargily" });
  fastify.register(landingRoutes, { prefix: "/api/landing" });
  fastify.register(superAdminRoutes, { prefix: "/api/super-admin" });

  fastify.get("/api/health", async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      await checkRedisConnectivity(env.REDIS_URL);

      return { status: "ok", checks: { database: "ok", redis: "ok" } };
    } catch (error) {
      request.log.error({ error }, "Health check failed");
      return reply.status(503).send({ status: "error", checks: { database: "error", redis: "error" } });
    }
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    fastify.log.info({ signal }, "Shutting down server");
    await fastify.close();
    await fastify.prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("unhandledRejection", (reason) => {
    fastify.log.fatal({ reason }, "Unhandled promise rejection");
    void shutdown("SIGTERM");
  });

  process.once("uncaughtException", (error) => {
    fastify.log.fatal({ error }, "Uncaught exception");
    void shutdown("SIGTERM");
  });

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    fastify.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
