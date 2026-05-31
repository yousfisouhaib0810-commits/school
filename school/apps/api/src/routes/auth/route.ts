import { FastifyPluginAsync } from "fastify";
import { loginSchema, registerSchema } from "@school/shared";
import * as argon2 from "argon2";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "../../lib/tokens.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const { tenantId } = request;

      const user = await fastify.prisma.user.findUnique({
        where: { email_tenantId: { email: body.email, tenantId } },
      });

      if (!user) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await argon2.verify(user.passwordHash, body.password);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const tokenPayload = {
        sub: user.id,
        role: user.role,
        tenantId: user.tenantId,
      };

      const accessToken = await generateAccessToken(fastify, tokenPayload);
      const refreshToken = await generateRefreshToken(fastify, tokenPayload);

      reply.setCookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      return { accessToken, user: { id: user.id, email: user.email, role: user.role } };
    }
  );

  fastify.post(
    "/register",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existingTenant = await fastify.prisma.tenant.findUnique({
      where: { subdomain: body.subdomain },
    });

    if (existingTenant) {
      return reply.status(409).send({ error: "Subdomain already taken" });
    }

    const result = await fastify.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { subdomain: body.subdomain, name: body.name },
      });

      const passwordHash = await argon2.hash(body.password);

      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          role: "ADMIN",
          tenantId: tenant.id,
        },
      });

      return { tenant, user };
    });

    const tokenPayload = {
      sub: result.user.id,
      role: result.user.role,
      tenantId: result.tenant.id,
    };

    const accessToken = await generateAccessToken(fastify, tokenPayload);
    const refreshToken = await generateRefreshToken(fastify, tokenPayload);

    reply.setCookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return {
      accessToken,
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
      tenant: { id: result.tenant.id, subdomain: result.tenant.subdomain },
    };
  });

  fastify.post(
    "/refresh",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
    const refreshToken = request.cookies["refreshToken"];

    if (!refreshToken) {
      return reply.status(401).send({ error: "No refresh token" });
    }

    const decoded = await verifyRefreshToken(refreshToken);
    if (!decoded) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }

    const tokenPayload = {
      sub: decoded.sub,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    const newAccessToken = await generateAccessToken(fastify, tokenPayload);
    const newRefreshToken = await generateRefreshToken(fastify, tokenPayload);

    reply.setCookie("refreshToken", newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return { accessToken: newAccessToken };
  });

  fastify.post(
    "/logout",
    {
      preHandler: [fastify.authenticate],
    },
    async (_request, reply) => {
      reply.clearCookie("refreshToken", { path: "/api/auth" });
      return { success: true };
    }
  );
};

export default authRoutes;
