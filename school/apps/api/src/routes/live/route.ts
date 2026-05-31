import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { liveSessionSchema } from "@school/shared";
import axios from "axios";
import { KJUR } from "jsrsasign";
import { env } from "../../env.js";

const meetingParamsSchema = z.object({ id: z.string().uuid() });
const zoomTokenResponseSchema = z.object({ access_token: z.string().min(1) });
const zoomMeetingResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  join_url: z.string().url(),
  password: z.string().optional(),
});

function isZoomConfigured(): boolean {
  return Boolean(
    env.ZOOM_ACCOUNT_ID &&
      env.ZOOM_CLIENT_ID &&
      env.ZOOM_CLIENT_SECRET &&
      env.ZOOM_SDK_KEY &&
      env.ZOOM_SDK_SECRET
  );
}

async function getZoomAccessToken(): Promise<string> {
  if (!env.ZOOM_ACCOUNT_ID || !env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    throw new Error("Zoom API is not configured");
  }

  const authHeader = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`,
    null,
    { headers: { Authorization: `Basic ${authHeader}` } }
  );
  return zoomTokenResponseSchema.parse(response.data).access_token;
}

function generateSignature(meetingNumber: string, role: number): string {
  if (!env.ZOOM_SDK_KEY || !env.ZOOM_SDK_SECRET) {
    throw new Error("Zoom SDK is not configured");
  }

  const issuedAt = Math.round(Date.now() / 1000) - 30;
  const expiresAt = issuedAt + 60 * 60 * 2;
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const payload = JSON.stringify({
    appKey: env.ZOOM_SDK_KEY,
    sdkKey: env.ZOOM_SDK_KEY,
    mn: meetingNumber,
    role,
    iat: issuedAt,
    exp: expiresAt,
    tokenExp: expiresAt,
  });

  return KJUR.jws.JWS.sign("HS256", header, payload, env.ZOOM_SDK_SECRET);
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

      if (!isZoomConfigured()) {
        request.log.error("Zoom integration is not configured");
        return reply.status(503).send({ error: "Live sessions are not configured" });
      }

      const data = liveSessionSchema.parse(request.body);

      let zoomMeeting;
      try {
        const token = await getZoomAccessToken();
        const response = await axios.post(
          "https://api.zoom.us/v2/users/me/meetings",
          {
            topic: data.title,
            type: 2,
            start_time: data.scheduledAt,
            timezone: "UTC",
            settings: {
              host_video: true,
              participant_video: false,
              join_before_host: false,
              mute_upon_entry: true,
              waiting_room: true,
            },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        zoomMeeting = zoomMeetingResponseSchema.parse(response.data);
      } catch (error) {
        request.log.error({ error }, "Zoom API error");
        return reply.status(502).send({ error: "Failed to create live session" });
      }

      const liveSession = await fastify.prisma.liveSession.create({
        data: {
          title: data.title,
          scheduledAt: new Date(data.scheduledAt),
          zoomMeetingId: String(zoomMeeting.id),
          zoomJoinUrl: zoomMeeting.join_url,
          zoomPassword: zoomMeeting.password,
          tenantId: request.tenantId,
        },
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
      if (!isZoomConfigured()) {
        request.log.error("Zoom integration is not configured");
        return reply.status(503).send({ error: "Live sessions are not configured" });
      }

      const { id } = meetingParamsSchema.parse(request.params);
      const session = await fastify.prisma.liveSession.findFirst({
        where: { id, tenantId: request.tenantId, deletedAt: null },
      });

      if (!session) {
        return reply.status(404).send({ error: "Live session not found" });
      }

      const isHost = request.userRole === "ADMIN" || request.userRole === "TEACHER" || request.userRole === "SUPER_ADMIN";
      const signature = generateSignature(session.zoomMeetingId, isHost ? 1 : 0);

      return {
        signature,
        zoomMeetingId: session.zoomMeetingId,
        zoomPassword: session.zoomPassword ?? "",
        sdkKey: env.ZOOM_SDK_KEY,
      };
    }
  );
};

export default liveRoutes;
