# ABC Signup Page + PayPage Payment Integration

## Context

The signup page at `/public/[slug]/signup/` is a polished 6-step membership form that currently runs with **mock submission only** — no real API calls. ABC Financial provides a Create Agreement API and a PCI-compliant PayPage iframe for payment tokenization. We need to wire these up so the signup form actually creates members in ABC, while keeping card/bank numbers completely out of our scope by using PayPage's iframe-based tokenization.

## Goals

- Wire up the signup form to call ABC's Create Agreement API on submission
- Replace Step 5's raw card form with ABC's PayPage iframe (PCI-compliant tokenization)
- Add plan-syncing from ABC so workspace admins can map display plans to ABC payment plan IDs
- Add ppsId, sendAgreementEmail, and paymentPlans fields to ABC integration config
- Emit events for signup agreement creation success/failure

## Non-goals

- Custom styling of the PayPage iframe internals (cross-origin, not possible)
- Handling raw card/bank numbers on our servers (the entire point is to NOT do this)
- Dynamic plan fetching for the signup UI (plans stay workspace-configurable with ABC ID mapping)
- Secondary members / family plan support (future scope)

## Standards check

- [x] **Workspace isolation** — every Prisma query scoped to `workspaceId`; signup route looks up workspace by slug, adapter loaded per-workspace
- [x] **Event-driven debugging** — `signup_agreement_created` and `signup_agreement_failed` events emitted
- [x] **Abstraction first** — all ABC API calls go through the adapter; route handler calls adapter, never ABC directly
- [x] **Fail-safe defaults** — event logging wrapped in try/catch; PayPage errors shown to user without crashing
- [x] **Input validation** — Zod schema on the signup POST route for all user input
- [x] **Error handling** — structured `ApiResponse` from the signup route
- [x] **Idempotency** — not applicable (agreement creation is intentionally non-idempotent; each submit creates a new agreement)
- [ ] **Foreign key indexes** — no schema changes
- [ ] **Webhook security** — postMessage origin validation on the client (`apipayservice.abcfinancial.net`)

## File-by-file changes

- `app/_lib/types/index.ts` — Add `ppsId`, `sendAgreementEmail`, `paymentPlans` to `AbcIgniteMeta`; add `abcPaymentPlanId` to `SignupPlan`; update `SignupFormState` reference
- `app/_lib/config/schema.ts` — Add `abcPaymentPlanId` to `SignupPlanSchema` Zod validation
- `app/_lib/config/workspace-config.service.ts` — Pass through `abcPaymentPlanId` in `resolveSignupPlans()`
- `app/_lib/integrations/abc-ignite.adapter.ts` — Add types (`AbcPaymentPlan`, `AbcPaymentPlanDetail`, `AbcCreateAgreementRequest`, `AbcCreateAgreementResponse`); add methods (`getPlans()`, `getPlanDetails()`, `createAgreement()`, `getPpsId()`)
- `app/api/v1/signup/[slug]/route.ts` **(new)** — POST handler: Zod validation, workspace lookup, adapter load, fetch planValidationHash, call createAgreement, emit events
- `app/public/[slug]/signup/steps/step-5-payment.tsx` — Replace raw card form with PayPage iframe + postMessage listener
- `app/public/[slug]/signup/client.tsx` — Replace card fields with `payPageTransactionId`/`payPagePaymentType` in form state; wire real API submission; add `ppsId` prop
- `app/public/[slug]/signup/[[...step]]/page.tsx` — Load ppsId from ABC integration, pass to SignupClient
- `app/(dashboard)/workspaces/[id]/abc-ignite-config-editor.tsx` — Add ppsId field, sendAgreementEmail toggle, Sync Plans button

## Risks

- **PayPage iframe may be blocked by CSP** — may need to add `apipayservice.abcfinancial.net` to frame-src. Check proxy.ts / next.config.ts.
- **planValidationHash changes daily** for some plans — fetched fresh at submission time, not cached.
- **Single transactionId for both due-today and draft** — ABC Example 7 confirms this works, but if a specific plan requires separate tokens, we'd need two iframe sessions. Start with one; adapt if needed.
- **Rollback**: Revert the branch. No database changes, no migrations.

## Verification

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] Manual flow: complete signup steps 2-5, PayPage iframe loads, submit creates agreement in ABC
- [ ] Events visible in dashboard: `signup_agreement_created`
- [ ] `/audit` reports clean against this branch

## Todos

- [ ] Add `ppsId`, `sendAgreementEmail`, `paymentPlans` to `AbcIgniteMeta` and `abcPaymentPlanId` to `SignupPlan` in types + schema + config resolver
- [ ] Add payment plan and agreement types to ABC adapter (`AbcPaymentPlan`, `AbcCreateAgreementRequest`, etc.)
- [ ] Add `getPlans()`, `getPlanDetails()`, `createAgreement()`, `getPpsId()` methods to ABC adapter
- [ ] Create signup API route `app/api/v1/signup/[slug]/route.ts` with Zod validation, agreement creation, event logging
- [ ] Rewrite Step 5 payment component with PayPage iframe + postMessage listener
- [ ] Update client.tsx: replace card fields with PayPage state, wire real API submission, add ppsId prop
- [ ] Update page.tsx server component to load ppsId from ABC integration and pass to client
- [ ] Update ABC Ignite config editor: add ppsId field, sendAgreementEmail toggle, Sync Plans button
- [ ] Type-check and lint pass
