import { FastifyPluginAsync } from "fastify";
import { checkoutSessionSchema } from "@school/shared";

const CHARGILY_SECRET_KEY = process.env.CHARGILY_SECRET_KEY || "test_sk_mock";
const CHARGILY_API_URL = "https://pay.chargily.net/test/api/v2/checkouts";

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

      // Map plan to price and amount (mocking logic)
      const amount = plan === "PRO" ? 5000 : plan === "ENTERPRISE" ? 15000 : 0;
      
      if (amount === 0) {
        return reply.status(400).send({ error: "Cannot checkout free plan" });
      }

      try {
        const response = await fetch(CHARGILY_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${CHARGILY_SECRET_KEY}`,
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

        const data = await response.json() as { checkout_url: string, id: string };
        return { checkoutUrl: data.checkout_url, id: data.id };
      } catch (error) {
        request.log.error(error, "Failed to initialize payment");
        return reply.status(500).send({ error: "Internal payment processing error" });
      }
    }
  );
};

export default paymentsRoute;