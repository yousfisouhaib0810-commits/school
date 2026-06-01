import { FastifyPluginAsync } from "fastify";
import { checkoutSessionSchema } from "@school/shared";
import { z } from "zod";
import { env } from "../../env.js";

const PLAN_AMOUNTS_DZD = {
  PRO: 5000,
  ENTERPRISE: 15000,
} as const;

const PLAN_AMOUNTS_USD_CENTS = {
  PRO: 4900,
  ENTERPRISE: 14900,
} as const;

const STRIPE_CHECKOUT_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

const chargilyCheckoutResponseSchema = z.object({
  checkout_url: z.string().url(),
  id: z.string().min(1),
});

const stripeCheckoutResponseSchema = z.object({
  url: z.string().url(),
  id: z.string().min(1),
});

function isPaidPlan(plan: string): plan is keyof typeof PLAN_AMOUNTS_DZD {
  return plan === "PRO" || plan === "ENTERPRISE";
}

function buildStripeCheckoutBody(input: {
  plan: keyof typeof PLAN_AMOUNTS_USD_CENTS;
  successUrl: string;
  cancelUrl: string;
  tenantId: string;
  userId: string;
}): URLSearchParams {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(PLAN_AMOUNTS_USD_CENTS[input.plan]),
    "line_items[0][price_data][product_data][name]": `School Platform ${input.plan === "PRO" ? "Pro" : "Enterprise"} Plan`,
    "metadata[tenantId]": input.tenantId,
    "metadata[userId]": input.userId,
    "metadata[plan]": input.plan,
    "payment_intent_data[metadata][tenantId]": input.tenantId,
    "payment_intent_data[metadata][userId]": input.userId,
    "payment_intent_data[metadata][plan]": input.plan,
  });

  return body;
}

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
      
      const { provider, plan, successUrl, cancelUrl } = parsed.data;

      if (!isPaidPlan(plan)) {
        return reply.status(400).send({ error: "Cannot checkout free plan" });
      }

      if (provider === "STRIPE") {
        if (!env.STRIPE_SECRET_KEY) {
          request.log.error("Stripe secret key is not configured");
          return reply.status(503).send({ error: "Payment gateway is not configured" });
        }

        try {
          const response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: buildStripeCheckoutBody({
              plan,
              successUrl,
              cancelUrl,
              tenantId: request.tenantId,
              userId: request.userId,
            }).toString(),
          });

          if (!response.ok) {
            const text = await response.text();
            request.log.error({ error: text }, "Stripe Checkout Error");
            return reply.status(500).send({ error: "Payment gateway error" });
          }

          const data = stripeCheckoutResponseSchema.parse(await response.json());
          return { checkoutUrl: data.url, id: data.id };
        } catch (error) {
          request.log.error(error, "Failed to initialize Stripe payment");
          return reply.status(500).send({ error: "Internal payment processing error" });
        }
      }

      const amount = PLAN_AMOUNTS_DZD[plan];

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
