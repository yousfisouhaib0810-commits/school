import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

const METRICS_TOKEN = "test-metrics-token-with-more-than-32-characters";

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
  process.env.METRICS_TOKEN = METRICS_TOKEN;
});

async function buildApp() {
  const { default: Fastify } = await import("fastify");
  const metricsModule = await import("./metrics.js");
  const metricsPlugin = metricsModule.default.default;

  const app = Fastify();
  await app.register(metricsPlugin);
  app.get("/api/example", async () => ({ ok: true }));
  app.get("/api/fails", async (_request, reply) => reply.status(503).send({ error: "unavailable" }));
  return app;
}

describe("metrics plugin", () => {
  it("rejects metrics reads without the bearer token", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), { error: "Unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("rejects metrics reads with an invalid bearer token", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
        headers: {
          authorization: "Bearer wrong-token",
        },
      });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), { error: "Unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("returns text metrics for authorised probes", async () => {
    const app = await buildApp();

    try {
      await app.inject({ method: "GET", url: "/api/example" });
      await app.inject({ method: "GET", url: "/api/fails" });
      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
        headers: {
          authorization: `Bearer ${METRICS_TOKEN}`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"]?.toString() ?? "", /text\/plain/);
      assert.match(response.body, /school_api_requests_total 2/);
      assert.match(response.body, /school_api_responses_total\{status_code="200"\} 1/);
      assert.match(response.body, /school_api_responses_total\{status_code="503"\} 1/);
      assert.match(response.body, /school_api_uptime_seconds \d+/);
      assert.match(response.body, /school_api_memory_rss_bytes \d+/);
    } finally {
      await app.close();
    }
  });
});
