# AI Agent System — Deep Audit

> **Date:** March 22, 2026
> **Scope:** Full vertical: Twilio webhook → engine → AI/channel adapters → persistence → workflow integration → admin API → follow-up cron → consent service → dashboard UI
> **Method:** Static code review against `docs/STANDARDS.md` and `docs/workflows/PRE-PUSH.md` (no commands executed)
> **Files reviewed:** ~40 source files across `app/_lib/agent/`, `app/api/v1/`, `app/_lib/services/`, `app/_lib/workflow/executors/`, `prisma/schema.prisma`, `__tests__/unit/`

---

## Summary

The agent system is architecturally sound. It follows the adapter registry pattern, workspace isolation, event-driven debugging, and fail-safe defaults prescribed by STANDARDS. Auth, Zod validation, and workspace scoping are applied consistently across all admin API routes. The consent service, opt-out handling, and quiet hours enforcement demonstrate mature compliance awareness.

There are **no critical security vulnerabilities** in the agent stack. The findings below are reliability and correctness issues that should be addressed before scaling or before the first high-volume workspace goes live.

---

## Findings

### HIGH — Twilio webhook drops PAUSED conversations into workflow path

**File:** `app/api/v1/twilio-webhook/route.ts:211-218`

The webhook looks up active conversations to route directly to the engine:

```typescript
const activeConversation = await prisma.conversation.findFirst({
  where: {
    workspaceId: client.id,
    contactAddress: payload.from,
    channelAddress: payload.to,
    status: ConversationStatus.ACTIVE,  // <-- only ACTIVE
  },
});
```

A `PAUSED` conversation (human takeover) is not matched. The inbound message falls through to the workflow trigger path, which may create a brand-new conversation via `route_to_agent` — duplicating the lead's conversation history and confusing the human who paused the original.

The engine itself handles `PAUSED` correctly (auto-resume or store-only at engine.ts:153-183), but the webhook never routes to it.

**Recommendation:** Include `PAUSED` in the webhook lookup:

```typescript
status: { in: [ConversationStatus.ACTIVE, ConversationStatus.PAUSED] },
```

---

### HIGH — No transaction wrapping for multi-step DB writes in engine

**File:** `app/_lib/agent/engine.ts` (multiple locations)

STANDARDS require transactions for "Multiple database writes that must succeed together." The engine performs sequential writes without transactions:

- `handleInboundMessage`: stores USER message (line 305) → calls AI → stores ASSISTANT message (line 712) → updates counters (line 727) → potentially updates status again (line 739). If the process dies between the ASSISTANT write and the counter update, `messageCount` and `totalTokens` drift permanently.
- `processFollowUp` in `follow-up.ts`: sendReply → create message (line 231) → update conversation (line 240) → update follow-up status (line 246) → schedule next step (line 269). A crash between send and DB writes means a message is delivered but not recorded.

**Recommendation:** Wrap the post-AI-call DB operations in a `withTransaction()` block. The AI call and channel send are external and should remain outside the transaction, but the store-message → update-counters → update-status steps should be atomic. Similarly for follow-up processing.

---

### HIGH — Response delay blocks Twilio webhook response

**File:** `app/_lib/agent/engine.ts:763-764`

```typescript
if (agent.responseDelaySeconds > 0) {
  await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
}
```

This `setTimeout` runs in the request handler. In the Twilio webhook path, the handler must return a TwiML response. Twilio enforces a 15-second timeout on webhook responses. If `responseDelaySeconds` is 5s and AI latency is 10s, the webhook times out and Twilio retries — causing duplicate processing.

The same pattern appears at lines 355-357, 380-382, and 658-660.

**Recommendation:** Return the TwiML response immediately from the webhook. The response delay + reply send should happen asynchronously (fire-and-forget after returning the HTTP response), or the delay should only apply to test-chat and proactive paths, not the reactive webhook path.

---

### MEDIUM — Twilio webhook returns JSON errors instead of TwiML on early failures

**File:** `app/api/v1/twilio-webhook/route.ts:78-83, 129-133, 160-164`

Three code paths return `ApiResponse.error()` (JSON) instead of empty TwiML:

1. Missing `source` parameter → JSON 400 (line 78-83)
2. Missing `X-Twilio-Signature` header → JSON 400 (line 129-133)
3. Invalid signature → JSON 400 (line 160-164)

STANDARDS say "Webhooks return 200 on partial failures (to prevent retries)." Twilio expects `text/xml` responses and will retry on non-200 or non-XML responses.

The missing-source case is arguably an integration misconfiguration (not a Twilio-initiated request), but the signature-failure paths are real webhook responses that should return TwiML to prevent retry storms.

**Recommendation:** Return `twimlResponse(200)` for all Twilio-initiated paths (after the `source` check, return TwiML on signature failures). The `source` check can remain as a JSON error since it indicates a misconfigured URL, not an actual Twilio webhook.

---

### MEDIUM — No rate limiting on test-chat and test-trigger POST

**Files:** `app/api/v1/workspaces/[id]/agents/[agentId]/test-chat/route.ts`, `test-trigger/route.ts`

PRE-PUSH says all endpoints should have rate limiting. These are admin-authenticated, but each POST makes a real AI API call (OpenAI/Anthropic). An authenticated user hammering test-chat could burn through AI quota or budget rapidly.

**Recommendation:** Add a per-user or per-workspace rate limit (e.g., 30 requests/minute) using `rateLimitByIP` or a new `rateLimitByUser` helper.

---

### MEDIUM — `cancelPendingFollowUps` logs empty workspaceId

**File:** `app/_lib/agent/follow-up.ts:103`

```typescript
logStructured({
  correlationId: crypto.randomUUID(),
  event: 'follow_up_cancelled',
  workspaceId: '',    // <-- always empty
  provider: 'agent',
  ...
});
```

The function only receives `conversationId` and `reason`, so it cannot log the workspace. This makes these log entries invisible to per-workspace filtering.

**Recommendation:** Accept `workspaceId` as an optional parameter (the caller always has it), or query it from the conversation.

---

### MEDIUM — Follow-up cron uses `console.log` instead of `logStructured`

**File:** `app/api/v1/cron/follow-ups/route.ts:29-36`

The `log()` helper writes raw `console.log(JSON.stringify(...))` rather than using `logStructured()` from the reliability module. This means cron execution events don't follow the standard structured log format and won't be captured by any log aggregation that relies on the `logStructured` output shape.

**Recommendation:** Replace the local `log()` with `logStructured()` calls, using a consistent `correlationId` per cron invocation.

---

### LOW — File upload trusts `file.type` from multipart form data

**File:** `app/api/v1/workspaces/[id]/agents/[agentId]/files/route.ts:117`

```typescript
const mimeType = file.type || 'application/octet-stream';
```

The MIME type comes from the client's `Content-Type` in the multipart boundary and can be spoofed. The extraction functions (pdf-parse, mammoth) will fail on mismatched content, producing an error response — not a security breach — but the error message includes the internal extraction error, which could leak implementation details.

**Recommendation:** Validate by file extension or magic bytes in addition to the declared MIME type. Wrap the error response to avoid exposing internal extraction errors.

---

### LOW — Duplicate AI call pattern between engine and follow-up

**Files:** `app/_lib/agent/engine.ts:1224-1248` (`callAI`), `app/_lib/agent/follow-up.ts:351-378` (`callFollowUpAI`)

Both functions resolve the AI adapter the same way. The 3/21 sprint consolidated `sendReply` but the AI call path still has two implementations. They're thin wrappers, so the duplication is minor, but any future change to AI call behavior (e.g., circuit breaker integration) must be applied in both places.

**Recommendation:** Extract a shared `callAI` into the engine (already exported) or a new shared module. Follow-up's `callFollowUpAI` should call the engine's `callAI` rather than reimplementing adapter resolution.

---

### LOW — Agent deletion does not cancel pending follow-ups

**File:** `app/api/v1/workspaces/[id]/agents/[agentId]/route.ts:147-159`

When an agent is deleted, active conversations are completed, but pending follow-ups are not cancelled. The cron will pick them up, try to `loadAgent()`, get null, and skip them — so there's no crash. But the follow-ups linger as PENDING records until processed.

**Recommendation:** Add `cancelPendingFollowUps` for all conversations of the deleted agent, or a bulk `prisma.followUp.updateMany` to cancel by `agentId`.

---

### LOW — `escalation.ts` includes raw `contactAddress` in HTML email

**File:** `app/_lib/agent/escalation.ts:46`

```typescript
<tr><td ...>Contact</td><td>${contactAddress}</td></tr>
```

While `escapeHtml` is applied to the `summary` field, `contactAddress` is interpolated directly into the HTML. Phone numbers don't typically contain HTML metacharacters, but the pattern is inconsistent.

**Recommendation:** Apply `escapeHtml(contactAddress)` for consistency.

---

## Test Coverage Gap Analysis

| Area | Test file | Coverage |
|------|-----------|----------|
| `handleInboundMessage` | `agent-engine.test.ts` | Good — covers happy path, opt-out, timeout, message limit, rate limit, FAQ, pause/resume |
| `initiateConversation` | None | **Missing** — proactive outreach, consent check, quiet hours blocking |
| Twilio webhook | None | **Missing** — signature verification, direct-to-engine routing, workflow fallthrough, opt-out early exit |
| Follow-up cron | None | **Missing** — idle detection logic, due processing, rescheduling |
| `processFollowUp` | None | **Missing** — pre-send checks, variant selection, quiet hours rescheduling |
| Consent service | None | **Missing** — record/check/revoke, expiry, re-grant after revocation |
| Tool execution | None | **Missing** — scheduling tools, registry dispatch |
| File upload/extraction | None | **Missing** — MIME validation, text extraction, size/count limits |
| Adapter registry | `agent-adapter-registry.test.ts` | Good |
| Pricing | `agent-pricing.test.ts` | Good |
| Schemas | `agent-schemas.test.ts` | Good |
| Escalation notification | None | **Missing** |
| Workflow executor | None | **Missing** — reactive vs proactive mode dispatch |
| Conversation pause/resume API | None | **Missing** |

**Estimated coverage by line count:** ~35% of the agent system's logic is covered by tests. The engine's `handleInboundMessage` is the most critical function and has reasonable coverage, but `initiateConversation`, the Twilio webhook, and the follow-up pipeline are completely untested.

---

## Doc Drift: `docs/AI-AGENT-SYSTEM.md` vs Repository

The system doc was last significantly updated around March 8, 2026. Since then, three sprints have added substantial functionality not reflected in the doc:

| Feature | In repo | In doc |
|---------|---------|--------|
| Quiet hours (`quiet-hours.ts`) | Yes | No |
| SMS encoding (`sms-encoding.ts`) | Yes | No |
| Retry with backoff (`retry.ts`) | Yes | No |
| Follow-up scheduler (`follow-up.ts`, cron) | Yes | No |
| Escalation notification (`escalation.ts`) | Yes | No |
| Tool calling system (`tool-registry.ts`, `tools/`) | Yes | No |
| File upload/RAG (`file-extract.ts`, files API) | Yes | No |
| Zod schemas (`schemas.ts`) | Yes | No |
| Adapter registry (`adapter-registry.ts`) | Yes | No |
| Consent service (`consent.service.ts`) | Yes | No |
| Opt-out handling | Yes | No |
| Response delay | Yes | No |
| FAQ overrides | Yes | No |
| Conversation pause/resume | Yes | Partially (marked "Partial" in audit section) |
| Initial message + lead variables | Yes | No |
| Circuit breaker (3/22 planned) | Not yet | No |
| Conversation stages (3/22 planned) | Not yet | No |

The "File Index" section lists 25 files; the actual agent module now has ~19 library files plus ~11 API route files plus the consent service — 31+ total.

---

## PRE-PUSH / STANDARDS Checklist Mapping

### Security Checklist (PRE-PUSH)

| Item | Status | Evidence |
|------|--------|----------|
| No secrets in code | PASS | All API keys accessed via adapter `getSecret()`. No hardcoded credentials. |
| No secrets in logs | PASS | `logStructured()` calls never include keys, tokens, or passwords. `event-logger.ts` truncates error messages to 500 chars. |
| No secrets in error messages | PASS | `ApiResponse.error()` returns generic messages. AI adapter errors are sanitized at boundaries. |
| Encryption keys not committed | PASS | `.env` in `.gitignore`. Only `REVLINE_ENCRYPTION_KEY_V1` reference is in `env.example` with placeholder. |
| Webhook signature verification | PASS | Twilio SDK `validateRequest` used. Signature checked before processing payload. |
| Rate limiting on public endpoints | PARTIAL | Twilio webhook has `rateLimitByClient`. Test-chat/test-trigger have no rate limits (admin-only, but AI cost exposure). |
| Admin routes protected | PASS | All 8 agent route files call `getUserIdFromHeaders()` + `getWorkspaceAccess()`. |
| Session handling | PASS | HTTP-only, secure-in-production, SameSite=strict cookies via `auth.ts`. |
| Input validation (Zod) | PASS | All mutating routes use schemas from `schemas.ts`. Conversations list uses inline Zod schema. Cron validates `CRON_SECRET`. |
| XSS prevention | PASS (partial) | `escapeHtml` used in escalation email `summary`, but `contactAddress` not escaped (LOW finding). |

### Architecture Compliance (PRE-PUSH)

| Item | Status | Evidence |
|------|--------|----------|
| Adapter extends base pattern | PASS | AI and channel adapters use registry pattern (not BaseIntegrationAdapter directly, but equivalent). |
| Uses `getSecret()` for credentials | PASS | Adapters load secrets via `forWorkspace()` which calls `loadAdapter()` → `getSecret()`. |
| Returns `IntegrationResult<T>` | PASS | All adapter methods return `IntegrationResult<ChatCompletionResult>` or similar. |
| Has `isConfigured()` validation | PASS | Twilio adapter has `isWebhookConfigured()`. AI adapters return null from `forWorkspace()` when not configured. |
| Events emitted | PASS | `emitAgentEvent()` fires on conversation_started, escalation_requested, conversation_completed. `emitEvent()` for response_sent, ai_failure. |
| Executor registered | PASS | `agentExecutors` in `executors/agent.ts`, registered in `executors/index.ts`. |
| Workspace isolation | PASS | Every Prisma query includes `workspaceId`. `loadAgent()` scopes by `workspaceId`. `findOrCreateConversation()` scopes all lookups. Follow-up cron processes per-agent with workspace scope. |
| Database transactions | FAIL | Multi-step writes in engine and follow-up pipeline are not wrapped in transactions (HIGH finding). |

### What Could Break Production (PRE-PUSH)

| Question | Assessment |
|----------|-----------|
| Could secrets leak? | No — secrets only in encrypted DB storage and adapter internals. |
| Could authentication be bypassed? | No — all admin routes use consistent auth pattern. Twilio webhook uses signature verification. Cron uses bearer token. |
| Could data be corrupted? | Possible — non-transactional multi-step writes could leave messageCount/totalTokens inconsistent on crash. |
| Could integrations break? | Low risk — adapter pattern followed. But circuit breaker is not yet implemented, so sustained AI outages burn through retries. |
| Is extensibility maintained? | Yes — three registries (AI, channel, tool) allow adding providers without engine changes. Consent service is decoupled from agent module. |

---

## Priority Remediation Order

1. **Twilio webhook PAUSED routing** (HIGH) — data correctness, simple fix
2. **Transaction wrapping for engine/follow-up DB writes** (HIGH) — data integrity
3. **Response delay blocking webhook** (HIGH) — Twilio timeout / retry storm risk
4. **TwiML on signature failures** (MEDIUM) — prevents Twilio retry storms
5. **Rate limit on test-chat/test-trigger** (MEDIUM) — cost protection
6. **cancelPendingFollowUps workspaceId** (MEDIUM) — observability
7. **Cron structured logging** (MEDIUM) — operational consistency
8. Tests for `initiateConversation`, Twilio webhook, follow-up pipeline (coverage)
9. Update `docs/AI-AGENT-SYSTEM.md` to reflect post-3/8 additions (doc drift)

---

*Generated: March 22, 2026*
