# Pipedrive Adapter

> **Created:** March 27, 2026
> **Updated:** March 27, 2026 (v2 — added person ID linking, workflow engine notes, switched from HubSpot to Pipedrive)
> **Scope:** Full Pipedrive CRM integration — person sync from landing pages, bidirectional field mapping, agent activity logging to Pipedrive timeline, deal/pipeline management, and workflow actions for contact and deal management.

---

## Status Summary

| Feature | Status | Phase |
|---------|--------|-------|
| 1.1 Prisma schema (enum + migration) | NOT STARTED | 1 |
| 1.2 PipedriveAdapter class | NOT STARTED | 1 |
| 1.3 Integration config entry | NOT STARTED | 1 |
| 1.4 Workflow registry + executors | NOT STARTED | 1 |
| 1.5 Dashboard wire-up (forms, config editor) | NOT STARTED | 1 |
| 1.6 Subscribe route — Pipedrive-first capture | NOT STARTED | 1 |
| 2.1 Pipedrive webhook route (inbound triggers) | NOT STARTED | 2 |
| 2.2 Field sync system | NOT STARTED | 2 |
| 2.3 Agent activity → Pipedrive activities | NOT STARTED | 2 |
| 2.4 Deal stage mapping | NOT STARTED | 2 |
| 2.5 Agent engine post-send hook | NOT STARTED | 2 |
| 2.6 Pipedrive sync reconciliation (cron) | NOT STARTED | 2 |
| OPT Engine: `continueOnError` flag | NOT STARTED | — |
| 3.1 Deals and pipelines | NOT STARTED | 3 |
| 3.2 Organization linking | NOT STARTED | 3 |

**Decisions made:**
- **API Token auth.** Workspaces connect their own Pipedrive accounts via an API token (single secret). No OAuth dance needed. Token is found in Pipedrive Settings > Personal Preferences > API.
- **Pipedrive-first person creation with ID linking.** The subscribe route creates the person in Pipedrive first, captures the Pipedrive person ID from the API response, and passes it through the trigger payload. The `revline.create_lead` executor stores the `pipedrivePersonId` on the lead. All subsequent Pipedrive operations use this ID directly — no email lookups, no ambiguity. See "Person ID Linking" section below.
- **Search-then-upsert pattern.** Pipedrive has no native upsert-by-email. The adapter searches for an existing person by email first, then creates or updates. This is two API calls for new contacts, one for existing — the adapter hides this complexity.
- **Graceful degradation on Pipedrive failure.** If the Pipedrive API call fails during form submission, RevLine still creates the lead and runs workflows. The lead is flagged with `pipedriveSyncPending: true` for later reconciliation. Landing pages never break because Pipedrive is down.
- **Field sync is per-workspace.** Each workspace defines its own mapping between RevLine lead properties and Pipedrive person fields in the adapter meta config. The adapter handles translation in both directions.
- **Agent actions log to Pipedrive.** Every outbound SMS or email from an agent creates a Pipedrive activity on the person timeline, so the business sees full activity as if a human rep did it. Pipedrive has native activity types (call, email, meeting, task) which map cleanly to agent channels. This is wired into the agent engine directly, not through workflow actions (see "Workflow Engine Considerations" section).

---

## Architecture

### Core Data Flow

```
Landing Page Form
    │
    ▼
POST /api/v1/subscribe
    │
    ├──► PipedriveAdapter.createOrUpdatePerson(email, fields)
    │        ├──► GET /v1/persons/search?term={email} (find existing)
    │        └──► POST /v1/persons or PUT /v1/persons/{id} → returns { id: 842, ... }
    │
    └──► emitTrigger(workspaceId, 
             { adapter: 'pipedrive', operation: 'person_created' },
             { email, pipedrivePersonId: 842, name, phone, ... }
         )
             │
             ▼
         Workflow Engine
             │
             ├──► revline.create_lead → stores pipedrivePersonId on lead.properties
             ├──► pipedrive.update_person_fields → uses ID 842 directly
             └──► agent.route_to_agent → agent context includes pipedrivePersonId
```

### Person ID Linking

Every RevLine lead that originates from (or syncs to) Pipedrive carries the Pipedrive person ID as a hard reference. This eliminates email-based lookups and prevents the "two John Smiths" problem.

**How it works:**
1. Subscribe route calls `PipedriveAdapter.createOrUpdatePerson(email)` — adapter searches by email, creates or updates, returns `{ id: 842, ... }`
2. The `pipedrivePersonId` is injected into the trigger payload
3. The `revline.create_lead` executor stores it in `lead.properties.pipedrivePersonId`
4. Every subsequent Pipedrive action reads `ctx.actionData.pipedrivePersonId` or looks it up from the lead and operates on the person by ID, not email

**Why this matters:**
- Pipedrive person IDs are stable numeric identifiers that never change
- Email-based lookups are fragile: normalization differences, Pipedrive merges, typos
- The ID is captured from the API response (synchronous), not from a webhook (async) — no round-trip delay
- When the agent texts a lead 3 days later, the activity logs to the exact right Pipedrive person

**Failure handling:**
- If the Pipedrive API call fails, the lead is still created in RevLine
- `lead.properties.pipedriveSyncPending` is set to `true`
- A reconciliation pass (cron or next interaction) retries the Pipedrive upsert and backfills the ID
- Workflows that have Pipedrive actions degrade gracefully — the Pipedrive executor skips if no `pipedrivePersonId` exists and the API lookup also fails

### Dual Entry Points

There are two ways contacts enter the system:

**Path A — RevLine landing page (synchronous):**
1. Form submits to `/api/v1/subscribe`
2. Subscribe route calls `PipedriveAdapter.createOrUpdatePerson()` — gets person ID from response
3. Subscribe route emits `pipedrive.person_created` trigger with `pipedrivePersonId` in payload
4. Workflows fire immediately — no webhook latency, hard ID link established

**Path B — Pipedrive-originated persons (webhook):**
1. Person created directly in Pipedrive (by sales team, import, etc.)
2. Pipedrive sends webhook to `POST /api/v1/pipedrive-webhook?source={slug}`
3. Webhook route verifies auth, extracts person data including Pipedrive person ID
4. Emits `pipedrive.person_created` trigger with `pipedrivePersonId` from the webhook payload
5. Same workflows fire — RevLine creates a lead with the ID link, runs automations

Both paths emit the same trigger (`pipedrive.person_created`) with the same `pipedrivePersonId` field, so workflows are configured once and work regardless of where the person originated.

### Agent Activity Logging

When the agent engine sends an outbound message (SMS via Twilio, email via Resend), the channel delivery step is followed by a Pipedrive activity write:

```
Agent Engine → sendReply()
    │
    ├──► Channel Adapter (Twilio/Resend) → send message
    │
    └──► PipedriveAdapter.logActivity(pipedrivePersonId, {
             type: 'call' | 'email' | 'task',
             subject: 'Agent SMS to lead' | 'Agent email to lead',
             note: message content,
             channel: 'sms' | 'email',
             done: true
         })
         └──► Pipedrive Activities API (uses person ID, not email)
```

Pipedrive has native activity types — `call`, `email`, `meeting`, `task` — which map cleanly to agent channels. SMS messages use the `call` type (closest native match) or a custom activity type if configured. Email messages use the `email` type. The business sees every agent touchpoint in the Pipedrive person timeline.

**Wiring:** This is NOT a workflow action. Agent messages happen outside the workflow context (follow-ups via cron, replies via webhooks). The activity logging is wired directly into the agent engine's `sendReply()` path as a post-send hook. If the workspace has Pipedrive configured and the lead has a `pipedrivePersonId`, the hook fires. It's fire-and-forget — activity logging failure never blocks message delivery. See "Workflow Engine Considerations" for why this can't go through the engine.

### Field Sync

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

- **RevLine → Pipedrive:** When a workflow action updates lead properties, the adapter pushes mapped fields to Pipedrive.
- **Pipedrive → RevLine:** When a Pipedrive webhook delivers field changes, the adapter pulls mapped values back to the RevLine lead.

Custom Pipedrive person fields (like `member_barcode_abc`) are auto-created if they don't exist, similar to MailerLite's `ensureFieldsExist()` pattern. Pipedrive custom fields use auto-generated key hashes (e.g., `abc123def456`), so the adapter resolves by field name and caches the key mapping.

---

## Pipedrive API Surface

| API | Used For | Phase |
|-----|----------|-------|
| **Persons API** (`/v1/persons`, `/v1/persons/search`) | Create, update, search persons. Search by email, then create or update. | 1 |
| **PersonFields API** (`/v1/personFields`) | List/create custom person fields for field sync. | 2 |
| **Activities API** (`/v1/activities`) | Log agent SMS as call/task activities, agent emails as email activities on person timeline. Native types: call, email, meeting, task. | 2 |
| **Webhooks API** (`/v1/webhooks`) | Register webhooks for `added.person`, `updated.person`, `added.deal` events. | 2 |
| **Deals API** (`/v1/deals`) | Create/update deals tied to persons. Pipedrive is deal-centric — deals move through pipeline stages. | 3 |
| **Pipelines API** (`/v1/pipelines`, `/v1/stages`) | List pipelines and stages for deal routing. | 3 |

**SDK:** `pipedrive` npm package. The official SDK exists but is less polished than some alternatives — some endpoints may need raw `fetch` calls with the API token as a query parameter.

**Rate Limits:** ~80 requests per 2 seconds on the Professional plan. The adapter should track this and return `retryable: true` with `retryAfterMs` on 429 responses.

**Auth:** API Token passed as `?api_token={token}` query parameter (Pipedrive's standard auth method for API tokens). Stored as encrypted secret in `workspaceIntegration.secrets` via the existing keyring.

---

## File Touchpoints

### New Files

| File | Purpose |
|------|---------|
| `app/_lib/integrations/pipedrive.adapter.ts` | `PipedriveAdapter extends BaseIntegrationAdapter<PipedriveMeta>` — persons, fields, activities, deals |
| `app/_lib/workflow/executors/pipedrive.ts` | Workflow action executors: `create_or_update_person`, `update_person_fields`, `log_activity`, `create_deal` |
| `app/(dashboard)/workspaces/[id]/pipedrive-config-editor.tsx` | Structured meta editor — field mappings, pipeline/stage config |
| `app/api/v1/pipedrive-webhook/route.ts` | Inbound Pipedrive webhook handler (Phase 2) |
| `prisma/migrations/YYYYMMDD_add_pipedrive/migration.sql` | Prisma migration for enum additions |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PIPEDRIVE` to `IntegrationType` and `EventSystem` enums |
| `app/_lib/types/index.ts` | Add `PipedriveMeta` interface, add to `IntegrationMeta` union |
| `app/_lib/integrations/config.ts` | Add `'PIPEDRIVE'` to `INTEGRATION_TYPES` array and `INTEGRATIONS` record |
| `app/_lib/integrations/index.ts` | Export `PipedriveAdapter` and related types |
| `app/_lib/workflow/registry.ts` | Add `PIPEDRIVE_ADAPTER: AdapterDefinition` with triggers and actions |
| `app/_lib/workflow/executors/index.ts` | Import and register `pipedriveExecutors` in `EXECUTORS` map |
| `app/(dashboard)/workspaces/[id]/add-integration-form.tsx` | Add PIPEDRIVE to integration type options |
| `app/(dashboard)/workspaces/[id]/integration-actions.tsx` | Add PIPEDRIVE to `IntegrationType` union, `AVAILABLE_SECRET_NAMES`, import config editor |
| `package.json` | Add `pipedrive` dependency |

---

## Phase 1 — Core Person Sync + Workflow Actions

The minimum viable integration: forms push persons to Pipedrive, workflows can manage Pipedrive persons.

### 1.1 Prisma Schema

Add to `IntegrationType` enum:
```
PIPEDRIVE
```

Add to `EventSystem` enum:
```
PIPEDRIVE
```

Run `prisma migrate dev` to generate migration.

### 1.2 PipedriveAdapter Class

`app/_lib/integrations/pipedrive.adapter.ts`

Extends `BaseIntegrationAdapter<PipedriveMeta>`. Pattern follows `MailerLiteAdapter` closely.

**Secrets:**
- `"API Token"` — Pipedrive API token (required)

**Static factory:**
- `static async forClient(clientId: string): Promise<PipedriveAdapter | null>`
- `static async forWorkspace(workspaceId: string): Promise<PipedriveAdapter | null>` (alias)

**Core methods (Phase 1):**
- `createOrUpdatePerson(email: string, fields?: Record<string, string>): Promise<IntegrationResult<PipedrivePersonResult>>`
  - Search by email first: `GET /v1/persons/search?term={email}&fields=email`
  - If found: `PUT /v1/persons/{id}` with updated fields
  - If not found: `POST /v1/persons` with email, name, fields
  - Returns `{ pipedrivePersonId: number, isNew: boolean, fields: {...} }` — the ID is the critical return value
  - Auto-calls `touch()` on success, `markUnhealthy()` on failure
- `getPerson(identifier: number | string, byId?: boolean): Promise<IntegrationResult<PipedrivePerson | null>>`
  - Lookup by pipedrivePersonId (default) or by email search (`byId=false`)
- `updatePersonFields(pipedrivePersonId: number, fields: Record<string, string>): Promise<IntegrationResult<void>>`
  - Update specific fields on an existing person by Pipedrive ID — no email lookups
- `validateConfig(): { valid: boolean; errors: string[] }`

**Pipedrive API client:**
```typescript
private readonly baseUrl = 'https://api.pipedrive.com';

private getToken(): string {
  return this.getSecret('API Token') || this.getPrimarySecret();
}

private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${this.baseUrl}${path}?api_token=${this.getToken()}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { /* handle errors, rate limits */ }
  const json = await res.json();
  return json.data;
}
```

### 1.3 Integration Config

Add to `INTEGRATION_TYPES` and `INTEGRATIONS` in `app/_lib/integrations/config.ts`:

```typescript
PIPEDRIVE: {
  id: 'PIPEDRIVE',
  name: 'pipedrive',
  displayName: 'Pipedrive',
  color: 'text-green-500',
  hasStructuredEditor: true,
  secrets: [
    {
      name: 'API Token',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'API token from Pipedrive Settings > Personal Preferences > API',
      required: true,
    },
  ],
  metaTemplate: {
    fieldMap: {},
    defaultPipelineId: null,
    stageMap: {},
  },
  metaDescription: 'Configure field mappings between RevLine and Pipedrive, pipeline stages, and sync behavior',
  metaFields: [
    { key: 'fieldMap.*', description: 'Map RevLine lead properties to Pipedrive person field keys', required: false },
    { key: 'defaultPipelineId', description: 'Default pipeline ID for new deals' },
    { key: 'stageMap.*', description: 'Map RevLine lead stages to Pipedrive pipeline stage IDs' },
  ],
  tips: [
    'Find your API Token: Pipedrive Settings > Personal Preferences > API',
    'Field mappings: left = RevLine lead property key, right = Pipedrive person field key',
    'Custom Pipedrive fields use hash keys (e.g., "abc123def456") — use "Fetch Fields" to populate',
    'Pipeline stages are numeric IDs — use "Fetch Pipelines" to populate stage mappings',
  ],
  warnings: [
    'API tokens have full access to your Pipedrive account — treat like a password',
    'Rate limit: ~80 requests per 2 seconds (Professional plan)',
  ],
}
```

### 1.4 Workflow Registry + Executors

**Registry entry** in `app/_lib/workflow/registry.ts`:

```typescript
const PIPEDRIVE_ADAPTER: AdapterDefinition = {
  id: 'pipedrive',
  name: 'Pipedrive',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Token'],
  },
  triggers: {
    person_created: {
      name: 'person_created',
      label: 'Person Created',
      description: 'Fires when a person is created or captured in Pipedrive',
      payloadSchema: CommonPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'phone', label: 'Phone', type: 'text', required: false },
      ],
    },
    person_updated: {
      name: 'person_updated',
      label: 'Person Updated',
      description: 'Fires when a Pipedrive person field changes (via webhook)',
      payloadSchema: CommonPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'field', label: 'Changed Field', type: 'text', required: false },
      ],
    },
    deal_updated: {
      name: 'deal_updated',
      label: 'Deal Updated',
      description: 'Fires when a deal stage changes in Pipedrive (via webhook)',
      payloadSchema: CommonPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'dealId', label: 'Deal ID', type: 'number', required: false },
        { name: 'stageId', label: 'New Stage ID', type: 'number', required: false },
      ],
    },
  },
  actions: {
    create_or_update_person: {
      name: 'create_or_update_person',
      label: 'Create or Update Person',
      description: 'Upsert a person in Pipedrive by email with optional fields',
      paramsSchema: z.object({
        fields: z.record(z.string()).optional(),
      }),
    },
    update_person_fields: {
      name: 'update_person_fields',
      label: 'Update Person Fields',
      description: 'Update specific fields on an existing Pipedrive person',
      paramsSchema: z.object({
        fields: z.record(z.string()),
      }),
    },
    create_deal: {
      name: 'create_deal',
      label: 'Create Deal',
      description: 'Create a deal linked to the person in the configured pipeline',
      paramsSchema: z.object({
        title: z.string().optional(),
        pipelineId: z.number().optional(),
        stageId: z.number().optional(),
        value: z.number().optional(),
        currency: z.string().optional(),
      }),
    },
  },
};
```

**Executors** in `app/_lib/workflow/executors/pipedrive.ts`:

Each executor follows the established pattern: load adapter via `PipedriveAdapter.forClient()`, handle `ctx.isTest` for dry-run, call adapter method, emit event via `EventSystem.PIPEDRIVE`, return `ActionResult`.

### 1.5 Dashboard Wire-Up

- `add-integration-form.tsx`: Add `'PIPEDRIVE'` to the integration type and wire secret inputs
- `integration-actions.tsx`: Add `'PIPEDRIVE'` to `IntegrationType` union and `AVAILABLE_SECRET_NAMES` (`['API Token']`), import and render `PipedriveConfigEditor`
- `pipedrive-config-editor.tsx`: Structured editor for field map (table of RevLine key → Pipedrive field key), pipeline/stage config, "Fetch Fields" and "Fetch Pipelines" buttons, test connection button

### 1.6 Subscribe Route — Pipedrive-First Capture

Modify `app/api/v1/subscribe/route.ts`:

After validation and client gate, before emitting the trigger:
1. Check if workspace has a Pipedrive integration configured
2. If yes: call `PipedriveAdapter.createOrUpdatePerson(email, mappedFields)`
3. Capture `pipedrivePersonId` from the API response
4. Emit trigger as `{ adapter: 'pipedrive', operation: 'person_created' }` with `pipedrivePersonId` in payload
5. The `revline.create_lead` executor stores `pipedrivePersonId` on the lead
6. All downstream Pipedrive actions use the ID directly

**Failure path:**
- If Pipedrive API call fails: still emit trigger (degrade gracefully)
- Pass `pipedriveSyncPending: true` in payload instead of `pipedrivePersonId`
- Log structured error with correlation ID
- Lead is created without a Pipedrive link — reconciliation picks it up later

Non-Pipedrive workspaces continue using `revline.email_captured` unchanged.

---

## Phase 2 — Webhooks, Activities, Field Sync

### 2.1 Pipedrive Webhook Route

`app/api/v1/pipedrive-webhook/route.ts`

- Receives `added.person`, `updated.person`, `updated.deal` events
- Pipedrive webhooks include HTTP Basic Auth credentials set during registration — verify against stored credentials
- Extracts person data, resolves workspace via `?source={slug}`
- Emits `pipedrive.person_created`, `pipedrive.person_updated`, or `pipedrive.deal_updated` trigger
- Rate limit: 100 requests per minute per workspace (matches existing webhook limits)

This is the second entry point — covers persons created directly in Pipedrive by the sales team, via import, or through other tools.

### 2.2 Field Sync System

Add methods to `PipedriveAdapter`:
- `syncFieldsToPipedrive(leadId: string): Promise<IntegrationResult<void>>` — reads lead properties, applies `fieldMap` from meta, pushes to Pipedrive
- `syncFieldsFromPipedrive(pipedrivePersonId: number, pipedriveFields: Record<string, unknown>): Promise<IntegrationResult<void>>` — reverse mapping, updates RevLine lead
- `ensureCustomFieldsExist(fieldNames: string[]): Promise<void>` — auto-creates custom Pipedrive person fields if missing (same pattern as MailerLite's `ensureFieldsExist()`)

Pipedrive custom fields use auto-generated hash keys (e.g., `abc123def456_member_barcode`). The adapter maintains a name-to-key cache resolved via `GET /v1/personFields` so the meta config can use human-readable names while the API calls use the hash keys.

Field sync fires:
- **Outbound (RevLine → Pipedrive):** After any `revline.update_lead_properties` action in a workflow
- **Inbound (Pipedrive → RevLine):** On `updated.person` webhook events

### 2.3 Agent Activity → Pipedrive Activities

Add methods to `PipedriveAdapter`:
- `logActivity(pipedrivePersonId: number, activity: PipedriveActivity): Promise<IntegrationResult<void>>`
- Falls back to email-based person search only if `pipedrivePersonId` is not available (shouldn't happen in normal flow)

`PipedriveActivity` type:
```typescript
interface PipedriveActivity {
  type: 'call' | 'email' | 'meeting' | 'task';
  subject: string;
  note: string;
  channel: 'sms' | 'email' | 'webchat';
  done: boolean;          // true for completed activities (sent messages)
  dueDate?: string;       // ISO date
  duration?: string;      // HH:MM format
}
```

Pipedrive's native activity types map cleanly to agent channels:
- **SMS** → `call` type (closest native match for phone-based communication) or custom activity type
- **Email** → `email` type (native)
- **Webchat** → `task` type with a note

**Integration point — agent engine, not workflow engine:**

The agent engine's send path (`sendReply()` in `app/_lib/agent/engine.ts`) gets a post-send hook:
1. After channel adapter delivers the message successfully
2. Look up the lead's `pipedrivePersonId` from `lead.properties`
3. If present and workspace has Pipedrive configured: call `PipedriveAdapter.logActivity(pipedrivePersonId, ...)`
4. Fire-and-forget — wrap in try/catch, log errors, never block delivery

This covers all three agent send contexts: reactive replies, proactive outreach, and follow-up sequences.

The executor `log_activity` is ALSO registered as a workflow action for explicit use in workflow definitions (e.g., logging a custom note when a Stripe payment comes in).

### 2.4 Deal Stage Mapping

`stageMap` in meta config maps RevLine lead stages to Pipedrive pipeline stages:

```json
{
  "defaultPipelineId": 1,
  "stageMap": {
    "CAPTURED": 1,
    "BOOKED": 2,
    "PAID": 3,
    "DEAD": 4
  }
}
```

Values are numeric Pipedrive stage IDs within the configured pipeline. When a `revline.update_lead_stage` action fires in a workflow, a post-action hook (or chained workflow action) calls `PipedriveAdapter.updateDeal()` to move the deal to the mapped stage.

Pipedrive is deal-centric — leads progress through pipeline stages via deals, not via a "lifecycle stage" property like HubSpot. This means the deal is the primary tracking object for sales progression.

---

## Phase 3 — Deals and Pipelines

Pipedrive is fundamentally deal-centric. Phase 3 elevates deals to a first-class workflow concept.

### 3.1 Deal Management

- `createDeal(pipedrivePersonId: number, deal: PipedriveDeal): Promise<IntegrationResult<PipedriveDealResult>>` — create a deal linked to a person
- `updateDeal(dealId: number, fields: Record<string, unknown>): Promise<IntegrationResult<void>>` — update deal stage, value, etc.
- `getDeal(dealId: number): Promise<IntegrationResult<PipedriveDeal | null>>`
- Deals are created automatically when a lead enters a pipeline (configurable per workflow)
- Deal value can be set from Stripe payment data when payment events occur

### 3.2 Organization Linking

- Optionally link persons to Pipedrive organizations
- Useful for B2B workspaces where multiple contacts belong to the same company
- Lower priority — most RevLine workspaces are B2C (gyms, personal training, etc.)

---

## PipedriveMeta Interface

```typescript
interface PipedriveMeta {
  /** RevLine property key → Pipedrive person field key */
  fieldMap?: Record<string, string>;
  /** Default pipeline ID for new deals */
  defaultPipelineId?: number;
  /** RevLine lead stage → Pipedrive stage ID (within the default pipeline) */
  stageMap?: Record<string, number>;
  /** Whether to auto-create a deal when a person is created */
  autoCreateDeal?: boolean;
  /** Default deal title template (supports {name}, {email} placeholders) */
  dealTitleTemplate?: string;
  /** Whether to log agent activities to Pipedrive (default: true if Pipedrive configured) */
  logActivities?: boolean;
  /** Custom activity type key for SMS (if configured in Pipedrive, otherwise uses "call") */
  smsActivityType?: string;
  /** Cached field key mappings: human-readable name → Pipedrive hash key */
  fieldKeyCache?: Record<string, string>;
}
```

**Lead properties (stored on `lead.properties` jsonb):**
```typescript
{
  pipedrivePersonId?: number;      // e.g., 842 — set on creation, used for all subsequent operations
  pipedriveDealId?: number;        // e.g., 1337 — if a deal was auto-created
  pipedriveSyncPending?: boolean;  // true if Pipedrive creation failed and needs retry
}
```

---

## Workflow Engine Considerations

The current workflow engine (`app/_lib/workflow/engine.ts`) is synchronous and sequential: actions execute one at a time in a `for` loop, and the first failure stops the entire workflow. This design is simple and reliable, but the Pipedrive integration pushes against some of its boundaries.

### What Works Fine Today

**Person creation in the subscribe route (outside the engine):** The Pipedrive upsert happens before `emitTrigger()` is called, so Pipedrive API latency doesn't add to workflow execution time. This is the right call — the engine doesn't need to handle it.

**Pipedrive actions in workflows:** Simple actions like `update_person_fields` or `create_or_update_person` work fine as sequential steps. They're ~200-500ms each (slightly higher than single-call APIs due to the search-then-upsert pattern), which is acceptable in a workflow that already includes a `create_lead` DB write and possibly an `add_to_group` MailerLite call.

**Context propagation for pipedrivePersonId:** The engine already supports this. When `revline.create_lead` returns `{ leadId, pipedrivePersonId }`, both values merge into `ctx.actionData` and flow to subsequent actions.

### Where It Gets Tight

**"Stop on first error" vs. non-critical actions.** If a workflow has `create_lead → update_pipedrive_fields → route_to_agent`, and the Pipedrive step fails (rate limited, token expired), the agent never gets routed. For the business, the agent not texting the lead is worse than Pipedrive being slightly out of date. Today, there's no way to mark an action as "continue on failure."

**Agent activity logging can't use the engine.** Agent messages happen in three contexts that are all outside workflow execution:
1. `handleInboundMessage()` — triggered by Twilio/Resend webhooks, not by the workflow engine
2. `initiateConversation()` — called from the `route_to_agent` executor, but the actual AI reply and channel send happen inside the agent engine
3. Follow-up sequences — fired by the `/api/v1/cron/follow-ups` cron job

None of these go through `emitTrigger()`. The activity logging must be wired directly into the agent engine's send path.

**No fire-and-forget.** Every action is `await`ed. For Pipedrive activity logging, we want "try to log this, don't wait for it, don't fail if it errors." The engine doesn't support this — but it doesn't need to, since activity logging goes through the agent engine, not the workflow engine.

### What We DON'T Need to Change (Yet)

**Async/queue-based execution.** The current synchronous model is fine for the Pipedrive integration. Workflows run in the context of an HTTP request (subscribe, webhook), and the total execution time stays under 5-10 seconds even with 3-4 actions. There's no need for a job queue or background workers at this scale.

**Parallel action execution.** Nice to have but not blocking. Pipedrive actions could theoretically run in parallel with MailerLite actions, but the latency savings (~200ms) don't justify the complexity.

**Conditional branching.** The `conditions` field on `WorkflowAction` is reserved but not implemented. Pipedrive doesn't create a need for it — the existing trigger filter handles routing.

### Recommended Engine Enhancement (Small, Optional)

A single addition would make the engine significantly more resilient for Pipedrive and future integrations:

**`continueOnError` flag on actions.** If set, a failed action logs the error and continues to the next action instead of stopping the workflow. The workflow still records the failure in `actionResults`, and the final status is `COMPLETED_WITH_WARNINGS` instead of `FAILED`.

```typescript
interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  continueOnError?: boolean;  // NEW: don't stop workflow on failure
}
```

This is a ~15-line change to the engine's action loop. It solves the "Pipedrive is down but the agent should still text" problem without introducing async complexity.

**Verdict:** The engine does not need a rewrite or async upgrade for the Pipedrive integration. The architecture already handles the hard parts (Pipedrive person creation happens outside the engine, activity logging goes through the agent engine). A small `continueOnError` flag would be a quality-of-life improvement but is not strictly required for Phase 1.

---

## Open Questions

- **Webhook registration:** Pipedrive webhooks are registered via the API (`POST /v1/webhooks`). Should the dashboard auto-register webhooks when the integration is added, or require the admin to set them up manually? Auto-registration is straightforward since it's just an API call with the target URL and event types.
- **Activity type for SMS:** Pipedrive has `call`, `email`, `meeting`, `task` as built-in activity types. Custom types can be created in Pipedrive settings. Options: (a) use `call` for SMS (closest phone-based match), (b) create a custom "SMS" activity type via the API, (c) make it configurable in meta (`smsActivityType`). Option (c) with `call` as default is the most flexible.
- **Person deduplication:** Pipedrive does NOT deduplicate by email natively on create. The adapter must search first (`/v1/persons/search?term={email}&fields=email`), then create or update. This adds one API call for new persons. The search is fast (~100ms) and reliable.
- **Custom field key hashing:** Pipedrive auto-generates hash keys for custom fields (e.g., `abc123_barcode`). The adapter needs a field name-to-key resolver that caches the mapping. This is fetched once via `GET /v1/personFields` and cached in the adapter instance (or in meta as `fieldKeyCache`).
- **Deal auto-creation:** Should a deal be auto-created when a person enters the system? Configurable via `autoCreateDeal` in meta. If enabled, the subscribe route (or a workflow action) creates a deal in the default pipeline when the person is created.
- **Multi-account workspaces:** Can a single workspace connect to multiple Pipedrive accounts? For now, no — one Pipedrive integration per workspace, consistent with all other integration types.

---

## Example Workflow Configurations

**Landing page capture → Pipedrive + agent:**
```json
{
  "name": "New lead from landing page",
  "triggerAdapter": "pipedrive",
  "triggerOperation": "person_created",
  "actions": [
    {
      "adapter": "revline",
      "operation": "create_lead",
      "params": { "stage": "CAPTURED" }
    },
    {
      "adapter": "pipedrive",
      "operation": "create_deal",
      "params": {
        "title": "New lead — {name}",
        "stageId": 1
      },
      "continueOnError": true
    },
    {
      "adapter": "agent",
      "operation": "route_to_agent",
      "params": { "agentId": "..." }
    }
  ]
}
```

**Stripe payment → update Pipedrive deal stage:**
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
      "params": {
        "fields": { "lead_status": "Won" }
      }
    }
  ]
}
```

---

## Complexity Estimate

| Component | Est. Lines | Difficulty | Reference |
|-----------|-----------|------------|-----------|
| `pipedrive.adapter.ts` | 450–650 | Medium | `mailerlite.adapter.ts` (250 lines); slightly more due to search-then-upsert |
| `executors/pipedrive.ts` | 250–350 | Low | `executors/mailerlite.ts` (260 lines); more actions (deals) |
| `pipedrive-config-editor.tsx` | 350–500 | Medium | `abc-ignite-config-editor.tsx`; fetch fields/pipelines UI |
| Webhook route (Phase 2) | 150–200 | Medium | `calendly-webhook/route.ts` |
| Schema + config + registry changes | ~100 total | Low | Mechanical — follow existing patterns |
| Subscribe route modification | ~30 | Low | Conditional addition |

**Total new code:** ~1,300–1,800 lines across 5 new files and ~10 modified files.

**Comparable to:** Slightly larger than the MailerLite integration, significantly smaller than ABC Ignite. The search-then-upsert pattern and deal management add ~100 lines over a HubSpot-equivalent adapter. Raw fetch calls instead of a polished SDK add minor boilerplate but keep the dependency lightweight.
