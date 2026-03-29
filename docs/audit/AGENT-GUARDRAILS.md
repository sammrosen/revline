# Audit Fixes: Agent Guardrails

> **Assignee:** Agent 3 — Guardrails
> **Generated:** March 28, 2026
> **Reference:** `docs/STANDARDS.md`

---

## Overall Assessment

The guardrails codebase is **clean**. Types, constants, prompt hardening, and the barrel exports all pass with zero findings. Two items in `input-screen.ts` and one observation on `output-filter.ts`.

---

## WARN — Should Fix

### W1 — `input-screen.ts`: Log calls omit `workspaceId`
**File:** `app/_lib/agent/guardrails/input-screen.ts` ~L128, ~L146
**Severity:** Medium

`parseClassifierResponse` calls `logStructured` twice (on JSON parse failure and on unexpected format) but neither includes `workspaceId` in the metadata. These parse failures cannot be correlated to a workspace in production logs.

**Fix:** Accept `workspaceId` as a parameter to `parseClassifierResponse` and include it in both `logStructured` calls:

```typescript
function parseClassifierResponse(
  content: string,
  workspaceId: string
): { intent: string; confidence: number } | null {
  // ...
  logStructured({
    system: EventSystem.AGENT,
    eventType: 'input_screen_parse_failed',
    workspaceId,
    // ...
  });
}
```

Then pass it through from `screenInput`.

---

### W2 — `input-screen.ts`: `as` cast on untrusted AI response
**File:** `app/_lib/agent/guardrails/input-screen.ts` ~L132
**Severity:** Low

`JSON.parse(jsonMatch[0]) as { intent?: string; confidence?: number }` — type assertion on the AI classifier's JSON response. While wrapped in try/catch, a Zod `.safeParse()` would be more robust and consistent with Standard #7 (Input Validation).

**Fix:**

```typescript
const ClassifierResponseSchema = z.object({
  intent: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const parsed = ClassifierResponseSchema.safeParse(JSON.parse(jsonMatch[0]));
if (!parsed.success) {
  // log and return null
}
```

---

## Low-Priority Observations (optional)

### O1 — `output-filter.ts`: No self-contained event logging
**File:** `app/_lib/agent/guardrails/output-filter.ts`
**Severity:** Low

When a response is blocked (prompt leak, commitment, prohibited phrase) or PII is scrubbed, the filter returns `modifications[]` and relies entirely on the engine caller to log events. If a future caller forgets, blocked responses are invisible.

**Options:**
- Accept a logger/context parameter and emit events internally
- Or document the contract that callers MUST log `modifications[]`
- Current approach is fine if the engine is the only consumer

---

### O2 — `output-filter.ts`: Redundant regex construction
**File:** `app/_lib/agent/guardrails/output-filter.ts` ~L49-55, ~L79-85
**Severity:** Low

Regex is constructed twice per PII pattern — once for `test()`, once for `replace()`. Since patterns use the `g` flag, `test()` advances `lastIndex`, so the double construction is correct but unnecessary.

**Fix (optional):** Skip the `test()` call. Run `replace()` once, compare result to original to detect changes:

```typescript
for (const { pattern, replacement, label } of PII_PATTERNS) {
  const before = result;
  result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
  if (result !== before) {
    modifications.push({ type: 'pii_scrubbed', detail: `Redacted ${label} pattern` });
  }
}
```

---

## Checklist

- [ ] W1 — pass workspaceId into parseClassifierResponse, include in log calls
- [ ] W2 — replace `as` cast with Zod safeParse on classifier JSON
- [ ] O1 — optional: add logging to output-filter or document caller contract
- [ ] O2 — optional: simplify PII regex pattern to single replace
