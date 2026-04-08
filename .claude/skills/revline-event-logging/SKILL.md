---
name: revline-event-logging
description: Use when emitting events, modifying app/_lib/event-logger.ts, adding routes, or building/auditing integration adapters in the RevLine repo. Enforces event naming, required metadata, and the rule that logging never breaks the main flow.
---

# RevLine Event Logging

In RevLine, **events are the primary debugging surface**. The dashboard's Events tab is the first place Sam looks when something is wrong. If an event is missing or its metadata is thin, Sam is blind. This is non-negotiable.

This skill triggers any time you're touching event emission, routes, or adapters. Read `docs/STANDARDS.md` §3 ("Event-Driven Debugging") for the canonical rule.

## Naming

Format: `{system}_{action}_{outcome}`

Good:
- `pipedrive_sync_failed`
- `mailerlite_subscribe_success`
- `agent_rate_limited`
- `webhook_received`
- `agent_ai_failure`
- `workspace_schema_auto_provisioned`

Bad:
- `error` — not specific
- `pipedriveSyncFailed` — wrong case
- `sync_failed` — missing system
- `pipedrive_failed` — missing action

If you're inventing a new event type, search the codebase first (`grep -r 'eventType:' app/`) to confirm you're not duplicating an existing one with a different name.

## Required metadata

Every event MUST include:

- `workspaceId` — without this, events can't be filtered by workspace and the dashboard breaks
- A `success: boolean` flag

Almost every event SHOULD include:

- One or more entity IDs the event is about: `agentId`, `conversationId`, `leadId`, `integrationId`
- A `correlationId` if the event is part of a multi-step flow (so the dashboard can group related events)
- Latency in ms (`latencyMs`) for any event that wraps a network call
- For failures: `errorMessage` (NOT truncated to less than ~500 chars), `errorClass`, and the upstream provider name if applicable

Past pain: error messages were truncated twice (DB column + UI CSS) so Sam saw only the first 40 chars and was blind to failures. Don't truncate.

## What NOT to put in events

From `docs/STANDARDS.md` §3:

- Full request/response payloads
- Secret values (API keys, tokens, passwords) — not even partially
- Debug-level info (HTTP headers, raw bodies)
- Retry attempts (these belong in structured logs, not events)

If you're tempted to log a payload "just in case," stop and ask whether the dashboard view will actually use it. If not, leave it in `console.error` for Railway logs.

## The fail-safe wrap

Logging MUST NEVER break the main flow. From `docs/STANDARDS.md` §4 ("Fail-Safe Defaults"):

```typescript
// ✅ CORRECT
try {
  await emitEvent({
    workspaceId,
    eventType: "pipedrive_sync_failed",
    success: false,
    metadata: { agentId, errorMessage: err.message, errorClass: err.name, latencyMs },
  });
} catch (logErr) {
  // Don't rethrow — logging failure must not block the main path
  console.error("emitEvent failed:", logErr);
}
```

If `emitEvent` is called inside a function whose primary purpose is something other than logging (e.g., a webhook handler, a workflow executor), the emitEvent call must be in its own try/catch. The route should still return its normal response even if event logging fails.

## Cross-reference

When you're touching events, also check:

- `app/_lib/event-logger.ts` — the canonical emitter
- `app/_lib/services/` — most state changes happen here; this is where event emission belongs
- `app/_lib/reliability/` — correlation IDs come from here
- `app/_lib/workflow/engine.ts` — emits workflow lifecycle events; see how it does it
- `app/_lib/integrations/pipedrive.adapter.ts` — reference adapter; see its event emission patterns

## Audit checklist (what `standards-auditor` looks for)

When auditing event-related changes:

- [ ] Every meaningful state change has an `emitEvent` call
- [ ] Event types follow `{system}_{action}_{outcome}`
- [ ] `workspaceId` is always set
- [ ] Failures emit events with full error context (not truncated)
- [ ] Logging is wrapped in try/catch
- [ ] No secrets, full payloads, or debug noise in event metadata
- [ ] No `console.log` where an event would be more appropriate

## Anti-patterns to flag

- `console.log("Pipedrive sync failed")` → should be an event, not a log
- `metadata: { error: error.message.substring(0, 100) }` → don't truncate errors
- `try { ... } catch (e) { /* swallow */ }` around an external call → at minimum emit a failure event
- Adding a new state transition without an event → flag it
- Hardcoding integration names in `engine.ts` → see `revline-integration-adapter` skill for the abstraction rule
