import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { tokenPayloadSchema } from "@school/shared";
import { verifyAccessToken } from "../lib/tokens.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
    userRole: string;
    tenantId: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", "");
  fastify.decorateRequest("userRole", "");
  fastify.decorateRequest("tenantId", "");

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = request.cookies["accessToken"];
    const token = bearerToken ?? cookieToken;

    if (!token) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const decoded = tokenPayloadSchema.parse(await verifyAccessToken(token));

      request.userId = decoded.sub;
      request.userRole = decoded.role;
      request.tenantId = decoded.tenantId;
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
