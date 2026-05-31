import { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { Plan } from "@school/shared";
import { tenantContext } from "../../plugins/prisma.js";
import { env } from "../../env.js";

const rawWebhookBodySchema = z.object({
  raw: z.string().min(1),
  parsed: z.unknown(),
});

const checkoutPaidSchema = z.object({
  type: z.literal("checkout.paid"),
  data: z.object({
    id: z.string().min(1),
    metadata: z.object({
      tenantId: z.string().uuid(),
      userId: z.string().uuid(),
      plan: z.nativeEnum(Plan),
    }),
  }),
});

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const computedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const computed = Buffer.from(computedSignature);
  const received = Buffer.from(signature);
  if (computed.length !== received.length) {
    return false;
  }
  return crypto.timingSafeEqual(computed, received);
}

export const chargilyWebhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (_request, body: Buffer, done) {
      try {
        const rawBody = body.toString("utf8");
        done(null, { raw: rawBody, parsed: JSON.parse(rawBody) });
      } catch (error) {
        done(error instanceof Error ? error : new Error("Invalid JSON"), undefined);
      }
    }
  );

  fastify.post("/", async (request, reply) => {
    if (!env.CHARGILY_SECRET_KEY) {
      request.log.error("Chargily webhook secret is not configured");
      return reply.status(503).send({ error: "Payment gateway is not configured" });
    }

    const signature = request.headers["signature"];
    if (!signature || typeof signature !== "string") {
      return reply.status(400).send({ error: "Missing signature" });
    }

    const payload = rawWebhookBodySchema.parse(request.body);
    if (!verifySignature(payload.raw, signature, env.CHARGILY_SECRET_KEY)) {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const paidCheckout = checkoutPaidSchema.safeParse(payload.parsed);
    if (!paidCheckout.success) {
      return reply.status(200).send({ received: true });
    }

    const { id, metadata } = paidCheckout.data.data;
    await tenantContext.run(metadata.tenantId, async () => {
      const existing = await fastify.prisma.subscription.findFirst({
        where: { tenantId: metadata.tenantId, userId: metadata.userId, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        await fastify.prisma.subscription.updateMany({
          where: { id: existing.id, tenantId: metadata.tenantId },
          data: {
            chargilyId: id,
            plan: metadata.plan,
            status: "ACTIVE",
          },
        });
        return;
      }

      await fastify.prisma.subscription.create({
        data: {
          tenantId: metadata.tenantId,
          userId: metadata.userId,
          chargilyId: id,
          plan: metadata.plan,
          status: "ACTIVE",
        },
      });
    });

    return reply.status(200).send({ received: true });
  });
};

export default chargilyWebhookRoute;
