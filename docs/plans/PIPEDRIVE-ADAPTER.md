# Pipedrive Adapter

> **Created:** March 27, 2026
> **Updated:** March 28, 2026 (v3 — workflow-driven architecture, subscribe route stays clean, continueOnError required)
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
| 2.1 Pipedrive webhook route (inbound triggers) | NOT STARTED | 2 |
| 2.2 Field sync system | NOT STARTED | 2 |
| 2.3 Agent activity logging (post-send hook) | NOT STARTED | 2 |
| 2.4 Reconciliation cron (pipedriveSyncPending) | NOT STARTED | 2 |
| 3.1 Deal + pipeline management | NOT STARTED | 3 |
| 3.2 Deal stage mapping | NOT STARTED | 3 |
| 3.3 Organization linking | NOT STARTED | 3 |

**Key decisions:**
- **Workflow-driven, not route-coupled.** The subscribe route stays integration-agnostic. Pipedrive person creation is a workflow action (`pipedrive.create_or_update_person`), not hardcoded in the route. The engine's context propagation threads the `pipedrivePersonId` to subsequent actions. This means the "config" for whether Pipedrive runs first is just the order of actions in the workflow definition.
- **`continueOnError` is required (not optional).** Without it, a Pipedrive API failure kills the entire workflow — the lead never gets created in RevLine. With it, Pipedrive can fail gracefully while the rest of the workflow proceeds.
- **API Token auth.** Workspaces connect their own Pipedrive accounts via an API token (single secret). No OAuth dance needed. Token is found in Pipedrive Settings > Personal Preferences > API.
- **Raw fetch, no SDK.** Pipedrive's REST API is simple (`?api_token=` query param). Raw fetch is consistent with how other adapters work and avoids SDK dependency risk.
- **Search-then-upsert pattern.** Pipedrive has no native upsert-by-email. The adapter searches first, then creates or updates. Two API calls for new contacts, one for existing — the adapter hides this complexity.
- **Graceful degradation on Pipedrive failure.** If the Pipedrive workflow action fails (with `continueOnError: true`), RevLine still creates the lead. The lead is flagged with `pipedriveSyncPending: true` for later reconciliation.
- **Field sync is per-workspace.** Each workspace defines its own mapping between RevLine lead properties and Pipedrive person fields in the adapter meta config.

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
             { adapter: 'revline', operation: 'email_captured' },
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

The subscribe route does not change. The workflow action order determines whether Pipedrive runs first. If Pipedrive is down, `continueOnError` lets the workflow continue — `create_lead` detects the missing `pipedrivePersonId` and sets `pipedriveSyncPending: true`.

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
- `lead.properties.pipedriveSyncPending = true` is set for reconciliation
- A cron job (Phase 2) retries the Pipedrive upsert and backfills the ID

### Dual Entry Points

**Path A — RevLine landing page (workflow-driven):**
1. Form submits to `/api/v1/subscribe` — emits `revline.email_captured`
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
| `app/api/v1/pipedrive-webhook/route.ts` | Inbound Pipedrive webhook handler (Phase 2) |
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
| `app/_lib/workflow/integration-config.ts` | Add `pipedrive` to `INTEGRATION_CONFIG` + Pipedrive operation labels |
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

Modify `revline.create_lead` to read `ctx.actionData.pipedrivePersonId`. If present, include it in the `properties` passed to `upsertLead`. If absent and the workflow has Pipedrive actions (detectable by checking if `ctx.actionData.pipedriveSyncPending` or if `pipedrivePersonId` is undefined when expected), set `pipedriveSyncPending: true`.

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
3. **Create a workflow** — trigger: `revline.email_captured`, actions: `pipedrive.create_or_update_person` (set `continueOnError: true`) then `revline.create_lead`
4. **Submit a form on your landing page** — verify: person appears in Pipedrive, lead exists in RevLine with `pipedrivePersonId` on its properties
5. **Kill test** — temporarily break the API token in the dashboard (edit the secret to a bad value), submit another form. Verify the lead is created in RevLine with `pipedriveSyncPending: true` and no crash. Restore the token after.
6. **Dedup test** — submit the same email twice. Verify Pipedrive updates (not duplicates) the person — should see one person with the latest data, not two

---

## Phase 2 — Inbound Webhooks, Field Sync, Activity Logging

### 2.1 Pipedrive Webhook Route

`app/api/v1/pipedrive-webhook/route.ts` — handles `added.person`, `updated.person`. HTTP Basic Auth verification. Workspace resolution via `?source={slug}`.

Echo dedup: when the webhook fires for a person we just created, detect it (lead already exists with this `pipedrivePersonId`) and skip re-processing.

### 2.2 Field Sync System

Bidirectional via `fieldMap` in meta. Outbound: after `update_lead_properties` actions. Inbound: on `updated.person` webhook events. Custom field auto-creation via `ensureCustomFieldsExist`.

### 2.3 Agent Activity Logging

Post-send hook in agent engine's `sendReply()`. Fire-and-forget. Maps SMS to `call` activity type, email to `email` type.

### 2.4 Reconciliation Cron

Picks up leads with `pipedriveSyncPending: true`, retries Pipedrive upsert, backfills person ID.

### What You Test (Phase 2)

1. Create a person directly in Pipedrive — verify a RevLine lead appears
2. Update a custom field in Pipedrive — verify it syncs to RevLine lead properties
3. Submit a form (creating person via RevLine) — verify webhook doesn't create a duplicate (echo dedup)
4. Have the agent send a message — verify activity appears on person's Pipedrive timeline
5. Break API token, submit form, fix token, wait for cron — verify reconciliation backfills person ID

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
  logActivities?: boolean;
  smsActivityType?: string;
  fieldKeyCache?: Record<string, string>;
}
```

**Lead properties (stored on `lead.properties` jsonb):**
```typescript
{
  pipedrivePersonId?: number;      // e.g., 842
  pipedriveDealId?: number;        // e.g., 1337 (Phase 3)
  pipedriveSyncPending?: boolean;  // true if Pipedrive creation failed
}
```

---

## Example Workflow Configurations

**Landing page capture with Pipedrive-first person creation:**
```json
{
  "name": "New lead from landing page",
  "triggerAdapter": "revline",
  "triggerOperation": "email_captured",
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
