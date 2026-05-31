import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { liveSessionSchema } from "@school/shared";
import axios from "axios";
import { KJUR } from "jsrsasign"; 

// Environment variables fallback keys for demonstration.
// They must be part of your env.ts in standard setup
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID || "";
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || "";
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || "";
const ZOOM_SDK_KEY = process.env.ZOOM_SDK_KEY || "";
const ZOOM_SDK_SECRET = process.env.ZOOM_SDK_SECRET || "";

const getZoomAccessToken = async () => {
  const authHeader = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  try {
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
      null,
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      }
    );
    return response.data.access_token;
  } catch {
    throw new Error("Failed to authenticate with Zoom API");
  }
};

function generateSignature(meetingNumber: string, role: number): string {
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours
  
  const oHeader = { alg: 'HS256', typ: 'JWT' };
  const oPayload = {
    appKey: ZOOM_SDK_KEY,
    sdkKey: ZOOM_SDK_KEY,
    mn: meetingNumber,
    role: role,
    iat: iat,
    exp: exp,
    tokenExp: exp
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  
  return KJUR.jws.JWS.sign("HS256", sHeader, sPayload, ZOOM_SDK_SECRET);
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

      const data = liveSessionSchema.parse(request.body);

      // Create Zoom Meeting using S2S OAuth
      let zoomResponse;
      try {
        const token = await getZoomAccessToken();
        zoomResponse = await axios.post(
          "https://api.zoom.us/v2/users/me/meetings",
          {
            topic: data.title,
            type: 2, // Scheduled meeting
            start_time: data.scheduledAt,
            timezone: "UTC",
            settings: {
              host_video: true,
              participant_video: false,
              join_before_host: false,
              mute_upon_entry: true,
              waiting_room: false, // Students join directly
            },
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err: unknown) {
        request.log.error(err, "Zoom API Error");
        return reply.status(500).send({ error: "Failed to create Zoom meeting" });
      }

      const liveSession = await fastify.prisma.liveSession.create({
        data: {
          title: data.title,
          scheduledAt: new Date(data.scheduledAt),
          zoomMeetingId: zoomResponse.data.id.toString(),
          zoomJoinUrl: zoomResponse.data.join_url,
          zoomPassword: zoomResponse.data.password,
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
    async (request, _reply) => {
      const sessions = await fastify.prisma.liveSession.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { scheduledAt: "desc" },
      });
      return sessions;
    }
  );

  fastify.get(
    "/:id/signature",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      // Double-isolation applied: Checking tenantId!
      const session = await fastify.prisma.liveSession.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!session) {
        return reply.status(404).send({ error: "Live session not found" });
      }

      // Teacher/Admin has Role 1 (host), Student has Role 0 (participant)
      const isHost = request.userRole === "ADMIN" || request.userRole === "TEACHER" || request.userRole === "SUPER_ADMIN";
      const role = isHost ? 1 : 0;
      
      const signature = generateSignature(session.zoomMeetingId, role);

      return {
        signature,
        zoomMeetingId: session.zoomMeetingId,
        zoomPassword: session.zoomPassword || "",
        sdkKey: ZOOM_SDK_KEY,
      };
    }
  );
};

export default liveRoutes;
