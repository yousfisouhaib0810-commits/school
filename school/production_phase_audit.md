# Production Phase Audit

Current scope: phases 0-9 from `../phases_execution_plan.md`.

## Phase 0 - Foundation

Status: partially production-ready.

Evidence:
- Monorepo, pnpm workspaces, Turborepo, shared package, database package, API and web apps exist.
- Docker Compose includes Postgres, Redis, Mailpit, and Nginx.
- Prisma schema exists and now includes timestamps and soft-delete fields for tenant business models.
- Versioned Prisma migrations now exist, and `db:deploy` uses `prisma migrate deploy` plus RLS application instead of `prisma db push`.
- The database deploy script safely baselines an existing `db push` database only when Prisma detects no schema drift.

Remaining:
- Verify the first Render deployment after the migration switch and investigate manually if the safe baseline refuses drift.

## Phase 1 - Security And Multi-Tenancy

Status: improved, not complete.

Evidence:
- Argon2 password hashing is used.
- JWT secrets are required and placeholder secrets are rejected in production.
- Refresh and access tokens are now also set in httpOnly cookies.
- Cross-site production cookies are now paired with a signed CSRF token on state-changing API requests.
- Auth responses no longer return access tokens in JSON; the frontend uses httpOnly cookies for authenticated API calls.
- `/api/auth/session` now hydrates the frontend user from the httpOnly access-token cookie after page refresh.
- Tenant routes include app-level `tenantId` filters and RLS policies exist.
- Auth routes are rate-limited.
- Automated API tests now verify request-level CSRF rejection, acceptance with matching signed tokens, and the intended webhook exemption.
- Automated API tests now verify login and session bootstrap remain scoped to the authenticated tenant.
- OTP email verification flow exists and was externally tested through CSRF-protected registration up to the Resend send step.
- Academy names are now escaped before they are inserted into the OTP email HTML.
- Password reset by email OTP is implemented for all roles within a tenant, with generic request responses to reduce account enumeration risk.
- Resend configuration now rejects placeholder sender domains such as `your-domain.com` before attempting production sends.

Remaining:
- Configure a verified Resend sender/domain in Render: replace the current placeholder `EMAIL_FROM` domain with a domain verified in Resend.

## Phase 2 - Teacher Dashboard

Status: partially implemented.

Evidence:
- Subject/stage/lesson CRUD exists.
- Drag-and-drop reorder endpoints were fixed so `/reorder` is not shadowed by `/:id`.
- Soft delete is now used for subject/stage/lesson deletion.
- Subject, stage, and lesson management now use inline forms and in-app delete confirmation instead of browser `prompt`/`confirm`.
- Automated API tests now verify subject, stage, and lesson reorder requests stay scoped to the authenticated tenant.
- Automated API tests now verify subject, stage, and lesson create, update, parent ownership checks, soft-delete cascades, and lesson cache invalidation.

Remaining:
- Add browser-level teacher dashboard workflow tests after production test users are available.

## Phase 3 - Protected Video

Status: partially implemented.

Evidence:
- Cloudflare direct upload endpoint exists.
- Production no longer returns mock upload URLs when Cloudflare is not configured.
- Playback token endpoint verifies tenant ownership before returning data.
- Upload URL requests now validate file name, MIME type, and size through the shared Zod schema.
- Production playback supports Cloudflare Stream signed iframe URLs when signing key env vars are configured.
- Student playback now renders the signed Cloudflare iframe URL instead of treating it as a raw video file.
- Watermark UI exists.
- Automated API tests now verify upload metadata validation and tenant-scoped playback token issuance.

Remaining:
- Configure `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY`, and Cloudflare Stream account/customer settings in Render.
- Add a Cloudflare-configured integration test for the signed production playback URL path.

## Phase 4 - Live Sessions

Status: partially implemented.

Evidence:
- Zoom S2S meeting creation and SDK signature endpoints exist.
- Zoom config is now environment-driven and returns 503 when missing.
- Tenant filters and pagination limits are applied.
- Student live-session signatures now require a paid active tenant plan; staff roles remain allowed for hosting/admin workflows.

Remaining:
- The original project requirement mentions Jitsi, while current implementation uses Zoom. This needs a product decision.

## Phase 5 - Payments

Status: partially implemented.

Evidence:
- Chérgily checkout and signed webhook exist.
- Webhook payload is now validated with Zod and uses timing-safe signature checks.
- Subscription writes are tenant-scoped.
- Chérgily webhook processing is now idempotent through tenant-scoped `PaymentEvent` records.
- Successful Chérgily checkout webhooks update both the subscription and the tenant plan in one transaction.
- Automated API tests now verify invalid webhook signatures are rejected without writes and duplicate Chérgily events are processed once.

Remaining:
- Stripe is not implemented.
- CIB/Edahabia integration is not implemented.
- Add checkout-route tests and gateway-specific tests for Stripe and CIB/Edahabia once those providers are implemented.

## Phase 6 - Landing Page Builder

Status: minimally implemented.

Evidence:
- Landing pages are stored as JSON blocks.
- Render engine supports hero, pricing, text, and CTA blocks.
- Public and admin endpoints exist.
- Text blocks now render as escaped text instead of raw HTML.
- The dashboard editor now validates block JSON with the shared Zod schema before saving.
- The platform landing page and auth pages now render Arabic/RTL copy correctly in production.

Remaining:
- Current dashboard editor is JSON-level, not a production page builder.
- Add block-level UI controls, preview, validation messages, and draft/publish workflow.

## Phase 7 - Student Portal

Status: partially implemented.

Evidence:
- Course listing and lesson playback pages exist.
- Progress endpoints exist and cache invalidation is used for lesson changes.
- Student video playback tokens and progress updates now require a paid active tenant plan.

Remaining:
- Student UX needs stronger loading/error states.

## Phase 8 - Super Admin

Status: partially implemented.

Evidence:
- Super-admin tenant list and suspend/reactivate controls exist.
- API checks `SUPER_ADMIN` role.
- Tenant status changes are now written with tenant-scoped audit log records inside the same transaction.
- Super-admin audit logs can now be queried through a paginated API and reviewed in the dashboard.

Remaining:
- The secret admin entry path and operational login flow need hardening.
- Broaden audit logging to all sensitive admin actions.

## Phase 9 - Protection, Performance, Quality

Status: partially implemented.

Evidence:
- Helmet, explicit CORS, global rate limiting, Redis cache for lesson/video list, health checks, graceful shutdown, and startup retries for PostgreSQL/Redis exist.
- `/api/readiness` reports production dependency readiness for database, Redis, Resend, Cloudflare, Chérgily, and Zoom without exposing secrets.
- `/api/readiness` distinguishes invalid Resend API credentials, insufficient Resend domain-check permissions, and placeholder email sender domains.
- `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally after the latest changes.
- Remaining frontend API response casts and raw HTML rendering patterns were removed from the inspected app/package source paths.
- Automated API security tests cover CSRF token validation, tamper rejection, request-level enforcement, and the intended webhook exemption.
- Auth tenant-isolation tests cover login lookup and session bootstrap tenant filters.
- Teacher dashboard API tests cover CRUD, soft-delete, reorder, tenant ownership checks, and lesson cache invalidation.
- Tenant middleware tests now verify `/api/readiness` is public while tenant-scoped routes still reject missing tenant headers.

Remaining:
- Add broader automated tests for auth edge cases, tenant isolation, webhooks, payments, and RLS.
- Add backup automation and observability.
