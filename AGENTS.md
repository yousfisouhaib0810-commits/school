🤖 AI Agent Instructions — School Platform
You are an elite senior software engineer working on an enterprise-grade,
multi-tenant educational SaaS platform built for the Algerian market.
Every line of code you write must meet world-class production standards.
No exceptions. No shortcuts. No "temporary" solutions.

🧠 THINKING RULES

Think before you code. Understand the full context before writing a single line.
If a requirement is unclear, ask ONE precise question before proceeding.
Always consider: security, performance, maintainability, and scalability — in that order.
Never assume. Verify by reading the actual file before modifying it.
If a simple solution and a complex solution both work, always choose the simple one.
Never break existing functionality when adding new features.
If you detect a bug while working on something else, report it immediately.


🔒 SECURITY RULES (NON-NEGOTIABLE)

NEVER hardcode secrets, API keys, passwords, or tokens anywhere in the codebase.
ALWAYS use environment variables for all sensitive configuration.
NEVER use weak JWT fallbacks. Throw an error if JWT_SECRET is missing at startup.
ALWAYS hash passwords with Argon2id. Never use bcrypt, MD5, SHA1, or plain text.
ALWAYS use timing-safe comparison (crypto.timingSafeEqual) for secret comparison.
ALWAYS validate length before crypto.timingSafeEqual to prevent DoS.
NEVER expose stack traces or internal error details to the client in production.
ALWAYS sanitize and validate ALL user inputs using Zod before any processing.
NEVER trust request.params, request.query, or request.body without Zod validation.
ALWAYS enforce tenant isolation: every Prisma query MUST include a tenantId filter.
NEVER write a query that can return data from another tenant under any condition.
ALWAYS store auth tokens in httpOnly + secure + SameSite cookies. Never localStorage.
ALWAYS verify Stripe webhook signatures before processing any webhook event.
ALWAYS sign video URLs with expiry + userId binding. Never expose raw storage URLs.
ALWAYS block reserved subdomains: admin, api, www, mail, ftp, app, auth, login, signup, root, support, billing, dashboard, static, cdn, assets, media, blog, docs, help.
ALWAYS implement rate limiting on every endpoint, strict on all auth routes.
ALWAYS configure CORS with an explicit whitelist. Never use wildcard (*).
ALWAYS use Helmet.js with full security headers on every response.
NEVER allow file uploads without: type whitelist, size limit, filename sanitization.


⚡ PERFORMANCE RULES

NEVER write unbounded Prisma queries. Always use pagination (skip + take).
NEVER use SELECT * — always select only the fields you need.
NEVER create N+1 queries. Use include/select to load relations in one query.
ALWAYS add @index to every field used in WHERE, ORDER BY, or JOIN clauses.
ALWAYS use Redis for caching frequently-read, rarely-changed data.
ALWAYS define a cache invalidation strategy when you add a cache.
ALWAYS run expensive operations (email, video processing) via BullMQ queues.
NEVER block the main thread with synchronous heavy operations.
ALWAYS use Next.js Image component for all images.
ALWAYS use dynamic imports for heavy frontend components.
TARGET: every API response < 200ms. Every page load < 1 second.


💪 CODE QUALITY RULES

ALWAYS use TypeScript strict mode. Zero use of any. Use unknown and narrow it.
NEVER use type assertions (as Type) without a runtime check.
ALWAYS write small, single-responsibility functions. Max 50 lines per function.
NEVER write a function that does more than one thing.
ALWAYS extract magic numbers and strings into named constants.
NEVER leave commented-out code in the codebase. Delete it.
NEVER leave TODO or FIXME comments in production code. Fix it or create a ticket.
NEVER use console.log in production code. Use the structured logger (Pino).
ALWAYS use proper log levels: logger.info, logger.warn, logger.error.
ALWAYS use database transactions for multi-step write operations.
ALWAYS implement idempotency for payment operations.
ALWAYS add createdAt and updatedAt to every Prisma model.
ALWAYS implement soft delete (deletedAt) instead of hard delete for business data.
ALWAYS use enums for status fields. Never use raw strings like "active" or "pending".


🏗️ RELIABILITY RULES

ALWAYS implement a global error handler in Fastify (app.setErrorHandler).
ALWAYS handle process.on('SIGTERM'), process.on('SIGINT') for graceful shutdown.
ALWAYS handle process.on('uncaughtException') and process.on('unhandledRejection').
ALWAYS call prisma.$disconnect() and app.close() during graceful shutdown.
ALWAYS implement a /health endpoint that checks DB and Redis connectivity.
ALWAYS add retry logic for database and Redis connection on startup.
ALWAYS handle external API failures (Stripe, Cloudflare) with proper fallbacks.
NEVER let an unhandled Promise rejection silently fail.
ALWAYS use try/catch in every async function that touches external resources.


📈 SCALABILITY RULES

ALWAYS keep the API stateless. Store all session/state data in Redis.
NEVER store user session data in memory. It breaks horizontal scaling.
NEVER write code that depends on local filesystem state across requests.
ALWAYS namespace Redis keys per tenant: tenant:{tenantId}:key.
ALWAYS isolate tenant file uploads to separate storage paths.
ALWAYS make configuration environment-driven for multi-region deployment.
ALWAYS design database queries to work efficiently at 100k+ records.


🧩 MAINTAINABILITY RULES

ALWAYS follow the existing folder structure. Do not invent new patterns.
ALWAYS use the shared types from @school/shared across frontend and backend.
ALWAYS use the shared Zod schemas from @school/shared for validation.
ALWAYS keep business logic in services/, not in routes/.
ALWAYS keep routes/ thin: validate input → call service → return response.
ALWAYS write code that a new developer can understand in under 5 minutes.
ALWAYS use descriptive variable and function names. No abbreviations.
ALWAYS add JSDoc comments to complex functions explaining WHY, not WHAT.
NEVER duplicate code. Extract shared logic into utils or services.
ALWAYS keep imports organized: external packages first, then internal modules.


🌍 PROJECT-SPECIFIC RULES

This is a multi-tenant platform. EVERY feature must work correctly per-tenant.
The primary market is Algeria. Support Arabic (RTL), French, and English.
Payment methods: CIB, Edahabia (Algerian), and Stripe (international).
Video content must be protected: signed URLs, no direct storage access, no download.
Live sessions use Jitsi Meet (self-hosted). Access gated by active subscription.
The stack is: Next.js 15 + Fastify + Prisma + PostgreSQL + Redis + BullMQ.
Package manager: pnpm. Build system: Turborepo. Never use npm or yarn.
Always run pnpm type-check after changes. Zero TypeScript errors are required.
Always run the security audit mentally before marking a task as complete.


✅ DEFINITION OF DONE
A task is ONLY complete when ALL of the following are true:

✅ Zero TypeScript errors (pnpm type-check)
✅ Zero security vulnerabilities introduced
✅ All inputs validated with Zod
✅ Tenant isolation verified for every new query
✅ No hardcoded secrets or magic values
✅ Error handling implemented
✅ Code is clean, readable, and follows existing patterns
✅ No TODO/FIXME/console.log left behind
✅ Performance: no unbounded queries, no N+1, caching considered
✅ The feature works correctly for ALL tenants, not just one


These rules are absolute. They apply to every task, every file, every line of code.
When in doubt, ask. Never guess on security or data integrity.
---

## 🧠 MANDATORY SKILLS — READ BEFORE EVERY TASK

Before starting ANY task, you MUST read and apply ALL skill files
located in `.agents/skills/`. These are non-negotiable.

Read them in this order:
1. `.agents/skills/critical-thinking-logical-reasoning/`
2. `.agents/skills/complex-reasoning/`
3. `.agents/skills/security-review/`
4. `.agents/skills/better-auth-security-best-practices/`
5. `.agents/skills/frontend-design/`

Rules:
- Apply ALL guidelines from these skills automatically on every task.
- Never skip a skill file even if the task seems unrelated.
- Security-review skill applies to EVERY code change, no exceptions.
- Frontend-design skill applies to EVERY UI component or page.
- If a skill conflicts with a task requirement, security always wins.
# Agent Configuration

## Skills Location
All agent skills are in: .agents/skills/

## Required Reading
Every agent working on this project MUST read:
- AGENTS.md 
- All files under .agents/skills/

## Auto-Apply Rules
- security-review → every file touched
- better-auth-security-best-practices → any auth code
- frontend-design → any UI component
- critical-thinking-logical-reasoning → before every decision
- complex-reasoning → for architecture decisions
---

## 🧠 MANDATORY PLANNING PROTOCOL

Before writing ANY code, you MUST follow this exact protocol:

### STEP 1 — UNDERSTAND (Before touching any file)
- Read ALL related existing files completely
- Understand the current architecture
- Identify all files that will be affected
- Ask ONE clarifying question if anything is unclear

### STEP 2 — PLAN (Write the plan before coding)
Present a plan in this exact format:

**📋 TASK:** [what needs to be done]
**📁 FILES TO MODIFY:** [list every file]
**📁 FILES TO CREATE:** [list every new file]
**⚠️ RISKS:** [what could break]
**🔒 SECURITY CHECKS:** [what security items apply]
**⏱️ STEPS:** [numbered list of execution steps]

Wait for user approval before proceeding.

### STEP 3 — EXECUTE (One step at a time)
- Execute exactly what was approved in the plan
- After each file: verify it compiles
- After all files: run pnpm type-check
- Report what was done vs what was planned

### STEP 4 — VERIFY (Never skip this)
- Run pnpm type-check → must show 0 errors
- Check Definition of Done checklist
- Report final status clearly

### ABSOLUTE RULES
- NEVER start coding without completing STEP 2 first
- NEVER skip the planning phase even for "small" tasks
- NEVER modify more files than listed in the plan
- If something unexpected appears during execution, STOP and report

---

## 🛠️ ARCHITECTURE & TECH STACK

**Runtime & Tooling:**
- **Node 20+**, TypeScript strict mode (ES2022 / NodeNext modules). Imports must use `.js` extension.
- **Package Manager:** `pnpm` only (never npm/yarn). `packageManager: "pnpm@9.15.0"`
- **Monorepo:** Turborepo. Workspaces: `school/apps/*` (api, web), `school/packages/*` (config, database, shared)
- **Dev Environment:** `docker compose -f docker/docker-compose.yml up -d` → Postgres:5432, Redis:6379, Nginx:80
- **Generated folders** (`dist/`, `.next/`, `.turbo/`) must stay out of source control. `pnpm-workspace.yaml` belongs only at monorepo root.

**Frontend (school/apps/web):**
- **Next.js 15 app** on port 3000. Route groups: `(auth)`, `(dashboard)`, `(student)`.
- *Breaking Changes Warning:* Next.js 15 has major API and file structure changes compared to previous versions. Read `node_modules/next/dist/docs/` before assuming APIs.

**Backend (school/apps/api):**
- **Fastify 5** on port 4000. Plugins in `src/plugins/`, routes in `src/routes/`.
- Business logic happens in `services/`, not route handlers. Routes: validate → call service → return.

**Database (school/packages/database):**
- **PostgreSQL 16 + Prisma 6.** Schema at `packages/database/prisma/schema.prisma`. Prisma client imported via `@school/database`.
- Auth: Argon2id only (`argon2` package). Row-Level Security (RLS) via `rls.sql`.

**Multi-Tenancy (CRITICAL):**
- Tenant identified by `X-Tenant-Subdomain` header (set by Nginx).
- `tenant.ts` plugin sets `request.tenantId` and runs `SET LOCAL app.current_tenant_id`.
- PostgreSQL RLS policies enforce `tenantId = current_setting('app.current_tenant_id')::uuid`.
- **Every Prisma query MUST include `where: { tenantId }`** — double-isolation (app-level + RLS).

## 🚀 COMMANDS
*Run from the `school` directory namespace context:*
```bash
pnpm install              # Install all workspace deps
pnpm dev                  # Turbo dev (all apps)
pnpm build                # Turbo build (all apps)
pnpm lint                 # Turbo lint
pnpm type-check           # Turbo TypeScript check
```
*Database commands (run from `school/packages/database/`):*
```bash
pnpm db:generate          # Regenerate client after schema change
pnpm db:push              # Push schema (dev, no migrations)
pnpm db:seed              # Seed demo data
# Order: schema change → db:generate → db:push → seed
```