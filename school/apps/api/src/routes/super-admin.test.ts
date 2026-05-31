import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import type { PrismaClient } from "@school/database";
import { z } from "zod";
import superAdminRoutes from "./super-admin/route.js";

const SUPER_ADMIN_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const AUDIT_ID = "44444444-4444-4444-8444-444444444444";

interface TenantRecord {
  id: string;
  subdomain: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  plan: "FREE" | "PRO" | "ENTERPRISE";
  createdAt: Date;
}

interface AuditLogRecord {
  id: string;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  tenant: {
    subdomain: string;
    name: string;
  };
}

interface SuperAdminStore {
  actorIsValid: boolean;
  role: "SUPER_ADMIN" | "ADMIN";
  tenants: TenantRecord[];
  auditLogs: AuditLogRecord[];
}

interface SuperAdminPrismaStub {
  user: {
    findFirst: () => Promise<{ id: string } | null>;
    groupBy: () => Promise<Array<{ tenantId: string; _count: { id: number } }>>;
  };
  tenant: {
    findMany: () => Promise<TenantRecord[]>;
    findUnique: (input: { where: { id: string }; select: { id: true; status: true } }) => Promise<{
      id: string;
      status: "ACTIVE" | "SUSPENDED";
    } | null>;
    update: (input: { where: { id: string }; data: { status: "ACTIVE" | "SUSPENDED" } }) => Promise<TenantRecord>;
  };
  auditLog: {
    create: (input: {
      data: {
        tenantId: string;
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: unknown;
      };
    }) => Promise<AuditLogRecord>;
    findMany: () => Promise<AuditLogRecord[]>;
  };
  $transaction: <T>(callback: (tx: SuperAdminPrismaStub) => Promise<T>) => Promise<T>;
}

const tenantsResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    usersCount: z.number().int(),
  })
);

const auditLogsEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      action: z.string(),
    })
  ),
});

function createStore(): SuperAdminStore {
  return {
    actorIsValid: true,
    role: "SUPER_ADMIN",
    tenants: [
      {
        id: SUPER_ADMIN_TENANT_ID,
        subdomain: "ops",
        name: "Operations",
        status: "ACTIVE",
        plan: "ENTERPRISE",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: TENANT_ID,
        subdomain: "academy",
        name: "Academy",
        status: "ACTIVE",
        plan: "FREE",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ],
    auditLogs: [],
  };
}

function createAuditLogRecord(
  store: SuperAdminStore,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: unknown;
  }
): AuditLogRecord {
  const tenant = store.tenants.find((record) => record.id === input.tenantId);
  if (!tenant) {
    throw new Error("Audit tenant not found");
  }

  return {
    id: `${AUDIT_ID.slice(0, -1)}${store.auditLogs.length}`,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? null,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    tenant: {
      subdomain: tenant.subdomain,
      name: tenant.name,
    },
  };
}

function createPrismaStub(store: SuperAdminStore) {
  const stub: SuperAdminPrismaStub = {
    user: {
      async findFirst() {
        return store.actorIsValid ? { id: USER_ID } : null;
      },
      async groupBy() {
        return [
          { tenantId: SUPER_ADMIN_TENANT_ID, _count: { id: 1 } },
          { tenantId: TENANT_ID, _count: { id: 2 } },
        ];
      },
    },
    tenant: {
      async findMany() {
        return [...store.tenants].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      },
      async findUnique(input: { where: { id: string }; select: { id: true; status: true } }) {
        const tenant = store.tenants.find((record) => record.id === input.where.id);
        return tenant ? { id: tenant.id, status: tenant.status } : null;
      },
      async update(input: { where: { id: string }; data: { status: "ACTIVE" | "SUSPENDED" } }) {
        const tenant = store.tenants.find((record) => record.id === input.where.id);
        if (!tenant) {
          throw new Error("Tenant not found");
        }
        tenant.status = input.data.status;
        return tenant;
      },
    },
    auditLog: {
      async create(input: {
        data: {
          tenantId: string;
          actorUserId: string;
          action: string;
          entityType: string;
          entityId: string;
          metadata?: unknown;
        };
      }) {
        const record = createAuditLogRecord(store, input.data);
        store.auditLogs.push(record);
        return record;
      },
      async findMany() {
        return [...store.auditLogs].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      },
    },
    async $transaction<T>(callback: (tx: typeof stub) => Promise<T>) {
      return callback(stub);
    },
  };

  return stub;
}

function toPrismaClientStub(stub: ReturnType<typeof createPrismaStub>): PrismaClient {
  if (
    typeof stub.user.findFirst !== "function" ||
    typeof stub.user.groupBy !== "function" ||
    typeof stub.tenant.findMany !== "function" ||
    typeof stub.tenant.findUnique !== "function" ||
    typeof stub.tenant.update !== "function" ||
    typeof stub.auditLog.create !== "function" ||
    typeof stub.auditLog.findMany !== "function" ||
    typeof stub.$transaction !== "function"
  ) {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

async function buildApp(store: SuperAdminStore) {
  const app = Fastify();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = store.role;
    request.tenantId = SUPER_ADMIN_TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(store)));

  await app.register(superAdminRoutes);
  return app;
}

describe("super admin routes", () => {
  it("requires a live verified SUPER_ADMIN actor before global tenant access", async () => {
    const store = createStore();
    store.actorIsValid = false;
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: "/tenants" });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.json(), { error: "Forbidden: Super Admin only" });
      assert.equal(store.auditLogs.length, 0);
    } finally {
      await app.close();
    }
  });

  it("rejects non-super-admin tokens before global tenant access", async () => {
    const store = createStore();
    store.role = "ADMIN";
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: "/tenants" });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.json(), { error: "Forbidden: Super Admin only" });
      assert.equal(store.auditLogs.length, 0);
    } finally {
      await app.close();
    }
  });

  it("lists tenants with user counts and records the sensitive read", async () => {
    const store = createStore();
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: "/tenants" });
      const tenants = tenantsResponseSchema.parse(response.json());

      assert.equal(response.statusCode, 200);
      assert.equal(tenants.length, 2);
      assert.equal(tenants.find((tenant) => tenant.id === TENANT_ID)?.usersCount, 2);
      assert.equal(store.auditLogs[0]?.action, "SUPER_ADMIN_TENANTS_VIEWED");
      assert.equal(store.auditLogs[0]?.actorUserId, USER_ID);
    } finally {
      await app.close();
    }
  });

  it("records audit-log views before returning paginated logs", async () => {
    const store = createStore();
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: "/audit-logs?take=10" });
      const body = auditLogsEnvelopeSchema.parse(response.json());

      assert.equal(response.statusCode, 200);
      assert.equal(store.auditLogs[0]?.action, "SUPER_ADMIN_AUDIT_LOGS_VIEWED");
      assert.equal(body.data[0]?.action, "SUPER_ADMIN_AUDIT_LOGS_VIEWED");
    } finally {
      await app.close();
    }
  });

  it("updates tenant status and writes the change audit record in the transaction", async () => {
    const store = createStore();
    const app = await buildApp(store);

    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/tenants/${TENANT_ID}/status`,
        payload: { status: "SUSPENDED" },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { success: true, status: "SUSPENDED" });
      assert.equal(store.tenants.find((tenant) => tenant.id === TENANT_ID)?.status, "SUSPENDED");
      assert.equal(store.auditLogs[0]?.action, "TENANT_STATUS_UPDATED");
      assert.deepEqual(store.auditLogs[0]?.metadata, {
        previousStatus: "ACTIVE",
        newStatus: "SUSPENDED",
      });
    } finally {
      await app.close();
    }
  });
});
