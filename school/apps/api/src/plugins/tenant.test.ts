import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import Fastify from "fastify";
import tenantPlugin from "./tenant.js";

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
});

describe("tenant plugin public paths", () => {
  it("allows readiness checks without a tenant header", async () => {
    const app = Fastify();
    await app.register(tenantPlugin);
    app.get("/api/readiness", async () => ({ status: "ok" }));

    const response = await app.inject({ method: "GET", url: "/api/readiness" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("allows password reset requests without a tenant header", async () => {
    const app = Fastify();
    await app.register(tenantPlugin);
    app.post("/api/auth/forgot-password", async () => ({ success: true }));

    const response = await app.inject({ method: "POST", url: "/api/auth/forgot-password" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { success: true });
  });

  it("rejects tenant-scoped paths without a tenant header", async () => {
    const app = Fastify();
    await app.register(tenantPlugin);
    app.get("/api/tenant/me", async () => ({ status: "ok" }));

    const response = await app.inject({ method: "GET", url: "/api/tenant/me" });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Missing tenant subdomain (X-Tenant-Subdomain header)" });
  });
});
