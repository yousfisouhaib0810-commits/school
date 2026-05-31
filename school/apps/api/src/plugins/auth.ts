import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { jwtVerify } from "jose";
import { tokenPayloadSchema } from "@school/shared";

import { env } from "../env.js";

const accessSecret = new TextEncoder().encode(env.JWT_SECRET);

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
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const { payload } = await jwtVerify(authHeader.slice(7), accessSecret);
      const decoded = tokenPayloadSchema.parse(payload);

      request.userId = decoded.sub;
      request.userRole = decoded.role;
      request.tenantId = decoded.tenantId;
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
