# Audit Fixes: Engine / Executors / Pipedrive / Sync

> **Assignee:** Agent 1 — Pipedrive, sync, executors, engine
> **Generated:** March 28, 2026
> **Reference:** `docs/STANDARDS.md`

---

## FAIL — Must Fix

### F2 — `agents/route.ts`: No try/catch around Prisma calls
**File:** `app/api/v1/workspaces/[id]/agents/route.ts`
**Severity:** HIGH

GET handler calls `prisma.agent.findMany` with no try/catch. POST handler calls `prisma.agent.create` with no try/catch. DB errors (connection, constraint violation) return unstructured 500s.

**Fix:** Wrap both handlers in try/catch, return `ApiResponse.error(...)` on failure.

---

### F3 — `agents/route.ts`: Path param not Zod-validated
**File:** `app/api/v1/workspaces/[id]/agents/route.ts`
**Severity:** HIGH

`const { id: workspaceId } = await params` — raw string goes straight to `getWorkspaceAccess` and Prisma with no UUID validation.

**Fix:** Add `z.string().uuid().safeParse(id)` guard at the top of both handlers.

---

### F4 — `agents/route.ts`: No event on agent creation
**File:** `app/api/v1/workspaces/[id]/agents/route.ts`
**Severity:** HIGH

Creating an agent is a significant state change with zero event emission. Standards require all meaningful state changes emit events.

**Fix:** After successful `prisma.agent.create`, emit `agent_created` event with `workspaceId`, `agentId`, `channelType`.

---

### F5 — `engine.ts` `loadAgent()`: Unsafe `as` casts on 5 JsonValue fields
**File:** `app/_lib/agent/engine.ts` (in `loadAgent()`)
**Severity:** HIGH

Five Prisma `JsonValue` fields are cast without runtime validation:
- `agent.channels as Array<{...}>`
- `agent.allowedEvents as string[]`
- `agent.enabledTools as string[]`
- `agent.followUpSequence as Array<{delayMinutes: number; ...}>`
- `agent.guardrails as Partial<GuardrailConfig> | null`

A single corrupt DB row causes silent runtime failures across the entire agent engine.

**Fix:** Create Zod schemas for each shape. Use `.safeParse()` with fallback defaults (empty array, `{}`, etc). Example pattern:

```typescript
const ChannelsSchema = z.array(z.object({
  type: z.string(),
  integrationId: z.string().optional(),
})).catch([]);

const channels = ChannelsSchema.parse(agent.channels);
```

---

### F6 — `workflow/engine.ts`: Unsafe double cast on `workflow.actions`
**File:** `app/_lib/workflow/engine.ts` ~L105
**Severity:** HIGH

`workflow.actions as unknown as WorkflowAction[]` — if stored JSON is malformed, the action execution loop crashes with no structured error.

**Fix:** Validate with a Zod schema for `WorkflowAction[]` before iterating. On parse failure, mark execution as failed with a clear error message.

---

### F7 — `revline.ts`: Unsafe casts on `leadPropertySchema` and `leadStages`
**File:** `app/_lib/workflow/executors/revline.ts` ~L37, ~L224
**Severity:** HIGH

`workspace?.leadPropertySchema as LeadPropertyDefinition[] | null` and `workspace?.leadStages as LeadStageDefinition[] | null` — these control all lead property/stage validation. Corrupt values propagate silently.

**Fix:** Create Zod schemas for `LeadPropertyDefinition[]` and `LeadStageDefinition[]`. Use `.safeParse()` with `[]` fallback.

---

### F10 — `test/route.ts`: No events on integration test
**File:** `app/api/v1/integrations/[id]/test/route.ts`
**Severity:** MEDIUM

Testing an integration connection emits no events on success or failure.

**Fix:** Emit `integration_test_success` / `integration_test_failed` with `workspaceId`, `integrationType`.

---

### F11a — Missing explicit return types
**Files:**
- `app/api/v1/workspaces/[id]/agents/route.ts` — both `GET` and `POST`
- `app/api/v1/integrations/[id]/test/route.ts` — `POST`
- `app/api/v1/resend-inbound/route.ts` — `POST`

**Severity:** MEDIUM

Standards require explicit return types on all exported functions.

**Fix:** Add `Promise<NextResponse>` (or `Promise<Response>`) return type to each.

---

## WARN — Should Fix

### W3 — `revline.ts`: `console.error`/`console.warn` instead of `logStructured`
**File:** `app/_lib/workflow/executors/revline.ts` ~L70, ~L148
**Severity:** Medium

Two calls use `console.error`/`console.warn` — invisible to structured observability tooling.

**Fix:** Replace with `logStructured()` including `workspaceId` in metadata.

---

### W4 — `pipedrive.ts`: No local try/catch around adapter calls
**File:** `app/_lib/workflow/executors/pipedrive.ts` ~L63, ~L152
**Severity:** Medium

`adapter.createOrUpdatePerson()` and `adapter.updatePersonFields()` have no local try/catch. Errors propagate to the workflow engine's generic catch block, losing Pipedrive-specific failure events.

**Fix:** Wrap each in try/catch, emit `pipedrive_*_failed` on error, then re-throw or return error result.

---

### W9 — `integration-sync.service.ts`: `applyRetryResult` has no try/catch
**File:** `app/_lib/services/integration-sync.service.ts`
**Severity:** Medium

Errors propagate raw to the cron caller. Service should be self-contained.

**Fix:** Wrap in try/catch, return structured result.

---

### W10 — `integration-sync.service.ts`: Schema update outside transaction
**File:** `app/_lib/services/integration-sync.service.ts`
**Severity:** Medium

`ensurePipedrivePropertyInSchema` runs outside `withTransaction` in `applyRetryResult`. If it fails, the queue entry is already marked COMPLETED but workspace schema is inconsistent.

**Fix:** Move inside transaction, or add standalone try/catch with recovery logic.

---

### W11 — `cron/integration-sync/route.ts`: Cron auth uses `===`
**File:** `app/api/v1/cron/integration-sync/route.ts` ~L36
**Severity:** Medium

`authHeader === \`Bearer ${cronSecret}\`` uses regular string comparison instead of timing-safe comparison.

**Fix:** Use `crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))` with length check.

---

### W12 — Integration routes: Initial DB lookup not scoped by workspaceId
**Files:**
- `app/api/v1/integrations/[id]/pipedrive-fields/route.ts`
- `app/api/v1/integrations/[id]/test/route.ts`

**Severity:** Medium

`findUnique({ where: { id } })` fetches by PK alone. Access is checked afterward, but defense-in-depth says the query itself should be scoped.

**Fix:** Include `workspaceId` in the query or use a compound lookup.

---

### W13 — Integration routes: Raw `NextResponse.json()` instead of `ApiResponse`
**Files:** Same as W12
**Severity:** Low

Inconsistent error response shape.

**Fix:** Switch to `ApiResponse.success()` / `ApiResponse.error()`.

---

### W14 — `agents/route.ts`: No transaction around integration checks + create
**File:** `app/api/v1/workspaces/[id]/agents/route.ts`
**Severity:** Medium

POST does multiple reads (integration checks) then a create. TOCTOU race: an integration could be deleted between check and create.

**Fix:** Wrap the integration checks + `prisma.agent.create` in `withTransaction`.

---

### W15 — `engine.ts`: `turnLog` double casts
**File:** `app/_lib/agent/engine.ts` ~L462, L568, L880, L963
**Severity:** Low

`turnLog as unknown as Prisma.InputJsonValue` — acceptable for writes, but a Zod schema validating `TurnLogEntry[]` before storage would be safer.

---

### W16 — `workflow/engine.ts`: `triggerFilter` unsafe cast
**File:** `app/_lib/workflow/engine.ts` ~L95
**Severity:** Low

`triggerFilter as Record<string, unknown> | null` — non-object values would cause silent bugs in `matchesFilter`.

**Fix:** Zod parse or `typeof` guard.

---

## Checklist

- [ ] F2 — try/catch on agents route GET/POST
- [ ] F3 — Zod validate path param on agents route
- [ ] F4 — emit `agent_created` event
- [ ] F5 — Zod schemas for 5 JsonValue fields in `loadAgent()`
- [ ] F6 — Zod validate `workflow.actions` before execution loop
- [ ] F7 — Zod validate `leadPropertySchema` and `leadStages`
- [ ] F10 — emit events on integration test
- [ ] F11a — add return types to exported route handlers
- [ ] W3 — replace console.error/warn with logStructured in revline.ts
- [ ] W4 — add try/catch in pipedrive executor
- [ ] W9 — add try/catch in applyRetryResult
- [ ] W10 — move schema update inside transaction
- [ ] W11 — timing-safe comparison for cron auth
- [ ] W12 — scope integration lookups by workspaceId
- [ ] W13 — switch to ApiResponse helper
- [ ] W14 — wrap agent creation in transaction
- [ ] W15 — optional: Zod validate turnLog before write
- [ ] W16 — optional: Zod validate triggerFilter
