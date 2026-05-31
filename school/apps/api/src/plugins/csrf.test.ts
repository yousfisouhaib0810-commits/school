import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
});

async function buildApp() {
  const { default: Fastify } = await import("fastify");
  const { default: cookie } = await import("@fastify/cookie");
  const csrfModule = await import("./csrf.js");
  const csrfPlugin = csrfModule.default.default;

  const app = Fastify();
  await app.register(cookie);
  await app.register(csrfPlugin);

  app.post("/api/protected", async () => ({ ok: true }));
  app.post("/api/webhooks/chargily/test", async () => ({ ok: true }));

  return app;
}

describe("csrf plugin", () => {
  it("rejects unsafe requests without a matching CSRF token", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/protected",
      });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.json(), { error: "Invalid CSRF token" });
    } finally {
      await app.close();
    }
  });

  it("accepts unsafe requests with matching signed CSRF tokens", async () => {
    const app = await buildApp();
    const { createCsrfToken } = await import("../lib/csrf.js");
    const csrfToken = createCsrfToken();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/protected",
        headers: {
          cookie: `csrfToken=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { ok: true });
    } finally {
      await app.close();
    }
  });

  it("does not require CSRF tokens for webhook endpoints", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/chargily/test",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { ok: true });
    } finally {
      await app.close();
    }
  });
});
