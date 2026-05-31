import { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { tenantContext } from "../../plugins/prisma.js";
import { Plan } from "@school/shared";

const CHARGILY_SECRET_KEY = process.env.CHARGILY_SECRET_KEY || "test_sk_mock";

export const chargilyWebhookRoute: FastifyPluginAsync = async (fastify) => {
  // Capture raw body for signature verification
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    function (req, body: string, done) {
      try {
        const json = JSON.parse(body);
        // We attach raw body to the request context safely
        done(null, { raw: body, parsed: json });
      } catch (err: unknown) {
        done(err as Error, undefined);
      }
    }
  );

  fastify.post("/", async (request, reply) => {
    const signature = request.headers["signature"];
    if (!signature || typeof signature !== "string") {
      return reply.status(400).send({ error: "Missing signature" });
    }

    const payload = request.body as { raw: string; parsed: unknown };
    
    // Verify signature
    const computedSignature = crypto
      .createHmac("sha256", CHARGILY_SECRET_KEY)
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
            await fastify.prisma.subscription.update({
               where: { id: existing.id },
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