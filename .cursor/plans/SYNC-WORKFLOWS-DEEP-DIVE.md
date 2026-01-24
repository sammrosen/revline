# Sync Workflows: Making Everything Talk to Everything

## Executive Summary

**Question:** Can we make the booking system workflow-based so ABC Ignite connections appear in the graph?

**Answer:** Yes, and it's approximately 8-12 hours of work. This document explains what exists, what needs to change, and the tradeoffs.

---

## Current Architecture

### Three Execution Patterns

The codebase currently has three patterns for calling external APIs:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT EXECUTION PATTERNS                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PATTERN 1: Async Workflows (Fire-and-Forget)                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│  │ Trigger  │───▶│ Workflow │───▶│ Executor │───▶│ Adapter  │                          │
│  │ emitted  │    │ Engine   │    │          │    │          │                          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                          │
│       │                                                │                                │
│       └─ Returns immediately                           └─ Results logged, not returned │
│                                                                                         │
│  Used by: Calendly webhooks, Stripe webhooks, form captures                             │
│  Visible in graph: YES                                                                  │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PATTERN 2: Direct Provider Calls (Sync)                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│  │ API      │───▶│ Booking  │───▶│ ABC      │───▶│ ABC API  │                          │
│  │ Route    │    │ Provider │    │ Adapter  │    │          │                          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                          │
│       │                                                │                                │
│       └─ Waits for result                              └─ Result returned to caller    │
│                                                                                         │
│  Used by: Booking API (lookup, availability, create)                                    │
│  Visible in graph: NO (hardcoded)                                                       │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PATTERN 3: Direct Service Calls (Sync)                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                                          │
│  │ API      │───▶│ Email    │───▶│ Resend   │                                          │
│  │ Route    │    │ Service  │    │ Adapter  │                                          │
│  └──────────┘    └──────────┘    └──────────┘                                          │
│                                                                                         │
│  Used by: Magic link emails, booking confirmations                                      │
│  Visible in graph: NO (hardcoded)                                                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**The Gap:** Patterns 2 and 3 don't appear in the workflow graph because they bypass the workflow engine.

---

## What the Workflow Engine Already Does

The workflow engine is surprisingly capable:

### Execution Flow

```typescript
// 1. Trigger is emitted
const result = await emitTrigger(workspaceId, trigger, payload);

// 2. Engine finds matching workflows
const workflows = await prisma.workflow.findMany({
  where: { workspaceId, enabled: true, triggerAdapter, triggerOperation }
});

// 3. For each workflow, execute actions SEQUENTIALLY
for (const action of workflow.actions) {
  const executor = getActionExecutor(action.adapter, action.operation);
  const result = await executeIdempotent(key, () => executor.execute(ctx, params));
  
  // Context accumulation: each action can pass data to the next
  if (result.data) {
    ctx.actionData = { ...ctx.actionData, ...result.data };
  }
}

// 4. Results are logged, but NOT returned to caller
```

### Key Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Sequential execution | ✅ Done | Actions run in order |
| Context accumulation | ✅ Done | Action outputs feed into next action |
| Idempotency | ✅ Done | 24-hour dedup via idempotent executor |
| Error handling | ✅ Done | Fail-fast, alerts on failure |
| Result capture | ✅ Done | Stored in `WorkflowExecution.actionResults` |
| Result RETURN | ❌ Missing | `emitTrigger()` doesn't return action results |

**The Only Missing Piece:** A sync execution path that returns action results to the caller.

---

## The Sync Workflow Proposal

### New Execution Mode

```typescript
// NEW: Sync workflow execution
async function executeWorkflowSync(
  workspaceId: string,
  triggerAdapter: string,
  triggerOperation: string,
  payload: Record<string, unknown>
): Promise<SyncWorkflowResult> {
  
  // 1. Find matching workflow (expect exactly one for sync)
  const workflow = await prisma.workflow.findFirst({
    where: { workspaceId, enabled: true, triggerAdapter, triggerOperation }
  });
  
  if (!workflow) {
    return { success: false, error: 'No workflow configured for this trigger' };
  }
  
  // 2. Execute workflow (reuse existing executeWorkflow logic)
  const result = await executeWorkflow(workflow, buildContext(payload));
  
  // 3. Return the final action result (or specific action's result)
  return {
    success: result.status === 'completed',
    data: result.results[result.results.length - 1]?.result.data,
    error: result.error,
    executionId: result.executionId,
  };
}
```

### Booking API Transformation

**Before (Direct Provider Call):**
```typescript
// POST /api/v1/booking/create
const provider = await getBookingProvider(workspaceId);
const result = await provider.createBooking(slot, customer);
```

**After (Sync Workflow):**
```typescript
// POST /api/v1/booking/create
const result = await executeWorkflowSync(
  workspaceId,
  'booking',           // adapter
  'create_booking',    // operation
  {
    slotId: slot.id,
    customerId: customer.id,
    employeeId: slot.providerData.employeeId,
    eventTypeId: slot.providerData.eventTypeId,
    startTime: slot.providerData.abcLocalStartTime,
  }
);

if (!result.success) {
  return ApiResponse.error(result.error);
}

return ApiResponse.success({ bookingId: result.data.bookingId });
```

### What Shows Up in the Graph

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              AFTER: VISIBLE IN GRAPH                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   [Booking Form] ──trigger──▶ [Workflow: Create Booking] ──action──▶ [ABC Ignite]       │
│                                                                                         │
│   The workflow is:                                                                      │
│   • Trigger: booking.create_booking                                                     │
│   • Action: abc_ignite.create_appointment                                               │
│   • Params: Map slot data to ABC fields                                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## What Needs to Be Built

### 1. Sync Workflow Execution (~2-3 hours)

**File:** `app/_lib/workflow/engine.ts`

Add a new function that:
- Finds a single matching workflow
- Executes it synchronously
- Returns the final action result

```typescript
export interface SyncWorkflowResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  executionId?: string;
}

export async function executeWorkflowSync(
  workspaceId: string,
  trigger: WorkflowTrigger,
  payload: Record<string, unknown>
): Promise<SyncWorkflowResult> {
  // Implementation
}
```

### 2. Create Appointment Action (~2 hours)

**File:** `app/_lib/workflow/executors/abc-ignite.ts`

The existing executors have `enroll_member` (join existing event) but not `create_appointment` (create new from availability).

```typescript
// Add to abcIgniteExecutors
create_appointment: {
  execute: async (ctx, params) => {
    const adapter = await AbcIgniteAdapter.forClient(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured' };
    }
    
    const result = await adapter.createAppointment({
      employeeId: params.employeeId,
      eventTypeId: params.eventTypeId,
      levelId: params.levelId,
      startTime: params.startTime,  // LOCAL time
      memberId: params.memberId,
    });
    
    return {
      success: result.success,
      data: { bookingId: result.data?.eventId },
      error: result.error,
    };
  },
},
```

### 3. Booking Trigger Adapter (~1 hour)

**File:** `app/_lib/workflow/registry.ts`

Add a `booking` adapter to the registry:

```typescript
export const BOOKING_ADAPTER: AdapterDefinition = {
  id: 'booking',
  name: 'Booking System',
  requiresIntegration: false,
  triggers: {
    create_booking: {
      name: 'Create Booking',
      description: 'When a booking is requested',
      payloadSchema: z.object({
        slotId: z.string(),
        customerId: z.string(),
        employeeId: z.string(),
        eventTypeId: z.string(),
        startTime: z.string(),
        memberId: z.string(),
      }),
    },
    // Future: lookup_member, check_availability
  },
  actions: {},
};
```

### 4. Booking API Refactor (~3 hours)

**Files:**
- `app/api/v1/booking/create/route.ts`
- `app/api/v1/booking/confirm/[token]/route.ts`

Replace direct provider calls with `executeWorkflowSync()`.

### 5. Workflow Configuration (Per Workspace)

Users create a workflow in the UI:
- **Name:** "Create Booking"
- **Trigger:** `booking.create_booking`
- **Action:** `abc_ignite.create_appointment`
- **Params:** Map trigger payload to action params

---

## What You Get

### 1. Full Graph Visibility

Every integration connection is visible:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SYSTEM GRAPH                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   [Calendly] ─webhook─▶ [Booking Created] ─action─▶ [MailerLite]                       │
│                                                                                         │
│   [Booking Form] ─trigger─▶ [Create Booking] ─action─▶ [ABC Ignite]                    │
│                         └─action─▶ [Resend] (confirmation email)                        │
│                                                                                         │
│   [Email Capture Form] ─trigger─▶ [Lead Captured] ─action─▶ [MailerLite]               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Configurable Everything

Want to add a step after booking? Just add an action:

```yaml
Workflow: Create Booking
  Trigger: booking.create_booking
  Actions:
    1. abc_ignite.create_appointment  # Book with ABC
    2. resend.send_email              # Send confirmation
    3. mailerlite.add_to_group        # Add to mailing list
```

### 3. Consistent Reliability

All calls go through:
- Idempotent execution (no double bookings)
- Structured logging
- Error alerting
- Execution history

### 4. Single Mental Model

"Triggers fire workflows. Workflows execute actions. Actions call integrations."

---

## What You're NOT Getting (Limitations)

### 1. Requires Workflow Configuration

Each booking type needs a workflow configured. You can't just enable ABC Ignite and have booking "just work" - you need to wire it up.

**Mitigation:** Create default workflows when ABC Ignite is configured, or use a "template" system.

### 2. Sync Workflows Are Single-Workflow

The sync execution expects ONE matching workflow. If multiple workflows match the same trigger, it's ambiguous which result to return.

**Mitigation:** Validate that sync triggers have at most one enabled workflow.

### 3. No Automatic Rollback

If the ABC call succeeds but a subsequent action fails (e.g., email), the booking exists but the email didn't send.

**Mitigation:** This is already true today. Consider sagas/compensation actions for v2.

### 4. Slightly More Latency

Workflow execution adds:
- Database query to find workflow (~5ms)
- Idempotency check (~5ms)
- Execution record creation (~5ms)

Total: ~15-20ms overhead per call. Acceptable for booking flows.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sync workflow bugs | Medium | High | Extensive testing, gradual rollout |
| Performance regression | Low | Medium | Benchmark before/after |
| User confusion | Medium | Low | Good defaults, documentation |
| Migration complexity | Low | Low | Old provider code remains, workflows optional |

---

## Implementation Plan

### Phase 1: Foundation (4-6 hours)

1. Add `executeWorkflowSync()` to workflow engine
2. Add `create_appointment` action to ABC executors
3. Add `booking` adapter to registry
4. Write tests

### Phase 2: Booking Integration (3-4 hours)

1. Refactor `/booking/create` to use sync workflow
2. Refactor `/booking/confirm` to use sync workflow
3. Keep provider as fallback if no workflow exists
4. Test end-to-end

### Phase 3: Graph Updates (Already Done)

The graph will automatically show booking workflows because they're just regular workflows.

### Phase 4: UX Polish (2-3 hours)

1. Default workflow templates when ABC is configured
2. UI for creating booking workflows
3. Documentation

---

## Verdict: Is This Too Ambitious?

**No.** This is approximately 10-15 hours of focused work for core functionality.

**Why it's achievable:**
- Workflow engine already does 90% of what's needed
- ABC adapter methods already exist
- Reliability infrastructure is already solid
- It's mostly wiring, not new concepts

**Why it's valuable:**
- Unified mental model (everything is workflows)
- Full visibility (everything in the graph)
- Configurable (change behavior without code)
- Foundation for "anything talks to anything"

**What you're building toward:**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE VISION: ANYTHING TALKS TO ANYTHING                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   Triggers (Events)         Workflows (Wiring)           Actions (Integrations)         │
│   ─────────────────         ────────────────             ────────────────────           │
│   • Calendly booking        User-configured              • ABC Ignite                   │
│   • Stripe payment          in the UI,                   • MailerLite                   │
│   • Form submission         visible in graph,            • Resend                       │
│   • Booking request         testable,                    • ManyChat                     │
│   • Custom webhook          reliable                     • Stripe                       │
│   • Scheduled job                                        • Custom API                   │
│                                                                                         │
│   ANY trigger can connect to ANY action through a workflow.                             │
│   The graph shows the complete picture.                                                 │
│   Everything is configurable, nothing is hardcoded.                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## What You Might Be Missing

### 1. Sync vs Async Semantics

Some operations need sync (booking - user waits for result), some need async (email - fire and forget). The engine should support both cleanly.

### 2. Workflow Templates

Users shouldn't have to build common workflows from scratch. "Enable ABC Ignite" should offer to create the booking workflow automatically.

### 3. Error UX

When a sync workflow fails, what does the user see? Need good error messages that map technical failures to user-friendly text.

### 4. Idempotency Keys from Callers

For sync workflows, who provides the idempotency key? The workflow engine generates one, but for booking, you might want the caller to provide one (e.g., pending booking ID) to prevent duplicates across retries.

### 5. Multi-Action Results

If a workflow has 3 actions, which result goes back to the caller? Options:
- Last action's result (current proposal)
- All action results (more complex but flexible)
- Marked "primary" action result

### 6. Timeout Handling

What if ABC is slow? The sync workflow needs a deadline. The resilient client has timeouts, but the overall workflow execution should also have a max duration.

---

## Next Steps

If you want to proceed:

1. **Confirm the approach:** Sync workflows for booking, everything visible in graph
2. **Prioritize:** Core functionality first, polish later
3. **I'll build it:** Start with Phase 1, incrementally deliver

If you want to defer:

1. **Document the gap:** "Booking uses direct provider calls, not visible in graph"
2. **Ship what we have:** The async workflow graph is still valuable
3. **Revisit later:** When you have more integration patterns to learn from

What's your call?
