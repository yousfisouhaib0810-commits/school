import { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { tenantContext } from "../../plugins/prisma.js";
import { Plan } from "@school/shared";
import { env } from "../../env.js";

export const chargilyWebhookRoute: FastifyPluginAsync = async (fastify) => {
  // Capture raw body as buffer for signature verification (Fastify 5 requires "buffer")
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (req, body: Buffer, done) {
      try {
        const rawBody = body.toString("utf8");
        const json = JSON.parse(rawBody);
        done(null, { raw: rawBody, parsed: json });
      } catch (err: unknown) {
        done(err as Error, undefined);
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

    const payload = request.body as { raw: string; parsed: unknown };
    
    // Verify signature
    const computedSignature = crypto
      .createHmac("sha256", env.CHARGILY_SECRET_KEY)
      .update(payload.raw)
      .digest("hex");

    if (
      computedSignature.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature))
    ) {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const data = payload.parsed as Record<string, unknown>;
    
    if (data.type === "checkout.paid") {
      const checkout = data.data as Record<string, unknown>;
      const metadata = checkout.metadata as Record<string, string>;
      
      if (!metadata || !metadata.tenantId || !metadata.userId || !metadata.plan) {
         request.log.warn({ checkoutId: checkout.id }, "Missing metadata on paid checkout");
         return reply.status(200).send({ received: true });
      }

      await tenantContext.run(metadata.tenantId, async () => {
         // Create or update subscription
         const existing = await fastify.prisma.subscription.findFirst({
            where: { tenantId: metadata.tenantId, userId: metadata.userId }
         });

         if (existing) {
            await fastify.prisma.subscription.updateMany({
               where: { id: existing.id, tenantId: metadata.tenantId },
               data: {
                  chargilyId: checkout.id as string,
                  plan: metadata.plan as Plan,
                  status: "ACTIVE"
               }
            });
         } else {
            await fastify.prisma.subscription.create({
               data: {
                  tenantId: metadata.tenantId,
                  userId: metadata.userId,
                  chargilyId: checkout.id as string,
                  plan: metadata.plan as Plan,
                  status: "ACTIVE"
               }
            });
         }
      });
    }

    return reply.status(200).send({ received: true });
  });
};

export default chargilyWebhookRoute;
