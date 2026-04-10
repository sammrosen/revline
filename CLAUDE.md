# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

RevLine — a multi-tenant RevOps automation platform (Next.js 16 monolith). Manages lead capture, routing, messaging, and booking pipelines for business clients. Each client ("workspace") gets isolated integrations, workflows, AI agents, and event logging. Live on Railway, serving real clients.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Prisma generate + Next.js build
npm run lint             # ESLint
npm run type-check       # tsc --noEmit
npm run test             # Vitest (all tests)
npm run test:watch       # Vitest watch mode
npx vitest run __tests__/unit/crypto.test.ts  # Run a single test file
npm run ci               # Full CI: lint + type-check + test + build

# Database
npm run db:migrate       # prisma migrate dev
npm run db:push          # prisma db push (schema changes without migration)
npm run db:seed          # Seed admin user (tsx prisma/seed.ts)
npm run db:generate      # prisma generate (regenerate client)
```

Tests require `TEST_DATABASE_URL` in env or `.env.local`. Each Vitest worker gets an isolated database (`test_db_0`, `test_db_1`, etc.) created by `__tests__/globalSetup.ts`. Test helpers (`createTestWorkspace`, `createTestIntegration`, `createTestLead`, etc.) are in `__tests__/setup.ts`.

## Architecture

### Three Major Subsystems

1. **Workflow Engine** (`app/_lib/workflow/`) — Adapter registry + sequential executor. Integrations register triggers and actions. Workflows are per-workspace: "when X triggers, execute actions A, B, C." `registry.ts` holds the adapter registry, `engine.ts` runs execution, `executors/` has per-action executors.

2. **Agent Engine** (`app/_lib/agent/`) — AI conversational agents (SMS via Twilio, webchat). Backed by OpenAI or Anthropic. `engine.ts` runs the AI loop, `tool-registry.ts` manages available tools, `adapter-registry.ts` maps channel types, `guardrails/` enforces limits. Agents have system prompts, token/message budgets, escalation patterns, and quiet hours.

3. **Integration Adapters** (`app/_lib/integrations/`) — Each external service extends `base.ts`. Adapters: MailerLite, Stripe, Calendly, ABC Ignite, Resend, Twilio, OpenAI, Anthropic, Pipedrive, RevLine (internal). Adding a new integration = write adapter, register it, create webhook route, wire frontend (see `docs/STANDARDS.md` for checklist).

### Core Infrastructure

- **`proxy.ts`** — Next.js 16 proxy (replaces middleware.ts). Handles global rate limiting, session auth for dashboard routes, custom domain routing, and static site domain routing.
- **`app/_lib/crypto.ts`** — AES-256-GCM encryption with versioned keyring. Secrets decrypted only at point-of-use.
- **`app/_lib/auth.ts`** — Argon2id passwords, session cookies, optional TOTP 2FA.
- **`app/_lib/client-gate.ts`** — Workspace lookup + execution gating (paused workspaces block actions).
- **`app/_lib/event-logger.ts`** — Append-only event ledger. Primary debugging surface.
- **`app/_lib/reliability/`** — Webhook deduplication, idempotent executor, correlation IDs.
- **`app/_lib/db.ts`** — Singleton PrismaClient (cached on globalThis).
- **`app/_lib/services/`** — Business logic: capture, consent, webhook processing, lead properties, integration sync.

### Request Flow

```
External webhook/form → proxy.ts (rate limit + auth) → API route handler
  → client-gate.ts (workspace lookup, status check)
  → service layer → integration adapter → external API
  → event-logger.ts (emit event)
  → workflow engine (if trigger matches)
```

### Multi-Tenancy

Everything is scoped to a workspace. Organizations own workspaces. Users have org memberships with roles (Owner/Admin/Member/Viewer). The Prisma schema enforces isolation via foreign keys. Always pass `workspaceId` — never do global operations.

### Route Structure

- `app/api/v1/` — All API endpoints (auth, workspaces, integrations, workflows, webhooks, cron, etc.)
- `app/(dashboard)/` — Internal dashboard (protected by proxy.ts auth check)
- `app/(sites)/`, `app/embed/` — Client-facing pages and embeddable widgets
- `app/fit1/`, `app/cyclic/`, `app/diet/`, `app/demo/`, `app/semi-private/`, `app/book/` — Client landing pages

### Key Patterns

- **Abstraction layers**: Route handler → Service → Integration Adapter → External API. Never call external APIs directly from routes.
- **Event naming**: `{system}_{action}_{outcome}` (e.g., `stripe_payment_succeeded`, `mailerlite_subscribe_failed`).
- **Input validation**: Zod schemas via `validateBody()` from `app/_lib/utils/validation.ts`.
- **Transactions**: `withTransaction()` from `app/_lib/utils/transaction.ts` for multi-step DB operations.
- **Error handling**: Structured `ApiResponse.success()`/`ApiResponse.error()` — never throw raw errors in routes. Webhooks return 200 on partial failures.
- **Secrets**: Multi-secret per integration stored as JSON array with `{ id, name, encryptedValue, keyVersion }`.

### Database

PostgreSQL via Prisma. Schema at `prisma/schema.prisma`. Key models: Organization, Workspace, WorkspaceIntegration, Lead, Event, Workflow, WorkflowExecution, WebhookEvent, Agent, Conversation, ConsentRecord. Uses `@map()` for snake_case table/column names.

### Deployment

Railway with Docker (`Dockerfile`). `railway.json` configures the deploy. Sentry for error tracking (`sentry.*.config.ts`, `instrumentation.ts`). GitHub Actions CI in `.github/workflows/`.

## Conventions

- Files: kebab-case. Functions: camelCase. Classes: PascalCase. Constants: SCREAMING_SNAKE.
- Strict TypeScript — no `any` without justification. Explicit return types on exported functions.
- Tailwind CSS v4 for styling.
- Path alias: `@/` maps to project root.
- Webhook signature verification must use `crypto.timingSafeEqual`.
- Rate limits: login 5/5min, subscribe 10/min, webhooks 100/min, global 100/min per IP.

## Working With Sam

Sam runs a strict **plan → implement → audit** ritual on this repo. Claude Code primitives in `.claude/` codify it. Follow the ritual; don't reinvent it.

### The ritual

1. **`/plan {feature}`** — drafts a plan in `docs/plans/{kebab-name}.md` from the template at `docs/plans/_template.md`. Stop after writing. Do not start coding.
2. **`/implement {plan-path}`** — re-reads the plan, locks it from edits via `.claude/state/active-implement.json`, and works through todos one at a time (in_progress → completed). The `standards-auditor` subagent runs against each chunk.
3. **`/audit`** — runs the `standards-auditor` subagent against the branch diff. Use it before merging, and any time Sam asks "is this standards compliant?"

**Do not edit a plan file while `/implement` is active on it.** A `PreToolUse` hook will block you. If the plan needs to change, stop and ask Sam.

### Worktree isolation

When Sam runs multiple agents in parallel, each implementation session MUST use `EnterWorktree` to get an isolated working directory. This prevents branch checkout collisions, working tree overwrites, and commits landing on wrong branches.

- `/plan` — runs in the main repo (safe, only writes plan files)
- `/implement` — MUST enter a worktree before making any code changes
- `/audit` — enter a worktree if other agents are active

Worktrees live at `.claude/worktrees/` (gitignored). They persist after completion for review. Sam cleans them up manually or via `git worktree prune`.

### Source of truth

`docs/STANDARDS.md` is canonical. When you need a rule, **quote it** — do not paraphrase. If you think a standard should change, say so and ask Sam to update the doc; don't drift around it.

Reference adapter: `app/_lib/integrations/pipedrive.adapter.ts`. When building or reviewing an integration, treat Pipedrive as the template — older adapters (Stripe, Resend, Twilio) predate the current pattern and may mix concerns.

### Skill consultation map

When you touch these areas, the relevant skill should already be in your context. If not, read it explicitly:

| Touching… | Consult skill |
|---|---|
| `app/_lib/integrations/`, `workflow/registry.ts`, `workflow/engine.ts` | `revline-integration-adapter` |
| `event-logger`, new routes, new adapters | `revline-event-logging` |
| Any Prisma query, service function, route handler | `revline-workspace-isolation` |
| Schema sync / provisioning / webhook handlers | `revline-idempotency` |
| Writing tests, modifying service/adapter code | `revline-testing` |

### Prefer questions over assumptions

When intent is ambiguous, **ask before guessing**. Canonical clarifications Sam appreciates being asked:

- Public URL or localhost? (affects webhook testing strategy)
- Which workspace? (everything is workspace-scoped)
- Sync or async? (changes failure mode)
- Should this run on `db:push` or via a migration? (affects prod safety)
- Is this hot path or background? (affects rate limit / timeout handling)

Don't ask trivial questions, but don't silently assume on ones that change the design.

### Do-not list

- **Don't edit plan files during `/implement`.** Stop and ask.
- **Don't hardcode integration-specific logic in `engine.ts` or other core modules.** Per-integration logic lives in the adapter or its executor. Past pain: `logPipedriveActivity()` hardcoded into the engine.
- **Don't add special cases to core for new providers.** Iterate the adapter registry; if you can't, that's a sign the abstraction is wrong — flag it.
- **Don't truncate error messages in event logs.** Past pain: errors were truncated twice (DB + UI) and Sam was blind to failures. Events are the primary debugging surface; preserve enough metadata to debug.
- **Don't bypass workspace scoping.** Every Prisma `findMany/findFirst/update/delete` must have `workspaceId` in the `where` clause.
- **Don't run `prisma migrate reset`, `db:push` against non-local DBs, `git push --force`, `git reset --hard`, or `rm -rf` without explicit confirmation.** A `PreToolUse` hook will block these.
- **Don't paraphrase `docs/STANDARDS.md` into other files.** Reference it; never duplicate it.

### Plan folder hygiene

`docs/plans/` is for active work. When a plan is complete or superseded, move it to `docs/plans/archive/`. Run `/triage-plans` periodically to surface stale ones. Don't leave half-implemented plans next to active ones — Sam has been burned by this.
