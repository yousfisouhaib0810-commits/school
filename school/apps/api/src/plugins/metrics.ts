import crypto from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env.js";

const METRICS_PATH = "/api/metrics";
const METRICS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

interface MetricsState {
  startedAt: number;
  totalRequests: number;
  responsesByStatusCode: Map<number, number>;
}

const metricsState: MetricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  responsesByStatusCode: new Map(),
};

function extractBearerToken(headerValue: string | string[] | undefined): string | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value?.startsWith("Bearer ")) {
    return null;
  }

  const token = value.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function areSameSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function renderMetrics(): string {
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor((Date.now() - metricsState.startedAt) / 1000);
  const lines = [
    "# HELP school_api_requests_total Total HTTP requests observed by the API process.",
    "# TYPE school_api_requests_total counter",
    `school_api_requests_total ${metricsState.totalRequests}`,
    "# HELP school_api_responses_total HTTP responses by status code.",
    "# TYPE school_api_responses_total counter",
  ];

  for (const [statusCode, count] of [...metricsState.responsesByStatusCode.entries()].sort(([left], [right]) => left - right)) {
    lines.push(`school_api_responses_total{status_code="${statusCode}"} ${count}`);
  }

  lines.push(
    "# HELP school_api_uptime_seconds API process uptime in seconds.",
    "# TYPE school_api_uptime_seconds gauge",
    `school_api_uptime_seconds ${uptimeSeconds}`,
    "# HELP school_api_memory_rss_bytes Resident memory used by the API process.",
    "# TYPE school_api_memory_rss_bytes gauge",
    `school_api_memory_rss_bytes ${memory.rss}`
  );

  return `${lines.join("\n")}\n`;
}

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onResponse", async (request, reply) => {
    if (request.url.startsWith(METRICS_PATH)) {
      return;
    }

    metricsState.totalRequests += 1;
    metricsState.responsesByStatusCode.set(
      reply.statusCode,
      (metricsState.responsesByStatusCode.get(reply.statusCode) ?? 0) + 1
    );
  });

  fastify.get(METRICS_PATH, async (request, reply) => {
    if (!env.METRICS_TOKEN) {
      request.log.error("Metrics token is not configured");
      return reply.status(503).send({ error: "Metrics are not configured" });
    }

    const token = extractBearerToken(request.headers.authorization);
    if (!token || !areSameSecret(token, env.METRICS_TOKEN)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    return reply.header("content-type", METRICS_CONTENT_TYPE).send(renderMetrics());
  });
};

export default fp(metricsPlugin);
