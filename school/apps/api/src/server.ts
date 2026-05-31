import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { z } from "zod";
import { Socket } from "node:net";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import tenantPlugin from "./plugins/tenant.js";
import authPlugin from "./plugins/auth.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import csrfPlugin from "./plugins/csrf.js";
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
import { getEmailDomain, isConfiguredValue, isUsableEmailSender } from "./services/email-config.js";

const REDIS_CHECK_TIMEOUT_MS = 2_000;
const EXTERNAL_READINESS_TIMEOUT_MS = 3_000;
const DEFAULT_PRODUCTION_WEB_ORIGINS = new Set(["https://school-mu-one.vercel.app"]);
type ReadinessValue =
  | "ok"
  | "missing"
  | "error"
  | "invalid_api_key"
  | "insufficient_permissions"
  | "unverified_domain";

const resendDomainsResponseSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      capabilities: z.object({
        sending: z.string(),
      }),
    })
  ),
});

async function checkResendReadiness(): Promise<ReadinessValue> {
  if (!isConfiguredValue(env.RESEND_API_KEY) || !isUsableEmailSender(env.EMAIL_FROM)) {
    return "missing";
  }

  const emailDomain = getEmailDomain(env.EMAIL_FROM);
  if (!emailDomain) {
    return "error";
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(EXTERNAL_READINESS_TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return "invalid_api_key";
      }
      return response.status === 403 ? "insufficient_permissions" : "error";
    }

    const domains = resendDomainsResponseSchema.parse(await response.json());
    const matchingDomain = domains.data.find((domain) => domain.name.toLowerCase() === emailDomain);

    if (!matchingDomain) {
      return "unverified_domain";
    }

    return matchingDomain.status === "verified" && matchingDomain.capabilities.sending === "enabled"
      ? "ok"
      : "unverified_domain";
  } catch {
    return "error";
  }
}

function configuredOrigins(): Set<string> {
  const origins = new Set(DEFAULT_PRODUCTION_WEB_ORIGINS);
  for (const origin of env.ALLOWED_ORIGINS?.split(",") ?? []) {
    const trimmed = origin.trim();
    if (trimmed) {
      origins.add(trimmed);
    }
  }
  return origins;
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname, origin: normalizedOrigin } = new URL(origin);
    if (env.NODE_ENV !== "production" && (hostname === "localhost" || hostname.endsWith(".localhost"))) {
      return true;
    }
    return configuredOrigins().has(normalizedOrigin);
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
  await fastify.register(csrfPlugin);

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

  fastify.get("/api/readiness", async (request, reply) => {
    const checks = {
      database: "ok",
      redis: "ok",
      email: await checkResendReadiness(),
      cloudflareUpload:
        isConfiguredValue(env.CLOUDFLARE_ACCOUNT_ID) && isConfiguredValue(env.CLOUDFLARE_STREAM_TOKEN)
          ? "ok"
          : "missing",
      cloudflarePlayback:
        isConfiguredValue(env.CLOUDFLARE_STREAM_CUSTOMER_CODE) &&
        isConfiguredValue(env.CLOUDFLARE_STREAM_SIGNING_KEY_ID) &&
        isConfiguredValue(env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY)
          ? "ok"
          : "missing",
      chargily: isConfiguredValue(env.CHARGILY_SECRET_KEY) ? "ok" : "missing",
      zoom:
        isConfiguredValue(env.ZOOM_ACCOUNT_ID) &&
        isConfiguredValue(env.ZOOM_CLIENT_ID) &&
        isConfiguredValue(env.ZOOM_CLIENT_SECRET) &&
        isConfiguredValue(env.ZOOM_SDK_KEY) &&
        isConfiguredValue(env.ZOOM_SDK_SECRET)
          ? "ok"
          : "missing",
    };

    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      await checkRedisConnectivity(env.REDIS_URL);
    } catch (error) {
      request.log.error({ error }, "Readiness infrastructure check failed");
      checks.database = "error";
      checks.redis = "error";
    }

    const ready = Object.values(checks).every((value) => value === "ok");
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks,
    });
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
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

bootstrap();
