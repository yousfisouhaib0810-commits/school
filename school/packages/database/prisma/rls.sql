-- Enable RLS on all tenant-scoped tables
-- Run after prisma db push / migrate

CREATE SCHEMA IF NOT EXISTS app;

-- Function to get current tenant
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Tenants table: no RLS needed (super admin access)
-- But we protect it for non-super-admin contexts

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_user ON "User";
CREATE POLICY tenant_isolation_on_user ON "User"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "EmailVerification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_emailverification ON "EmailVerification";
CREATE POLICY tenant_isolation_on_emailverification ON "EmailVerification"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_subject ON "Subject";
CREATE POLICY tenant_isolation_on_subject ON "Subject"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "Stage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_stage ON "Stage";
CREATE POLICY tenant_isolation_on_stage ON "Stage"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_lesson ON "Lesson";
CREATE POLICY tenant_isolation_on_lesson ON "Lesson"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "VideoProgress" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_videoprogress ON "VideoProgress";
CREATE POLICY tenant_isolation_on_videoprogress ON "VideoProgress"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_subscription ON "Subscription";
CREATE POLICY tenant_isolation_on_subscription ON "Subscription"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "LandingPage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_landingpage ON "LandingPage";
CREATE POLICY tenant_isolation_on_landingpage ON "LandingPage"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());

ALTER TABLE "LiveSession" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_on_livesession ON "LiveSession";
CREATE POLICY tenant_isolation_on_livesession ON "LiveSession"
  USING ("tenantId" = app.current_tenant_id())
  WITH CHECK ("tenantId" = app.current_tenant_id());
