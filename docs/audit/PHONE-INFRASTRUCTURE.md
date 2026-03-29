# Audit Fixes: Phone Infrastructure

> **Assignee:** Agent 2 — Phone plan
> **Generated:** March 28, 2026
> **Reference:** `docs/STANDARDS.md`

---

## FAIL — Must Fix

### F1 — Phone config PATCH/DELETE not scoped by workspaceId
**File:** `app/api/v1/workspaces/[id]/phone-configs/[configId]/route.ts`
**Severity:** HIGH

PATCH uses `prisma.phoneConfig.update({ where: { id: configId }, data })` — the WHERE clause uses only `id`, not scoped by `workspaceId`. Same issue in DELETE: `prisma.phoneConfig.delete({ where: { id: configId } })`.

Both rely on a prior `findFirst` ownership check, but this violates defense-in-depth workspace isolation. A TOCTOU race is theoretically possible.

**Fix:** Either:
- Use `prisma.phoneConfig.updateMany({ where: { id: configId, workspaceId }, data })` (and check `count > 0`)
- Or wrap the findFirst + update in a transaction

Same pattern for DELETE.

---

### F8 — Phone config list GET: No try/catch
**File:** `app/api/v1/workspaces/[id]/phone-configs/route.ts` GET handler
**Severity:** MEDIUM

`prisma.phoneConfig.findMany` at ~L58 has no try/catch. A DB connection error returns an unstructured 500.

**Fix:** Wrap in try/catch, return `ApiResponse.error('Failed to load phone configs', 500)`.

---

### F9 — Voice webhook payload not Zod-validated
**File:** `app/api/v1/twilio-voice/route.ts`
**Severity:** MEDIUM

`CallSid`, `From`, `To`, `CallerCity`, `CallerState`, `CallerCountry` are extracted from an unvalidated `Record<string, string>` (form body). Standards require all external input validated with Zod.

**Fix:** Add a Zod schema:

```typescript
const TwilioVoicePayloadSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
  CallerCity: z.string().optional(),
  CallerState: z.string().optional(),
  CallerCountry: z.string().optional(),
});
```

Parse the form body through this before extracting fields.

---

## WARN — Should Fix

### W5 — Phone config GET by ID: No try/catch
**File:** `app/api/v1/workspaces/[id]/phone-configs/[configId]/route.ts` GET handler
**Severity:** Medium

`prisma.phoneConfig.findFirst` at ~L46 has no try/catch. Same class of issue as F8.

**Fix:** Wrap in try/catch.

---

### W6 — PATCH/DELETE catch blocks don't log errors
**File:** `app/api/v1/workspaces/[id]/phone-configs/[configId]/route.ts`
**Severity:** Low

PATCH and DELETE catch blocks return generic 500 errors but don't call `logStructured` before returning.

**Fix:** Add `logStructured({ system: EventSystem.BACKEND, eventType: 'phone_config_update_error', ... })` in each catch block.

---

### W7 — Event names lack system prefix
**File:** `app/_lib/phone/missed-call-handler.ts`
**Severity:** Low

Events like `missed_call_auto_text_sent`, `missed_call_agent_started`, `missed_call_notification_sent` don't follow the `{system}_{action}_{outcome}` convention. Compare: L88 correctly uses `twilio_missed_call`.

**Fix:** Rename to `twilio_auto_text_sent`, `twilio_agent_started`, `twilio_notification_sent` etc., keeping the system prefix consistent.

---

### W8 — TwiML utilities duplicated across webhook routes
**Files:**
- `app/api/v1/twilio-voice/route.ts`
- `app/api/v1/twilio-webhook/route.ts`

**Severity:** Low

`parseFormBody`, `getWebhookUrl`, `escapeXml`, `twimlResponse`, and `EMPTY_TWIML` are duplicated between both files.

**Fix:** Extract to a shared module at `app/_lib/phone/twiml-utils.ts` (or `app/_lib/integrations/twilio-utils.ts`) and import from both routes.

---

### W17 — `PhoneConfig.mode` should be a Prisma enum
**File:** `prisma/schema.prisma` (`PhoneConfig` model)
**Severity:** Medium

`mode` is a bare `String` with valid values `"NOTIFICATION"` / `"AGENT"`. No DB-level constraint — only app-layer Zod validation prevents bad values.

**Fix:** Create a Prisma enum:

```prisma
enum PhoneConfigMode {
  NOTIFICATION
  AGENT
}
```

Update the field to `mode PhoneConfigMode @default(NOTIFICATION)`. Requires a migration.

---

## Checklist

- [ ] F1 — scope PATCH/DELETE mutations by workspaceId
- [ ] F8 — try/catch on phone config list GET
- [ ] F9 — Zod schema for voice webhook payload
- [ ] W5 — try/catch on phone config GET by ID
- [ ] W6 — logStructured in PATCH/DELETE catch blocks
- [ ] W7 — add system prefix to missed-call event names
- [ ] W8 — extract shared TwiML utilities
- [ ] W17 — convert PhoneConfig.mode to Prisma enum
