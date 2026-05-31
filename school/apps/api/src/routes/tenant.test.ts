import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import type { PrismaClient } from "@school/database";
import tenantRoutes from "./tenant/route.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

interface TenantRouteStore {
  auditActions: string[];
}

function createPrismaStub(store: TenantRouteStore) {
  return {
    tenant: {
      async findUnique() {
        return {
          id: TENANT_ID,
          subdomain: "academy",
          name: "Academy",
          logoUrl: null,
          status: "ACTIVE",
          plan: "FREE",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      },
      async update(input: { where: { id: string }; data: { name?: string; logoUrl?: string | null } }) {
        return {
          id: input.where.id,
          subdomain: "academy",
          name: input.data.name ?? "Academy",
          logoUrl: input.data.logoUrl ?? null,
          status: "ACTIVE",
          plan: "FREE",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      },
    },
    auditLog: {
      async create(input: { data: { action: string } }) {
        store.auditActions.push(input.data.action);
      },
    },
  };
}

function toPrismaClientStub(stub: ReturnType<typeof createPrismaStub>): PrismaClient {
  if (
    typeof stub.tenant.findUnique !== "function" ||
    typeof stub.tenant.update !== "function" ||
    typeof stub.auditLog.create !== "function"
  ) {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

async function buildApp(store: TenantRouteStore, role: "ADMIN" | "TEACHER") {
  const app = Fastify();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = role;
    request.tenantId = TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(store)));

  await app.register(tenantRoutes);
  return app;
}

describe("tenant routes", () => {
  it("writes an audit log when tenant settings are updated", async () => {
    const store: TenantRouteStore = { auditActions: [] };
    const app = await buildApp(store, "ADMIN");

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/me",
        payload: { name: "Updated Academy" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().name, "Updated Academy");
      assert.deepEqual(store.auditActions, ["TENANT_SETTINGS_UPDATED"]);
    } finally {
      await app.close();
    }
  });

  it("does not audit rejected tenant settings updates", async () => {
    const store: TenantRouteStore = { auditActions: [] };
    const app = await buildApp(store, "TEACHER");

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/me",
        payload: { name: "Updated Academy" },
      });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.json(), { error: "Forbidden" });
      assert.deepEqual(store.auditActions, []);
    } finally {
      await app.close();
    }
  });
});
