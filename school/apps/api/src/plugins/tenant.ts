import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { tenantContext } from "./prisma.js";

const PUBLIC_PATH_PREFIXES = [
  "/api/health",
  "/api/readiness",
  "/api/auth/csrf",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/session",
  "/api/webhooks/chargily",
  "/api/super-admin"
];

const tenantHeaderSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1).transform((values) => values[0]),
]);

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
    tenantSubdomain: string;
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify) => {
  if (!fastify.hasRequestDecorator("tenantId")) fastify.decorateRequest("tenantId", "");
  fastify.decorateRequest("tenantSubdomain", "");

  fastify.addHook("onRequest", (request: FastifyRequest, reply: FastifyReply, done) => {
    if (PUBLIC_PATH_PREFIXES.some((path) => request.url.startsWith(path))) {
      return done();
    }

    const header = tenantHeaderSchema.safeParse(request.headers["x-tenant-subdomain"]);
    if (!header.success) {
      reply.status(400).send({ error: "Missing tenant subdomain (X-Tenant-Subdomain header)" });
      return done();
    }

    fastify.prisma.tenant.findFirst({
      where: { subdomain: header.data, deletedAt: null },
      select: { id: true, status: true },
    }).then((tenant) => {
      if (!tenant) {
        reply.status(404).send({ error: "Tenant not found" });
        return done();
      }

      if (tenant.status === "SUSPENDED") {
        reply.status(403).send({ error: "Account suspended" });
        return done();
      }

      request.tenantId = tenant.id;
      request.tenantSubdomain = header.data;

      tenantContext.run(tenant.id, () => {
        done();
      });
    }).catch(done);
  });
};

export default fp(tenantPlugin);
