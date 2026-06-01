import crypto from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@school/database";
import { Plan } from "@school/shared";
import { z } from "zod";
import { env } from "../../env.js";
import { tenantContext } from "../../plugins/prisma.js";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

const rawWebhookBodySchema = z.object({
  raw: z.string().min(1),
  parsed: z.unknown(),
});

const checkoutSessionCompletedSchema = z.object({
  id: z.string().min(1),
  type: z.literal("checkout.session.completed"),
  data: z.object({
    object: z.object({
      id: z.string().min(1),
      metadata: z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        plan: z.nativeEnum(Plan),
      }),
    }),
  }),
});

function parseStripeSignature(signatureHeader: string): { timestamp: number; signatures: string[] } | null {
  const parts = signatureHeader.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t" && value) {
      timestamp = Number(value);
    }
    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || !Number.isInteger(timestamp) || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function areSameSignature(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) {
    return false;
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parsed.timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(`${parsed.timestamp}.${rawBody}`).digest("hex");
  return parsed.signatures.some((signature) => areSameSignature(signature, expectedSignature));
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const stripeWebhookRoute: FastifyPluginAsync = async (fastify) => {
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
    if (!env.STRIPE_WEBHOOK_SECRET) {
      request.log.error("Stripe webhook secret is not configured");
      return reply.status(503).send({ error: "Payment gateway is not configured" });
    }

    const signature = request.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return reply.status(400).send({ error: "Missing signature" });
    }

    const payload = rawWebhookBodySchema.parse(request.body);
    if (!verifyStripeSignature(payload.raw, signature, env.STRIPE_WEBHOOK_SECRET)) {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const completedSession = checkoutSessionCompletedSchema.safeParse(payload.parsed);
    if (!completedSession.success) {
      return reply.status(200).send({ received: true });
    }

    const { id, type, data } = completedSession.data;
    const session = data.object;
    const metadata = session.metadata;

    await tenantContext.run(metadata.tenantId, async () => {
      try {
        await fastify.prisma.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              tenantId: metadata.tenantId,
              provider: "stripe",
              eventId: id,
              eventType: type,
            },
          });

          const existing = await tx.subscription.findFirst({
            where: { tenantId: metadata.tenantId, userId: metadata.userId, deletedAt: null },
            select: { id: true },
          });

          if (existing) {
            await tx.subscription.updateMany({
              where: { id: existing.id, tenantId: metadata.tenantId },
              data: {
                stripeCheckoutSessionId: session.id,
                plan: metadata.plan,
                status: "ACTIVE",
              },
            });
          } else {
            await tx.subscription.create({
              data: {
                tenantId: metadata.tenantId,
                userId: metadata.userId,
                stripeCheckoutSessionId: session.id,
                plan: metadata.plan,
                status: "ACTIVE",
              },
            });
          }

          await tx.tenant.updateMany({
            where: { id: metadata.tenantId, deletedAt: null },
            data: { plan: metadata.plan },
          });
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          request.log.info({ eventId: id, tenantId: metadata.tenantId }, "Duplicate Stripe webhook ignored");
          return;
        }
        throw error;
      }
    });

    return reply.status(200).send({ received: true });
  });
};

export default stripeWebhookRoute;
