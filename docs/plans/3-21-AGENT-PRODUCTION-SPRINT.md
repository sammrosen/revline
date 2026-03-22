# 3/21 Agent Production Sprint

> **Date:** March 21, 2026
> **Goal:** Get the agent system production-ready for live SMS traffic.
> **Channel:** SMS only (Twilio). Other channels are future work.
> **Reference:** `docs/plans/AI-AGENT-FEATURES.md` for full backlog.

---

## Build Order

Eight items, ordered by: legal risk > cost savings > reliability > conversion impact.

### 1. Quiet Hours Enforcement

**Why first:** TCPA quiet hours violations are generating a wave of class-action lawsuits. $500–$1,500 per message, no cap. This is the only feature that can bankrupt you if missing.

**Scope:**
- New utility: `isWithinSendWindow(timezone: string): boolean` — returns false if current time in the recipient's timezone is outside 9 AM–8 PM (buffers against strictest state rules)
- Gate in `sendReply()`: if outside window, log `agent_send_delayed_quiet_hours` and skip delivery (or queue for next window)
- Gate in `initiateConversation()`: same check before outbound
- Use `Workspace.timezone` (already exists, IANA format like `America/New_York`)
- No new dependencies — `Intl.DateTimeFormat` handles timezone math natively

**Files:**
- New: `app/_lib/agent/quiet-hours.ts`
- Modified: `app/_lib/agent/engine.ts` — `sendReply()`, `initiateConversation()`

**Edge cases:**
- Workspace with no timezone set → default to `America/New_York` (most conservative for US East Coast)
- Test mode → skip quiet hours check (already have `testMode` flag)

---

### 2. SMS Encoding Sanitization

**Why second:** Without this, Claude's output silently triples your SMS costs. A single curly quote switches the entire message from GSM-7 (160 chars/segment) to UCS-2 (70 chars/segment).

**Scope:**
- New utility: `sanitizeForGsm7(text: string): string` — replaces smart quotes with straight quotes, strips emoji, normalizes Unicode dashes/spaces
- Apply in `sendReply()` before passing body to the channel adapter (only when channel is SMS)
- Segment count estimator: `estimateSegments(text: string): { encoding: 'gsm7' | 'ucs2', segments: number, characters: number }` — log on every outbound for cost tracking
- Per-agent toggle: `allowUnicode` on Agent model (default false) — skip sanitization when true

**Files:**
- New: `app/_lib/agent/sms-encoding.ts`
- Modified: `app/_lib/agent/engine.ts` — `sendReply()` calls sanitizer for SMS channels
- Modified: `prisma/schema.prisma` — `allowUnicode` Boolean on Agent (optional, default false)

---

### 3. Anthropic Prompt Caching

**Why third:** Cheapest change with highest ROI. System prompts are 500–1,000+ tokens, sent every turn. Prompt caching costs 10% on cache hits within a 5-minute window. For multi-turn SMS conversations this cuts AI cost nearly in half.

**Scope:**
- Modify `chatCompletion()` in `anthropic.adapter.ts`: when setting `requestParams.system`, use the block format with `cache_control`:
  ```
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]
  ```
- Track cache performance from response: `response.usage.cache_creation_input_tokens` and `response.usage.cache_read_input_tokens`
- Surface cache stats in the `ChatCompletionResult` usage object (add optional `cacheCreationTokens` and `cacheReadTokens` fields)
- Log cache hit rate in turn log for visibility in test chat panel

**Files:**
- Modified: `app/_lib/integrations/anthropic.adapter.ts` — `chatCompletion()` system prompt format
- Modified: `app/_lib/integrations/openai.adapter.ts` — add cache fields to `ChatCompletionResult` type (even if unused by OpenAI, keeps the interface uniform)

---

### 4. AI Retry with Exponential Backoff

**Why fourth:** Claude has transient failures (429 rate limit, 529 overloaded, 500 internal). Currently a single failure = no reply + fallback message. A 3-attempt retry with backoff recovers from most transient issues invisibly.

**Scope:**
- New utility: `retryWithBackoff<T>(fn, options): Promise<T>` — generic retry wrapper
  - `maxAttempts`: 3
  - `initialDelayMs`: 1000
  - `maxDelayMs`: 30000
  - Jitter: `delay + random(0, delay * 0.1)`
  - Per-error strategy: 429 → use `Retry-After` header if present, 529/500 → retry, 413 → do not retry (context too large), 402 → do not retry (billing), all others → do not retry
- Wrap `callAI()` in the retry utility
- Log each retry attempt in turn log: `{ type: 'retry', attempt, error, delayMs }`
- After all retries exhausted, fall through to existing `fallbackMessage` path

**Files:**
- New: `app/_lib/agent/retry.ts`
- Modified: `app/_lib/agent/engine.ts` — wrap `callAI()` calls in retry
- Modified: `app/_lib/agent/types.ts` — add `RetryLog` to `TurnLogEntry` union

---

### 5. Sliding Window for Conversation History

**Why fifth:** As real conversations grow, sending all 50 messages on every turn is wasteful and degrades response quality. A 10-pair window with older message summarization keeps costs flat and quality high.

**Scope:**
- In engine step 8 (load conversation history), if `messageCount > windowSize * 2`:
  - Load only the last `windowSize * 2` messages for the AI call
  - For older messages: generate a one-paragraph summary via a cheap Haiku call (or reuse existing summary from `Conversation.metadata`)
  - Store summary in `Conversation.metadata.historySummary` — only regenerate when the window slides past new messages
- Per-agent config: `contextWindowSize` (default 10 pairs = 20 messages)
- AI message structure becomes: `[system_prompt, {role: 'developer', content: historySummary}, ...lastNPairs, newMessage]`

**Files:**
- Modified: `app/_lib/agent/engine.ts` — message loading logic (step 8)
- Modified: `app/_lib/agent/types.ts` — add `contextWindowSize` to `AgentConfig`
- Modified: `prisma/schema.prisma` — add `contextWindowSize` Int on Agent (default 10)
- Modified: `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — add field to guardrails section

---

### 6. First Message Compliance Warnings

**Why sixth:** SMS marketing regulations require specific disclosures in the first message. Not a hard block, but a dashboard warning that protects workspace admins from accidental non-compliance.

**Scope:**
- Validation utility: `checkFirstMessageCompliance(message: string, workspaceName: string): { compliant: boolean, warnings: string[] }`
  - Check for: business name present, frequency disclosure, "Msg & data rates may apply" or equivalent, "Reply STOP" or equivalent
- Display warnings in agent editor when saving `initialMessage` that fails checks
- Optional auto-append: `smsDisclaimerFooter` field on Agent — text appended to the very first outbound message only (e.g., `"\nReply STOP to opt out. Msg & data rates may apply."`)
- Apply footer in `initiateConversation()` and in the initial message path of `handleInboundMessage()`

**Files:**
- New: `app/_lib/agent/compliance.ts`
- Modified: `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — compliance warnings in UI
- Modified: `app/_lib/agent/engine.ts` — append footer to first message
- Modified: `prisma/schema.prisma` — `smsDisclaimerFooter` String? on Agent

---

### 7. Follow-Up Scheduler (Foundation)

**Why seventh:** The single biggest conversion lever — leads contacted within 5 minutes are 100x more likely to convert. This is the largest build item but requires the quiet hours and compliance features already in place.

**Scope (Phase 1 — DB-backed, no Redis):**
- New model: `FollowUp` — workspaceId, conversationId, agentId, contactAddress, channelAddress, scheduledAt, attemptNumber, maxAttempts, status (PENDING/SENT/SKIPPED/CANCELLED), skipReason, sentAt, messageTemplate?
- Per-agent config: `followUpSequence` JSON — array of `{ delayMinutes: number }` (e.g., `[60, 1440, 2880, 5760, 10080]` = 1hr, 1d, 2d, 4d, 7d)
- When conversation goes idle (no lead response for `followUpSequence[0].delayMinutes`), create the first `FollowUp` row
- New cron route: `/api/v1/cron/follow-ups` — runs every 2–5 minutes, picks up due follow-ups
- Pre-send checks (runs on every follow-up before delivery):
  - Lead responded since scheduling? → skip, cancel remaining
  - Opted out? → cancel all
  - Within quiet hours? → reschedule to next window open
  - Conversation still ACTIVE? → skip if completed/escalated/timed_out
  - Max attempts reached? → mark conversation dormant
- Follow-up message: use AI to generate a contextual re-engagement based on last conversation, or fall back to `initialMessage` variant
- Cancel all pending follow-ups when a new inbound message arrives

**Files:**
- Modified: `prisma/schema.prisma` — `FollowUp` model, `followUpSequence` on Agent
- New: `app/_lib/agent/follow-up.ts` — scheduling logic, pre-send checks
- New: `app/api/v1/cron/follow-ups/route.ts` — cron endpoint
- Modified: `app/_lib/agent/engine.ts` — cancel follow-ups on inbound, schedule on conversation idle
- Modified: `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — follow-up sequence config UI

---

### 8. Conversation Stage Tracking

**Why eighth:** Enables funnel analytics — where leads drop off, which stages convert, which prompts work best. Low effort to add, compounds in value as conversation volume grows.

**Scope:**
- Define stages: `GREETING`, `QUALIFICATION`, `DISCOVERY`, `VALUE_PRESENTATION`, `CLOSING`, `FOLLOW_UP`, `DORMANT`
- Store current stage in `Conversation.metadata.stage` (default `GREETING`)
- Stage transition logic in engine after each turn:
  - `GREETING` → `QUALIFICATION` after first exchange
  - `QUALIFICATION` → `DISCOVERY` after name + one qualifying detail collected
  - `DISCOVERY` → `VALUE_PRESENTATION` after 3+ back-and-forth turns
  - `VALUE_PRESENTATION` → `CLOSING` when CTA presented (booking, visit, trial)
  - Any → `FOLLOW_UP` when follow-up sequence activates
  - Any → `DORMANT` when all follow-ups exhausted
- Inject stage hint into system prompt: `"Current conversation stage: DISCOVERY. Guide toward presenting value."` 
- Log stage transitions in turn log and event ledger

**Files:**
- New: `app/_lib/agent/stages.ts` — stage definitions, transition logic
- Modified: `app/_lib/agent/engine.ts` — evaluate stage after each turn, inject into system prompt
- Modified: `app/_lib/agent/types.ts` — stage enum, stage transition log type

---

## Migration Summary

**New Prisma fields (single migration):**
- `Agent.allowUnicode` Boolean @default(false)
- `Agent.contextWindowSize` Int @default(10)
- `Agent.smsDisclaimerFooter` String?
- `Agent.followUpSequence` Json @default("[]")
- New model: `FollowUp`

**New files (7):**
- `app/_lib/agent/quiet-hours.ts`
- `app/_lib/agent/sms-encoding.ts`
- `app/_lib/agent/retry.ts`
- `app/_lib/agent/compliance.ts`
- `app/_lib/agent/follow-up.ts`
- `app/_lib/agent/stages.ts`
- `app/api/v1/cron/follow-ups/route.ts`

**Modified files (6):**
- `app/_lib/agent/engine.ts` — most changes land here
- `app/_lib/agent/types.ts` — new config fields, turn log types
- `app/_lib/integrations/anthropic.adapter.ts` — prompt caching
- `app/(dashboard)/workspaces/[id]/agent-editor.tsx` — new config fields in UI
- `prisma/schema.prisma` — new fields + FollowUp model
- `app/_lib/integrations/openai.adapter.ts` — cache fields on shared type (minor)

---

## What This Sprint Does NOT Include

- New channels (web chat, Instagram, WhatsApp) — SMS only
- Consent record model — important but needs design around signup/form flows, not just agent
- Circuit breaker — retry with backoff covers 95% of transient failures
- Production conversation viewer UI — data is there, dashboard is a separate sprint
- Usage dashboard / billing hooks — track first, surface later
- Prompt versioning — nice to have, not blocking production
- Prompt injection detection — hardened system prompt + rate limiting is sufficient for launch
