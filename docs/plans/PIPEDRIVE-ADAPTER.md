# Pipedrive Adapter

> **Created:** March 27, 2026
> **Updated:** March 28, 2026 (v5 — Phase 2 complete: webhook route, inbound field sync, activity logging, reconciliation cron, validation audit)
> **Scope:** Full Pipedrive CRM integration — person sync from landing pages, bidirectional field mapping, agent activity logging to Pipedrive timeline, deal/pipeline management, and workflow actions for contact and deal management.

---

## Status Summary

| Feature | Status | Phase |
|---------|--------|-------|
| 1.1 `continueOnError` engine enhancement | **DONE** | 1 |
| 1.2 Prisma schema (enum + migration) | **DONE** | 1 |
| 1.3 PipedriveAdapter class | **DONE** | 1 |
| 1.4 Integration config entry | **DONE** | 1 |
| 1.5 Workflow registry + executors | **DONE** | 1 |
| 1.6 `create_lead` executor — pipedrivePersonId linking | **DONE** | 1 |
| 1.7 Dashboard wire-up (forms, config editor) | **DONE** | 1 |
| 1.8 Visual branding (logo, integration-config, grid picker) | **DONE** | 1 |
| 2.0 Trigger rename (`email_captured` → `contact-submitted`) | **DONE** | 2 |
| 2.0 Static payload schema for `contact-submitted` | **DONE** | 2 |
| 2.0 Test connection endpoint (`/api/v1/integrations/[id]/test`) | **DONE** | 2 |
| 2.0 Pipedrive fields API (`/api/v1/integrations/[id]/pipedrive-fields`) | **DONE** | 2 |
| 2.2a Field sync UI (Sync Fields, auto-mapping, create-and-map) | **DONE** | 2 |
| 2.2b `pipedrivePersonId` auto-provisioning in workspace schema | **DONE** | 2 |
| 2.1 Pipedrive webhook route (inbound triggers) | **DONE** | 2 |
| 2.2c Inbound field sync (Pipedrive → RevLine on webhook) | **DONE** | 2 |
| 2.3 Agent activity logging (post-send hook) | **DONE** | 2 |
| 2.4 Reconciliation cron (IntegrationSyncQueue) | **DONE** | 2 |
| 2.5 Validation audit (Zod hardening, timing-safe auth, structured logging) | **DONE** | 2 |
| 3.1 Deal + pipeline management | **DONE** | 3 |
| 3.2 Deal stage mapping | **DONE** | 3 |
| 3.3 Organization linking | NOT STARTED (deferred — first Pipedrive customer is a countertop co. doing B2C homeowner work, no GC/org grouping needed; `org_id` can be back-filled later without migration pain) | 3 |

**Key decisions:**
- **Workflow-driven, not route-coupled.** The subscribe route stays integration-agnostic. Pipedrive person creation is a workflow action (`pipedrive.create_or_update_person`), not hardcoded in the route. The engine's context propagation threads the `pipedrivePersonId` to subsequent actions. This means the "config" for whether Pipedrive runs first is just the order of actions in the workflow definition.
- **`continueOnError` is required (not optional).** Without it, a Pipedrive API failure kills the entire workflow — the lead never gets created in RevLine. With it, Pipedrive can fail gracefully while the rest of the workflow proceeds.
- **API Token auth.** Workspaces connect their own Pipedrive accounts via an API token (single secret). No OAuth dance needed. Token is found in Pipedrive Settings > Personal Preferences > API.
- **Raw fetch, no SDK.** Pipedrive's REST API is simple (`?api_token=` query param). Raw fetch is consistent with how other adapters work and avoids SDK dependency risk.
- **Search-then-upsert pattern.** Pipedrive has no native upsert-by-email. The adapter searches first, then creates or updates. Two API calls for new contacts, one for existing — the adapter hides this complexity.
- **Graceful degradation on Pipedrive failure.** If the Pipedrive workflow action fails (with `continueOnError: true`), RevLine still creates the lead. Failed actions are enqueued in `IntegrationSyncQueue` for automatic retry with exponential backoff.
- **DB-backed retry queue (not flags).** `IntegrationSyncQueue` replaces the original `pipedriveSyncPending` flag approach. Generic model supporting any adapter/operation. Processed by a cron job (`/api/v1/cron/integration-sync`) with exponential backoff, idempotent enqueue, and atomic result application. Future-proof for BullMQ migration.
- **Field sync is per-workspace.** Each workspace defines its own mapping between RevLine lead properties and Pipedrive person fields in the adapter meta config. Inbound sync (Pipedrive → RevLine) inverts the same `fieldMap`.
- **Trigger renamed from `email_captured` to `contact-submitted`.** The form captures more than email (name, phone, source). The trigger now aligns with the `landing-page` form definition in the form registry. All backend, frontend, and test references updated.
- **`pipedrivePersonId` auto-provisioned in workspace schema.** When the `create_lead` executor stores a Pipedrive person ID on a lead, it ensures the workspace's `leadPropertySchema` includes a `pipedrivePersonId` property so it appears as a column in the leads table. Fail-safe and idempotent.
- **Webhook auth via shared secret.** Pipedrive has no HMAC signatures. The webhook URL includes a `?secret=` param validated with `crypto.timingSafeEqual`. Replay protection via `meta.timestamp` (3-minute window). Rate limited via `rateLimitByClient`.
- **Activity logging is fire-and-forget.** `logPipedriveActivity()` in `pipedrive-activity.ts` is called after every successful agent send with `.catch(() => {})`. Respects `meta.logActivities` opt-in. Never blocks message delivery.
- **Validation hardened across the stack.** All executor `as` casts replaced with Zod `.safeParse()`. API route path params validated. Cron auth uses `crypto.timingSafeEqual`. Structured logging replaces `console.error`. `ApiResponse` used consistently.

---

## Architecture

### Core Data Flow (Workflow-Driven)

```
Landing Page Form
    │
    ▼
POST /api/v1/subscribe                (unchanged — integration-agnostic)
    │
    └──► emitTrigger(workspaceId,
             { adapter: 'revline', operation: 'contact-submitted' },
             { email, name, phone, source }
         )
             │
             ▼
         Workflow Engine
             │
             ├──► pipedrive.create_or_update_person  (continueOnError: true)
             │        ├──► GET /v1/persons/search?term={email}
             │        └──► POST /v1/persons or PUT /v1/persons/{id}
             │        └──► returns { pipedrivePersonId: 842, isNew: true }
             │                 ↓ merges into ctx.actionData
             │
             ├──► revline.create_lead
             │        └──► reads ctx.actionData.pipedrivePersonId → stores on lead.properties
             │
             └──► agent.route_to_agent (or other actions)
```

The subscribe route does not change. The workflow action order determines whether Pipedrive runs first. If Pipedrive is down, `continueOnError` lets the workflow continue — `create_lead` detects the missing `pipedrivePersonId` and enqueues the action in `IntegrationSyncQueue` for automatic retry.

### Person ID Linking

Every RevLine lead that syncs to Pipedrive carries the Pipedrive person ID as a hard reference. This eliminates email-based lookups and prevents the "two John Smiths" problem.

**How it works (via workflow context propagation):**
1. `pipedrive.create_or_update_person` executor calls the Pipedrive API, gets `{ id: 842 }`, returns `{ pipedrivePersonId: 842, isNew: true }` as `result.data`
2. Engine merges into `ctx.actionData` — now `ctx.actionData.pipedrivePersonId === 842`
3. `revline.create_lead` reads `ctx.actionData.pipedrivePersonId` and stores it on `lead.properties.pipedrivePersonId`
4. Every subsequent Pipedrive action uses this ID directly — no email lookups

**Why this matters:**
- Pipedrive person IDs are stable numeric identifiers that never change
- Email-based lookups are fragile: normalization differences, Pipedrive merges, typos
- The ID is captured from the API response within the same workflow execution — no async round-trip

**Failure handling:**
- If the Pipedrive action fails with `continueOnError: true`, the engine continues
- `ctx.actionData.pipedrivePersonId` is absent — `create_lead` creates the lead without it
- The failed action is enqueued in `IntegrationSyncQueue` with exponential backoff
- The reconciliation cron (`/api/v1/cron/integration-sync`) retries the action and backfills the person ID atomically

### Dual Entry Points

**Path A — RevLine landing page (workflow-driven):**
1. Form submits to `/api/v1/subscribe` — emits `revline.contact-submitted`
2. Workflow action `pipedrive.create_or_update_person` creates person, returns ID
3. Workflow action `revline.create_lead` stores the ID on the lead
4. No changes to the subscribe route — all logic is in the workflow definition

**Path B — Pipedrive-originated persons (webhook, Phase 2):**
1. Person created directly in Pipedrive (by sales team, import, etc.)
2. Pipedrive sends webhook to `POST /api/v1/pipedrive-webhook?source={slug}`
3. Webhook route verifies auth, extracts person data including Pipedrive person ID
4. Emits `pipedrive.person_created` trigger with `pipedrivePersonId` from the webhook payload
5. Same `revline.create_lead` action picks up the ID from the trigger payload

### Field Sync (Phase 2)

Per-workspace bidirectional mapping stored in adapter meta:

```json
{
  "fieldMap": {
    "phone": "phone",
    "source": "lead_source",
    "barcode": "member_barcode_abc"
  }
}
```

Left side = RevLine lead property key. Right side = Pipedrive person field key.

### Agent Activity Logging (Phase 2)

Wired into the agent engine's `sendReply()` path as a post-send hook. Not a workflow action — agent messages happen outside workflow context (follow-ups via cron, replies via webhooks). Fire-and-forget: activity logging failure never blocks message delivery.

---

## Pipedrive API Surface

| API | Used For | Phase |
|-----|----------|-------|
| **Persons API** (`/v1/persons`, `/v1/persons/search`) | Create, update, search persons. Search by email, then create or update. | 1 |
| **PersonFields API** (`/v1/personFields`) | List/create custom person fields for field sync. | 2 |
| **Activities API** (`/v1/activities`) | Log agent messages as activities on person timeline. | 2 |
| **Webhooks API** (`/v1/webhooks`) | Register webhooks for `added.person`, `updated.person`, `added.deal`. | 2 |
| **Deals API** (`/v1/deals`) | Create/update deals tied to persons. | 3 |
| **Pipelines API** (`/v1/pipelines`, `/v1/stages`) | List pipelines and stages for deal routing. | 3 |

**Rate Limits:** ~80 requests per 2 seconds on the Professional plan. The adapter returns `retryable: true` with `retryAfterMs` on 429 responses.

**Auth:** API Token passed as `?api_token={token}` query parameter. Stored as encrypted secret via the existing keyring.

---

## File Touchpoints

### New Files

| File | Purpose |
|------|---------|
| `app/_lib/integrations/pipedrive.adapter.ts` | `PipedriveAdapter extends BaseIntegrationAdapter<PipedriveMeta>` — persons, fields, activities |
| `app/_lib/workflow/executors/pipedrive.ts` | Workflow action executors: `create_or_update_person`, `update_person_fields` |
| `app/(dashboard)/workspaces/[id]/pipedrive-config-editor.tsx` | Structured meta editor — field mappings, test connection |
| `app/api/v1/integrations/[id]/test/route.ts` | Test connection endpoint for any integration |
| `app/api/v1/integrations/[id]/pipedrive-fields/route.ts` | Fetch Pipedrive person fields for sync UI |
| `app/api/v1/pipedrive-webhook/route.ts` | Inbound Pipedrive webhook handler — shared secret auth, replay protection, echo dedup |
| `app/_lib/services/integration-sync.service.ts` | DB-backed retry queue service — `enqueueFailedAction()`, `applyRetryResult()`, `syncInboundFields()` |
| `app/api/v1/cron/integration-sync/route.ts` | Cron route for processing the IntegrationSyncQueue with exponential backoff |
| `app/_lib/agent/pipedrive-activity.ts` | Fire-and-forget agent activity logging to Pipedrive timeline |
| `prisma/migrations/YYYYMMDD_add_pipedrive/migration.sql` | Prisma migration for enum additions |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PIPEDRIVE` to `IntegrationType` and `EventSystem` enums |
| `app/_lib/types/index.ts` | Add `PipedriveMeta` interface, add to `IntegrationMeta` union |
| `app/_lib/integrations/config.ts` | Add `'PIPEDRIVE'` to `INTEGRATION_TYPES` array and `INTEGRATIONS` record |
| `app/_lib/integrations/index.ts` | Export `PipedriveAdapter` and related types |
| `app/_lib/workflow/types.ts` | Add `continueOnError?: boolean` to `WorkflowAction` |
| `app/_lib/workflow/engine.ts` | Handle `continueOnError` in the action loop |
| `app/_lib/workflow/registry.ts` | Add `PIPEDRIVE_ADAPTER: AdapterDefinition` with triggers and actions |
| `app/_lib/workflow/executors/index.ts` | Import and register `pipedriveExecutors` |
| `app/_lib/workflow/executors/revline.ts` | `create_lead` reads `ctx.actionData.pipedrivePersonId` |
| `app/(dashboard)/workspaces/[id]/add-integration-form.tsx` | Replace `<select>` dropdown with logo grid picker, add PIPEDRIVE |
| `app/(dashboard)/workspaces/[id]/integration-actions.tsx` | Add PIPEDRIVE to `IntegrationType` union, `AVAILABLE_SECRET_NAMES`, import config editor |
| `app/_lib/workflow/integration-config.ts` | Add `pipedrive` to `INTEGRATION_CONFIG` + Pipedrive operation labels; renamed `email_captured` → `contact-submitted` |
| `app/_lib/forms/registry.ts` | `landing-page` form trigger declared as `contact-submitted` |
| `app/api/v1/subscribe/route.ts` | Emits `contact-submitted` (renamed from `email_captured`) |
| `app/_lib/services/capture.service.ts` | Updated trigger reference to `contact-submitted` |
| `public/logos/pipedrive.png` | Pipedrive icon mark (152x152 PNG) |

---

## Phase 1 — Core Person Sync + Workflow Actions (DONE)

The minimum viable integration: workflow actions push persons to Pipedrive, person ID links back to RevLine lead.

### 1.1 `continueOnError` Engine Enhancement

Add `continueOnError?: boolean` to `WorkflowAction` in `app/_lib/workflow/types.ts`.

Modify the action loop in `app/_lib/workflow/engine.ts`: when `action.continueOnError === true` and the action fails, log the error, push the failure result, emit a warning event, but **do not break** — continue to the next action. Track whether any action failed with `continueOnError` so the final status can be `COMPLETED_WITH_WARNINGS` instead of `COMPLETED`.

### 1.2 Prisma Schema

Add `PIPEDRIVE` to both enums, run `prisma migrate dev`.

### 1.3 PipedriveAdapter Class

`app/_lib/integrations/pipedrive.adapter.ts`

Extends `BaseIntegrationAdapter<PipedriveMeta>`. Raw fetch with `?api_token=` auth.

**Core methods:**
- `createOrUpdatePerson(email, name?, fields?)` — search by email, create or update, return `{ pipedrivePersonId, isNew }`
- `getPerson(id)` — lookup by Pipedrive person ID
- `updatePersonFields(pipedrivePersonId, fields)` — update fields on existing person
- `validateConfig()` — check API token is valid

### 1.4 Integration Config

Add `PIPEDRIVE` entry to `INTEGRATIONS` record and `INTEGRATION_TYPES` array.

### 1.5 Workflow Registry + Executors

Registry: triggers (`person_created`, `person_updated`) and actions (`create_or_update_person`, `update_person_fields`).

Executors: follow the MailerLite executor pattern — load adapter, handle `ctx.isTest`, call adapter, emit event, return `ActionResult`.

### 1.6 `create_lead` Executor Update

Modify `revline.create_lead` to read `ctx.actionData.pipedrivePersonId`. If present, include it in the `properties` passed to `upsertLead`. If absent, the lead is created without a Pipedrive link — the failed action is enqueued in `IntegrationSyncQueue` by the engine for later reconciliation.

### 1.7 Dashboard Wire-Up

- `add-integration-form.tsx`: Add `'PIPEDRIVE'` to integration type options
- `integration-actions.tsx`: Add `'PIPEDRIVE'` to local type union, `AVAILABLE_SECRET_NAMES`, boolean flag, import/render config editor
- `pipedrive-config-editor.tsx`: Structured editor for field map, test connection button

### 1.8 Visual Branding + Grid Picker

- `public/logos/pipedrive.png`: Pipedrive icon mark (152x152 PNG from Pipedrive CDN)
- `app/_lib/workflow/integration-config.ts`: `pipedrive` entry in `INTEGRATION_CONFIG` (brand color `#017737`, green classes, logo path) + operation labels (`person_created`, `person_updated`, `create_or_update_person`, `update_person_fields`)
- `app/(dashboard)/workspaces/[id]/add-integration-form.tsx`: Replaced the `<select>` dropdown with a responsive logo grid (`grid-cols-3`/`grid-cols-4`). Each integration renders as a clickable card with logo and name. Selected state shows brand-colored border + glow.

### What You Test (Phase 1)

1. **Add Pipedrive integration in dashboard** — restart dev server first (`PIPEDRIVE` enum needs a fresh Prisma client load). Open workspace > Integrations > "+ Add Integration". You should see a grid of integration logos instead of a dropdown. Click Pipedrive, paste your API token, save.
2. **Test connection** — after saving, open the Pipedrive integration, click "Test Connection" in the config editor. Should confirm the token is valid.
3. **Create a workflow** — trigger: `revline.contact-submitted`, actions: `pipedrive.create_or_update_person` (set `continueOnError: true`) then `revline.create_lead`
4. **Submit a form on your landing page** — verify: person appears in Pipedrive, lead exists in RevLine with `pipedrivePersonId` on its properties
5. **Kill test** — temporarily break the API token in the dashboard (edit the secret to a bad value), submit another form. Verify the lead is created in RevLine (without `pipedrivePersonId`) and a PENDING entry appears in `IntegrationSyncQueue`. Restore the token after.
6. **Dedup test** — submit the same email twice. Verify Pipedrive updates (not duplicates) the person — should see one person with the latest data, not two

---

## Phase 2 — Inbound Webhooks, Field Sync, Activity Logging

### Infrastructure (DONE)

These items were completed alongside Phase 1 polish:

- **Trigger rename:** `email_captured` → `contact-submitted` across subscribe route, integration-config, capture service, event-logger, tests, and seed files. Aligns emitted trigger with form registry declaration.
- **Static payload schema:** Added `ContactSubmittedPayloadSchema` to `REVLINE_ADAPTER.triggers` in the registry so the payload compatibility checker can introspect `contact-submitted` fields.
- **Test connection endpoint:** `POST /api/v1/integrations/[id]/test` — loads adapter, calls `validateConfig()`, returns result.
- **Pipedrive fields API:** `GET /api/v1/integrations/[id]/pipedrive-fields` — fetches person fields from Pipedrive for the sync UI.

### 2.2a Field Sync UI (DONE)

Built an ABC Ignite-style auto-mapping panel in `pipedrive-config-editor.tsx`:
- **Sync Fields** button fetches Pipedrive fields + workspace properties in parallel
- **Auto-mapping panel** categorizes into Matched (green), Suggested (yellow), Unmapped (manual)
- **"Available from Pipedrive" chips** — Pipedrive fields not yet in the workspace schema appear as cyan clickable chips. Click to create the RevLine property AND add the field mapping in one action. "Add All" bulk button.
- **Smart key normalization:** Custom fields with hash keys use the `name` field for key generation.
- **Ignored system fields:** `IGNORED_PD_KEYS` filters out Pipedrive internal fields (IDs, counters, timestamps).

### 2.2b pipedrivePersonId Auto-Provisioning (DONE)

The `create_lead` executor calls `ensurePipedrivePropertyInSchema()` when storing a Pipedrive person ID. This auto-adds `pipedrivePersonId` (type: number) to the workspace's `leadPropertySchema` so it appears in the leads table. Fail-safe (try/catch), idempotent, emits `workspace_schema_auto_provisioned` event.

### 2.1 Pipedrive Webhook Route (DONE)

`app/api/v1/pipedrive-webhook/route.ts` — handles `added.person`, `updated.person` events from Pipedrive.

**Auth:** Shared secret via `?secret=` query param, validated with `crypto.timingSafeEqual`. No HMAC (Pipedrive doesn't provide one).

**Replay protection:** Validates `meta.timestamp` is within 3-minute window (STANDARDS.md Section 1.3).

**Rate limiting:** `rateLimitByClient(slug)` applied before any DB work (STANDARDS.md Section 4).

**Echo dedup:** When the webhook fires for a person we just created/updated (lead with matching `pipedrivePersonId` updated within 30s), skip re-processing to prevent feedback loops.

**Flow:** Parse params → rate limit → resolve workspace → load adapter → verify secret → register in WebhookProcessor → dedup → Zod validate → replay check → echo check → emit trigger → field sync (for updates) → mark processed.

### 2.2c Inbound Field Sync (DONE)

`syncInboundFields()` in `integration-sync.service.ts` — inverts the workspace's `fieldMap` (RevLine key → Pipedrive key becomes Pipedrive key → RevLine key), finds the lead by `pipedrivePersonId`, and merges changed values into `lead.properties`. Called from the webhook route for `updated.person` events. Emits `pipedrive_fields_synced_inbound` event.

### 2.3 Agent Activity Logging (DONE)

`logPipedriveActivity()` in `app/_lib/agent/pipedrive-activity.ts` — fire-and-forget hook called from `sendReply()` after every successful agent message. Checks `meta.logActivities` opt-in, looks up lead's `pipedrivePersonId`, calls `adapter.createActivity()`. Maps SMS → `call` type, email → `email` type. Truncates note body to 2000 chars. Never throws, never blocks delivery.

`createActivity()` method added to `PipedriveAdapter` — uses `POST /v1/activities` with `person_id`, `type`, `subject`, `note`, `done`.

### 2.4 Reconciliation Cron (DONE)

Replaced the original `pipedriveSyncPending` flag approach with a generic `IntegrationSyncQueue` table (DB-backed retry queue). The cron at `/api/v1/cron/integration-sync` processes the queue with exponential backoff, dispatching to the existing executor registry. Idempotent enqueue via `enqueueFailedAction()`, atomic result application via `applyRetryResult()`. Auth uses `crypto.timingSafeEqual`.

### 2.5 Validation Audit (DONE)

Comprehensive validation hardening across the Pipedrive integration stack:
- Pipedrive executor `as Record<string, string>` casts → Zod `.safeParse()`
- Resend inbound payload cast → Zod schema
- Path param UUID validation on Pipedrive fields/test routes
- Agent engine JSON field casts → Zod schemas
- Agent route wrapped in `withTransaction` (TOCTOU prevention)
- `console.error` → `logStructured`, `NextResponse.json` → `ApiResponse`
- Cron auth → `crypto.timingSafeEqual`

### What You Test (Phase 2)

**Webhook route (2.1):**
1. Configure `webhookSecret` in Pipedrive adapter meta and register a webhook in Pipedrive pointing to `POST /api/v1/pipedrive-webhook?source={slug}&secret={webhookSecret}`
2. Create a person directly in Pipedrive — verify `pipedrive.person_created` trigger fires and a RevLine lead appears
3. Submit a form (creating person via RevLine) — verify the webhook echo is detected and skipped (no duplicate processing)

**Inbound field sync (2.2c):**
4. Update a custom field on a person in Pipedrive — verify the mapped RevLine lead property updates automatically

**Activity logging (2.3):**
5. Set `logActivities: true` in adapter meta. Have the agent send a message to a lead with a `pipedrivePersonId` — verify an activity appears on the person's Pipedrive timeline

**Reconciliation cron (2.4):**
6. Break API token, submit form (creates lead without `pipedrivePersonId`), fix token, trigger cron (`POST /api/v1/cron/integration-sync`) — verify person ID is backfilled on the lead

---

## Phase 3 — Deals and Pipelines

### 3.1 Deal Management

`createDeal`, `updateDeal` adapter methods. `create_deal` workflow action. Deal value from Stripe payment data.

### 3.2 Deal Stage Mapping

`stageMap` in meta maps RevLine lead stages to Pipedrive pipeline stages. When `update_lead_stage` fires, a chained action moves the deal.

### 3.3 Organization Linking

Optional B2B feature — link persons to organizations.

### What You Test (Phase 3)

1. Configure pipeline + stage map, create lead — verify deal appears in correct stage
2. Trigger a Stripe payment — verify deal value updates
3. Change lead stage — verify deal moves to mapped stage

---

## PipedriveMeta Interface

```typescript
interface PipedriveMeta {
  fieldMap?: Record<string, string>;
  defaultPipelineId?: number;
  stageMap?: Record<string, number>;
  autoCreateDeal?: boolean;
  dealTitleTemplate?: string;
  webhookSecret?: string;       // Shared secret for inbound webhook verification
  logActivities?: boolean;      // Opt-in for agent activity logging
  smsActivityType?: string;
  fieldKeyCache?: Record<string, string>;
}
```

**Lead properties (stored on `lead.properties` jsonb):**
```typescript
{
  pipedrivePersonId?: number;      // e.g., 842
  pipedriveDealId?: number;        // e.g., 1337 (Phase 3)
}
```
Note: `pipedriveSyncPending` flag was replaced by the `IntegrationSyncQueue` table in Phase 2.4.

---

## Example Workflow Configurations

**Landing page capture with Pipedrive-first person creation:**
```json
{
  "name": "New lead from landing page",
  "triggerAdapter": "revline",
  "triggerOperation": "contact-submitted",
  "actions": [
    {
      "adapter": "pipedrive",
      "operation": "create_or_update_person",
      "params": {},
      "continueOnError": true
    },
    {
      "adapter": "revline",
      "operation": "create_lead",
      "params": { "stage": "CAPTURED" }
    },
    {
      "adapter": "agent",
      "operation": "route_to_agent",
      "params": { "agentId": "..." }
    }
  ]
}
```

**Stripe payment — update Pipedrive person fields:**
```json
{
  "name": "Payment received — update Pipedrive",
  "triggerAdapter": "stripe",
  "triggerOperation": "payment_succeeded",
  "actions": [
    {
      "adapter": "revline",
      "operation": "update_lead_stage",
      "params": { "stage": "PAID" }
    },
    {
      "adapter": "pipedrive",
      "operation": "update_person_fields",
      "params": { "fields": { "lead_status": "Won" } },
      "continueOnError": true
    }
  ]
}
```

---

## Complexity Estimate

| Component | Est. Lines | Difficulty | Reference |
|-----------|-----------|------------|-----------|
| `continueOnError` engine change | ~20 | Low | Small modification to action loop |
| `pipedrive.adapter.ts` | 350–500 | Medium | `mailerlite.adapter.ts` (250 lines); more due to search-then-upsert |
| `executors/pipedrive.ts` | 150–200 | Low | `executors/mailerlite.ts` (260 lines); fewer actions in Phase 1 |
| `pipedrive-config-editor.tsx` | 250–400 | Medium | Simpler than `abc-ignite-config-editor.tsx` |
| Schema + config + registry changes | ~100 total | Low | Mechanical — follow existing patterns |
| `create_lead` executor update | ~15 | Low | Read from `ctx.actionData`, pass to properties |

**Total new code (Phase 1):** ~900–1,250 lines across 3 new files and ~10 modified files.
