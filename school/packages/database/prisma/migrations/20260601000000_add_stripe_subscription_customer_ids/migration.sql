ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "stripeSubscriptionId" TEXT;

CREATE INDEX "User_tenantId_stripeCustomerId_idx" ON "User"("tenantId", "stripeCustomerId");
CREATE INDEX "Subscription_tenantId_stripeSubscriptionId_idx" ON "Subscription"("tenantId", "stripeSubscriptionId");
