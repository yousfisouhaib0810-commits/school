# Production Phase Audit

Current scope: phases 0-9 from `../phases_execution_plan.md`.

## Phase 0 - Foundation

Status: partially production-ready.

Evidence:
- Monorepo, pnpm workspaces, Turborepo, shared package, database package, API and web apps exist.
- Docker Compose includes Postgres, Redis, Mailpit, and Nginx.
- Prisma schema exists and now includes timestamps and soft-delete fields for tenant business models.

Remaining:
- Replace `db push` deployment with versioned Prisma migrations before serious production scale.

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
- OTP email verification flow exists and was externally tested through CSRF-protected registration up to the Resend send step.
- Academy names are now escaped before they are inserted into the OTP email HTML.

Remaining:
- Configure a verified Resend sender in Render: `RESEND_API_KEY` and `EMAIL_FROM`.
- Add focused automated tests for CSRF rejection/acceptance and tenant isolation.

## Phase 2 - Teacher Dashboard

Status: partially implemented.

Evidence:
- Subject/stage/lesson CRUD exists.
- Drag-and-drop reorder endpoints were fixed so `/reorder` is not shadowed by `/:id`.
- Soft delete is now used for subject/stage/lesson deletion.

Remaining:
- Replace prompt/confirm-based nested editors with production forms and validation feedback.
- Add focused tests for tenant isolation and reorder behaviour.

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

Remaining:
- Configure `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY`, and Cloudflare Stream account/customer settings in Render.
- Add an automated integration test for upload metadata validation and tenant-scoped playback token issuance.

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

Remaining:
- Stripe is not implemented.
- CIB/Edahabia integration is not implemented.
- Add automated webhook integration tests and gateway-specific payment provider tests.

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

Remaining:
- The secret admin entry path and operational login flow need hardening.
- Add an audit-log viewer and broaden logging to all sensitive admin actions.

## Phase 9 - Protection, Performance, Quality

Status: partially implemented.

Evidence:
- Helmet, explicit CORS, global rate limiting, Redis cache for lesson/video list, health checks, and graceful shutdown exist.
- `/api/readiness` reports production dependency readiness for database, Redis, Resend, Cloudflare, Chérgily, and Zoom without exposing secrets.
- `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally after the latest changes.
- Remaining frontend API response casts and raw HTML rendering patterns were removed from the inspected app/package source paths.
- A first automated API security test covers CSRF token validation and tamper rejection.

Remaining:
- Add broader automated tests for auth, tenant isolation, webhooks, payments, and RLS.
- Add backup automation and observability.
