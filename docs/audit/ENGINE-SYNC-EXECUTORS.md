# Audit Fixes: Engine / Sync / Pipedrive Phase 2

> **Assignee:** Agent 1 — Pipedrive, sync, executors, engine
> **Generated:** March 29, 2026 (Round 3)
> **Reference:** `docs/STANDARDS.md`

---

## FAIL — Must Fix

### F1 — `syncInboundFields()`: Query fetches arbitrary lead (CRITICAL)
**File:** `app/_lib/services/integration-sync.service.ts` — `syncInboundFields()`
**Severity:** CRITICAL

`prisma.lead.findFirst({ where: { workspaceId } })` fetches an **arbitrary** lead in the workspace, then manually checks if `pipedrivePersonId` matches. In any workspace with more than one lead, this will almost always pick the wrong lead and silently no-op. Field sync is completely broken for multi-lead workspaces.

**Fix:** Filter by `pipedrivePersonId` inside the query using Prisma's JSON path filter:

```typescript
const lead = await prisma.lead.findFirst({
  where: {
    workspaceId: opts.workspaceId,
    properties: {
      path: ['pipedrivePersonId'],
      equals: opts.pipedrivePersonId,
    },
  },
  select: { id: true, properties: true },
});
```

Remove the manual `pipedrivePersonId` comparison after the query.

---

### F2 — `syncInboundFields()`: Read-then-write without transaction
**File:** `app/_lib/services/integration-sync.service.ts` — `syncInboundFields()`
**Severity:** HIGH

Reads `lead.properties`, merges new fields, then writes back in two separate DB calls. A concurrent update between the read and write loses data (classic TOCTOU).

**Fix:** Wrap in `withTransaction`:

```typescript
await withTransaction(async (tx) => {
  const lead = await tx.lead.findFirst({ where: { ... }, select: { id: true, properties: true } });
  // ... merge logic ...
  await tx.lead.update({ where: { id: lead.id }, data: { properties: merged } });
});
```

---

### F3 — `PipedriveMeta`: Duplicate `logActivities` property
**File:** `app/_lib/types/index.ts` — `PipedriveMeta` interface
**Severity:** HIGH

`logActivities?: boolean` is declared **twice** (~L826 and ~L828) with different JSDoc comments. Copy-paste error. TypeScript silently merges duplicates of the same type, but the second shadows the first's documentation.

**Fix:** Remove the duplicate declaration. Keep whichever JSDoc is more accurate.

---

## WARN — Should Fix

### W1 — `integration-sync.service.ts`: 3 unsafe `as` casts on JsonValue
**File:** `app/_lib/services/integration-sync.service.ts` ~L157, L229, L294
**Severity:** Medium

`lead.properties as Record<string, unknown>` and `leadPropertySchema as LeadPropertyDefinition[]` — Prisma `JsonValue` without Zod validation.

**Fix:** Use a shared utility pattern:

```typescript
const properties = z.record(z.unknown()).catch({}).parse(lead.properties);
```

Or create a reusable `parseJsonProperties(value: Prisma.JsonValue)` helper.

---

### W2 — `integration-sync.service.ts`: 4 `console.error` calls remain
**File:** `app/_lib/services/integration-sync.service.ts` ~L123, L173, L189, L304
**Severity:** Medium

Still using `console.error` instead of `logStructured`. These are invisible to structured observability.

**Fix:** Replace all four with `logStructured()` including `workspaceId` in metadata.

---

### W3 — `ensurePipedrivePropertyInSchema()`: TOCTOU on workspace schema
**File:** `app/_lib/services/integration-sync.service.ts`
**Severity:** Medium

Same read-then-write pattern as F2 but on the workspace's `leadPropertySchema`. Concurrent calls could drop a newly added property.

**Fix:** Wrap in `withTransaction`, or use Prisma's JSONB append if available.

---

### W4 — `verifySecret()`: Secret length leak via timing side-channel
**File:** `app/api/v1/pipedrive-webhook/route.ts` — `verifySecret()`
**Severity:** Medium

`if (provided.length !== stored.length) return false` reveals the exact length of the webhook secret through response time measurement.

**Fix:** Hash both values with SHA-256 before comparing (hashes are always 32 bytes):

```typescript
function verifySecret(provided: string, stored: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}
```

---

### W5 — Pipedrive webhook returns 401 on invalid secret
**File:** `app/api/v1/pipedrive-webhook/route.ts` ~L116
**Severity:** Medium

Invalid webhook secret returns `ApiResponse.error(401)`. Pipedrive will retry failed deliveries, creating unnecessary load. Standards say webhooks return 200 on failures.

**Fix:** Change to `ApiResponse.webhookAck()` and emit a warning event instead. The event already fires — just change the HTTP response.

---

### W6 — `pipedrive-activity.ts`: Unsafe `as` cast on lead.properties
**File:** `app/_lib/agent/pipedrive-activity.ts` ~L44
**Severity:** Medium

`lead.properties as Record<string, unknown>` — Prisma `JsonValue` without Zod.

**Fix:** Same pattern as W1 — use `z.record(z.unknown()).catch({}).parse(...)`.

---

### W7 — `pipedrive-activity.ts`: Silent catch with zero logging
**File:** `app/_lib/agent/pipedrive-activity.ts` ~L84-86
**Severity:** Low

Outer catch block swallows all errors with no logging. Failures are completely invisible.

**Fix:** Add `logStructured` at warn level with `workspaceId` and error message.

---

### W8 — `deriveResolution`: No branch for PAUSED status
**File:** `app/_lib/agent/engine.ts` — `deriveResolution()`
**Severity:** Medium

`PAUSED` is a valid `ConversationStatus` but `deriveResolution` has no explicit branch for it. Not a bug today (never called with PAUSED), but a defensive gap.

**Fix:** Add an explicit `case ConversationStatus.PAUSED:` branch, or add a comment explaining why it's excluded.

---

### W9 — `engine.ts`: Dead `finalStatus` variable
**File:** `app/_lib/agent/engine.ts` ~L994
**Severity:** Low

`finalStatus` is declared but never referenced. The actual status update uses `ConversationStatus.COMPLETED` inline.

**Fix:** Remove the dead variable.

---

### W10 — `engine.ts`: `tokenResolution!` non-null assertions
**File:** `app/_lib/agent/engine.ts` ~L1018, L1036
**Severity:** Low

Logically safe (guarded by `hitTokenLimit`) but non-null assertions are a code smell.

**Fix:** Extract the token-limit block into a conditional that narrows the type naturally.

---

## Checklist

- [ ] F1 — Fix syncInboundFields query to filter by pipedrivePersonId via JSON path
- [ ] F2 — Wrap syncInboundFields read+write in withTransaction
- [ ] F3 — Remove duplicate logActivities property from PipedriveMeta
- [ ] W1 — Replace 3 unsafe as casts with Zod in integration-sync.service.ts
- [ ] W2 — Migrate 4 console.error calls to logStructured
- [ ] W3 — Wrap ensurePipedrivePropertyInSchema in transaction
- [ ] W4 — Hash both sides before timingSafeEqual in verifySecret
- [ ] W5 — Return 200 (webhookAck) on invalid Pipedrive webhook secret
- [ ] W6 — Zod validate lead.properties in pipedrive-activity.ts
- [ ] W7 — Add logStructured to silent catch in pipedrive-activity.ts
- [ ] W8 — Add PAUSED branch or comment to deriveResolution
- [ ] W9 — Remove dead finalStatus variable
- [ ] W10 — Narrow tokenResolution type instead of non-null assertion
