import { randomUUID } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { SignJWT } from "jose";
import { z } from "zod";
import { liveSessionSchema } from "@school/shared";
import { env } from "../../env.js";
import { canAccessPaidTenantContent } from "../../services/subscription-access.js";
import { createTenantAuditLog } from "../../services/audit-log.js";

const meetingParamsSchema = z.object({ id: z.string().uuid() });
const JITSI_TOKEN_TTL_SECONDS = 60 * 60 * 2;
const JITSI_TOKEN_CLOCK_TOLERANCE_SECONDS = 10;

function isJitsiConfigured(): boolean {
  return Boolean(env.JITSI_DOMAIN && env.JITSI_APP_ID && env.JITSI_APP_SECRET);
}

function getJitsiOrigin(): URL {
  if (!env.JITSI_DOMAIN) {
    throw new Error("Jitsi domain is not configured");
  }

  const value = env.JITSI_DOMAIN.startsWith("http") ? env.JITSI_DOMAIN : `https://${env.JITSI_DOMAIN}`;
  return new URL(value);
}

function createJitsiRoomName(tenantId: string): string {
  return `tenant-${tenantId}-${randomUUID()}`;
}

async function createJitsiToken(input: {
  roomName: string;
  userId: string;
  userEmail: string;
  userName: string;
  isModerator: boolean;
}): Promise<string> {
  if (!env.JITSI_APP_ID || !env.JITSI_APP_SECRET) {
    throw new Error("Jitsi JWT is not configured");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const secret = new TextEncoder().encode(env.JITSI_APP_SECRET);

  return new SignJWT({
    aud: "jitsi",
    iss: env.JITSI_APP_ID,
    sub: getJitsiOrigin().hostname,
    room: input.roomName,
    context: {
      user: {
        id: input.userId,
        email: input.userEmail,
        name: input.userName,
        moderator: input.isModerator,
      },
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setNotBefore(issuedAt - JITSI_TOKEN_CLOCK_TOLERANCE_SECONDS)
    .setExpirationTime(issuedAt + JITSI_TOKEN_TTL_SECONDS)
    .sign(secret);
}

const liveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      if (request.userRole !== "ADMIN" && request.userRole !== "SUPER_ADMIN" && request.userRole !== "TEACHER") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      if (!isJitsiConfigured()) {
        request.log.error("Jitsi integration is not configured");
        return reply.status(503).send({ error: "Live sessions are not configured" });
      }

      const data = liveSessionSchema.parse(request.body);
      const jitsiOrigin = getJitsiOrigin();
      const roomName = createJitsiRoomName(request.tenantId);
      const joinUrl = new URL(roomName, jitsiOrigin).toString();

      const liveSession = await fastify.prisma.liveSession.create({
        data: {
          title: data.title,
          scheduledAt: new Date(data.scheduledAt),
          jitsiRoomName: roomName,
          jitsiJoinUrl: joinUrl,
          zoomMeetingId: roomName,
          zoomJoinUrl: joinUrl,
          tenantId: request.tenantId,
        },
      });

      await createTenantAuditLog({
        prisma: fastify.prisma,
        tenantId: request.tenantId,
        actorUserId: request.userId,
        action: "LIVE_SESSION_CREATED",
        entityType: "LIVE_SESSION",
        entityId: liveSession.id,
        metadata: { title: liveSession.title },
      });

      return reply.status(201).send(liveSession);
    }
  );

  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      return fastify.prisma.liveSession.findMany({
        where: { tenantId: request.tenantId, deletedAt: null },
        orderBy: { scheduledAt: "desc" },
        take: 100,
      });
    }
  );

  fastify.get(
    "/:id/signature",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!isJitsiConfigured()) {
        request.log.error("Jitsi integration is not configured");
        return reply.status(503).send({ error: "Live sessions are not configured" });
      }

      const { id } = meetingParamsSchema.parse(request.params);
      const session = await fastify.prisma.liveSession.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
        select: {
          id: true,
          jitsiRoomName: true,
          jitsiJoinUrl: true,
          zoomMeetingId: true,
          zoomJoinUrl: true,
        },
      });

      if (!session) {
        return reply.status(404).send({ error: "Live session not found" });
      }

      const isModerator =
        request.userRole === "ADMIN" || request.userRole === "TEACHER" || request.userRole === "SUPER_ADMIN";
      const canAccess = await canAccessPaidTenantContent({
        prisma: fastify.prisma,
        tenantId: request.tenantId,
        userRole: request.userRole,
      });

      if (!canAccess) {
        return reply.status(402).send({ error: "Active subscription required" });
      }

      const user = await fastify.prisma.user.findFirst({
        where: { id: request.userId, tenantId: request.tenantId, deletedAt: null },
        select: { email: true, name: true },
      });

      if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const roomName = session.jitsiRoomName ?? session.zoomMeetingId;
      const joinUrl = session.jitsiJoinUrl ?? session.zoomJoinUrl ?? new URL(roomName, getJitsiOrigin()).toString();
      const token = await createJitsiToken({
        roomName,
        userId: request.userId,
        userEmail: user.email,
        userName: user.name ?? user.email,
        isModerator,
      });

      return {
        provider: "jitsi",
        domain: getJitsiOrigin().hostname,
        roomName,
        joinUrl,
        jwt: token,
        isModerator,
      };
    }
  );
};

export default liveRoutes;
