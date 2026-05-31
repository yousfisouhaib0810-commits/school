import { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import {
  lessonParamsSchema,
  videoProgressUpdateSchema,
  assignVideoSchema,
  videoUploadRequestSchema,
} from "@school/shared";
import { z } from "zod";
import { env } from "../../env.js";
import { canAccessPaidTenantContent } from "../../services/subscription-access.js";

const MAX_VIDEO_DURATION_SECONDS = 3600 * 4;
const PLAYBACK_TOKEN_TTL_SECONDS = 10 * 60;

const playbackParamsSchema = z.object({
  uid: z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-]+$/),
});

const cloudflareUploadResponseSchema = z.object({
  result: z.object({
    uploadURL: z.string().url(),
    uid: z.string().min(1),
  }),
});

const playbackTokenResponseSchema = z.object({
  result: z.object({
    token: z.string().min(1),
  }),
});

function isConfiguredSecret(value: string | undefined): value is string {
  return Boolean(value && !value.toLowerCase().includes("placeholder"));
}

function decodeCloudflarePrivateKey(value: string): string {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("BEGIN PRIVATE KEY")) {
    return normalized;
  }

  return Buffer.from(normalized, "base64").toString("utf8").replace(/\\n/g, "\n").trim();
}

async function generateLocalPlaybackToken(input: {
  uid: string;
  userId: string;
  tenantId: string;
  signingKeyId: string;
  privateKey: string;
}): Promise<string> {
  const privateKey = await importPKCS8(decodeCloudflarePrivateKey(input.privateKey), "RS256");
  const expiresAt = Math.floor(Date.now() / 1000) + PLAYBACK_TOKEN_TTL_SECONDS;

  return new SignJWT({
    sub: input.uid,
    kid: input.signingKeyId,
    userId: input.userId,
    tenantId: input.tenantId,
    downloadable: false,
  })
    .setProtectedHeader({ alg: "RS256", kid: input.signingKeyId })
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

const videoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const cacheKey = `tenant:${request.tenantId}:lessons`;
    const cached = await fastify.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const lessons = await fastify.prisma.lesson.findMany({
      where: {
        tenantId: request.tenantId,
        deletedAt: null,
        stage: { deletedAt: null, subject: { deletedAt: null } },
      },
      select: {
        id: true,
          title: true,
          description: true,
          videoUid: true,
          sortOrder: true,
          stage: { select: { id: true, title: true, deletedAt: true } },
      },
      orderBy: { sortOrder: "asc" },
      take: 100,
    });

    await fastify.redis.set(cacheKey, JSON.stringify(lessons), "EX", 3600);

    return lessons;
  });

  fastify.get("/:lessonId/progress", {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { lessonId } = lessonParamsSchema.parse(request.params);

    const progress = await fastify.prisma.videoProgress.findFirst({
      where: {
        tenantId: request.tenantId,
        userId: request.userId,
        lessonId,
      },
    });

    return progress || { secondsWatched: 0, isCompleted: false };
  });

  fastify.put("/:lessonId/progress", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const canAccess = await canAccessPaidTenantContent({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      userRole: request.userRole,
    });

    if (!canAccess) {
      return reply.status(402).send({ error: "Active subscription required" });
    }

    const { lessonId } = lessonParamsSchema.parse(request.params);
    const body = videoProgressUpdateSchema.parse(request.body);

    const lesson = await fastify.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        tenantId: request.tenantId,
        deletedAt: null,
        stage: { deletedAt: null, subject: { deletedAt: null } },
      },
      select: { id: true },
    });

    if (!lesson) {
      return reply.status(404).send({ error: "Lesson not found" });
    }

    const progress = await fastify.prisma.videoProgress.upsert({
      where: {
        userId_lessonId: {
          userId: request.userId,
          lessonId,
        },
      },
      create: {
        userId: request.userId,
        lessonId,
        tenantId: request.tenantId,
        secondsWatched: body.secondsWatched,
        isCompleted: body.isCompleted ?? false,
      },
      update: {
        secondsWatched: body.secondsWatched,
        isCompleted: body.isCompleted ?? false,
      },
    });

    return progress;
  });

  fastify.post("/upload-url", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const uploadRequest = videoUploadRequestSchema.parse(request.body);
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const token = env.CLOUDFLARE_STREAM_TOKEN;

    if (!accountId || !token || accountId.includes("placeholder") || token.includes("placeholder")) {
      if (env.NODE_ENV === "production") {
        return reply.status(503).send({ error: "Video upload service is not configured" });
      }
      request.log.info("Using mock Cloudflare response due to missing or placeholder credentials");
      return { 
        uploadURL: "https://mock.cloudflare.stream/upload", 
        uid: `mock-${crypto.randomUUID()}`,
      };
    }

    let response;
    try {
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
          requireSignedURLs: true,
          meta: {
            fileName: uploadRequest.fileName,
            fileSize: String(uploadRequest.fileSize),
            mimeType: uploadRequest.mimeType,
            tenantId: request.tenantId,
            uploadedBy: request.userId,
          },
        }),
      });
    } catch (error) {
      request.log.error({ error }, "Failed to fetch from Cloudflare API");
      return reply.status(500).send({ error: "Could not generate upload URL" });
    }

    if (!response.ok) {
      const errorText = await response.text();
      request.log.error({ errorText }, "Cloudflare API Error");
      return reply.status(500).send({ error: "Could not generate upload URL" });
    }

    const data = cloudflareUploadResponseSchema.parse(await response.json());
    return {
      uploadURL: data.result.uploadURL,
      uid: data.result.uid,
    };
  });

  fastify.patch("/assign", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
      return reply.status(403).send({ error: "Forbidden" });
    }
    
    const body = assignVideoSchema.parse(request.body);
    
    const lesson = await fastify.prisma.lesson.findFirst({
       where: {
         id: body.lessonId,
         tenantId: request.tenantId,
         deletedAt: null,
         stage: { deletedAt: null, subject: { deletedAt: null } },
       }
    });
    
    if (!lesson) {
        return reply.status(404).send({ error: "Lesson not found" });
    }
    
    await fastify.prisma.lesson.updateMany({
        where: { id: lesson.id, tenantId: request.tenantId },
        data: { videoUid: body.videoUid }
    });
    
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);

    return { success: true };
  });

  fastify.get("/:uid/playback-token", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { uid } = playbackParamsSchema.parse(request.params);
    const canAccess = await canAccessPaidTenantContent({
      prisma: fastify.prisma,
      tenantId: request.tenantId,
      userRole: request.userRole,
    });

    if (!canAccess) {
      return reply.status(402).send({ error: "Active subscription required" });
    }
    
    // Security Rule: Enforce tenant isolation and ownership before granting token
    const lesson = await fastify.prisma.lesson.findFirst({
        where: {
          videoUid: uid,
          tenantId: request.tenantId,
          deletedAt: null,
          stage: { deletedAt: null, subject: { deletedAt: null } },
        }
    });

    if (!lesson) {
        return reply.status(403).send({ error: "Unauthorized access to video" });
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const customerCode = env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? accountId;
    const signingKeyId = env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
    const signingPrivateKey = env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY;
    const streamToken = env.CLOUDFLARE_STREAM_TOKEN;

    if (!isConfiguredSecret(accountId) || !isConfiguredSecret(customerCode)) {
      if (env.NODE_ENV === "production") {
        return reply.status(503).send({ error: "Video playback service is not configured" });
      }

      const signedToken = `mock-signed-token-for-${uid}-${Date.now()}`;
      return {
        token: signedToken,
        url: `https://mock.cloudflare.stream/${signedToken}/iframe`,
      };
    }

    if (isConfiguredSecret(signingKeyId) && isConfiguredSecret(signingPrivateKey)) {
      const signedToken = await generateLocalPlaybackToken({
        uid,
        userId: request.userId,
        tenantId: request.tenantId,
        signingKeyId,
        privateKey: signingPrivateKey,
      });

      return {
        token: signedToken,
        url: `https://customer-${customerCode}.cloudflarestream.com/${signedToken}/iframe`,
      };
    }

    if (env.NODE_ENV === "production") {
      return reply.status(503).send({ error: "Video playback signing is not configured" });
    }

    if (isConfiguredSecret(streamToken)) {
      let response;
      try {
        response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/token`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exp: Math.floor(Date.now() / 1000) + PLAYBACK_TOKEN_TTL_SECONDS,
            downloadable: false,
          }),
        });
      } catch (error) {
        request.log.error({ error }, "Failed to fetch playback token from Cloudflare API");
        return reply.status(500).send({ error: "Could not generate playback token" });
      }

      if (!response.ok) {
        const errorText = await response.text();
        request.log.error({ errorText }, "Cloudflare playback token API error");
        return reply.status(500).send({ error: "Could not generate playback token" });
      }

      const data = playbackTokenResponseSchema.parse(await response.json());
      return {
        token: data.result.token,
        url: `https://customer-${customerCode}.cloudflarestream.com/${data.result.token}/iframe`,
      };
    }

    const signedToken = `mock-signed-token-for-${uid}-${Date.now()}`;
    return {
      token: signedToken,
      url: `https://mock.cloudflare.stream/${signedToken}/iframe`,
    };
  });
};

export default videoRoutes;
