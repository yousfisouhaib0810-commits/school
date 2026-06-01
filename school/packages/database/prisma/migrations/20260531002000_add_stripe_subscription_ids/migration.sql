ALTER TABLE "Subscription" ADD COLUMN "stripeCheckoutSessionId" TEXT;

CREATE INDEX "Subscription_tenantId_stripeCheckoutSessionId_idx" ON "Subscription"("tenantId", "stripeCheckoutSessionId");
