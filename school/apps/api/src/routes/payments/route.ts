import { FastifyPluginAsync } from "fastify";
import { checkoutSessionSchema } from "@school/shared";
import { z } from "zod";
import { env } from "../../env.js";

const PLAN_AMOUNTS_DZD = {
  PRO: 5000,
  ENTERPRISE: 15000,
} as const;

const chargilyCheckoutResponseSchema = z.object({
  checkout_url: z.string().url(),
  id: z.string().min(1),
});

export const paymentsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/checkout",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parsed = checkoutSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payment request parameters" });
      }
      
      const { plan, successUrl, cancelUrl } = parsed.data;

      const amount = plan === "PRO" || plan === "ENTERPRISE" ? PLAN_AMOUNTS_DZD[plan] : 0;
      
      if (amount === 0) {
        return reply.status(400).send({ error: "Cannot checkout free plan" });
      }

      if (!env.CHARGILY_SECRET_KEY) {
        request.log.error("Chargily secret key is not configured");
        return reply.status(503).send({ error: "Payment gateway is not configured" });
      }

      try {
        const response = await fetch(env.CHARGILY_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.CHARGILY_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            currency: "dzd",
            success_url: successUrl,
            failure_url: cancelUrl,
            metadata: {
               tenantId: request.tenantId,
               userId: request.userId,
               plan
            }
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          request.log.error({ error: text }, "Chargily Checkout Error");
          return reply.status(500).send({ error: "Payment gateway error" });
        }

        const data = chargilyCheckoutResponseSchema.parse(await response.json());
        return { checkoutUrl: data.checkout_url, id: data.id };
      } catch (error) {
        request.log.error(error, "Failed to initialize payment");
        return reply.status(500).send({ error: "Internal payment processing error" });
      }
    }
  );
};

export default paymentsRoute;
