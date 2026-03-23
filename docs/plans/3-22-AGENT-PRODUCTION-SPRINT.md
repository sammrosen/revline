# 3/22 Agent Production Sprint

> **Date:** March 22, 2026
> **Goal:** Layer consent tracking, AI resilience, follow-up personalization, and conversation intelligence onto the agent system.
> **Channel:** SMS only (Twilio). Other channels are future work.
> **Reference:** `docs/plans/AI-AGENT-FEATURES.md` for full backlog, `docs/plans/3-21-AGENT-PRODUCTION-SPRINT.md` for prior sprint.
> **Note:** Database migrations and cron registration are deferred — we'll batch those at the end.

---

## Context for Implementation

**Read before building. This section explains what already exists and the architectural decisions that constrain this sprint.**

### Project overview

RevLine is a multi-workspace RevOps automation platform for gym clients. Tech stack: Next.js 16 (App Router), React 19, TypeScript 5 (strict), PostgreSQL via Prisma 6, Tailwind CSS v4, custom auth (Argon2id + sessions + TOTP). AI integrations use OpenAI and Anthropic SDKs through a decoupled adapter registry. Messaging goes through Twilio. All code follows `docs/STANDARDS.md` — read that first for architecture principles (abstraction first, workspace isolation, event-driven debugging, fail-safe defaults, structured logging, Zod validation on all inputs).

### What the 3/21 sprint built (already implemented, merged, working)

The prior sprint (`docs/plans/3-21-AGENT-PRODUCTION-SPRINT.md`) shipped 5 features:

1. **Quiet Hours Enforcement** — `app/_lib/agent/quiet-hours.ts`. Pure functions: `checkSendWindow()`, `shouldEnforceQuietHours()`, `getNextWindowOpen()`. Integrated into `sendReply()` in `engine.ts` as a "send gate." Proactive messages blocked outside 9 AM–8 PM recipient local time; reactive messages log a warning but proceed. Types: `SendType`, `SendReplyResult`, `SendGateResult`.

2. **SMS Encoding Sanitization** — `app/_lib/agent/sms-encoding.ts`. Pure functions: `sanitizeForGsm7()`, `isGsm7Compatible()`, `estimateSegments()`. Applied in `sendReply()` for SMS channels. Per-agent `allowUnicode` toggle on the Agent model (default false).

3. **Anthropic Prompt Caching** — Modified `app/_lib/integrations/anthropic.adapter.ts` to send system prompt as `TextBlockParam[]` with `cache_control: { type: 'ephemeral' }`. Cache stats (`cacheCreationTokens`, `cacheReadTokens`) surfaced in `ChatCompletionResult.usage`. OpenAI adapter has the same optional fields for type uniformity.

4. **AI Retry with Exponential Backoff** — `app/_lib/agent/retry.ts`. Generic `retryWithBackoff<T>()` utility wrapping both AI calls in the engine. Adapters extract `Retry-After` headers and pass them as `retryAfterMs` on `IntegrationResult`. `RetryLog` added to `TurnLogEntry` union.

5. **Follow-Up Scheduler** — `app/_lib/agent/follow-up.ts` + `app/api/v1/cron/follow-ups/route.ts`. DB-backed `FollowUp` model (Prisma). Per-agent config: `followUpEnabled`, `followUpAiGenerated`, `followUpSequence` (JSON array of `{ delayMinutes, message? }`). Cron detects idle conversations and schedules follow-ups; `processFollowUp()` runs pre-send checks (conversation active, lead responded, opted out) then delivers. Agent editor UI (`agent-editor.tsx`) has enable toggle, AI/template toggle, and dynamic step list.

### Post-3/21 audit fixes (already applied)

Two issues from the code audit were fixed before this sprint:

- **`cancelPendingFollowUps`** now accepts a `reason` parameter (default `'lead_responded'`) instead of hardcoding it. The opt-out path passes `'opted_out'`.
- **`sendReply` consolidation** — `sendReply()` is now exported from `engine.ts`. The duplicate `sendFollowUpMessage()` helper in `follow-up.ts` was deleted. `processFollowUp()` calls `sendReply(workspaceId, agent, from, to, body, 'proactive')` directly and handles `SendReplyResult.blockedByQuietHours` for rescheduling. All outbound now flows through a single path.

### Key files to understand before starting

| File | What it does |
|------|-------------|
| `docs/STANDARDS.md` | Architecture principles — read first |
| `app/_lib/agent/engine.ts` | Core conversational loop. `handleInboundMessage()`, `initiateConversation()`, `sendReply()`, `loadAgent()`, `callAI()`. Most changes land here. |
| `app/_lib/agent/types.ts` | `AgentConfig`, `TurnLogEntry` (discriminated union), `AgentResponse`. All type definitions for the agent system. |
| `app/_lib/agent/follow-up.ts` | Follow-up scheduling, cancellation, processing. `processFollowUp()` routes through `sendReply()`. |
| `app/_lib/agent/schemas.ts` | Zod validation for agent API inputs (`CreateAgentSchema`, `UpdateAgentSchema`). |
| `app/_lib/agent/adapter-registry.ts` | `resolveAI()`, `resolveChannel()` — decoupled adapter lookups by integration key. |
| `app/_lib/agent/index.ts` | Barrel exports for the agent module. Update when adding new modules. |
| `app/(dashboard)/workspaces/[id]/agent-editor.tsx` | Agent create/edit UI. Follow-up section already exists; variant UI goes here. |
| `prisma/schema.prisma` | Database schema. `Agent`, `Conversation`, `FollowUp` models are the relevant ones. |
| `app/_lib/integrations/base.ts` | Base adapter class. `protected error()` returns `IntegrationResult` with optional `retryAfterMs`. |

### Patterns to follow

- **New agent module**: create `app/_lib/agent/<name>.ts`, export from `index.ts`, import in `engine.ts`. Pure functions preferred. See `quiet-hours.ts` or `sms-encoding.ts` as templates.
- **Platform-level service**: for concerns that cross system boundaries (consent, billing, etc.), create `app/_lib/services/<name>.service.ts`. The agent engine imports from services — services never import from agent. See `capture.service.ts` as a template.
- **Turn log entries**: add a new interface to the `TurnLogEntry` discriminated union in `types.ts` with a unique `type` string literal. The engine pushes log entries during processing; they're stored on the conversation for debugging.
- **Structured logging**: use `logStructured()` from `app/_lib/reliability` for all operational events. Required fields: `correlationId`, `event`, `workspaceId`, `provider`, `success`.
- **Prisma changes**: modify `prisma/schema.prisma`, but do NOT run `prisma migrate dev` or `prisma db push` during this sprint — migrations are batched at the end.
- **Zod validation**: all API input schemas live in `schemas.ts`. When extending `AgentConfig`, add the corresponding Zod field to `CreateAgentSchema`.

### What was explicitly skipped / deferred

- Features 5 (Sliding Window) and 6 (First Message Compliance) — not needed for reactive-first SMS launch
- Database migrations — batched at end of sprint
- Cron registration updates — existing follow-up cron is sufficient
- New channels — SMS only for now

---

## Build Order

Four items, ordered by: legal protection > reliability > conversion impact > analytics.

### 1. Consent Record Storage (Feature 1.2)

**Why first:** TCPA requires proof of Prior Express Written Consent for every marketing SMS. Without consent records, every outbound message is legally indefensible regardless of how well the agent performs. Quiet hours (3/21) prevent timing violations; this prevents "no consent at all" violations.

**Abstraction layer:** Consent is a **platform-level service**, not an agent concern. Consent is per-workspace, per-contact, per-channel — a lead in a workspace may have SMS consent but not WhatsApp consent, or email consent but not SMS. The agent system is a *consumer* of consent, not the *owner*. This allows future callers (signup forms, marketing automation, compliance audit APIs) to use the same consent service without importing from the agent module.

Follows `STANDARDS.md`:
- **Abstraction First:** `Route Handler / Engine → Service Layer (consent.service.ts) → Prisma`
- **Workspace Isolation:** Every query scoped to `workspaceId`
- **Event-Driven Debugging:** Emits `consent_granted`, `consent_revoked` events
- **Fail-Safe Defaults:** No consent record = blocked (deny by default for proactive outreach)

**Scope:**

*Prisma model:*
- New model: `ConsentRecord` with unique constraint on `(workspaceId, contactAddress, channel)`
  - `workspaceId` — workspace isolation
  - `contactAddress` — phone number, email, IG handle, etc.
  - `channel` — `SMS`, `EMAIL`, `WHATSAPP`, `INSTAGRAM` (string, not enum — extensible for future channels)
  - `consentType` — enum: `MARKETING`, `TRANSACTIONAL`
  - `method` — enum: `WEB_FORM`, `SMS_KEYWORD`, `IN_PERSON`, `API`
  - `languagePresented` — exact consent text shown to the user (required for TCPA proof)
  - `ipAddress` — for web form audit trail (nullable for non-web methods)
  - `grantedAt` — when consent was given
  - `expiresAt` — optional expiry (nullable)
  - `revokedAt` — soft revoke timestamp (nullable — never delete consent records)
- New enums: `ConsentType`, `ConsentMethod`
- Workspace relation: `consentRecords ConsentRecord[]`

*Service module: `app/_lib/services/consent.service.ts`*
- `recordConsent(params): Promise<ConsentRecord>` — upsert consent record (re-granting after revocation creates a new active record), emit `consent_granted` event
- `checkConsent(workspaceId, contactAddress, channel): Promise<ConsentRecord | null>` — returns latest active (non-revoked, non-expired) consent record, or null
- `revokeConsent(workspaceId, contactAddress, channel): Promise<boolean>` — set `revokedAt` on active record, emit `consent_revoked` event, return true if a record was revoked
- All functions workspace-scoped, all emit structured log events

*Engine integration (thin — agent is a consumer):*
- `initiateConversation()` — after loading agent and resolving contact address, call `checkConsent(workspaceId, contactAddress, channelType)`. If null and consent is required (marketing), block with `AgentResponse.error = 'no_consent'`. Transactional consent type bypasses this check.
- Opt-out handler in `handleInboundMessage()` — call `revokeConsent(workspaceId, contactAddress, channelType)` alongside existing `OptOutRecord` upsert

**Files:**
- Modified: `prisma/schema.prisma` — `ConsentRecord` model, `ConsentType` enum, `ConsentMethod` enum, Workspace relation
- New: `app/_lib/services/consent.service.ts` — platform-level consent service
- Modified: `app/_lib/services/index.ts` — export consent service (if barrel exists)
- Modified: `app/_lib/agent/engine.ts` — consent check in `initiateConversation()`, revocation in opt-out handler (imports from services, not agent)

**Edge cases:**
- No consent record found → block proactive outbound, return `AgentResponse` with error reason `no_consent`
- Expired consent (`expiresAt < now`) → treat as no consent
- Transactional consent type → always allow (TCPA only requires PEWC for marketing)
- Re-granting after revocation → new `grantedAt`, `revokedAt` cleared (or new row — upsert handles both)
- Reactive messages (`handleInboundMessage`) → do NOT check consent (lead initiated contact, consent is implicit for the reply)
- Channel string mismatch → normalize to uppercase before lookup

---

### 2. Circuit Breaker for AI Providers (Feature 4.2)

**Why second:** Retry with backoff (3/21) handles transient failures, but if Anthropic is down for 5+ minutes, every conversation burns through 3 retries before falling back. A circuit breaker detects sustained outages and skips the AI call entirely, serving fallback immediately. Saves latency and API quota during outages.

**Scope:**
- New module: `app/_lib/agent/circuit-breaker.ts`
- In-memory state machine per provider key (e.g., `anthropic`, `openai`):
  - States: `CLOSED` (normal) → `OPEN` (tripped) → `HALF_OPEN` (probing)
  - `CLOSED → OPEN`: after `failureThreshold` consecutive failures (default 5)
  - `OPEN → HALF_OPEN`: after `resetTimeoutMs` elapses (default 30000ms)
  - `HALF_OPEN → CLOSED`: after `successThreshold` successes (default 3)
  - `HALF_OPEN → OPEN`: on any failure
- Exported functions:
  - `checkCircuit(provider: string): { state: CircuitState, allowed: boolean }` — returns current state, whether the call should proceed
  - `recordSuccess(provider: string): void` — decrement failure count or advance HALF_OPEN → CLOSED
  - `recordFailure(provider: string): void` — increment failure count, potentially trip to OPEN
  - `getCircuitState(provider: string): CircuitState` — for logging/debugging
- Engine integration in `callAI()`:
  - Before AI call: `checkCircuit(agent.aiIntegration)` — if not allowed, skip AI and return error with `retryable: false`
  - After successful AI call: `recordSuccess(agent.aiIntegration)`
  - After failed AI call (post-retry): `recordFailure(agent.aiIntegration)`
- Emit structured log events: `agent_circuit_breaker_opened`, `agent_circuit_breaker_closed`

**Files:**
- New: `app/_lib/agent/circuit-breaker.ts`
- Modified: `app/_lib/agent/engine.ts` — wrap `callAI()` with circuit breaker checks
- Modified: `app/_lib/agent/index.ts` — export circuit breaker functions
- Modified: `app/_lib/agent/types.ts` — add `CircuitBreakerLog` to `TurnLogEntry` union

**Design notes:**
- In-memory state is intentional — circuit breaker state does not need to survive restarts. On restart, breaker resets to CLOSED, which is the correct recovery behavior.
- Per-provider granularity (not per-workspace) — if Anthropic is down, it's down for everyone. No point tripping per-workspace breakers independently.

---

### 3. Follow-Up Message Variants (Feature 3.2)

**Why third:** Currently each follow-up step sends the same template message to every lead. Variants allow A/B testing and prevent leads from receiving identical follow-ups across conversations, which feels robotic and reduces re-engagement rates.

**Scope:**
- Extend `followUpSequence` type to support an optional `variants` array per step:
  ```
  Array<{ delayMinutes: number; message?: string; variants?: string[] }>
  ```
  When `variants` is present and non-empty, the scheduler picks one instead of using `message`.
- Variant selection logic in `follow-up.ts`:
  - New helper: `selectVariant(variants: string[], conversationId: string, stepIndex: number): string`
  - Strategy: hash-based rotation using `conversationId + stepIndex` to ensure deterministic but varied selection
  - No repeat within same conversation: track sent variants in `FollowUp.messageText` audit column, filter already-used variants
- Schema validation: add `variants: z.array(z.string().max(500)).max(5).optional()` to the follow-up step object in `CreateAgentSchema`
- UI: each follow-up step in `agent-editor.tsx` gets a toggle between "Single message" and "Variants" mode
  - Single mode: current textarea for `message`
  - Variants mode: list of textareas (up to 5), add/remove buttons
  - Visual indicator showing variant count per step

**Files:**
- Modified: `app/_lib/agent/types.ts` — extend `followUpSequence` type with `variants?: string[]`
- Modified: `app/_lib/agent/schemas.ts` — add `variants` to follow-up step Zod schema
- Modified: `app/_lib/agent/follow-up.ts` — add `selectVariant()` helper, update template path in `processFollowUp()`
- Modified: `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — single/variants toggle per step, variant textareas
- Modified: `prisma/schema.prisma` — no schema changes needed (variants live inside the existing `followUpSequence` JSON column)

**Edge cases:**
- All variants already used in this conversation → fall back to `message` field, then `fallbackMessage`
- `variants` array is empty → treat as if not set, use `message`
- Migration: existing agents have no `variants` field — `undefined` is handled as "use `message`"

---

### 4. Conversation Stage Tracking (Feature 3.3 / 8)

**Why fourth:** Enables funnel analytics, stage-aware AI behavior, and automatic follow-up stage transitions. Low implementation effort with compounding value as conversation volume grows.

**Scope:**
- New module: `app/_lib/agent/stages.ts`
- Define stage enum as a TypeScript const (not Prisma enum — stored in `Conversation.metadata` JSON):
  ```
  GREETING → QUALIFICATION → DISCOVERY → VALUE_PRESENTATION → CLOSING → FOLLOW_UP → DORMANT
  ```
- Transition logic: `evaluateStageTransition(currentStage, messageCount, lastRole, metadata): { newStage: ConversationStage, reason: string } | null`
  - `GREETING → QUALIFICATION`: after first agent response (messageCount >= 2)
  - `QUALIFICATION → DISCOVERY`: after lead provides name or qualifying info (messageCount >= 4)
  - `DISCOVERY → VALUE_PRESENTATION`: after 3+ back-and-forth turns (messageCount >= 6)
  - `VALUE_PRESENTATION → CLOSING`: when CTA keywords detected in agent response (booking, visit, trial, schedule, signup)
  - `Any → FOLLOW_UP`: when follow-up sequence activates for this conversation
  - `Any → DORMANT`: when all follow-ups exhausted with no response
- Engine integration:
  - After each turn in `handleInboundMessage()`: call `evaluateStageTransition()`, update `Conversation.metadata.stage` if changed
  - Inject stage hint into system prompt: `"[Current conversation stage: DISCOVERY. Guide toward presenting value.]"`
  - Log stage transitions in turn log as `StageTransitionLog`
- Follow-up integration:
  - `processFollowUp()` updates stage to `FOLLOW_UP` when sending first follow-up
  - When all follow-ups exhausted → update stage to `DORMANT`

**Files:**
- New: `app/_lib/agent/stages.ts` — stage definitions, `evaluateStageTransition()`, `STAGE_PROMPT_HINTS` map
- Modified: `app/_lib/agent/engine.ts` — evaluate stage after each turn, inject hint into system prompt, log transitions
- Modified: `app/_lib/agent/types.ts` — add `ConversationStage` type, `StageTransitionLog` to `TurnLogEntry` union
- Modified: `app/_lib/agent/follow-up.ts` — update stage to `FOLLOW_UP` / `DORMANT` at appropriate points
- Modified: `app/_lib/agent/index.ts` — export stages module

**Design notes:**
- Stages are heuristic, not AI-classified — simple message count + keyword rules. AI-based stage detection is a future enhancement.
- Stage is stored in `Conversation.metadata` (JSON), not a dedicated column — avoids a migration for this sprint and keeps the stage system flexible.
- Stage hints in the system prompt are short (one line) — they nudge the AI without overriding the user's system prompt.

---

## Migration Summary (deferred — batch at end)

**New Prisma models:**
- `ConsentRecord` — workspace-scoped consent audit trail

**New Prisma enums:**
- `ConsentType` (MARKETING, TRANSACTIONAL)
- `ConsentMethod` (WEB_FORM, SMS_KEYWORD, IN_PERSON, API)

**No new columns on Agent** — follow-up variants live inside existing `followUpSequence` JSON column. Conversation stage lives in existing `Conversation.metadata` JSON.

**New files (3):**
- `app/_lib/services/consent.service.ts` — platform-level consent service (not in agent module)
- `app/_lib/agent/circuit-breaker.ts`
- `app/_lib/agent/stages.ts`

**Modified files (6):**
- `app/_lib/agent/engine.ts` — consent check (imports from services), circuit breaker, stage tracking
- `app/_lib/agent/follow-up.ts` — variant selection, stage updates
- `app/_lib/agent/types.ts` — new log types, stage type, variant type extension
- `app/_lib/agent/schemas.ts` — variants in follow-up step validation
- `app/_lib/agent/index.ts` — new exports (circuit breaker, stages — consent exports from services)
- `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — follow-up variant UI

---

## What This Sprint Does NOT Include

- Database migration execution — deferred, will batch with `prisma db push` at the end
- Cron job updates — follow-up cron already exists, stage tracking doesn't need one
- New channels (web chat, Instagram, WhatsApp) — SMS only
- Sliding window for conversation history — on hold, revisit when conversation length becomes an issue
- First message compliance warnings — not needed for reactive-first launch
- Production conversation viewer UI — separate sprint
- AI provider failover — circuit breaker is the prerequisite; failover builds on top of it later
- Consent collection UI (forms, opt-in flows) — this sprint adds the storage and checking layer; collection points are a separate build
