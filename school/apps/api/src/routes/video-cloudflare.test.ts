import assert from "node:assert/strict";
import crypto from "node:crypto";
import { before, describe, it } from "node:test";
import { importSPKI, jwtVerify } from "jose";
import Fastify, { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@school/database";
import { z } from "zod";
import errorHandlerPlugin from "../plugins/error-handler.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OWN_VIDEO_UID = "tenant_owned_video";
const SIGNING_KEY_ID = "test-signing-key";
const CUSTOMER_CODE = "testcustomer";

let publicKeyPem = "";

const playbackResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
});

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

async function loadVideoRoutes(): Promise<FastifyPluginAsync> {
  const videoRouteModule = await import("./video/route.js");
  const routeCandidate = unwrapDefaultExport(videoRouteModule);
  if (typeof routeCandidate !== "function") {
    throw new Error("Invalid video route plugin");
  }

  return routeCandidate as FastifyPluginAsync;
}

async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();
  const videoRoutes = await loadVideoRoutes();

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
  const keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  publicKeyPem = keyPair.publicKey;
  process.env.DATABASE_URL = "postgresql://school:test@localhost:5432/school";
  process.env.JWT_SECRET = "test-access-secret-with-more-than-32-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-more-than-32-characters";
  process.env.NODE_ENV = "production";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = CUSTOMER_CODE;
  process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = SIGNING_KEY_ID;
  process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY = keyPair.privateKey;
  delete process.env.CLOUDFLARE_STREAM_TOKEN;
});

describe("Cloudflare playback signing", () => {
  it("issues a tenant- and user-bound signed Cloudflare iframe URL when signing keys are configured", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/${OWN_VIDEO_UID}/playback-token`,
      });
      const body = playbackResponseSchema.parse(response.json());

      assert.equal(response.statusCode, 200);
      assert.equal(
        body.url,
        `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${body.token}/iframe`
      );

      const publicKey = await importSPKI(publicKeyPem, "RS256");
      const verified = await jwtVerify(body.token, publicKey);

      assert.equal(verified.protectedHeader.alg, "RS256");
      assert.equal(verified.protectedHeader.kid, SIGNING_KEY_ID);
      assert.equal(verified.payload.sub, OWN_VIDEO_UID);
      assert.equal(verified.payload.kid, SIGNING_KEY_ID);
      assert.equal(verified.payload.userId, USER_ID);
      assert.equal(verified.payload.tenantId, TENANT_ID);
      assert.equal(verified.payload.downloadable, false);
    } finally {
      await app.close();
    }
  });
});
