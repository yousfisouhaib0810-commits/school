import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import type { Redis } from "ioredis";
import subjectRoutes from "./subjects/route.js";
import stageRoutes from "./stages/route.js";
import lessonRoutes from "./lessons/route.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_A_ITEM_ID = "44444444-4444-4444-8444-444444444444";
const TENANT_B_ITEM_ID = "55555555-5555-4555-8555-555555555555";

interface ReorderRecord {
  id: string;
  tenantId: string;
  sortOrder: number;
  deletedAt: Date | null;
}

interface UpdateManyInput {
  where: {
    id: string;
    tenantId: string;
    deletedAt: null;
  };
  data: {
    sortOrder: number;
  };
}

interface ModelStub {
  updateMany(input: UpdateManyInput): Promise<{ count: number }>;
}

interface PrismaStub {
  subject: ModelStub;
  stage: ModelStub;
  lesson: ModelStub;
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
  $transaction<T>(operations: Array<Promise<T>>): Promise<T[]>;
}

interface RedisStub {
  del(...keys: string[]): Promise<number>;
}

function toPrismaClientStub(stub: PrismaStub): PrismaClient {
  if (
    typeof stub.subject.updateMany !== "function" ||
    typeof stub.stage.updateMany !== "function" ||
    typeof stub.lesson.updateMany !== "function" ||
    typeof stub.auditLog.create !== "function" ||
    typeof stub.$transaction !== "function"
  ) {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

function toRedisStub(stub: RedisStub): Redis {
  if (typeof stub.del !== "function") {
    throw new Error("Invalid Redis test stub");
  }

  return stub as unknown as Redis;
}

function createModelStub(records: ReorderRecord[]): ModelStub {
  return {
    async updateMany(input) {
      let count = 0;
      for (const record of records) {
        if (
          record.id === input.where.id &&
          record.tenantId === input.where.tenantId &&
          record.deletedAt === input.where.deletedAt
        ) {
          record.sortOrder = input.data.sortOrder;
          count += 1;
        }
      }
      return { count };
    },
  };
}

function createPrismaStub(records: ReorderRecord[], auditActions: string[]): PrismaStub {
  const model = createModelStub(records);

  return {
    subject: model,
    stage: model,
    lesson: model,
    auditLog: {
      async create(input) {
        auditActions.push(input.data.action);
      },
    },
    async $transaction(operations) {
      return Promise.all(operations);
    },
  };
}

async function buildApp(route: FastifyPluginAsync, records: ReorderRecord[], auditActions: string[]) {
  const app = Fastify();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "TEACHER";
    request.tenantId = TENANT_A_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(records, auditActions)));
  app.decorate("redis", toRedisStub({
    async del(..._keys: string[]) {
      return 1;
    },
  }));

  await app.register(route);
  return app;
}

describe("teacher reorder routes", () => {
  const cases: Array<{ name: string; route: FastifyPluginAsync }> = [
    { name: "subjects", route: subjectRoutes },
    { name: "stages", route: stageRoutes },
    { name: "lessons", route: lessonRoutes },
  ];

  for (const testCase of cases) {
    it(`keeps ${testCase.name} reorder scoped to the authenticated tenant`, async () => {
      const records: ReorderRecord[] = [
        { id: TENANT_A_ITEM_ID, tenantId: TENANT_A_ID, sortOrder: 0, deletedAt: null },
        { id: TENANT_B_ITEM_ID, tenantId: TENANT_B_ID, sortOrder: 0, deletedAt: null },
      ];
      const auditActions: string[] = [];
      const app = await buildApp(testCase.route, records, auditActions);

      const response = await app.inject({
        method: "PATCH",
        url: "/reorder",
        payload: [
          { id: TENANT_A_ITEM_ID, sortOrder: 3 },
          { id: TENANT_B_ITEM_ID, sortOrder: 9 },
        ],
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { success: true });
      assert.equal(records[0]?.sortOrder, 3);
      assert.equal(records[1]?.sortOrder, 0);
      assert.equal(auditActions.length, 1);

      await app.close();
    });
  }
});
