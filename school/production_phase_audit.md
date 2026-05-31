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
- Subject, stage, and lesson create/update/delete/reorder operations now write tenant-scoped audit logs.
- Subject, stage, and lesson management now use inline forms and in-app delete confirmation instead of browser `prompt`/`confirm`.
- Automated API tests now verify subject, stage, and lesson reorder requests stay scoped to the authenticated tenant.
- Automated API tests now verify subject, stage, and lesson create, update, parent ownership checks, soft-delete cascades, lesson cache invalidation, and mutation audit events.

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
- Automated API tests now verify the Cloudflare-configured signed playback path emits a user- and tenant-bound non-downloadable RS256 token and iframe URL.

Remaining:
- Configure `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY`, and Cloudflare Stream account/customer settings in Render.

## Phase 4 - Live Sessions

Status: partially implemented.

Evidence:
- Zoom S2S meeting creation and SDK signature endpoints exist.
- Zoom config is now environment-driven and returns 503 when missing.
- Tenant filters and pagination limits are applied.
- Student live-session signatures now require a paid active tenant plan; staff roles remain allowed for hosting/admin workflows.
- Live-session creation now writes a tenant-scoped audit log.

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

Additional Phase 5 evidence after checkout-route hardening:
- Chargily checkout responses are now validated before use.
- Automated API tests now verify checkout creation sends tenant/user/plan metadata to Chargily and free plans do not call the gateway.

Remaining:
- Stripe is not implemented.
- CIB/Edahabia integration is not implemented.
- Add gateway-specific tests for Stripe and CIB/Edahabia once those providers are implemented.

## Phase 6 - Landing Page Builder

Status: minimally implemented.

Evidence:
- Landing pages are stored as JSON blocks.
- Render engine supports hero, pricing, text, and CTA blocks.
- Public and admin endpoints exist.
- Text blocks now render as escaped text instead of raw HTML.
- The dashboard editor now provides block-level controls, live preview, validation messaging, draft save, and publish actions instead of requiring raw JSON edits.
- Landing page updates now use tenant-scoped write filters, and automated API tests verify public published reads, tenant-scoped draft updates, and invalid block rejection before writes.
- Landing page create/update operations now write tenant-scoped audit logs.
- The platform landing page and auth pages now render Arabic/RTL copy correctly in production.

Remaining:
- Add browser-level landing builder workflow tests after production test users are available.

## Phase 7 - Student Portal

Status: partially implemented.

Evidence:
- Course listing and lesson playback pages exist.
- Progress endpoints exist and cache invalidation is used for lesson changes.
- Student video playback tokens and progress updates now require a paid active tenant plan.
- Student course, lesson, live-session, and profile screens now use clearer loading, empty, retryable error, and account-context states.

Remaining:
- Add browser-level student journey tests after production test users are available.

## Phase 8 - Super Admin

Status: partially implemented.

Evidence:
- Super-admin tenant list and suspend/reactivate controls exist.
- API checks `SUPER_ADMIN` role.
- Tenant status changes are now written with tenant-scoped audit log records inside the same transaction.
- Super-admin audit logs can now be queried through a paginated API and reviewed in the dashboard.
- Super-admin API access now revalidates the JWT actor against the database and rejects deleted, unverified, non-super-admin, or suspended-tenant actors before global reads.
- Super-admin tenant-list and audit-log reads are now recorded as audit events with request context metadata.
- The login flow now routes `SUPER_ADMIN` users directly to the operational `/dashboard` super-admin console.
- Tenant settings updates now write tenant-scoped audit logs.
- Automated API tests now cover stale actor rejection, non-super-admin rejection, audited global tenant reads, audited audit-log reads, and audited tenant status updates.

Remaining:
- Add browser-level super-admin login and console workflow tests after a production super-admin test account is available.
- Define any additional product-specific audit event coverage required for non-content tenant-admin operations.

## Phase 9 - Protection, Performance, Quality

Status: partially implemented.

Evidence:
- Helmet, explicit CORS, global rate limiting, Redis cache for lesson/video list, health checks, graceful shutdown, and startup retries for PostgreSQL/Redis exist.
- `/api/readiness` reports production dependency readiness for database, Redis, Resend, Cloudflare, Chérgily, and Zoom without exposing secrets.
- `/api/readiness` distinguishes invalid Resend API credentials, insufficient Resend domain-check permissions, and placeholder email sender domains.
- Database backup automation now exists through `pnpm db:backup`; it writes custom-format `pg_dump` files to `BACKUP_DIR`/`backups` without placing `DATABASE_URL` on the child process command line.
- `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally after the latest changes.
- Remaining frontend API response casts and raw HTML rendering patterns were removed from the inspected app/package source paths.
- Automated API security tests cover CSRF token validation, tamper rejection, request-level enforcement, and the intended webhook exemption.
- Auth tenant-isolation tests cover login lookup and session bootstrap tenant filters.
- Teacher dashboard API tests cover CRUD, soft-delete, reorder, tenant ownership checks, and lesson cache invalidation.
- Cloudflare playback signing tests verify configured signed iframe URLs include user and tenant binding.
- Payment tests cover Chargily checkout metadata, free-plan rejection, webhook signatures, and webhook idempotency.
- Landing builder tests cover tenant-scoped API writes and invalid block rejection; the dashboard builder now uses controls plus preview instead of JSON editing.
- Student portal pages now expose explicit loading, empty, and retryable error states for course, lesson, and live-session flows.
- Tenant middleware tests now verify `/api/readiness` is public while tenant-scoped routes still reject missing tenant headers.
- Super-admin tests now verify hardened actor revalidation and audit logging for sensitive global operations.
- Tenant-admin mutation tests now verify audit logging for subject, stage, lesson, landing-page, and tenant-settings changes.

Remaining:
- Add broader automated tests for auth edge cases, tenant isolation, webhooks, payments, and RLS.
- Add scheduled production backup execution and retention outside the app runtime.
- Add observability beyond structured logs and readiness checks.
