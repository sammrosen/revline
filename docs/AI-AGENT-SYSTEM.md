# AI Agent System

> **Last Updated:** March 8, 2026
> **Status:** Core System Complete, P1 Features Complete, Unified Test Panel Live
> **Phases:** Twilio Adapter, OpenAI Adapter, Anthropic Adapter, Agent Engine, Test Suite, P1 Features, Standards Enforcement, Unified Test Panel

## Executive Summary

The AI agent system enables autonomous conversational AI agents within RevLine workspaces. Each workspace can create multiple agents that respond to leads via SMS (Twilio) using AI (OpenAI or Anthropic). The system is **channel-agnostic** and **AI-agnostic** by design -- the agent engine doesn't know or care which messaging provider or AI model it's using. Everything is configured per-bot.

The system integrates bidirectionally with the workflow engine: workflows can activate bots (`route_to_agent` action), and bots emit events that trigger other workflows (`conversation_started`, `escalation_requested`, etc.).

---

## Architecture

```mermaid
flowchart TD
    SMS["Inbound SMS\n(Twilio Webhook)"] -->|"first message"| WF["Workflow Engine"]
    SMS -->|"active conversation"| Engine
    WF -->|"route_to_agent"| Engine["Agent Engine"]
    Engine -->|"reads config"| Bot["Agent Record\n(prompt, AI, limits)"]
    Engine -->|"loads/stores"| DB["Conversation + Messages\n(Postgres)"]
    Engine -->|"chatCompletion()"| AI{"AI Adapter\n(OpenAI or Anthropic)"}
    AI -->|"response + tokens"| Engine
    Engine -->|"sendSms()"| Channel{"Channel Adapter\n(Twilio)"}
    Engine -->|"emits events"| Events["Event Ledger +\nWorkflow Triggers"]
    TestUI["Test Chat Panel\n(Dashboard)"] -->|"testMode=true"| Engine
```

### Message Flow

1. **First message from a new contact:** Twilio webhook fires `sms_received` trigger into the workflow engine. A workflow with a `route_to_agent` action creates the conversation and generates the first AI response.
2. **Subsequent messages in an active conversation:** Twilio webhook detects an active conversation for the contact+number combo and routes directly to the agent engine, bypassing workflow overhead.
3. **Test mode:** The test chat panel in the dashboard calls the engine with `testMode=true`, which skips channel delivery (no SMS sent) but exercises the full pipeline.

---

## Components

### Phase 1: Twilio Adapter

**Status:** Complete

The Twilio adapter handles SMS sending/receiving, webhook signature validation, and phone number management.

| File | Purpose |
|------|---------|
| `app/_lib/integrations/twilio.adapter.ts` | SMS adapter (sendSms, verifyWebhook, phone number management) |
| `app/api/v1/twilio-webhook/route.ts` | Inbound SMS webhook handler with agent routing |
| `app/_lib/workflow/executors/twilio.ts` | Workflow executor for `send_sms` action |
| `app/(dashboard)/workspaces/[id]/twilio-config-editor.tsx` | Structured config UI (phone numbers, webhook setup) |

**Capabilities:**
- Send SMS via Twilio REST API
- Receive inbound SMS via webhook (form-urlencoded)
- Validate `X-Twilio-Signature` using the `twilio` SDK
- Phone number management (add/remove via API fetch from Twilio account)
- Webhook deduplication via `MessageSid`
- Active conversation detection for direct agent routing

**Secrets:** Account SID, Auth Token

---

### Phase 2a: OpenAI Adapter

**Status:** Complete

| File | Purpose |
|------|---------|
| `app/_lib/integrations/openai.adapter.ts` | Chat Completions API adapter |
| `app/_lib/workflow/executors/openai.ts` | Workflow executor for `generate_text` action |
| `app/(dashboard)/workspaces/[id]/openai-config-editor.tsx` | Structured config UI (model, temperature, max tokens) |
| `app/api/v1/integrations/[id]/openai-models/route.ts` | Fetch available models from OpenAI API |

**Capabilities:**
- Chat completions via `client.chat.completions.create()`
- Model listing via `client.models.list()`
- Tool/function calling support (`tools` parameter)
- Token usage tracking (prompt + completion)

**Models supported:** gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini

**Secret:** API Key

---

### Phase 2b: Anthropic Adapter

**Status:** Complete

| File | Purpose |
|------|---------|
| `app/_lib/integrations/anthropic.adapter.ts` | Messages API adapter |
| `app/_lib/workflow/executors/anthropic.ts` | Workflow executor for `generate_text` action |
| `app/(dashboard)/workspaces/[id]/anthropic-config-editor.tsx` | Structured config UI (model, max tokens, temperature) |
| `app/api/v1/integrations/[id]/anthropic-models/route.ts` | Fetch available models from Anthropic API |

**Capabilities:**
- Chat completions via `client.messages.create()`
- Translates between RevLine's unified `ChatMessage` format and Anthropic's format (system prompt as top-level param, `developer` role mapped to `system`)
- Tool use support (`tool_use` / `tool_result` content blocks)
- Token usage tracking (input + output)
- `max_tokens` is required on every Anthropic call (handled by adapter)

**Models supported:** claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001

**Secret:** API Key

---

### Phase 3a: Agent Engine Core

**Status:** Complete

The agent engine manages the full conversational loop autonomously.

#### Engine

| File | Purpose |
|------|---------|
| `app/_lib/agent/engine.ts` | Core engine: `handleInboundMessage()` |
| `app/_lib/agent/types.ts` | Type definitions (InboundMessageParams, AgentResponse, etc.) |
| `app/_lib/agent/index.ts` | Barrel exports |
| `app/_lib/agent/pricing.ts` | Static model pricing map for cost estimation |

**Engine flow (per turn):**

1. Load agent config from DB
2. Find or create conversation for contact+channel+bot
3. Check guardrails: timeout, message limit, token limit
4. Store inbound USER message
5. Emit `conversation_started` event (if new)
6. Load full conversation history
7. Build AI messages (system prompt + history)
8. Call AI adapter (OpenAI or Anthropic based on config)
9. Store ASSISTANT response with token usage
10. Update conversation counters (messageCount, totalTokens)
11. Send reply via channel adapter (Twilio) -- skipped in test mode
12. Emit events (`agent_response_sent`, `agent_turn_complete`)
13. Return `AgentResponse` with usage, events, latency

**Guardrails:**
- Max messages per conversation (default 50)
- Max tokens per conversation (default 100,000)
- Conversation timeout (default 24 hours)
- Fallback message on AI failure
- Allowed events whitelist

#### Database Models

In `prisma/schema.prisma`:

**Agent** -- Workspace-scoped bot configuration:
- Identity: name, description
- Channel: channelType (SMS), channelIntegration (TWILIO)
- AI: aiIntegration (OPENAI/ANTHROPIC), modelOverride, temperatureOverride, maxTokensOverride
- Prompt: systemPrompt (text)
- Guardrails: maxMessagesPerConversation, maxTokensPerConversation, conversationTimeoutMinutes, fallbackMessage
- Permissions: allowedEvents (JSON array of event types the bot can emit)
- Status: active toggle

**Conversation** -- Ties a lead + bot + channel:
- Channel context: contactAddress, channelAddress, channel
- Status: ACTIVE, COMPLETED, ESCALATED, TIMED_OUT
- Counters: messageCount, totalTokens
- Flags: isTest (separates test conversations from production)
- Timestamps: startedAt, lastMessageAt, endedAt

**ConversationMessage** -- Individual messages:
- Role: USER, ASSISTANT, SYSTEM
- Content: message text
- Token tracking: promptTokens, completionTokens

#### CRUD API

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/workspaces/[id]/agents` | GET, POST | List/create agents |
| `/api/v1/workspaces/[id]/agents/[agentId]` | GET, PATCH, DELETE | Get/update/delete agent |
| `/api/v1/workspaces/[id]/agents/[agentId]/conversations` | GET | List production conversations |

#### Dashboard UI

| File | Purpose |
|------|---------|
| `app/(dashboard)/workspaces/[id]/agent-list.tsx` | Agent list with status, conversation count, create/edit/delete |
| `app/(dashboard)/workspaces/[id]/agent-editor.tsx` | Structured config editor for all agent settings |

Accessible via the **Agents** tab in the workspace sidebar.

---

### Phase 3b: Workflow Integration

**Status:** Complete

The agent plugs into the workflow system as an internal adapter (like RevLine forms).

**Registered in `app/_lib/workflow/registry.ts`:**

| Type | Name | Description |
|------|------|-------------|
| Trigger | `conversation_started` | New conversation created |
| Trigger | `escalation_requested` | Bot needs human help |
| Trigger | `conversation_completed` | Conversation ended (limit, timeout, or goal) |
| Trigger | `bot_event` | Generic event from allowedEvents config |
| Action | `route_to_agent` | Activate an agent for a lead/channel |

**Executor:** `app/_lib/workflow/executors/agent.ts` -- Reads agentId from action params, forwards trigger payload to `handleInboundMessage()`.

**Styling:** `app/_lib/workflow/integration-config.ts` -- Violet brand color (`#8B5CF6`), Bot icon.

---

### Phase 4: Test Suite

**Status:** Complete

A full chat playground built into the Testing tab for real AI testing without burning Twilio SMS credits.

| File | Purpose |
|------|---------|
| `app/(dashboard)/workspaces/[id]/testing-chat-panel.tsx` | Full chat playground UI |
| `app/(dashboard)/workspaces/[id]/testing-tab.tsx` | Testing tab (Endpoints, Scenarios, **Chats**) |
| `app/api/v1/workspaces/[id]/agents/[agentId]/test-chat/route.ts` | POST: send test message, GET: list test convos, DELETE: clear |
| `app/api/v1/workspaces/[id]/agents/[agentId]/test-trigger/route.ts` | POST: simulate workflow trigger |
| `app/_lib/agent/pricing.ts` | Cost estimation for known models |

**Test Chat Features:**
- Agent selector (active bots only)
- Real AI calls (actual OpenAI/Anthropic API)
- No channel delivery (testMode skips Twilio)
- Inline metadata per response: token counts, cost estimate, latency, events emitted
- Collapsible system prompt editor with live overrides
- Guardrail progress bars (messages + tokens vs limits)
- Quick-send buttons (escalation, appointment, gibberish, goodbye)
- Trigger simulator with configurable payload
- Conversation history browser
- New chat / clear all actions
- Test conversations flagged `isTest=true`, excluded from production stats

**Cost Estimation:**
Static pricing map for all supported models. Returns dollar amounts for prompt + completion tokens.

---

## Production Data Isolation

Test conversations are completely isolated from production:
- `Conversation.isTest` boolean field distinguishes test from real
- Agent list API excludes `isTest=true` from conversation counts
- Individual agent detail API excludes test conversations
- Conversations list API filters `isTest: false` by default
- Test chat GET endpoint only returns `isTest: true` conversations

---

## Configuration Summary

### Per-Workspace Setup

Each workspace needs:
1. **Twilio integration** -- Account SID + Auth Token secrets, phone numbers configured
2. **AI integration** -- OpenAI or Anthropic API Key secret, model + temperature configured
3. **Agent(s)** -- Created in the Agents tab with channel, AI provider, system prompt, and guardrails

### Twilio Webhook Setup

The inbound SMS webhook URL format:
```
https://your-domain.com/api/v1/twilio-webhook?source={workspaceSlug}
```
Configure in Twilio Console: Phone Numbers > Your Number > Messaging > "A message comes in" > Webhook > HTTP POST.

---

## Event Emission

The agent system emits these events into the event ledger:

| Event | When |
|-------|------|
| `agent_conversation_started` | New conversation created |
| `agent_conversation_completed` | Conversation ended (timeout, message limit, token limit) |
| `agent_escalation_requested` | Bot escalated to human |
| `agent_response_sent` | AI response delivered |
| `agent_ai_failure` | AI adapter call failed |
| `agent_bot_event` | Generic event from allowedEvents |

---

## File Index

### New Files (25)

**Core Engine (4):**
- `app/_lib/agent/engine.ts`
- `app/_lib/agent/types.ts`
- `app/_lib/agent/index.ts`
- `app/_lib/agent/pricing.ts`

**Integration Adapters (3):**
- `app/_lib/integrations/twilio.adapter.ts`
- `app/_lib/integrations/openai.adapter.ts`
- `app/_lib/integrations/anthropic.adapter.ts`

**Webhook Handler (1):**
- `app/api/v1/twilio-webhook/route.ts`

**API Routes (7):**
- `app/api/v1/workspaces/[id]/agents/route.ts`
- `app/api/v1/workspaces/[id]/agents/[agentId]/route.ts`
- `app/api/v1/workspaces/[id]/agents/[agentId]/conversations/route.ts`
- `app/api/v1/workspaces/[id]/agents/[agentId]/test-chat/route.ts`
- `app/api/v1/workspaces/[id]/agents/[agentId]/test-trigger/route.ts`
- `app/api/v1/integrations/[id]/openai-models/route.ts`
- `app/api/v1/integrations/[id]/anthropic-models/route.ts`

**Workflow Executors (4):**
- `app/_lib/workflow/executors/twilio.ts`
- `app/_lib/workflow/executors/openai.ts`
- `app/_lib/workflow/executors/anthropic.ts`
- `app/_lib/workflow/executors/agent.ts`

**Dashboard UI (6):**
- `app/(dashboard)/workspaces/[id]/agent-list.tsx`
- `app/(dashboard)/workspaces/[id]/agent-editor.tsx`
- `app/(dashboard)/workspaces/[id]/testing-chat-panel.tsx`
- `app/(dashboard)/workspaces/[id]/twilio-config-editor.tsx`
- `app/(dashboard)/workspaces/[id]/openai-config-editor.tsx`
- `app/(dashboard)/workspaces/[id]/anthropic-config-editor.tsx`

### Modified Files (10+)

- `prisma/schema.prisma` -- Agent, Conversation, ConversationMessage models + enums
- `app/_lib/types/index.ts` -- TwilioMeta, OpenAIMeta, AnthropicMeta types
- `app/_lib/integrations/config.ts` -- TWILIO, OPENAI, ANTHROPIC integration configs
- `app/_lib/integrations/index.ts` -- Barrel exports for new adapters
- `app/_lib/workflow/registry.ts` -- Twilio, OpenAI, Anthropic, Agent adapter definitions
- `app/_lib/workflow/executors/index.ts` -- Executor registration
- `app/_lib/workflow/integration-config.ts` -- Visual styling for new adapters
- `app/(dashboard)/workspaces/[id]/workspace-tabs.tsx` -- Agents tab
- `app/(dashboard)/workspaces/[id]/testing-tab.tsx` -- Chats sub-tab
- `app/(dashboard)/_components/sidebar/WorkspaceNav.tsx` -- Agents nav item
- `app/(dashboard)/workspaces/[id]/integration-actions.tsx` -- Wire-up for new integrations

### Dependencies Added

- `twilio` -- SMS sending and webhook signature validation
- `openai` -- Chat Completions API client
- `@anthropic-ai/sdk` -- Messages API client

---

## 3/4/2026 — Feature Audit & Next Steps

### Current Status by Category

#### Done (3)

- **Multi-turn conversation history** — Full message history is loaded from the DB and passed to the AI on every turn. Not just the latest message.
- **Workspace-level agent isolation** — Every query is scoped by workspaceId. Bots, conversations, messages never bleed between clients.
- **Escalation event emission** — Bot emits `escalation_requested` which can trigger workflows.

#### Partial (4)

- **Bot sleep / human takeover** — `ESCALATED` status stops the bot, but there is no `PAUSED` status, no auto-resume on inactivity, and no way for a human to manually pause a specific conversation from the dashboard.
- **Escalation delivery** — The event fires and *can* trigger a workflow (e.g., email the gym owner), but there is no built-in notification and no conversation summary is generated for the human taking over.
- **Per-conversation log** — API exists (`GET /agents/[id]/conversations`) with full messages, but no dashboard UI to view production conversations. Test playground shows test convos only.
- **Per-client usage tracking** — Token counts are stored per-conversation and per-message. No aggregation view, no dashboard surface, no billing hooks.

#### Missing (13)

**Core Config:**
- **Response delay** — Bot replies instantly. Need a configurable delay (e.g., 2-5 seconds) to prevent robotic feel.
- **Initial message** — No dedicated first-message field. The bot only responds to inbound; it never initiates contact.
- **FAQ override layer** — Every message hits the AI. Need keyword/pattern matching that bypasses AI for hardcoded answers (hours, location, pricing).
- **Make channel config optional** — Currently required to create a bot. Should be optional so bots can be created and tested without Twilio configured. Channel only required when used in a workflow.

**Conversation Quality:**
- **Opt-out handling** — No STOP/UNSUBSCRIBE detection, no blocking of future messages, no dashboard surfacing. This is a compliance risk.
- **Rate limiting per lead** — No per-lead throttle. A lead spamming messages gets unlimited AI responses up to the guardrail max.

**Follow-up Sequencing (biggest gap):**
- **Re-engagement triggers** — No timed follow-ups. The engine only reacts to inbound messages, never proactively sends. Need scheduled follow-ups at configurable intervals (e.g., 2hr / 12hr / 23hr within the 24hr SMS window).
- **Follow-up rotation** — No variant cycling. Needs to send different follow-up messages each time, never the same one twice.
- **Last-question-aware follow-up** — No context-aware follow-up generation. Follow-ups should reference the last thing discussed.

**Escalation:**
- **Handoff summary** — No summary generation on escalation. The human taking over has to read the raw conversation.

**Analytics / Visibility:**
- **Conversation dropoff chart** — No analytics on where leads ghost in the flow.
- **Lead pipeline view** — No visual funnel/stage view for gym owners to see their lead funnel.
- **Usage-based billing hooks** — Usage data is tracked but not aggregated or surfaced for billing.

---

### Implementation Roadmap

#### Priority 1 — Core Polish (before real testing)

These are needed to actually test the system end-to-end with real leads:

1. **Make channel config optional on agent** — Remove channel as required field, validate only at workflow-binding time
2. **Response delay** — Add `responseDelaySeconds` field to Agent model and engine, apply before `sendReply`
3. **Initial message** — Add `initialMessage` field; when a new conversation starts via `route_to_agent`, send this before waiting for lead input
4. **Opt-out handling** — Detect STOP/UNSUBSCRIBE in inbound messages, mark conversation as completed, block future messages to that contact, surface in dashboard

#### Priority 2 — Production Readiness

These are needed before deploying to real gym clients:

5. **Bot pause / human takeover** — Add `PAUSED` conversation status, dashboard button to pause per-conversation, auto-resume after configurable inactivity
6. **Escalation delivery** — Built-in email/SMS notification to gym owner on escalation, with AI-generated conversation summary
7. **FAQ override layer** — JSON array of `{ patterns: string[], response: string }` checked before AI call; exact matches bypass the model entirely
8. **Rate limiting per lead** — Cap responses per contact per time window (e.g., max 10 replies per hour)

#### Priority 3 — Follow-up Sequencing

Architecturally significant — requires a scheduler/cron mechanism:

9. **Re-engagement scheduler** — Cron job or delayed-action system that checks for conversations with no reply after configurable intervals, fires follow-up
10. **Follow-up variants** — Configurable array of follow-up message templates, cycled through per conversation
11. **Context-aware follow-up** — Generate follow-up via AI using last conversation context instead of generic template

#### Priority 4 — Visibility & Analytics

12. **Production conversation viewer** — Dashboard UI to browse and read real (non-test) conversations per agent and per lead
13. **Conversation history on lead detail** — Show past conversations on a lead's profile page
14. **Per-workspace usage dashboard** — Aggregated view: messages sent, tokens used, leads touched, estimated cost, broken out by agent
15. **Conversation analytics** — Dropoff chart, response time distribution, escalation rate, completion rate
16. **Lead pipeline view** — Visual stage funnel for gym owners

#### Priority 5 — Scale & Billing

17. **Usage-based billing hooks** — Aggregate usage per workspace per billing period, expose via API for billing integration
18. **Handoff summary** — AI-generated conversation summary on escalation

#### Future (unchanged)

- Tool calling / function calling — Bots calling workflow actions mid-conversation
- Web chat widget — Browser-based chat channel (beyond SMS)
- Multi-channel — WhatsApp, email, web chat channels
- Intent detection — Structured intent/goal tracking

---

---

## 3/8/2026 — Branch Changelog (adapter/sms)

Everything built since the 3/4 audit, in chronological order.

### 1. Full Rename: Chatbot → Agent

All user-facing and codebase references renamed from "chatbot" to "agent" across the entire system:

- **Prisma schema:** Models renamed (`Chatbot` → `Agent`, field `chatbotId` → `agentId`), database tables remapped
- **TypeScript types:** `ChatbotConfig` → `AgentConfig`, `ChatbotResponse` → `AgentResponse`, etc.
- **File/directory names:** `app/_lib/chatbot/` → `app/_lib/agent/`
- **API routes:** `/chatbots/` → `/agents/`
- **Workflow identifiers:** `CHATBOT_ADAPTER` → `AGENT_ADAPTER`, trigger/action names updated
- **Event strings:** `EventSystem.CHATBOT` → `EventSystem.AGENT`
- **UI components:** Tab labels, editor titles, sidebar nav
- **Documentation:** All docs updated

### 2. P1 Features — Core Polish

All P1 roadmap items from the 3/4 audit implemented:

**Response delay** (`responseDelaySeconds` on Agent model):
- Configurable 0-60 second delay before bot replies
- Engine applies delay before `sendReply()`, skipped in test mode
- Returned as `responseDelaySkipped` in test responses for visibility

**Initial message** (`initialMessage` on Agent model):
- Dedicated first-message field with lead variable interpolation (`{{name}}`, `{{email}}`, etc.)
- Sent when `initiateConversation()` creates a new conversation
- UI provides variable autocomplete dropdown in the editor

**Opt-out handling:**
- `OptOutRecord` model in Prisma (workspaceId, contactAddress, reason, source, agentId, conversationId)
- Engine detects STOP/UNSUBSCRIBE/CANCEL keywords via `isOptOutMessage()`
- Creates opt-out record, marks conversation COMPLETED, blocks future messages
- Trigger `contact_opted_out` fires into workflow system

**FAQ override layer** (`faqOverrides` JSON on Agent model):
- Array of `{ patterns: string[], response: string }` entries
- Checked before AI call via `matchFaq()` — pattern matches bypass AI entirely
- Configurable in agent editor UI

**Rate limiting per lead** (`rateLimitPerHour` on Agent model):
- Counts messages from a contact in the last hour
- Returns rate limit error when exceeded
- Event `agent_rate_limited` emitted

**Reference file context:**
- `AgentFile` model stores uploaded reference documents
- `file-extract.ts` extracts text from TXT, CSV, PDF (via `pdf-parse`), DOCX (via `mammoth`)
- Extracted text prepended to system prompt on every AI call
- File upload/delete API routes, max 50K chars per file
- Upload UI in agent editor

**Channel config made optional:**
- Channel fields (`channelType`, `channelIntegration`) nullable on Agent model
- Agents can be created and tested without any channel configured
- Channel only validated when used in production workflows

### 3. Proactive Outreach Architecture

New `initiateConversation()` function in the engine for agent-initiated contact:

- **Channel-agnostic "from" address:** `channelAddress` field on Agent model stores the outbound address (phone number, email, etc.)
- **Contact address resolution:** `CHANNEL_ADAPTER_REGISTRY` entries include `contactField` (e.g., `phone` for Twilio) to look up the lead's address from their properties
- **Dual-mode executor:** `route_to_agent` workflow action supports two modes:
  - **Reactive:** Trigger has `body` + `from` (inbound SMS) → `handleInboundMessage()`
  - **Proactive:** Trigger has no `body` (e.g., `new_member` event) → `initiateConversation()` with agent's initial message
- `getContactFieldForChannel()` helper in adapter registry

### 4. Standards Enforcement Audit

Full audit against `docs/STANDARDS.md` with systematic fixes:

**Adapter registry pattern** (`adapter-registry.ts`):
- `AI_ADAPTER_REGISTRY` and `CHANNEL_ADAPTER_REGISTRY` centralize all provider resolution
- Engine uses `resolveAI()` / `resolveChannel()` — zero hardcoded provider logic
- New providers added via registry entries, not engine changes

**Structured logging:**
- All `console.error` in agent code replaced with `logStructured()` from `app/_lib/reliability`
- Events: `agent_rate_limited`, `agent_ai_failure`, `agent_escalation_notification_failed`, `agent_turn_complete`, `agent_engine_error`, `agent_send_skipped`, etc.

**API standardization:**
- All 8 agent API routes rewritten to use Zod input validation + `ApiResponse` helpers
- `test-action/route.ts` rewritten from raw `NextResponse.json` to `ApiResponse` + Zod + `logStructured`
- `test-action-direct/route.ts` same treatment

**Workspace isolation hardening:**
- Added `workspaceId` to `conversation.updateMany` in DELETE agent route
- All conversation queries double-scoped (agentId + workspaceId)

**Error handling:**
- `file-extract.ts` wrapped PDF/DOCX extraction in try/catch with structured errors
- `conversations/route.ts` query params validated with Zod (`limit`, `offset`, `status`)

### 5. Workflow Tester (Unified Triggers + Actions)

Replaced the basic "Trigger Simulator" in the chat test panel with a comprehensive Workflow Tester:

**Triggers mode:**
- Dropdown of all registered triggers (ABC Ignite, RevLine, Agent, etc.)
- Dynamic form fields rendered from `testFields` definitions in the registry
- ABC Ignite `new_member` trigger has full test fields with defaults (email, name, phone, barcode, member status, join status)
- "Fill Defaults" button resets all fields to pre-configured test data
- Calls `POST /test-action` which fires `emitTrigger()` and returns workflow execution results

**Actions mode:**
- Dropdown of all registered actions with `testFields` (RevLine create_lead, update_lead_stage, emit_event, etc.)
- Dynamic form rendering matching trigger mode
- Calls `POST /test-action-direct` which runs a single action executor directly

**Registry enhancements:**
- `testFields` added to ABC Ignite `new_member`, all RevLine actions, Agent `route_to_agent`, Twilio `send_sms`, Resend `send_email`
- New `getActionsForUI()` function mirrors `getTriggersForUI()`

### 6. Test Flow — isTest Threading

Fixed workflow triggers failing in test mode because agent required a channel:

- Added `isTest?: boolean` to `WorkflowContext` type
- Added `options?: { isTest?: boolean }` parameter to `emitTrigger()`
- Both `test-action` and `test-action-direct` routes set `isTest: true`
- Agent executor passes `testMode: ctx.isTest` to both `handleInboundMessage` and `initiateConversation`
- Reactive mode channel check skipped when `ctx.isTest` is true
- Test-triggered conversations stored with `isTest: true` in DB, visible in chat panel history

### 7. Unified Test Chat Panel

Made the chat panel a true messenger that can continue any conversation:

- Added `conversationId?: string` to `InboundMessageParams`
- `findOrCreateConversation()` checks for `conversationId` first (direct lookup by ID), falls through to address-based lookup if not provided
- `TestChatSchema` accepts optional `conversationId` (UUID)
- `sendMessage()` in UI includes `conversationId` when set (loaded from history)
- Chat panel auto-refreshes history and opens the drawer after firing workflow triggers/actions

**Result:** Load a workflow-initiated conversation from history → type a message → the engine continues that exact conversation. Direct chat still works as before (no `conversationId` = address-based lookup).

### 8. New Files Added Since 3/4

| File | Purpose |
|------|---------|
| `app/_lib/agent/adapter-registry.ts` | AI + channel adapter registries |
| `app/_lib/agent/schemas.ts` | Zod validation schemas for all agent APIs |
| `app/_lib/agent/escalation.ts` | Escalation email notifications |
| `app/_lib/agent/file-extract.ts` | PDF/DOCX/TXT text extraction |
| `app/api/v1/workspaces/[id]/agents/[agentId]/conversations/[conversationId]/route.ts` | Pause/resume conversation |
| `app/api/v1/workspaces/[id]/agents/[agentId]/files/route.ts` | Upload/list agent files |
| `app/api/v1/workspaces/[id]/agents/[agentId]/files/[fileId]/route.ts` | Delete agent file |
| `app/api/v1/workspaces/[id]/test-action-direct/route.ts` | Direct action executor for testing |

### 9. Updated Roadmap Status

| Item | Status | Notes |
|------|--------|-------|
| Channel config optional | **Done** | Nullable fields, validated at workflow time |
| Response delay | **Done** | `responseDelaySeconds`, skipped in test mode |
| Initial message | **Done** | Lead variable interpolation, sent on proactive outreach |
| Opt-out handling | **Done** | STOP detection, OptOutRecord, workflow trigger |
| FAQ override layer | **Done** | Pattern matching before AI, configurable in editor |
| Rate limiting per lead | **Done** | `rateLimitPerHour`, per-contact throttling |
| Reference file context | **Done** | Upload + extract + prepend to system prompt |
| Bot pause / human takeover | **Partial** | `PAUSED` status + `pausedAt`/`pausedBy` fields exist, API route for pause/resume, `autoResumeMinutes` on agent. Dashboard conversation viewer not yet built. |
| Escalation delivery | **Partial** | Email notification to workspace owners via `escalation.ts`. Conversation summary not yet generated. |
| Proactive outreach | **Done** | `initiateConversation()`, dual-mode executor, channel-agnostic contact resolution |
| Workflow tester | **Done** | Unified triggers + actions in chat panel, dynamic test fields |
| Unified test chat | **Done** | `conversationId` threading, continue any conversation |

**Remaining P2 items:** Production conversation viewer UI, handoff summary generation, conversation analytics/dropoff charts, usage dashboard, billing hooks, follow-up sequencing (scheduler needed).

---

## Standards Compliance

Audited against `docs/STANDARDS.md` and `docs/workflows/PRE-PUSH.md` (re-audited 3/8/2026):

- **Abstraction First:** All AI/channel calls through adapter registry — `resolveAI()`, `resolveChannel()`. Zero hardcoded provider logic in engine.
- **Workspace Isolation:** All queries double-scoped (workspaceId + agentId). DELETE route includes workspaceId in updateMany.
- **Event-Driven Debugging:** All errors use `logStructured()`. No `console.error` in agent system code.
- **Fail-Safe Defaults:** Fallback messages on AI failure, graceful error handling, structured try/catch in file extraction.
- **Input Validation:** All API routes use Zod schemas. Query params validated. `TestChatSchema`, `CreateAgentSchema`, `UpdateAgentSchema`, `TestActionSchema`, `TestActionDirectSchema`, `ConversationListQuery`.
- **API Response:** All routes use `ApiResponse` helpers with security headers. No raw `NextResponse.json`.
- **TypeScript:** 0 errors. No `any` types. Explicit interfaces for all public APIs.
- **ESLint:** 0 errors. 33 pre-existing warnings (all outside agent system).
- **Authentication:** All routes verify session + workspace access via `getUserIdFromHeaders()` + `getWorkspaceAccess()`.
- **No secrets in logs:** Verified across all agent files.
