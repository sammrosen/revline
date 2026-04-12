# Agent System Evolution: From Chatbot to General-Purpose Agents

## Context

The agent system (`app/_lib/agent/`) is currently a conversational chatbot engine. Every code path assumes a conversation exists — the entry point is `handleInboundMessage()`, the output is always a text reply sent through a channel (SMS/Email/WebChat), and the only tools available are scheduling operations (check_availability, book_appointment, lookup_customer).

Meanwhile, the workflow engine (`app/_lib/workflow/`) already defines all the business operations we'd want agents to use (Pipedrive CRM, MailerLite, Resend email, Twilio SMS, RevLine leads, ABC Ignite) as executor objects with clean `execute(ctx, params) => ActionResult` interfaces. The pieces exist — they're just wired together in a chat-only way.

**Goal:** Evolve to `trigger -> agent + tools -> output` where trigger can be anything (inbound message, cron, event, workflow, manual), tools are any integration the workspace has configured, and output can be a chat reply, a background task result, or both.

**Approach:** Incremental refactor in 4 phases. Each phase ships independently, maintains backward compatibility, and unlocks new capability.

---

## Phase 1: Extract the AI Reasoning Core

**What:** Pull the AI reasoning loop (call AI, execute tools, loop) out of `engine.ts` into a standalone function that can operate without a conversation.

**Why this is the foundation:** The tool loop at `engine.ts:664-883` is the actual "agent brain" — it calls the AI, processes tool calls, loops, accumulates usage. Everything else in that 1700-line file is conversation orchestration (find/create conversation, store messages, send reply, check timeout, etc.). Extracting this lets us reuse the brain for non-chat execution.

### New file: `app/_lib/agent/reasoning.ts`

```typescript
export interface ReasoningParams {
  workspaceId: string;
  agentId: string;
  agentConfig: AgentConfig;          // reuse existing type
  messages: ChatMessage[];            // system prompt + history/task context
  tools: ResolvedTools;               // from resolveTools()
  maxIterations?: number;             // default 10
  correlationId?: string;             // for structured logging
}

export interface ReasoningResult {
  replyText: string | null;
  toolsUsed: string[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  turnLog: TurnLogEntry[];
  finishReason: string;
}

export async function runReasoning(params: ReasoningParams): Promise<ReasoningResult>
```

### Changes

| File | Change |
|------|--------|
| `app/_lib/agent/reasoning.ts` | **New.** Extract lines 664-883 from engine.ts into `runReasoning()`. Includes: initial AI call with retry, tool execution loop, usage accumulation, turn log entries, structured logging. |
| `app/_lib/agent/engine.ts` | **Modify.** Replace inline tool loop with `runReasoning()` call. Zero behavior change. |
| `app/_lib/agent/types.ts` | **Modify.** Add `ReasoningParams`, `ReasoningResult` types. |
| `app/_lib/agent/index.ts` | **Modify.** Export `runReasoning`. |

### Key detail: `ToolExecutionContext` evolution

Currently `ToolExecutionContext` requires `conversationId`. For non-chat runs, we need this to be optional:

```typescript
// tool-registry.ts — change
export interface ToolExecutionContext {
  workspaceId: string;
  agentId: string;
  conversationId?: string;   // was required, now optional
  runId?: string;            // new: for task runs
  leadId?: string;
  args: Record<string, unknown>;
}
```

Existing tools (scheduling) don't use `conversationId` in their logic, so this is safe.

### Verification

- All existing tests pass unchanged
- `handleInboundMessage` produces identical results (same turn logs, same usage, same replies)
- `runReasoning` is independently callable with mock messages + tools

---

## Phase 2: Bridge Workflow Executors into Agent Tools

**What:** Create an adapter layer that wraps any workflow `ActionExecutor` as an `AgentToolDefinition`, so agents can use all existing integration actions as tools.

**Why this is high-leverage:** The workflow engine already has ~20 business operations defined with descriptions, Zod parameter schemas, and working executors. Bridging them into the tool registry is ~100 lines of code and massively expands what agents can do.

### New file: `app/_lib/agent/tools/workflow-bridge.ts`

For each action in the workflow registry:
1. Use `operationDef.label` + `operationDef.description` as the tool description
2. Convert Zod `paramsSchema` to JSON Schema for the tool's `parameters`
3. The `execute` function builds a minimal `WorkflowContext` from `ToolExecutionContext` and calls the executor

Tool naming: `{adapter}.{operation}` — e.g., `pipedrive.create_deal`, `revline.update_lead_stage`, `resend.send_email`

### What becomes available as agent tools

| Tool name | What it does | Source executor |
|-----------|-------------|-----------------|
| `pipedrive.create_or_update_person` | Upsert CRM contact | `executors/pipedrive.ts` |
| `pipedrive.create_deal` | Create CRM deal | `executors/pipedrive.ts` |
| `pipedrive.move_deal_stage` | Move deal between stages | `executors/pipedrive.ts` |
| `revline.create_lead` | Create/upsert lead | `executors/revline.ts` |
| `revline.update_lead_stage` | Update lead stage | `executors/revline.ts` |
| `revline.update_lead_properties` | Update lead properties | `executors/revline.ts` |
| `revline.emit_event` | Log custom event | `executors/revline.ts` |
| `mailerlite.add_to_group` | Add subscriber to group | `executors/mailerlite.ts` |
| `mailerlite.add_tag` | Tag subscriber | `executors/mailerlite.ts` |
| `resend.send_email` | Send email | `executors/resend.ts` |
| `twilio.send_sms` | Send SMS | `executors/twilio.ts` |
| `abc_ignite.lookup_member` | Look up gym member | `executors/abc-ignite.ts` |
| `abc_ignite.enroll_member` | Enroll member | `executors/abc-ignite.ts` |

### Changes

| File | Change |
|------|--------|
| `app/_lib/agent/tools/workflow-bridge.ts` | **New.** Bridge layer (~100 lines). Reads workflow registry, wraps each action as `AgentToolDefinition`, registers via `registerTool()`. |
| `app/_lib/agent/tools/index.ts` | **Modify.** Import `./workflow-bridge` to trigger registration at module load. |

### Key detail: WorkflowContext bridge

The bridge needs to translate `ToolExecutionContext` → `WorkflowContext`:

```typescript
const workflowCtx: WorkflowContext = {
  workspaceId: toolCtx.workspaceId,
  trigger: { adapter: 'agent', operation: 'tool_call', payload: {} },
  email: '', // resolved from lead if leadId present
  name: '',
  leadId: toolCtx.leadId,
  actionData: {},
  isTest: false,
};
```

Some executors need `email` (e.g., mailerlite, pipedrive). When `leadId` is available, look up the lead's email. When not, the AI should pass email as a param (most executors accept it in params as a fallback).

### Verification

- `getAvailableTools()` returns all bridged tools alongside existing scheduling tools
- An agent with `enabledTools: ["pipedrive.create_deal"]` can call it in a test-chat session
- Existing scheduling tools unaffected

---

## Phase 3: Task Execution Model (AgentRun)

**What:** Introduce `AgentRun` — a lightweight execution record for non-conversational agent runs — and a new entry point `executeTask()` alongside `handleInboundMessage()`.

### New Prisma model: `AgentRun`

```prisma
model AgentRun {
  id          String         @id @default(uuid())
  workspaceId String         @map("workspace_id")
  agentId     String         @map("agent_id")
  leadId      String?        @map("lead_id")

  triggerType  String        @map("trigger_type")    // 'manual' | 'cron' | 'event' | 'workflow'
  triggerRef   String?       @map("trigger_ref")     // correlation ID, workflow execution ID, etc.

  input      Json            @default("{}")
  output     Json?
  turnLog    Json?           @map("turn_log")         // TurnLogEntry[]

  status       AgentRunStatus @default(RUNNING)
  totalTokens  Int           @default(0) @map("total_tokens")
  toolCalls    Int           @default(0) @map("tool_calls")
  iterations   Int           @default(0)

  error String?

  startedAt   DateTime       @default(now()) @map("started_at")
  completedAt DateTime?      @map("completed_at")
  durationMs  Int?           @map("duration_ms")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  agent     Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  lead      Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@index([workspaceId, startedAt])
  @@index([agentId, status])
  @@map("agent_runs")
}

enum AgentRunStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

**Why not reuse Conversation?** Conversation has too much chat-specific baggage: contactAddress, channelAddress, channelIntegration, messages table, follow-ups, PAUSED/ESCALATED/TIMED_OUT statuses. A task run is input/output with a turn log. Shoehorning it into Conversation would mean nullable-ifying required fields and adding confusing conditional logic everywhere.

### New file: `app/_lib/agent/task.ts`

```typescript
export interface TaskParams {
  workspaceId: string;
  agentId: string;
  leadId?: string;
  triggerType: 'manual' | 'cron' | 'event' | 'workflow';
  triggerRef?: string;
  input: Record<string, unknown>;    // trigger payload / task context
  taskPrompt?: string;               // optional override for system prompt
  maxTokens?: number;                // budget override
  maxIterations?: number;            // budget override (default 10)
}

export interface TaskResult {
  success: boolean;
  runId: string;
  output: Record<string, unknown> | null;
  replyText: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  toolsUsed: string[];
  turnLog: TurnLogEntry[];
  durationMs: number;
  error?: string;
}

export async function executeTask(params: TaskParams): Promise<TaskResult>
```

Implementation flow:
1. Load agent config (reuses `loadAgent()` from engine.ts — may need to export it)
2. Create `AgentRun` record (status: RUNNING)
3. Build messages: system prompt + user message constructed from `input` (+ `taskPrompt` if provided)
4. Resolve tools via `resolveTools(agent.enabledTools)`
5. Call `runReasoning()` from Phase 1
6. Apply output guardrails (PII scrubbing, prohibited phrases — same pipeline)
7. Update `AgentRun` with result (status: COMPLETED or FAILED)
8. Emit event via event-logger
9. Emit workflow trigger `agent.task_completed` (enables chaining)
10. Return `TaskResult`

### Agent model changes

Add optional fields to the Agent Prisma model:

```prisma
// In Agent model:
maxTokensPerRun  Int  @default(50000)  @map("max_tokens_per_run")
maxIterationsPerRun Int @default(10)   @map("max_iterations_per_run")
```

These serve as budget defaults for task runs. The `channels` field remains optional at the DB level (already JSON, can be empty array) — task-only agents just don't configure channels.

### Changes

| File | Change |
|------|--------|
| `prisma/schema.prisma` | **Modify.** Add `AgentRun` model, `AgentRunStatus` enum, budget fields on Agent. |
| `app/_lib/agent/task.ts` | **New.** `executeTask()` entry point. |
| `app/_lib/agent/engine.ts` | **Modify.** Export `loadAgent()` (currently internal). |
| `app/_lib/agent/types.ts` | **Modify.** Add `TaskParams`, `TaskResult`. |
| `app/_lib/agent/index.ts` | **Modify.** Export `executeTask`. |
| `app/_lib/workflow/registry.ts` | **Modify.** Add `task_completed` trigger + `execute_task` action to agent adapter. |
| `app/_lib/workflow/executors/agent.ts` | **Modify.** Add `execute_task` executor alongside `route_to_agent`. |

### Verification

- `executeTask()` runs an agent with tools, produces a TaskResult with turn log
- `AgentRun` record persisted with full metadata
- Workflow trigger `agent.task_completed` fires and can trigger downstream workflows
- Existing `handleInboundMessage` and `route_to_agent` unaffected

---

## Phase 4: Trigger Architecture + API

**What:** Wire up all the trigger types and expose APIs for managing and running task agents.

### 4a. Manual invocation API

```
POST /api/v1/workspaces/[id]/agents/[agentId]/run
Body: { input: {...}, taskPrompt?: "..." }
Response: TaskResult
```

Simple route that calls `executeTask({ triggerType: 'manual', ... })`.

### 4b. Cron-triggered agents

Add `schedule` field to Agent model:

```prisma
// In Agent model:
schedule Json? @map("schedule")  // { cron: "0 9 * * *", timezone: "America/New_York", taskPrompt: "...", enabled: true }
```

New cron route: `app/api/v1/cron/agent-tasks/route.ts`
- Protected by CRON_SECRET (same as existing cron routes)
- Queries all agents with `schedule.enabled = true` where cron expression matches
- Calls `executeTask({ triggerType: 'cron' })` for each
- Workspace-isolated with per-workspace error handling (same pattern as follow-ups cron)

### 4c. Workflow-to-task-agent action

Already wired in Phase 3 (`execute_task` executor). Any workflow trigger (Calendly booking, Stripe payment, form submission, Pipedrive deal update) can invoke a task agent as a workflow action.

### 4d. AgentRun viewer API

```
GET /api/v1/workspaces/[id]/agents/[agentId]/runs?status=...&limit=...
GET /api/v1/workspaces/[id]/agents/[agentId]/runs/[runId]
```

### Changes

| File | Change |
|------|--------|
| `prisma/schema.prisma` | **Modify.** Add `schedule` field to Agent. |
| `app/api/v1/workspaces/[id]/agents/[agentId]/run/route.ts` | **New.** Manual task invocation. |
| `app/api/v1/workspaces/[id]/agents/[agentId]/runs/route.ts` | **New.** List agent runs. |
| `app/api/v1/workspaces/[id]/agents/[agentId]/runs/[runId]/route.ts` | **New.** Get run detail. |
| `app/api/v1/cron/agent-tasks/route.ts` | **New.** Cron handler. |
| `app/_lib/agent/schemas.ts` | **Modify.** Add schedule validation schema, run invocation schema. |

### Verification

- Manual invocation via API produces AgentRun with full turn log
- Cron handler correctly evaluates schedules and runs due agents
- Run list/detail APIs return correct data with workspace scoping
- End-to-end: create agent with schedule -> cron fires -> agent runs -> task_completed triggers workflow -> downstream action executes

---

## Budget & Safety Model

Trust the prompt + structural guardrails:

- **Token budget:** `maxTokensPerRun` on agent config (default 50k). `runReasoning` checks accumulated tokens and stops if exceeded.
- **Iteration budget:** `maxIterationsPerRun` on agent config (default 10). Same limit as chat tool loop.
- **Output guardrails:** Same pipeline as chat (PII scrubbing, prohibited phrases, prompt leak detection). Applied to task output text.
- **Workspace rate limits:** Max agent runs per day per workspace (configurable, default 100). Enforced in `executeTask()` before running.
- **Event logging:** Every task run emits events to the event ledger. Full turn log preserved on AgentRun record.

No per-action approval. No dry-run mode initially. The system prompt is the control plane — same as how chat agents work today.

---

## What We're NOT Doing

- **No agent framework/library** — we have the pieces, just reorganizing them
- **No multi-agent orchestration** — one agent per run, chaining via workflow triggers
- **No streaming for task runs** — synchronous execution, results returned when complete
- **No UI changes in this plan** — dashboard agent editor/run viewer is a follow-up
- **No new integration adapters** — we're exposing existing ones as agent tools

---

## Phase Order & Dependencies

```
Phase 1 (Extract Reasoning Core)
    |
    v
Phase 2 (Bridge Workflow Executors) -- can overlap with Phase 1
    |
    v
Phase 3 (Task Execution Model) -- requires Phase 1 + 2
    |
    v
Phase 4 (Triggers + API) -- requires Phase 3
```

Phases 1 and 2 have no dependency on each other and can be developed in parallel. Phase 2 uses `registerTool()` (no engine changes), Phase 1 modifies the engine (no tool changes).

---

## Critical Files Reference

| File | Role |
|------|------|
| `app/_lib/agent/engine.ts` | Current monolith — extraction source for Phase 1 |
| `app/_lib/agent/tool-registry.ts` | Tool registration interface — Phase 2 registers into this |
| `app/_lib/agent/types.ts` | Type definitions — extended in Phases 1, 3 |
| `app/_lib/agent/tools/scheduling.ts` | Existing tool implementations — pattern reference |
| `app/_lib/workflow/registry.ts` | Adapter definitions with Zod schemas — Phase 2 reads these |
| `app/_lib/workflow/executors/index.ts` | Executor registry — Phase 2 wraps these |
| `app/_lib/workflow/executors/agent.ts` | Current agent executor — Phase 3 extends |
| `app/_lib/workflow/types.ts` | WorkflowContext, ActionResult — Phase 2 bridge types |
| `prisma/schema.prisma` | Agent, Conversation models — Phase 3 adds AgentRun |
| `app/_lib/agent/guardrails/output-filter.ts` | Output guardrails — reused for task output |
| `app/_lib/event-logger.ts` | Event emission — used by all phases |
