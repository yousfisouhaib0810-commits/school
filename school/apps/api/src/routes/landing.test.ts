import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import { landingPageSchema, type LandingPageInput } from "@school/shared";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PAGE_ID = "44444444-4444-4444-8444-444444444444";

interface LandingPageRecord extends LandingPageInput {
  id: string;
  tenantId: string;
  deletedAt: Date | null;
}

interface LandingPageFindFirstInput {
  where: {
    id?: string;
    tenantId: string;
    published?: boolean;
    deletedAt: null;
  };
}

interface LandingPageUpdateManyInput {
  where: {
    id: string;
    tenantId: string;
    deletedAt: null;
  };
  data: LandingPageInput;
}

interface LandingPageCreateInput {
  data: LandingPageInput & {
    tenantId: string;
  };
}

interface LandingPageModelStub {
  findFirst(input: LandingPageFindFirstInput): Promise<LandingPageRecord | null>;
  updateMany(input: LandingPageUpdateManyInput): Promise<{ count: number }>;
  create(input: LandingPageCreateInput): Promise<LandingPageRecord>;
}

interface PrismaStub {
  landingPage: LandingPageModelStub;
  auditLog: {
    create(input: {
      data: {
        tenantId: string;
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: unknown;
      };
    }): Promise<void>;
  };
}

interface CapturedQueries {
  update?: LandingPageUpdateManyInput;
  auditActions: string[];
}

function createPayload(published: boolean): LandingPageInput {
  return {
    published,
    blocks: [
      {
        type: "hero",
        props: {
          title: "Academy",
          subtitle: "Learn safely",
          bg: "#ffffff",
        },
      },
    ],
  };
}

function createRecords(): LandingPageRecord[] {
  return [
    {
      id: PAGE_ID,
      tenantId: TENANT_ID,
      deletedAt: null,
      ...createPayload(false),
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      tenantId: OTHER_TENANT_ID,
      deletedAt: null,
      ...createPayload(true),
    },
  ];
}

function createPrismaStub(records: LandingPageRecord[], capturedQueries: CapturedQueries): PrismaStub {
  return {
    landingPage: {
      async findFirst(input) {
        return (
          records.find((record) => {
            const matchesPublished = input.where.published === undefined || record.published === input.where.published;
            const matchesId = input.where.id === undefined || record.id === input.where.id;
            return (
              record.tenantId === input.where.tenantId &&
              record.deletedAt === input.where.deletedAt &&
              matchesPublished &&
              matchesId
            );
          }) ?? null
        );
      },
      async updateMany(input) {
        capturedQueries.update = input;
        const record = records.find(
          (item) =>
            item.id === input.where.id &&
            item.tenantId === input.where.tenantId &&
            item.deletedAt === input.where.deletedAt
        );
        if (!record) {
          return { count: 0 };
        }

        record.blocks = input.data.blocks;
        record.published = input.data.published;
        return { count: 1 };
      },
      async create(input) {
        const record: LandingPageRecord = {
          id: "66666666-6666-4666-8666-666666666666",
          tenantId: input.data.tenantId,
          deletedAt: null,
          blocks: input.data.blocks,
          published: input.data.published,
        };
        records.push(record);
        return record;
      },
    },
    auditLog: {
      async create(input) {
        capturedQueries.auditActions.push(input.data.action);
      },
    },
  };
}

function toPrismaClientStub(stub: PrismaStub): PrismaClient {
  if (
    typeof stub.landingPage.findFirst !== "function" ||
    typeof stub.landingPage.updateMany !== "function" ||
    typeof stub.landingPage.create !== "function" ||
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

async function loadLandingRoutes(): Promise<FastifyPluginAsync> {
  const routeModule = await import("./landing/route.js");
  const routeCandidate = unwrapDefaultExport(routeModule);
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid landing route plugin");
  }

  return routeCandidate as FastifyPluginAsync;
}

async function buildApp(records: LandingPageRecord[], capturedQueries: CapturedQueries) {
  const app = Fastify();
  const landingRoutes = await loadLandingRoutes();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "ADMIN";
    request.tenantId = TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(records, capturedQueries)));
  app.addHook("preHandler", async (request) => {
    if (!request.tenantId) {
      request.tenantId = TENANT_ID;
    }
  });

  await app.register(landingRoutes);
  return app;
}

describe("landing routes", () => {
  it("returns only the published landing page for the current tenant", async () => {
    const records = createRecords();
    records[0] = { ...records[0], published: true };
    const app = await buildApp(records, { auditActions: [] });

    try {
      const response = await app.inject({ method: "GET", url: "/" });
      const envelope = landingPageSchema.parse(response.json().data);

      assert.equal(response.statusCode, 200);
      assert.equal(envelope.published, true);
      assert.equal(envelope.blocks[0]?.type, "hero");
    } finally {
      await app.close();
    }
  });

  it("updates drafts with a tenant-scoped update query", async () => {
    const records = createRecords();
    const capturedQueries: CapturedQueries = { auditActions: [] };
    const app = await buildApp(records, capturedQueries);
    const payload = createPayload(true);

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/",
        payload,
      });
      const envelope = landingPageSchema.parse(response.json().data);

      assert.equal(response.statusCode, 200);
      assert.equal(envelope.published, true);
      assert.equal(capturedQueries.update?.where.id, PAGE_ID);
      assert.equal(capturedQueries.update?.where.tenantId, TENANT_ID);
      assert.notEqual(capturedQueries.update?.where.tenantId, OTHER_TENANT_ID);
      assert.deepEqual(capturedQueries.auditActions, ["LANDING_PAGE_UPDATED"]);
    } finally {
      await app.close();
    }
  });

  it("rejects invalid landing blocks before writing", async () => {
    const records = createRecords();
    const capturedQueries: CapturedQueries = { auditActions: [] };
    const app = await buildApp(records, capturedQueries);

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/",
        payload: {
          published: true,
          blocks: [{ type: "script", props: { content: "<script>alert(1)</script>" } }],
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), { error: "Invalid landing page data" });
      assert.equal(capturedQueries.update, undefined);
      assert.deepEqual(capturedQueries.auditActions, []);
    } finally {
      await app.close();
    }
  });
});
