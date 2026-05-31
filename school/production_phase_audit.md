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
- Tenant routes include app-level `tenantId` filters and RLS policies exist.
- Auth routes are rate-limited.

Remaining:
- Complete session bootstrap UX without exposing access tokens in API responses.
- Add a CSRF token layer if production keeps Vercel and Render as separate sites.

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

Remaining:
- The original project requirement mentions Jitsi, while current implementation uses Zoom. This needs a product decision.
- Gate student access by active subscription.

## Phase 5 - Payments

Status: partially implemented.

Evidence:
- Chérgily checkout and signed webhook exist.
- Webhook payload is now validated with Zod and uses timing-safe signature checks.
- Subscription writes are tenant-scoped.

Remaining:
- Stripe is not implemented.
- CIB/Edahabia integration is not implemented.
- Payment idempotency is incomplete.

## Phase 6 - Landing Page Builder

Status: minimally implemented.

Evidence:
- Landing pages are stored as JSON blocks.
- Render engine supports hero, pricing, text, and CTA blocks.
- Public and admin endpoints exist.

Remaining:
- Current dashboard editor is JSON-level, not a production page builder.
- Add block-level UI controls, preview, validation messages, and draft/publish workflow.

## Phase 7 - Student Portal

Status: partially implemented.

Evidence:
- Course listing and lesson playback pages exist.
- Progress endpoints exist and cache invalidation is used for lesson changes.

Remaining:
- Subscription gating for paid content and live sessions is incomplete.
- Student UX needs stronger loading/error states and session bootstrap.

## Phase 8 - Super Admin

Status: partially implemented.

Evidence:
- Super-admin tenant list and suspend/reactivate controls exist.
- API checks `SUPER_ADMIN` role.

Remaining:
- The secret admin entry path and operational login flow need hardening.
- Audit logging for admin actions is missing.

## Phase 9 - Protection, Performance, Quality

Status: partially implemented.

Evidence:
- Helmet, explicit CORS, global rate limiting, Redis cache for lesson/video list, health checks, and graceful shutdown exist.
- `pnpm type-check`, `pnpm lint`, and `pnpm build` pass locally after the latest changes.

Remaining:
- Add automated tests for auth, tenant isolation, webhooks, payments, and RLS.
- Add backup automation and observability.
- Remove remaining unsafe type assertions in frontend API parsing.
