# Pipedrive Phase 3 — Deals, Pipelines, and Full Webhook Coverage

## Context

Pipedrive Phases 1 and 2 shipped: person upsert, field sync, inbound person webhooks, activity logging, and reconciliation cron (see `docs/plans/PIPEDRIVE-ADAPTER.md` status table). Phase 3 — deals, pipelines, and non-person webhook events — was scoped out and has no code yet. A countertop installation company is the first production Pipedrive customer, and the demo they need is: **landing-page submission creates a person + deal in Pipedrive; stage changes inside Pipedrive fire RevLine workflows that send chats/SMS back to the lead.** Every Pipedrive webhook event the workflow builder cares about must round-trip through the engine so Sam can build automations for this company without touching code.

This plan finishes the Pipedrive adapter to that standard: deal CRUD, pipeline/stage management, all four deal webhook triggers wired into the registry, a pipeline/stage-map UI alongside the existing field-sync UI, and enough test coverage that `/audit` runs clean.

## Goals

- **G1.** Workflows can create, update, and move deals in Pipedrive via three new executors (`pipedrive.create_deal`, `pipedrive.update_deal`, `pipedrive.move_deal_stage`).
- **G2.** Inbound webhooks for `added.deal`, `updated.deal` (split into `deal_updated`, `deal_won`, `deal_lost` based on status transition), and the existing `added.person`/`updated.person` continue working — all four deal events are distinct, mutually-exclusive workflow triggers registered in `PIPEDRIVE_ADAPTER`.
- **G3.** `pipedriveDealId` propagates through workflow context and auto-provisions into the workspace's `leadPropertySchema` the same way `pipedrivePersonId` does today.
- **G4.** Workspace admins can load pipelines/stages from Pipedrive and map RevLine `LeadStage` values to Pipedrive stage IDs through `pipedrive-config-editor.tsx` (no hand-editing JSON).
- **G5.** End-to-end demo works: landing-page submission → person + deal created in Pipedrive → moving the deal's stage in the Pipedrive UI fires a RevLine workflow that sends a chat/SMS.
- **G6.** Tests cover the deal adapter methods (happy + error paths), the three new executors (including `pipedriveDealId` context propagation), and each of the four deal webhook event branches.

## Non-goals

- **Organizations / `createOrganization` / `linkPersonToOrganization`.** Countertop company's first use case is homeowner B2C — no GC/org grouping needed. Revisit if/when they ask for "group jobs by contractor." `org_id` can be back-filled on existing persons later without migration pain.
- **Auto-create deal on person create.** User picked "explicit workflow action only." `autoCreateDeal` meta field stays in the type but is not consumed in this phase.
- **`deleted.deal` handling.** Out of scope — RevLine doesn't model deletes. Skip in the webhook router with a processed-no-op, same as the current non-person event branch.
- **Multi-pipeline support per workflow.** `defaultPipelineId` on the meta is the only pipeline. Workflows can override with `params.pipelineId` on `create_deal`, but the dashboard UI only manages one default pipeline.
- **Deal value rollup from Stripe.** The existing PIPEDRIVE-ADAPTER.md Phase 3 sketch mentions this; skip it. Workflows can pass `value`/`currency` as params if they want.

## Standards check

Verified against `docs/STANDARDS.md`:

- [x] **Workspace isolation** — every new Prisma query scoped to `workspaceId` (schema provisioning, lead lookups by `pipedriveDealId`, webhook echo detection).
- [x] **Event-driven debugging** — every state change emits an event. New event types (all `{system}_{action}_{outcome}` compliant): `pipedrive_deal_created`, `pipedrive_deal_create_failed`, `pipedrive_deal_updated`, `pipedrive_deal_update_failed`, `pipedrive_deal_stage_moved`, `pipedrive_deal_stage_move_failed`, `pipedrive_webhook_deal_added`, `pipedrive_webhook_deal_updated`, `pipedrive_webhook_deal_won`, `pipedrive_webhook_deal_lost`, `pipedrive_webhook_deal_echo_skipped`.
- [x] **Abstraction first** — all deal logic lives in `pipedrive.adapter.ts` and `executors/pipedrive.ts`. `engine.ts` gets zero Pipedrive-specific code. Webhook route dispatches by event name only; the adapter owns the Pipedrive API surface.
- [x] **Fail-safe defaults** — webhook route returns 200 on every partial failure via `ApiResponse.webhookAck` (matches existing person-event handling). Executors return structured errors; never throw to `engine.ts`.
- [x] **Input validation** — Zod schemas for all params (`CreateDealParamsSchema`, `UpdateDealParamsSchema`, `MoveDealStageParamsSchema`) and for the webhook deal payload shape (`PipedriveWebhookDealPayloadSchema` extending the existing wrapper schema). No `as` casts on webhook input.
- [x] **Error handling** — `ApiResponse.webhookAck`/`ApiResponse.success`/`ApiResponse.error` only. Route handlers never throw. Structured logging via `logStructured` on every catch.
- [x] **Idempotency** — webhook dedup via existing `WebhookProcessor.register` (providerEventId = `meta.id`). Echo detection extended to deal events via `pipedriveDealId` + 30s `lastEventAt` window (mirror of existing person echo logic). `ensurePipedriveDealPropertyInSchema` is a new idempotent helper modeled on `ensurePipedrivePropertyInSchema` in `integration-sync.service.ts:313`.
- [x] **Foreign key indexes** — no new FKs added. `pipedriveDealId` lives in `lead.properties` jsonb, not a column.
- [x] **Webhook security** — `verifySecret` (timing-safe sha256) and 3-minute `REPLAY_MAX_AGE_SECONDS` replay window are reused unchanged.

## File-by-file changes

### Modified

- **`app/_lib/integrations/pipedrive.adapter.ts`** — Add a `Deal Operations` section after the existing `Activity Logging` section. New types: `PipedriveDeal`, `PipedriveDealResult`, `PipedrivePipeline`, `PipedriveStage`. New methods (all using the existing `this.request<T>(...)` helper at line 124): `createDeal(opts)`, `updateDeal(dealId, opts)`, `getDeal(dealId)`, `moveDealStage(dealId, stageId)` (thin wrapper over `updateDeal`), `listPipelines()`, `listStages(pipelineId?)`. All follow the existing `markUnhealthy`/`touch` discipline used by `createOrUpdatePerson` at line 219.

- **`app/_lib/workflow/executors/pipedrive.ts`** — Add three executors following the existing `createOrUpdatePerson` / `updatePersonFields` pattern:
  - `createDeal`: reads `ctx.actionData.pipedrivePersonId` (same fallback-to-lead-properties pattern as `updatePersonFields` at line 139), calls `adapter.createDeal`, returns `{ pipedriveDealId, isNew: true }` so downstream actions can pick it up.
  - `updateDeal`: reads `ctx.actionData.pipedriveDealId` with lead-properties fallback, calls `adapter.updateDeal`.
  - `moveDealStage`: reads `ctx.actionData.pipedriveDealId` + a `stageId` param, calls `adapter.moveDealStage`.
  Extend the exported `pipedriveExecutors` record at line 208. Each executor uses `PipedriveFieldsSchema`-style Zod guards.

- **`app/_lib/workflow/registry.ts`** — Extend `PIPEDRIVE_ADAPTER` (line 824):
  - Add four triggers: `deal_added`, `deal_updated`, `deal_won`, `deal_lost`. Each uses a new `DealPayloadSchema` (extends `CommonPayloadSchema` with `pipedriveDealId`, `pipedrivePersonId`, `pipelineId`, `stageId`, `status`, `title`, `value?`, `currency?`). `testFields` include email + dealId for the test runner.
  - Add three actions: `create_deal` (params: `title?`, `value?`, `currency?`, `pipelineId?`, `stageId?`), `update_deal` (params: same fields optional), `move_deal_stage` (params: `stageId` required).

- **`app/api/v1/pipedrive-webhook/route.ts`** — Extend the `isPersonEvent` branch at line 181. New logic:
  1. Add `isDealEvent = event === 'added.deal' || event === 'updated.deal'`.
  2. For deal events: extract `dealId`, `personId`, `pipelineId`, `stageId`, `status`, `title`, `value`, `currency` from `current`. Validate via a new `PipedriveWebhookDealPayloadSchema`.
  3. Run echo detection against `lead.properties.pipedriveDealId` with the same 30s `lastEventAt` window used for persons at line 204 (factor into a small helper `findRecentLeadByPipedriveId(workspaceId, kind, id)` to avoid duplication).
  4. Determine trigger operation:
     - `added.deal` → `deal_added`
     - `updated.deal` AND `current.status === 'won'` AND `previous?.status !== 'won'` → `deal_won`
     - `updated.deal` AND `current.status === 'lost'` AND `previous?.status !== 'lost'` → `deal_lost`
     - `updated.deal` otherwise → `deal_updated`
  5. Emit the trigger with the full deal payload (including the owning person's email/name/phone — look up the person from the `current.person_id` field; if the payload already includes `person_name`/`person_email` in a Pipedrive flattened field, prefer those to skip a round-trip).
  6. Keep the existing person branch unchanged. The `added.organization`/`updated.organization` fallthrough stays as "skipped" (non-op).

- **`app/_lib/services/integration-sync.service.ts`** — Add `ensurePipedriveDealPropertyInSchema(workspaceId)` helper, modeled on `ensurePipedrivePropertyInSchema` at line 313. Call it from the existing `applyRetryResult` path (around line 178) when `opts.resultData.pipedriveDealId != null`. Wrap in the same try/catch so provisioning failure never breaks the retry. Emits `workspace_schema_auto_provisioned` event with metadata `{ property: 'pipedriveDealId' }`.

- **`app/_lib/workflow/integration-config.ts`** — Add operation labels for `create_deal`, `update_deal`, `move_deal_stage`, `deal_added`, `deal_updated`, `deal_won`, `deal_lost`. Maintains the existing label registry pattern.

- **`app/(dashboard)/workspaces/[id]/pipedrive-config-editor.tsx`** — Add a **Pipelines & Stages** section below the existing Field Sync section. Components:
  - **Pipeline selector**: dropdown populated from `GET /api/v1/integrations/[id]/pipedrive-pipelines` (new route below). Selected pipeline writes to `meta.defaultPipelineId`.
  - **Stage map editor**: one row per RevLine `LeadStage` enum value (CAPTURED, ENGAGED, QUALIFIED, BOOKED, PAID). Each row has a dropdown of stages for the selected pipeline. Saving writes to `meta.stageMap`.
  - **"Sync Pipelines" button**: re-fetches pipelines/stages. Follows the same button/panel pattern as the existing "Sync Fields" button.
  - **Read-only display of the deal webhook URL**: it's the same webhook URL as person events; the section should remind the admin to subscribe to `added.deal`/`updated.deal` in Pipedrive's webhook config alongside the existing `added.person`/`updated.person`.

- **`app/_lib/types/index.ts`** — No type changes. `PipedriveMeta` at line 812 already has `defaultPipelineId`, `stageMap`, `autoCreateDeal`, `dealTitleTemplate`. Add a `pipedriveDealId?: number` JSDoc comment in the "Lead properties" area of the existing file header if such an area exists (cosmetic only).

### New

- **`app/api/v1/integrations/[id]/pipedrive-pipelines/route.ts`** `(new)` — `GET` endpoint following the same pattern as the existing `pipedrive-fields/route.ts`. Auth: workspace session. Loads `PipedriveAdapter.forWorkspace`, calls `adapter.listPipelines()` and `adapter.listStages()` (fetches all stages for all pipelines in parallel). Returns `{ pipelines: [{ id, name, stages: [{id, name, orderNr}] }] }`. Path param UUID validated. `ApiResponse.success`/`ApiResponse.error` used. This is the only new route file in the plan.

- **`__tests__/unit/pipedrive-deal-adapter.test.ts`** `(new)` — Unit tests for each new adapter method. Mock `fetch` via the existing test helpers under `__tests__/setup.ts`. Cover: happy path for each method, 401 (invalid token) error, 429 (rate limit) retryable error, 500 (upstream) retryable error, 404 (`getDeal` returns null).

- **`__tests__/unit/pipedrive-deal-executors.test.ts`** `(new)` — Tests for `createDeal`, `updateDeal`, `moveDealStage` executors. Cover: `ctx.isTest` dry-run, missing `pipedrivePersonId`/`pipedriveDealId` error, fallback to lead properties, success path with `ctx.actionData` propagation, adapter error propagation.

- **`__tests__/integration/pipedrive-deal-webhook.test.ts`** `(new)` — Webhook route tests for each event branch. Uses `createTestWorkspace` + `createTestIntegration` from `__tests__/setup.ts`. Cover: valid `added.deal` → `deal_added` trigger, `updated.deal` with status unchanged → `deal_updated`, status `won` transition → `deal_won`, status `lost` transition → `deal_lost`, echo detection (recent lead with matching `pipedriveDealId` → skipped), replay protection (old timestamp → rejected), invalid secret → 200 with warning, invalid payload → 200 with warning.

## Risks

- **Risk: Deal payload shape varies across Pipedrive webhook API versions.** Pipedrive v1 webhooks flatten deal fields differently than v2. The new `PipedriveWebhookDealPayloadSchema` should use `.passthrough()` on unknown fields and `z.coerce.number()` on IDs to handle variations. Mitigation: integration test covers both a v1-shaped and v2-shaped sample payload.
- **Risk: Workflow engine double-firing on `updated.deal` events where status transitions to won/lost.** We consciously split into distinct triggers, so a single Pipedrive event emits exactly one RevLine trigger. Test case explicitly asserts `deal_updated` is NOT fired when `deal_won` fires.
- **Risk: `ensurePipedriveDealPropertyInSchema` race with existing `ensurePipedrivePropertyInSchema` on the same workspace.** Both wrap in `withTransaction`, so serialized writes to `leadPropertySchema` are safe. Tests should exercise the case where a workflow creates person + deal in the same run.
- **Risk: The pipeline/stage API endpoint could leak API errors to the dashboard.** Route returns sanitized error messages only (never the raw Pipedrive error body). Follows the existing `pipedrive-fields/route.ts` pattern.
- **Rollback path**: every change is additive. If the deal work breaks person-event processing, revert the webhook route diff and the registry diff — person triggers and executors don't touch any new code.
- **Production impact**: no schema migration, no data backfill. New event types are added to logs but the `event_type` column is a free-form string. `pipedriveDealId` property is auto-provisioned lazily on first use.
- **Known blocker for verification**: dev server currently fails with `Can't resolve 'tailwindcss' in 'C:\Users\Sam\desktop'` — webpack is resolving from one directory above the repo root. This is unrelated to this plan but blocks the manual end-to-end verification. Triage separately before starting `/implement`.

## Verification

How we know it's done:

- [ ] `npm run type-check` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes, including the three new test files.
- [ ] `/audit` reports clean against this branch.
- [ ] **Dashboard — pipeline sync**: open a workspace with Pipedrive configured, click "Sync Pipelines" in the config editor. A dropdown of pipelines appears. Select one, save. Verify `meta.defaultPipelineId` is persisted.
- [ ] **Dashboard — stage map**: after selecting a pipeline, map `CAPTURED → <Pipedrive stage>`, `BOOKED → <Pipedrive stage>`. Save. Verify `meta.stageMap` is persisted.
- [ ] **Workflow builder**: create a workflow with trigger `revline.contact-submitted` and actions `[pipedrive.create_or_update_person (continueOnError), pipedrive.create_deal (continueOnError), revline.create_lead]`. Save.
- [ ] **End-to-end demo flow (Sam's explicit deliverable)**: submit the landing-page form. Verify: person created in Pipedrive, deal created in the default pipeline, RevLine lead has both `pipedrivePersonId` and `pipedriveDealId` on `lead.properties`, workspace dashboard shows the lead with both columns.
- [ ] **Inbound deal webhooks (Sam's explicit deliverable — "test all the webhooks")**: in Pipedrive, subscribe the workspace's webhook URL to `added.deal`, `updated.deal`. Create a deal directly in Pipedrive → verify `pipedrive.deal_added` trigger fires in the RevLine event log. Move the deal to a different stage → verify `deal_updated` fires. Mark the deal won → verify `deal_won` fires (and `deal_updated` does NOT). Mark a different deal lost → verify `deal_lost` fires.
- [ ] **Workflow response to webhook trigger (Sam's demo closing loop)**: wire a second workflow with trigger `pipedrive.deal_updated` and action `twilio.send_sms` (message body: "Your quote is being updated"). Move a deal in Pipedrive → verify the lead receives an SMS.
- [ ] **Echo test**: create a deal via a workflow → verify the resulting webhook echo is detected and skipped (no double-trigger).
- [ ] **Failure path**: break the API token, run the landing-page flow. Verify lead is still created in RevLine (without `pipedriveDealId`), failed action lands in `IntegrationSyncQueue`, restore token, trigger reconciliation cron, verify `pipedriveDealId` is back-filled on the lead.

## Todos

Sequential, single-responsibility. `/implement` works through these in order.

- [ ] **1.** Add deal types (`PipedriveDeal`, `PipedriveDealResult`, `PipedrivePipeline`, `PipedriveStage`) and `createDeal` method to `pipedrive.adapter.ts`.
- [ ] **2.** Add `updateDeal`, `getDeal`, `moveDealStage` methods to `pipedrive.adapter.ts`.
- [ ] **3.** Add `listPipelines` and `listStages` methods to `pipedrive.adapter.ts`.
- [ ] **4.** Write unit tests for all new adapter methods in `__tests__/unit/pipedrive-deal-adapter.test.ts`.
- [ ] **5.** Add `createDeal` executor to `executors/pipedrive.ts` (with `pipedriveDealId` propagation into `ctx.actionData`).
- [ ] **6.** Add `updateDeal` and `moveDealStage` executors to `executors/pipedrive.ts`; extend `pipedriveExecutors` export.
- [ ] **7.** Add the three new action definitions (`create_deal`, `update_deal`, `move_deal_stage`) to `PIPEDRIVE_ADAPTER` in `registry.ts`.
- [ ] **8.** Add the four new deal triggers (`deal_added`, `deal_updated`, `deal_won`, `deal_lost`) to `PIPEDRIVE_ADAPTER` with a shared `DealPayloadSchema`.
- [ ] **9.** Add operation labels for the seven new operations to `workflow/integration-config.ts`.
- [ ] **10.** Write executor unit tests in `__tests__/unit/pipedrive-deal-executors.test.ts`.
- [ ] **11.** Extend `pipedrive-webhook/route.ts` to handle `added.deal` and `updated.deal`, including status-transition detection for won/lost and echo detection via `pipedriveDealId`.
- [ ] **12.** Add `ensurePipedriveDealPropertyInSchema` to `integration-sync.service.ts` and wire it into the retry-result apply path.
- [ ] **13.** Write webhook integration tests in `__tests__/integration/pipedrive-deal-webhook.test.ts` covering each of the four event branches, echo, replay, and invalid-payload paths.
- [ ] **14.** Create `app/api/v1/integrations/[id]/pipedrive-pipelines/route.ts` — GET endpoint returning pipelines + stages.
- [ ] **15.** Add the "Pipelines & Stages" section to `pipedrive-config-editor.tsx`: Sync Pipelines button, pipeline selector, stage map editor, deal-webhook subscription reminder.
- [ ] **16.** Run `npm run type-check`, `npm run lint`, `npm run test`. Fix anything red.
- [ ] **17.** Run `/audit` against the branch diff, fix any findings.
- [ ] **18.** Manual end-to-end verification from the Verification section above, in a dev environment (blocked on the tailwindcss dev-server issue — address first).
- [ ] **19.** Update `docs/plans/PIPEDRIVE-ADAPTER.md` status table: mark 3.1 and 3.2 DONE. Leave 3.3 (organizations) NOT STARTED with a note explaining the countertop-company decision.
