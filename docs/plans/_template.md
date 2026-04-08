# {{TITLE}}

## Context

Why this change is being made — the problem, the trigger, the intended outcome. One short paragraph. If this is in response to an incident, link the event type or the date.

## Goals

- Concrete, testable outcome 1
- Concrete, testable outcome 2

## Non-goals

- What this explicitly does NOT do (prevents scope creep)
- Areas left untouched

## Standards check

Before implementing, confirm this plan is compatible with `docs/STANDARDS.md`. List any rules that are load-bearing for this work:

- [ ] **Workspace isolation** — every Prisma query scoped to `workspaceId`
- [ ] **Event-driven debugging** — every state change emits an event with `{system}_{action}_{outcome}` naming
- [ ] **Abstraction first** — no integration-specific logic added to `engine.ts` or other core modules
- [ ] **Fail-safe defaults** — logging never breaks main flow; webhooks return 200 on partial failures
- [ ] **Input validation** — Zod schemas at all external boundaries (no `as` casts)
- [ ] **Error handling** — structured `ApiResponse` from routes, no raw throws
- [ ] **Idempotency** — schema provisioning and webhook processing are safe to repeat
- [ ] **Foreign key indexes** — any new FK has a DB index
- [ ] **Webhook security** — `timingSafeEqual` + replay window if applicable

If any box can't be ticked, document the deviation and the reason.

## File-by-file changes

For each file, what changes and why:

- `path/to/file.ts` — short description of the change
- `path/to/other-file.ts` — short description
- ...

Mark new files with `(new)`.

## Risks

- What could go wrong? What's the rollback path?
- Any production impact? Any data migration?

## Verification

How will we know it's done? Concrete steps:

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes (and any new tests added)
- [ ] Manual flow: …
- [ ] Events visible in dashboard: …
- [ ] `/audit` reports clean against this branch

## Todos

Sequential, single-responsibility. `/implement` will work through these in order.

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
