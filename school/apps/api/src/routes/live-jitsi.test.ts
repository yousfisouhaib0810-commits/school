import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import { jwtVerify } from "jose";
import type { PrismaClient } from "@school/database";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/school";
process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
process.env.JITSI_DOMAIN = "meet.school.example";
process.env.JITSI_APP_ID = "school-platform";
process.env.JITSI_APP_SECRET = "test-jitsi-secret-with-more-than-32-characters";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";

interface LiveSessionRecord {
  id: string;
  tenantId: string;
  title: string;
  scheduledAt: Date;
  jitsiRoomName: string | null;
  jitsiJoinUrl: string | null;
  zoomMeetingId: string;
  zoomJoinUrl: string | null;
  deletedAt: Date | null;
}

interface LiveRouteStore {
  role: "ADMIN" | "STUDENT";
  tenantPlan: "FREE" | "PRO";
  sessions: LiveSessionRecord[];
  auditActions: string[];
}

function createStore(): LiveRouteStore {
  return {
    role: "ADMIN",
    tenantPlan: "PRO",
    sessions: [
      {
        id: SESSION_ID,
        tenantId: TENANT_ID,
        title: "Math live",
        scheduledAt: new Date("2026-06-01T12:00:00.000Z"),
        jitsiRoomName: "tenant-room",
        jitsiJoinUrl: "https://meet.school.example/tenant-room",
        zoomMeetingId: "tenant-room",
        zoomJoinUrl: "https://meet.school.example/tenant-room",
        deletedAt: null,
      },
    ],
    auditActions: [],
  };
}

function createPrismaStub(store: LiveRouteStore) {
  return {
    liveSession: {
      async create(input: {
        data: {
          tenantId: string;
          title: string;
          scheduledAt: Date;
          jitsiRoomName: string;
          jitsiJoinUrl: string;
          zoomMeetingId: string;
          zoomJoinUrl: string;
        };
      }) {
        const session: LiveSessionRecord = {
          id: "55555555-5555-4555-8555-555555555555",
          deletedAt: null,
          ...input.data,
        };
        store.sessions.push(session);
        return session;
      },
      async findMany(input: { where: { tenantId: string; deletedAt: null } }) {
        return store.sessions.filter(
          (session) => session.tenantId === input.where.tenantId && session.deletedAt === input.where.deletedAt
        );
      },
      async findFirst(input: { where: { id: string; tenantId: string; deletedAt: null } }) {
        return (
          store.sessions.find(
            (session) =>
              session.id === input.where.id &&
              session.tenantId === input.where.tenantId &&
              session.deletedAt === input.where.deletedAt
          ) ?? null
        );
      },
    },
    user: {
      async findFirst(input: { where: { id: string; tenantId: string; deletedAt: null } }) {
        if (input.where.id !== USER_ID || input.where.tenantId !== TENANT_ID) {
          return null;
        }
        return { email: "student@example.com", name: "Student" };
      },
    },
    tenant: {
      async findFirst(input: { where: { id: string; plan: { not: "FREE" } } }) {
        return input.where.id === TENANT_ID && store.tenantPlan !== "FREE" ? { id: TENANT_ID } : null;
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
    typeof stub.liveSession.create !== "function" ||
    typeof stub.liveSession.findMany !== "function" ||
    typeof stub.liveSession.findFirst !== "function" ||
    typeof stub.user.findFirst !== "function" ||
    typeof stub.tenant.findFirst !== "function" ||
    typeof stub.auditLog.create !== "function"
  ) {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

function unwrapDefaultExport(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === "function") {
      return current;
    }
    if (typeof current !== "object" || current === null || !("default" in current)) {
      return current;
    }
    current = (current as { default: unknown }).default;
  }
  return current;
}

async function loadLiveRoutes(): Promise<FastifyPluginAsync> {
  const routeModule = await import("./live/route.js");
  const routeCandidate = unwrapDefaultExport(routeModule);
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid live route plugin");
  }
  return routeCandidate as FastifyPluginAsync;
}

async function buildApp(store: LiveRouteStore) {
  const app = Fastify();
  const liveRoutes = await loadLiveRoutes();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = store.role;
    request.tenantId = TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(store)));

  await app.register(liveRoutes);
  return app;
}

describe("Jitsi live routes", () => {
  it("creates tenant-scoped Jitsi sessions without calling an external meeting API", async () => {
    const store = createStore();
    const app = await buildApp(store);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/",
        payload: { title: "Physics live", scheduledAt: "2026-06-01T12:00:00.000Z" },
      });

      assert.equal(response.statusCode, 201);
      assert.equal(response.json().tenantId, TENANT_ID);
      assert.match(response.json().jitsiRoomName, /^tenant-/);
      assert.match(response.json().jitsiJoinUrl, /^https:\/\/meet\.school\.example\//);
      assert.deepEqual(store.auditActions, ["LIVE_SESSION_CREATED"]);
    } finally {
      await app.close();
    }
  });

  it("returns a room-bound Jitsi JWT only for sessions inside the authenticated tenant", async () => {
    const store = createStore();
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: `/${SESSION_ID}/signature` });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().provider, "jitsi");
      assert.equal(response.json().domain, "meet.school.example");
      assert.equal(response.json().roomName, "tenant-room");

      const secret = new TextEncoder().encode(process.env.JITSI_APP_SECRET);
      const verified = await jwtVerify(response.json().jwt, secret, {
        issuer: process.env.JITSI_APP_ID,
        audience: "jitsi",
      });

      assert.equal(verified.payload.sub, "meet.school.example");
      assert.equal(verified.payload.room, "tenant-room");
    } finally {
      await app.close();
    }
  });

  it("does not issue Jitsi tokens for another tenant session", async () => {
    const store = createStore();
    store.sessions[0] = { ...store.sessions[0], tenantId: OTHER_TENANT_ID };
    const app = await buildApp(store);

    try {
      const response = await app.inject({ method: "GET", url: `/${SESSION_ID}/signature` });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.json(), { error: "Live session not found" });
    } finally {
      await app.close();
    }
  });
});
