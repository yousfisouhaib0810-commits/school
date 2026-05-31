import { FastifyPluginAsync } from "fastify";
import {
  loginSchema,
  registerSchema,
  resendEmailVerificationSchema,
  verifyEmailSchema,
} from "@school/shared";
import * as argon2 from "argon2";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "../../lib/tokens.js";
import {
  createAndSendEmailVerification,
  resendEmailVerification,
  verifyEmailCode,
} from "../../services/email-verification.js";
import { isEmailServiceConfigured } from "../../services/email.js";
import { createCsrfToken } from "../../lib/csrf.js";
import { env } from "../../env.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/csrf", async (_request, reply) => {
    const token = createCsrfToken();

    reply.setCookie("csrfToken", token, {
      path: "/",
      httpOnly: false,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 60 * 60,
    });

    return { token };
  });

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

      if (!user || user.deletedAt) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      if (!user.emailVerifiedAt) {
        return reply.status(403).send({ error: "Email verification required" });
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

      reply.setCookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
      reply.setCookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      return { user: { id: user.id, email: user.email, role: user.role } };
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

    if (!isEmailServiceConfigured()) {
      request.log.error("Email service is not configured");
      return reply.status(503).send({ error: "Verification email service is not configured" });
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

    try {
      await createAndSendEmailVerification(fastify.prisma, {
        tenantId: result.tenant.id,
        userId: result.user.id,
        email: result.user.email,
        academyName: result.tenant.name,
      });
    } catch (error) {
      request.log.error({ error, tenantId: result.tenant.id }, "Failed to send verification email");
      await fastify.prisma.$transaction([
        fastify.prisma.emailVerification.updateMany({
          where: { tenantId: result.tenant.id },
          data: { consumedAt: new Date() },
        }),
        fastify.prisma.user.updateMany({
          where: { tenantId: result.tenant.id },
          data: { deletedAt: new Date() },
        }),
        fastify.prisma.tenant.update({
          where: { id: result.tenant.id },
          data: {
            deletedAt: new Date(),
            status: "SUSPENDED",
            subdomain: `failed-${result.tenant.id}`,
          },
        }),
      ]);
      return reply.status(503).send({ error: "Verification email could not be sent" });
    }

    return {
      requiresEmailVerification: true,
      email: result.user.email,
      tenant: { id: result.tenant.id, subdomain: result.tenant.subdomain },
    };
  });

  fastify.post(
    "/verify-email",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const body = verifyEmailSchema.parse(request.body);
      const tenant = await fastify.prisma.tenant.findFirst({
        where: { subdomain: body.subdomain, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!tenant || tenant.status === "SUSPENDED") {
        return reply.status(400).send({ error: "Invalid or expired verification code" });
      }

      let verified;
      try {
        verified = await verifyEmailCode(fastify.prisma, {
          tenantId: tenant.id,
          email: body.email,
          code: body.code,
        });
      } catch {
        return reply.status(400).send({ error: "Invalid or expired verification code" });
      }

      const user = await fastify.prisma.user.findFirst({
        where: { id: verified.userId, tenantId: tenant.id, deletedAt: null },
        select: { id: true, email: true, role: true, tenantId: true },
      });

      if (!user) {
        return reply.status(400).send({ error: "Invalid or expired verification code" });
      }

      const tokenPayload = {
        sub: user.id,
        role: user.role,
        tenantId: user.tenantId,
      };

      const accessToken = await generateAccessToken(fastify, tokenPayload);
      const refreshToken = await generateRefreshToken(fastify, tokenPayload);

      reply.setCookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
      reply.setCookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      return {
        user: { id: user.id, email: user.email, role: user.role },
        tenant: { id: tenant.id, subdomain: body.subdomain },
      };
    }
  );

  fastify.post(
    "/resend-verification",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "1 minute" },
      },
    },
    async (request, _reply) => {
      const body = resendEmailVerificationSchema.parse(request.body);
      const tenant = await fastify.prisma.tenant.findFirst({
        where: { subdomain: body.subdomain, deletedAt: null },
        select: { id: true, name: true, status: true },
      });

      if (!tenant || tenant.status === "SUSPENDED") {
        return { success: true };
      }

      const user = await fastify.prisma.user.findUnique({
        where: { email_tenantId: { email: body.email, tenantId: tenant.id } },
        select: { id: true, email: true, emailVerifiedAt: true, deletedAt: true },
      });

      if (!user || user.deletedAt || user.emailVerifiedAt) {
        return { success: true };
      }

      try {
        await resendEmailVerification(fastify.prisma, {
          tenantId: tenant.id,
          userId: user.id,
          email: user.email,
          academyName: tenant.name,
        });
      } catch (error) {
        request.log.warn({ error, tenantId: tenant.id }, "Verification resend failed");
      }

      return { success: true };
    }
  );

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

    reply.setCookie("accessToken", newAccessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    reply.setCookie("refreshToken", newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return { success: true };
  });

  fastify.post(
    "/logout",
    {
      preHandler: [fastify.authenticate],
    },
    async (_request, reply) => {
      reply.clearCookie("accessToken", { path: "/" });
      reply.clearCookie("refreshToken", { path: "/api/auth" });
      return { success: true };
    }
  );
};

export default authRoutes;
