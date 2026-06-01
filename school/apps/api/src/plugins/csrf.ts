import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { areSameCsrfToken } from "../lib/csrf.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXCLUDED_PATH_PREFIXES = ["/api/health", "/api/auth/csrf", "/api/webhooks/chargily", "/api/webhooks/stripe"];

const csrfPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) {
      return;
    }

    if (EXCLUDED_PATH_PREFIXES.some((path) => request.url.startsWith(path))) {
      return;
    }

    const headerToken = request.headers["x-csrf-token"];
    const csrfHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const csrfCookie = request.cookies["csrfToken"];

    if (!areSameCsrfToken(csrfHeader, csrfCookie)) {
      return reply.status(403).send({ error: "Invalid CSRF token" });
    }
  });
};

export default fp(csrfPlugin);
