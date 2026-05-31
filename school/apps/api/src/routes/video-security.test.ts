import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import errorHandlerPlugin from "../plugins/error-handler.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OWN_VIDEO_UID = "tenant_owned_video";

interface LessonFindFirstInput {
  where: {
    videoUid?: string;
    tenantId: string;
    deletedAt: null;
  };
}

interface PrismaStub {
  lesson: {
    findFirst(input: LessonFindFirstInput): Promise<{ id: string } | null>;
  };
}

function toPrismaClientStub(stub: PrismaStub): PrismaClient {
  if (typeof stub.lesson.findFirst !== "function") {
    throw new Error("Invalid Prisma test stub");
  }

  return stub as unknown as PrismaClient;
}

function createPrismaStub(): PrismaStub {
  return {
    lesson: {
      async findFirst(input) {
        if (input.where.tenantId === TENANT_ID && input.where.videoUid === OWN_VIDEO_UID) {
          return { id: "33333333-3333-4333-8333-333333333333" };
        }
        return null;
      },
    },
  };
}

async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const videoRouteModule = await import("./video/route.js");
  const videoRoutesCandidate: unknown = videoRouteModule.default;
  if (typeof videoRoutesCandidate !== "function") {
    throw new Error("Invalid video route plugin");
  }
  const videoRoutes = videoRoutesCandidate as FastifyPluginAsync;
  const app = Fastify();

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "");
  app.decorateRequest("tenantId", "");
  app.decorate("authenticate", async (request) => {
    request.userId = USER_ID;
    request.userRole = "TEACHER";
    request.tenantId = TENANT_ID;
  });
  app.decorate("prisma", toPrismaClientStub(createPrismaStub()));

  await app.register(errorHandlerPlugin);
  await app.register(videoRoutes);
  return app;
}

before(() => {
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "test";
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_STREAM_TOKEN;
  delete process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  delete process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY;
});

describe("video security routes", () => {
  it("rejects invalid upload metadata before creating an upload URL", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/upload-url",
      payload: {
        fileName: "../lesson.mp4",
        fileSize: 1024,
        mimeType: "application/x-msdownload",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "Validation error");

    await app.close();
  });

  it("does not issue playback tokens for videos outside the authenticated tenant", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/foreign_video/playback-token",
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: "Unauthorized access to video" });

    await app.close();
  });

  it("issues a non-downloadable mock playback URL only after tenant ownership is confirmed", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/${OWN_VIDEO_UID}/playback-token`,
    });
    const body = response.json() as { token?: string; url?: string };

    assert.equal(response.statusCode, 200);
    assert.match(body.token ?? "", /^mock-signed-token-for-tenant_owned_video-/);
    assert.match(body.url ?? "", /^https:\/\/mock\.cloudflare\.stream\/mock-signed-token-for-tenant_owned_video-/);

    await app.close();
  });
});
