import { FastifyPluginAsync } from "fastify";
import { lessonParamsSchema, videoProgressUpdateSchema, assignVideoSchema } from "@school/shared";
import { env } from "../../env.js";

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
      where: { tenantId: request.tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        videoUid: true,
        sortOrder: true,
        stage: { select: { id: true, title: true } },
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
    const { lessonId } = lessonParamsSchema.parse(request.params);
    const body = videoProgressUpdateSchema.parse(request.body);

    const lesson = await fastify.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId: request.tenantId },
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

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const token = env.CLOUDFLARE_STREAM_TOKEN;

    if (!accountId || !token || accountId.includes("placeholder") || token.includes("placeholder")) {
      request.log.info("Using mock Cloudflare response due to missing or placeholder credentials");
      return { 
        uploadURL: "https://mock.cloudflare.stream/upload", 
        uid: "mock-" + Math.random().toString(36).slice(2) 
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
          maxDurationSeconds: 3600 * 4,
          requireSignedURLs: true,
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

    const data = await response.json() as unknown as { result: { uploadURL: string; uid: string } };
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
       where: { id: body.lessonId, tenantId: request.tenantId }
    });
    
    if (!lesson) {
        return reply.status(404).send({ error: "Lesson not found" });
    }
    
    await fastify.prisma.lesson.update({
        where: { id: lesson.id },
        data: { videoUid: body.videoUid }
    });
    
    await fastify.redis.del(`tenant:${request.tenantId}:lessons`);

    return { success: true };
  });

  fastify.get("/:uid/playback-token", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    
    // Security Rule: Enforce tenant isolation and ownership before granting token
    const lesson = await fastify.prisma.lesson.findFirst({
        where: { videoUid: uid, tenantId: request.tenantId }
    });

    if (!lesson) {
        return reply.status(403).send({ error: "Unauthorized access to video" });
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    
    // In Production: Generate signed JWT here using CF keys (pem string).
    // For now we issue a mock signed payload to satisfy requireSignedURLs architecture.
    const signedToken = `mock-signed-token-for-${uid}-${Date.now()}`;
    
    return { 
      token: signedToken,
      url: accountId && !accountId.includes("placeholder")
        ? `https://customer-${accountId}.cloudflarestream.com/${signedToken}/iframe`
        : `https://mock.cloudflare.stream/${signedToken}/iframe`
    };
  });
};

export default videoRoutes;
