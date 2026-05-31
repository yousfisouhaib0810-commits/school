import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import cookie from "@fastify/cookie";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const EMAIL = "shared@example.com";

interface LoginFindUniqueInput {
  where: {
    email_tenantId: {
      email: string;
      tenantId: string;
    };
  };
}

interface SessionFindFirstInput {
  where: {
    id: string;
    tenantId: string;
    deletedAt: null;
    emailVerifiedAt: {
      not: null;
    };
  };
}

interface TenantStatusRecord {
  id: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED";
  deletedAt: Date | null;
}

interface SessionUserRecord {
  id: string;
  email: string;
  role: "ADMIN";
  tenant: TenantStatusRecord;
}

interface PrismaStub {
  user: {
    findUnique(input: LoginFindUniqueInput): Promise<null>;
    findFirst(input: SessionFindFirstInput): Promise<SessionUserRecord | null>;
  };
}

interface CapturedAuthQueries {
  login?: LoginFindUniqueInput;
  session?: SessionFindFirstInput;
}

function toPrismaClientStub(stub: PrismaStub): PrismaClient {
  if (typeof stub.user.findUnique !== "function" || typeof stub.user.findFirst !== "function") {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

function createPrismaStub(capturedQueries: CapturedAuthQueries): PrismaStub {
  return {
    user: {
      async findUnique(input) {
        capturedQueries.login = input;
        assert.equal(input.where.email_tenantId.email, EMAIL);
        assert.equal(input.where.email_tenantId.tenantId, TENANT_A_ID);
        return null;
      },
      async findFirst(input) {
        capturedQueries.session = input;
        if (input.where.id !== USER_ID || input.where.tenantId !== TENANT_A_ID) {
          return null;
        }

        return {
          id: USER_ID,
          email: EMAIL,
          role: "ADMIN",
          tenant: {
            id: TENANT_A_ID,
            subdomain: "tenant-a",
            status: "ACTIVE",
            deletedAt: null,
          },
        };
      },
    },
  };
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

async function loadAuthRoutes(): Promise<FastifyPluginAsync> {
  const authRouteModule = await import("./auth/route.js");
  const routeCandidate = unwrapDefaultExport(authRouteModule);
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid auth route plugin");
  }

  return routeCandidate as FastifyPluginAsync;
}

async function buildApp(capturedQueries: CapturedAuthQueries) {
  const app = Fastify();
  const authRoutes = await loadAuthRoutes();

  await app.register(cookie);
  app.decorateRequest("tenantId", "");
  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(capturedQueries)));
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "ADMIN";
    request.tenantId = TENANT_A_ID;
  });
  app.addHook("preHandler", async (request) => {
    request.tenantId = TENANT_A_ID;
  });

  await app.register(authRoutes);
  return app;
}

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
});

describe("auth tenant isolation", () => {
  it("does not authenticate an email that only exists in another tenant", async () => {
    const capturedQueries: CapturedAuthQueries = {};
    const app = await buildApp(capturedQueries);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: EMAIL,
          password: "valid-password",
        },
      });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), { error: "Invalid credentials" });
      assert.equal(capturedQueries.login?.where.email_tenantId.tenantId, TENANT_A_ID);
      assert.notEqual(capturedQueries.login?.where.email_tenantId.tenantId, TENANT_B_ID);
    } finally {
      await app.close();
    }
  });

  it("bootstraps sessions only with the authenticated tenant id", async () => {
    const capturedQueries: CapturedAuthQueries = {};
    const app = await buildApp(capturedQueries);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/session",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        user: { id: USER_ID, email: EMAIL, role: "ADMIN" },
        tenant: { id: TENANT_A_ID, subdomain: "tenant-a" },
      });
      assert.equal(capturedQueries.session?.where.id, USER_ID);
      assert.equal(capturedQueries.session?.where.tenantId, TENANT_A_ID);
      assert.notEqual(capturedQueries.session?.where.tenantId, TENANT_B_ID);
    } finally {
      await app.close();
    }
  });
});
