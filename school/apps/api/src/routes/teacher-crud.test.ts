import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import type { Redis } from "ioredis";
import { z } from "zod";
import subjectRoutes from "./subjects/route.js";
import stageRoutes from "./stages/route.js";
import lessonRoutes from "./lessons/route.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUBJECT_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_SUBJECT_ID = "55555555-5555-4555-8555-555555555555";
const STAGE_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_STAGE_ID = "77777777-7777-4777-8777-777777777777";
const LESSON_ID = "88888888-8888-4888-8888-888888888888";

interface SubjectRecord {
  id: string;
  tenantId: string;
  title: string;
  color: string;
  sortOrder: number;
  deletedAt: Date | null;
}

interface StageRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  title: string;
  sortOrder: number;
  deletedAt: Date | null;
}

interface LessonRecord {
  id: string;
  tenantId: string;
  stageId: string;
  title: string;
  description?: string;
  videoUid?: string;
  sortOrder: number;
  deletedAt: Date | null;
}

interface TeacherCrudStore {
  subjects: SubjectRecord[];
  stages: StageRecord[];
  lessons: LessonRecord[];
  redisDeletes: string[];
  auditActions: string[];
}

interface UpdateManyResult {
  count: number;
}

const subjectRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  color: z.string(),
  sortOrder: z.number(),
  deletedAt: z.string().nullable(),
});

const stageRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string(),
  sortOrder: z.number(),
  deletedAt: z.string().nullable(),
});

const lessonRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  stageId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  videoUid: z.string().optional(),
  sortOrder: z.number(),
  deletedAt: z.string().nullable(),
});

function createStore(): TeacherCrudStore {
  return {
    subjects: [
      { id: SUBJECT_ID, tenantId: TENANT_ID, title: "Math", color: "#3B82F6", sortOrder: 0, deletedAt: null },
      {
        id: OTHER_SUBJECT_ID,
        tenantId: OTHER_TENANT_ID,
        title: "Foreign",
        color: "#3B82F6",
        sortOrder: 0,
        deletedAt: null,
      },
    ],
    stages: [
      { id: STAGE_ID, tenantId: TENANT_ID, subjectId: SUBJECT_ID, title: "Year 1", sortOrder: 0, deletedAt: null },
      {
        id: OTHER_STAGE_ID,
        tenantId: OTHER_TENANT_ID,
        subjectId: OTHER_SUBJECT_ID,
        title: "Foreign stage",
        sortOrder: 0,
        deletedAt: null,
      },
    ],
    lessons: [
      { id: LESSON_ID, tenantId: TENANT_ID, stageId: STAGE_ID, title: "Intro", sortOrder: 0, deletedAt: null },
    ],
    redisDeletes: [],
    auditActions: [],
  };
}

function matchesTenantRecord(record: { id: string; tenantId: string; deletedAt: Date | null }, where: {
  id: string;
  tenantId: string;
  deletedAt: null;
}): boolean {
  return record.id === where.id && record.tenantId === where.tenantId && record.deletedAt === where.deletedAt;
}

function softDeleteSubjects(store: TeacherCrudStore, where: { id: string; tenantId: string; deletedAt: null }): UpdateManyResult {
  let count = 0;
  for (const subject of store.subjects) {
    if (matchesTenantRecord(subject, where)) {
      subject.deletedAt = new Date();
      count += 1;
    }
  }
  return { count };
}

function softDeleteLessonsBySubject(store: TeacherCrudStore, subjectId: string): UpdateManyResult {
  const stageIds = new Set(store.stages.filter((stage) => stage.subjectId === subjectId).map((stage) => stage.id));
  let count = 0;
  for (const lesson of store.lessons) {
    if (stageIds.has(lesson.stageId) && lesson.tenantId === TENANT_ID && lesson.deletedAt === null) {
      lesson.deletedAt = new Date();
      count += 1;
    }
  }
  return { count };
}

function createPrismaStub(store: TeacherCrudStore) {
  return {
    subject: {
      async count(input: { where: { tenantId: string; deletedAt: null } }) {
        return store.subjects.filter(
          (subject) => subject.tenantId === input.where.tenantId && subject.deletedAt === input.where.deletedAt
        ).length;
      },
      async create(input: { data: Omit<SubjectRecord, "id" | "deletedAt"> }) {
        const subject = { id: "99999999-9999-4999-8999-999999999999", ...input.data, deletedAt: null };
        store.subjects.push(subject);
        return subject;
      },
      async findFirst(input: { where: { id: string; tenantId: string; deletedAt: null } }) {
        return store.subjects.find((subject) => matchesTenantRecord(subject, input.where)) ?? null;
      },
      async updateMany(input: { where: { id: string; tenantId: string; deletedAt: null }; data: Partial<SubjectRecord> }) {
        if ("deletedAt" in input.data) {
          return softDeleteSubjects(store, input.where);
        }
        const subject = store.subjects.find((record) => matchesTenantRecord(record, input.where));
        if (!subject) {
          return { count: 0 };
        }
        Object.assign(subject, input.data);
        return { count: 1 };
      },
    },
    stage: {
      async count(input: { where: { subjectId: string; tenantId: string; deletedAt: null } }) {
        return store.stages.filter(
          (stage) =>
            stage.subjectId === input.where.subjectId &&
            stage.tenantId === input.where.tenantId &&
            stage.deletedAt === input.where.deletedAt
        ).length;
      },
      async create(input: { data: Omit<StageRecord, "id" | "deletedAt"> }) {
        const stage = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ...input.data, deletedAt: null };
        store.stages.push(stage);
        return stage;
      },
      async findFirst(input: { where: { id: string; tenantId: string; deletedAt: null } }) {
        return store.stages.find((stage) => matchesTenantRecord(stage, input.where)) ?? null;
      },
      async updateMany(input: {
        where: { id?: string; subjectId?: string; tenantId?: string; deletedAt: null };
        data: Partial<StageRecord>;
      }) {
        let count = 0;
        for (const stage of store.stages) {
          const matches =
            stage.deletedAt === input.where.deletedAt &&
            (!input.where.id || stage.id === input.where.id) &&
            (!input.where.subjectId || stage.subjectId === input.where.subjectId) &&
            (!input.where.tenantId || stage.tenantId === input.where.tenantId);
          if (matches) {
            Object.assign(stage, input.data);
            count += 1;
          }
        }
        return { count };
      },
    },
    lesson: {
      async count(input: { where: { stageId: string; tenantId: string; deletedAt: null } }) {
        return store.lessons.filter(
          (lesson) =>
            lesson.stageId === input.where.stageId &&
            lesson.tenantId === input.where.tenantId &&
            lesson.deletedAt === input.where.deletedAt
        ).length;
      },
      async create(input: { data: Omit<LessonRecord, "id" | "deletedAt"> }) {
        const lesson = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ...input.data, deletedAt: null };
        store.lessons.push(lesson);
        return lesson;
      },
      async findFirst(input: { where: { id: string; tenantId: string; deletedAt: null } }) {
        return store.lessons.find((lesson) => matchesTenantRecord(lesson, input.where)) ?? null;
      },
      async updateMany(input: {
        where: {
          id?: string;
          stageId?: string;
          tenantId: string;
          deletedAt: null;
          stage?: { subjectId: string };
        };
        data: Partial<LessonRecord>;
      }) {
        if (input.where.stage?.subjectId) {
          return softDeleteLessonsBySubject(store, input.where.stage.subjectId);
        }
        let count = 0;
        for (const lesson of store.lessons) {
          const matches =
            lesson.tenantId === input.where.tenantId &&
            lesson.deletedAt === input.where.deletedAt &&
            (!input.where.id || lesson.id === input.where.id) &&
            (!input.where.stageId || lesson.stageId === input.where.stageId);
          if (matches) {
            Object.assign(lesson, input.data);
            count += 1;
          }
        }
        return { count };
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
        store.auditActions.push(input.data.action);
      },
    },
    async $transaction<T>(operations: Array<Promise<T>>) {
      return Promise.all(operations);
    },
  };
}

function toPrismaClientStub(stub: ReturnType<typeof createPrismaStub>): PrismaClient {
  if (
    typeof stub.subject.count !== "function" ||
    typeof stub.subject.create !== "function" ||
    typeof stub.subject.findFirst !== "function" ||
    typeof stub.subject.updateMany !== "function" ||
    typeof stub.stage.count !== "function" ||
    typeof stub.stage.create !== "function" ||
    typeof stub.stage.findFirst !== "function" ||
    typeof stub.stage.updateMany !== "function" ||
    typeof stub.lesson.count !== "function" ||
    typeof stub.lesson.create !== "function" ||
    typeof stub.lesson.findFirst !== "function" ||
    typeof stub.lesson.updateMany !== "function" ||
    typeof stub.auditLog.create !== "function" ||
    typeof stub.$transaction !== "function"
  ) {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

function toRedisStub(store: TeacherCrudStore): Redis {
  const stub = {
    async del(...keys: string[]) {
      store.redisDeletes.push(...keys);
      return keys.length;
    },
  };

  if (typeof stub.del !== "function") {
    throw new Error("Invalid Redis test stub");
  }

  return stub as unknown as Redis;
}

async function buildApp(route: FastifyPluginAsync, store: TeacherCrudStore) {
  const app = Fastify();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "TEACHER";
    request.tenantId = TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub(store)));
  app.decorate("redis", toRedisStub(store));

  await app.register(route);
  return app;
}

describe("teacher CRUD routes", () => {
  it("creates, updates, and soft-deletes subjects and their children within the tenant", async () => {
    const store = createStore();
    const app = await buildApp(subjectRoutes, store);

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/",
        payload: { title: "Physics", color: "#22C55E" },
      });
      const created = subjectRecordSchema.parse(createResponse.json());

      assert.equal(createResponse.statusCode, 201);
      assert.equal(created.tenantId, TENANT_ID);
      assert.equal(created.sortOrder, 1);

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/${SUBJECT_ID}`,
        payload: { title: "Advanced Math" },
      });

      assert.equal(updateResponse.statusCode, 200);
      assert.equal(subjectRecordSchema.parse(updateResponse.json()).title, "Advanced Math");

      const deleteResponse = await app.inject({ method: "DELETE", url: `/${SUBJECT_ID}` });

      assert.equal(deleteResponse.statusCode, 200);
      assert.notEqual(store.subjects.find((subject) => subject.id === SUBJECT_ID)?.deletedAt, null);
      assert.notEqual(store.stages.find((stage) => stage.id === STAGE_ID)?.deletedAt, null);
      assert.notEqual(store.lessons.find((lesson) => lesson.id === LESSON_ID)?.deletedAt, null);
      assert.equal(store.subjects.find((subject) => subject.id === OTHER_SUBJECT_ID)?.deletedAt, null);
      assert.deepEqual(store.auditActions, ["SUBJECT_CREATED", "SUBJECT_UPDATED", "SUBJECT_DELETED"]);
    } finally {
      await app.close();
    }
  });

  it("creates, updates, and soft-deletes stages only under tenant-owned subjects", async () => {
    const store = createStore();
    const app = await buildApp(stageRoutes, store);

    try {
      const foreignCreateResponse = await app.inject({
        method: "POST",
        url: "/",
        payload: { subjectId: OTHER_SUBJECT_ID, title: "Foreign" },
      });

      assert.equal(foreignCreateResponse.statusCode, 404);
      assert.deepEqual(foreignCreateResponse.json(), { error: "Subject not found" });

      const createResponse = await app.inject({
        method: "POST",
        url: "/",
        payload: { subjectId: SUBJECT_ID, title: "Year 2" },
      });
      const created = stageRecordSchema.parse(createResponse.json());

      assert.equal(createResponse.statusCode, 201);
      assert.equal(created.tenantId, TENANT_ID);
      assert.equal(created.sortOrder, 1);

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/${STAGE_ID}`,
        payload: { title: "Updated year" },
      });

      assert.equal(updateResponse.statusCode, 200);
      assert.equal(stageRecordSchema.parse(updateResponse.json()).title, "Updated year");

      const deleteResponse = await app.inject({ method: "DELETE", url: `/${STAGE_ID}` });

      assert.equal(deleteResponse.statusCode, 200);
      assert.notEqual(store.stages.find((stage) => stage.id === STAGE_ID)?.deletedAt, null);
      assert.notEqual(store.lessons.find((lesson) => lesson.id === LESSON_ID)?.deletedAt, null);
      assert.equal(store.stages.find((stage) => stage.id === OTHER_STAGE_ID)?.deletedAt, null);
      assert.deepEqual(store.auditActions, ["STAGE_CREATED", "STAGE_UPDATED", "STAGE_DELETED"]);
    } finally {
      await app.close();
    }
  });

  it("creates, updates, and soft-deletes lessons only under tenant-owned stages", async () => {
    const store = createStore();
    const app = await buildApp(lessonRoutes, store);

    try {
      const foreignCreateResponse = await app.inject({
        method: "POST",
        url: "/",
        payload: { stageId: OTHER_STAGE_ID, title: "Foreign" },
      });

      assert.equal(foreignCreateResponse.statusCode, 404);
      assert.deepEqual(foreignCreateResponse.json(), { error: "Stage not found" });

      const createResponse = await app.inject({
        method: "POST",
        url: "/",
        payload: { stageId: STAGE_ID, title: "Derivatives", description: "Intro" },
      });
      const created = lessonRecordSchema.parse(createResponse.json());

      assert.equal(createResponse.statusCode, 201);
      assert.equal(created.tenantId, TENANT_ID);
      assert.equal(created.sortOrder, 1);

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/${LESSON_ID}`,
        payload: { title: "Updated lesson" },
      });

      assert.equal(updateResponse.statusCode, 200);
      assert.equal(lessonRecordSchema.parse(updateResponse.json()).title, "Updated lesson");

      const deleteResponse = await app.inject({ method: "DELETE", url: `/${LESSON_ID}` });

      assert.equal(deleteResponse.statusCode, 200);
      assert.notEqual(store.lessons.find((lesson) => lesson.id === LESSON_ID)?.deletedAt, null);
      assert.deepEqual(store.redisDeletes, [
        `tenant:${TENANT_ID}:lessons`,
        `tenant:${TENANT_ID}:lessons`,
        `tenant:${TENANT_ID}:lessons`,
      ]);
      assert.deepEqual(store.auditActions, ["LESSON_CREATED", "LESSON_UPDATED", "LESSON_DELETED"]);
    } finally {
      await app.close();
    }
  });
});
