# Workflow Engine

The workflow engine is RevLine's decoupled automation system. It connects **triggers** (events from integrations) to **actions** (operations performed by integrations) through configurable **workflows**.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [How It Works](#how-it-works)
5. [Adding New Adapters](#adding-new-adapters)
6. [Adding New Operations](#adding-new-operations)
7. [Creating Workflows](#creating-workflows)
8. [Workflow Context & Data Flow](#workflow-context--data-flow)
9. [Trigger Filters](#trigger-filters)
10. [Error Handling](#error-handling)
11. [Execution History](#execution-history)
12. [API Reference](#api-reference)
13. [Examples](#examples)

---

## Overview

The workflow engine replaces hardcoded integration logic with a flexible, configurable system:

**Before (hardcoded):**
```
Stripe payment → Always update lead to PAID → Always add to "customers" group
```

**After (workflow-based):**
```
Stripe payment → [Workflow decides] → Run configured actions
```

### Key Benefits

- **Decoupled:** Integrations don't know about each other
- **Configurable:** Actions are defined per-client, not in code
- **Extensible:** Add new integrations by adding adapters
- **Auditable:** Every execution is logged with results
- **Filterable:** Run workflows only when conditions match

---

## Core Concepts

### Adapters

An **adapter** represents an integration (external service or internal capability):

| Adapter | Description | Type |
|---------|-------------|------|
| `calendly` | Booking/scheduling webhooks | External |
| `stripe` | Payment webhooks | External |
| `mailerlite` | Email list management | External |
| `revline` | Internal lead & event management | Internal |
| `manychat` | Instagram DM automation | External (future) |

### Triggers

A **trigger** is an event that starts a workflow:

| Trigger | Description | Payload |
|---------|-------------|---------|
| `calendly.booking_created` | Someone booked a call | email, name, eventType |
| `calendly.booking_canceled` | Booking was canceled | email, name, reason |
| `stripe.payment_succeeded` | One-time payment completed | email, name, amount, product |
| `stripe.subscription_created` | Subscription started | email, amount, interval |
| `revline.email_captured` | Lead captured on landing page | email, name, source |

### Actions

An **action** is an operation a workflow can execute:

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `mailerlite.add_to_group` | Add subscriber to a group | `group` (group key) |
| `mailerlite.remove_from_group` | Remove from a group | `group` (group key) |
| `mailerlite.add_tag` | Add a tag to subscriber | `tag` (tag name) |
| `revline.create_lead` | Create/update a lead record | `source` (optional) |
| `revline.update_lead_stage` | Update lead stage | `stage` (CAPTURED/BOOKED/PAID/DEAD) |
| `revline.emit_event` | Log a custom event | `eventType`, `success` |

### Workflows

A **workflow** connects one trigger to one or more actions:

```
┌─────────────────────────────────────────────────────────────┐
│ Workflow: "Booking to MailerLite"                           │
├─────────────────────────────────────────────────────────────┤
│ Trigger: calendly.booking_created                           │
│ Filter:  (none)                                             │
├─────────────────────────────────────────────────────────────┤
│ Actions:                                                    │
│   1. revline.update_lead_stage → { stage: "BOOKED" }       │
│   2. mailerlite.add_to_group   → { group: "booked_calls" } │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
                                  ┌──────────────────────┐
                                  │    Webhook Handler   │
                                  │  (Stripe, Calendly)  │
                                  └──────────┬───────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW ENGINE                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐     ┌─────────────────┐                      │
│   │  emitTrigger()  │────▶│  Find Matching  │                      │
│   │                 │     │   Workflows     │                      │
│   └─────────────────┘     └────────┬────────┘                      │
│                                    │                                │
│                                    ▼                                │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │ For each workflow:                                       │      │
│   │   1. Evaluate trigger filter                             │      │
│   │   2. Build WorkflowContext                               │      │
│   │   3. Execute actions sequentially                        │      │
│   │   4. Stop on first error                                 │      │
│   │   5. Record execution result                             │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                    │                                │
│                                    ▼                                │
│   ┌─────────────────┐     ┌─────────────────┐                      │
│   │ Action Executor │────▶│   Integration   │                      │
│   │    Registry     │     │    Adapters     │                      │
│   └─────────────────┘     └─────────────────┘                      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │   Event Log &   │
                          │   Execution DB  │
                          └─────────────────┘
```

### File Structure

```
app/_lib/workflow/
├── index.ts           # Re-exports everything
├── types.ts           # TypeScript types & interfaces
├── registry.ts        # Adapter definitions (triggers & actions)
├── engine.ts          # Core execution logic
└── executors/
    ├── index.ts       # Executor registry
    ├── mailerlite.ts  # MailerLite action executors
    └── revline.ts     # RevLine action executors
```

---

## How It Works

### 1. Trigger Emission

When an event occurs (webhook received, email captured), the handler calls `emitTrigger()`:

```typescript
import { emitTrigger } from '@/app/_lib/workflow';

// In stripe-webhook/route.ts
await emitTrigger(
  clientId,
  { adapter: 'stripe', operation: 'payment_succeeded' },
  {
    email: 'customer@example.com',
    name: 'John Doe',
    amount: 9900,
    product: 'premium_coaching',
  }
);
```

### 2. Workflow Matching

The engine finds all workflows for this client where:
- `enabled = true`
- `triggerAdapter = 'stripe'`
- `triggerOperation = 'payment_succeeded'`

### 3. Filter Evaluation

For each workflow, if a `triggerFilter` is defined, it's evaluated against the payload:

```json
// Workflow filter
{ "product": "premium_coaching" }

// Payload
{ "email": "...", "product": "premium_coaching" }

// Result: MATCH ✓
```

### 4. Context Building

A `WorkflowContext` is created with normalized data:

```typescript
{
  trigger: {
    adapter: 'stripe',
    operation: 'payment_succeeded',
    payload: { email: '...', amount: 9900, product: '...' }
  },
  email: 'customer@example.com',  // Extracted from payload
  name: 'John Doe',               // Extracted from payload
  clientId: 'client-uuid',
  leadId: undefined,              // Will be set if lead is created
  actionData: {},                 // Accumulated from action results
}
```

### 5. Sequential Action Execution

Actions run in order. Each action:
1. Gets executed by its adapter's executor
2. Can access and modify the context
3. Returns success/failure
4. On failure: workflow stops, remaining actions skipped

### 6. Result Recording

A `WorkflowExecution` record is created with:
- Trigger info (adapter, operation, payload)
- Status (COMPLETED or FAILED)
- Action results array
- Error message (if failed)
- Timing (startedAt, completedAt)

---

## Adding New Adapters

To add a new integration (e.g., ConvertKit):

### Step 1: Define the Adapter

Edit `app/_lib/workflow/registry.ts`:

```typescript
export const CONVERTKIT_ADAPTER: AdapterDefinition = {
  id: 'convertkit',
  name: 'ConvertKit',
  requiresIntegration: true,  // Needs client config
  triggers: {
    subscriber_activated: {
      name: 'subscriber_activated',
      label: 'Subscriber Activated',
      description: 'Fires when a subscriber confirms their email',
      payloadSchema: z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
      }),
    },
  },
  actions: {
    add_to_sequence: {
      name: 'add_to_sequence',
      label: 'Add to Sequence',
      description: 'Add subscriber to an email sequence',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        sequenceId: z.string().describe('ConvertKit sequence ID'),
      }),
    },
  },
};

// Add to registry
export const ADAPTER_REGISTRY: Record<string, AdapterDefinition> = {
  // ... existing
  convertkit: CONVERTKIT_ADAPTER,
};
```

### Step 2: Create Action Executors

Create `app/_lib/workflow/executors/convertkit.ts`:

```typescript
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

const addToSequence: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const sequenceId = params.sequenceId as string;
    
    // Get ConvertKit adapter (you'd need to create this)
    const adapter = await ConvertKitAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ConvertKit not configured' };
    }
    
    // Call ConvertKit API
    const result = await adapter.addToSequence(ctx.email, sequenceId);
    
    return result;
  },
};

export const convertkitExecutors: Record<string, ActionExecutor> = {
  add_to_sequence: addToSequence,
};
```

### Step 3: Register Executors

Edit `app/_lib/workflow/executors/index.ts`:

```typescript
import { convertkitExecutors } from './convertkit';

const EXECUTORS: Record<string, Record<string, ActionExecutor>> = {
  // ... existing
  convertkit: convertkitExecutors,
};
```

---

## Adding New Operations

To add a new trigger or action to an existing adapter:

### Adding a Trigger

Edit the adapter in `registry.ts`:

```typescript
export const STRIPE_ADAPTER: AdapterDefinition = {
  // ...
  triggers: {
    // existing triggers...
    
    refund_created: {
      name: 'refund_created',
      label: 'Refund Created',
      description: 'Fires when a refund is processed',
      payloadSchema: z.object({
        email: z.string().email(),
        amount: z.number(),
        reason: z.string().optional(),
      }),
    },
  },
};
```

Then emit this trigger from the appropriate webhook handler.

### Adding an Action

1. Add to registry:

```typescript
export const MAILERLITE_ADAPTER: AdapterDefinition = {
  // ...
  actions: {
    // existing actions...
    
    update_field: {
      name: 'update_field',
      label: 'Update Custom Field',
      description: 'Update a custom field for a subscriber',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        field: z.string(),
        value: z.string(),
      }),
    },
  },
};
```

2. Add executor:

```typescript
// In executors/mailerlite.ts

const updateField: ActionExecutor = {
  async execute(ctx, params): Promise<ActionResult> {
    // Implementation
  },
};

export const mailerliteExecutors: Record<string, ActionExecutor> = {
  // existing...
  update_field: updateField,
};
```

---

## Creating Workflows

### Via Admin API

**Create a workflow:**

```bash
POST /api/admin/workflows
Content-Type: application/json

{
  "clientId": "client-uuid",
  "name": "Payment to Customer List",
  "triggerAdapter": "stripe",
  "triggerOperation": "payment_succeeded",
  "triggerFilter": { "product": "coaching" },
  "actions": [
    {
      "adapter": "revline",
      "operation": "update_lead_stage",
      "params": { "stage": "PAID" }
    },
    {
      "adapter": "mailerlite",
      "operation": "add_to_group",
      "params": { "group": "customers" }
    }
  ]
}
```

**Update a workflow:**

```bash
PATCH /api/admin/workflows/{workflowId}
Content-Type: application/json

{
  "name": "Updated Workflow Name",
  "enabled": false
}
```

### Via Database Seed

For default workflows, add to `prisma/seed.ts`:

```typescript
await prisma.workflow.create({
  data: {
    clientId: client.id,
    name: 'Default: Email Capture',
    triggerAdapter: 'revline',
    triggerOperation: 'email_captured',
    actions: [
      {
        adapter: 'revline',
        operation: 'create_lead',
        params: {},
      },
      {
        adapter: 'mailerlite',
        operation: 'add_to_group',
        params: { group: 'leads' },
      },
    ],
  },
});
```

---

## Workflow Context & Data Flow

The `WorkflowContext` passes data between actions:

```typescript
interface WorkflowContext {
  // Trigger info (immutable)
  trigger: {
    adapter: string;       // e.g., 'stripe'
    operation: string;     // e.g., 'payment_succeeded'
    payload: Record<string, unknown>;
  };
  
  // Extracted data (normalized)
  email: string;           // Always available
  name?: string;           // If provided
  
  // Client context
  clientId: string;
  
  // Mutable state
  leadId?: string;         // Set when lead is created/found
  actionData: Record<string, unknown>;  // Accumulated from actions
}
```

### Data Accumulation

When an action succeeds, its result data is merged into `actionData`:

```typescript
// Action 1: revline.create_lead returns { leadId: 'abc' }
// Context becomes: { actionData: { leadId: 'abc' }, leadId: 'abc' }

// Action 2: Can now access ctx.leadId
```

### Email Extraction

The engine automatically extracts email from common payload shapes:

```typescript
// All of these work:
{ email: 'user@example.com' }
{ customer_email: 'user@example.com' }
{ customer: { email: 'user@example.com' } }
```

---

## Trigger Filters

Trigger filters let workflows run only when specific conditions match.

### Basic Equality

```json
{ "product": "premium" }
```

Matches when `payload.product === "premium"`.

### Nested Paths

```json
{ "customer.plan": "pro" }
```

Matches when `payload.customer.plan === "pro"`.

### Multiple Conditions (AND)

```json
{
  "product": "coaching",
  "amount": 9900
}
```

All conditions must match.

### Example Use Cases

**Run only for specific product:**
```json
// Trigger: stripe.payment_succeeded
// Filter:
{ "product": "fit1" }
```

**Run only for high-value purchases:**
```json
// Trigger: stripe.payment_succeeded
// Filter:
{ "amount": 99900 }  // $999.00
```

---

## Error Handling

### Stop on First Error

When an action fails, the workflow stops immediately:

```
Action 1: revline.create_lead    ✓ Success
Action 2: mailerlite.add_to_group  ✗ Failed (group not found)
Action 3: revline.emit_event     ⊘ Skipped
```

### Error Recording

Failed workflows are recorded with:
- Status: `FAILED`
- Error message: Details of what failed
- Action results: Which actions ran before failure

### Event Logging

Failed actions emit events to the event log:

- `workflow_action_failed` - Action returned failure
- `workflow_action_error` - Action threw an exception
- `workflow_failed` - Workflow didn't complete all actions

---

## Execution History

Every workflow execution is recorded in `workflow_executions`:

```sql
SELECT 
  id,
  workflow_id,
  trigger_adapter,
  trigger_operation,
  status,
  error,
  started_at,
  completed_at
FROM workflow_executions
WHERE client_id = 'xxx'
ORDER BY started_at DESC
LIMIT 50;
```

### Viewing via API

```bash
GET /api/admin/workflows/{workflowId}/executions
```

Response:
```json
[
  {
    "id": "exec-uuid",
    "workflowId": "workflow-uuid",
    "status": "COMPLETED",
    "triggerAdapter": "stripe",
    "triggerOperation": "payment_succeeded",
    "triggerPayload": { "email": "...", "amount": 9900 },
    "actionResults": [
      { "action": {...}, "result": { "success": true, "data": {...} } }
    ],
    "startedAt": "2025-01-05T10:30:00Z",
    "completedAt": "2025-01-05T10:30:01Z"
  }
]
```

---

## API Reference

### Workflows

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/workflows` | GET | List all workflows |
| `/api/admin/workflows` | POST | Create a workflow |
| `/api/admin/workflows/{id}` | GET | Get a workflow |
| `/api/admin/workflows/{id}` | PATCH | Update a workflow |
| `/api/admin/workflows/{id}` | DELETE | Delete a workflow |
| `/api/admin/workflows/{id}/toggle` | PATCH | Enable/disable a workflow |
| `/api/admin/workflows/{id}/executions` | GET | Get execution history |

### Registry

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/workflow-registry` | GET | Get all adapters with triggers/actions |
| `/api/admin/workflow-registry/triggers` | GET | Get all available triggers |
| `/api/admin/workflow-registry/actions` | GET | Get all available actions |

---

## Examples

### Example 1: Basic Email Capture

**Trigger:** `revline.email_captured`  
**Actions:**
1. Create lead in database
2. Add to MailerLite "leads" group

```json
{
  "name": "Email Capture to MailerLite",
  "triggerAdapter": "revline",
  "triggerOperation": "email_captured",
  "actions": [
    {
      "adapter": "revline",
      "operation": "create_lead",
      "params": {}
    },
    {
      "adapter": "mailerlite",
      "operation": "add_to_group",
      "params": { "group": "leads" }
    }
  ]
}
```

### Example 2: Booking Flow

**Trigger:** `calendly.booking_created`  
**Actions:**
1. Update lead stage to BOOKED
2. Add to "booked_calls" group
3. Log custom event

```json
{
  "name": "Booking to Booked Stage",
  "triggerAdapter": "calendly",
  "triggerOperation": "booking_created",
  "actions": [
    {
      "adapter": "revline",
      "operation": "update_lead_stage",
      "params": { "stage": "BOOKED" }
    },
    {
      "adapter": "mailerlite",
      "operation": "add_to_group",
      "params": { "group": "booked_calls" }
    },
    {
      "adapter": "revline",
      "operation": "emit_event",
      "params": { "eventType": "booking_processed", "success": true }
    }
  ]
}
```

### Example 3: Product-Specific Payment

**Trigger:** `stripe.payment_succeeded`  
**Filter:** `{ "product": "fit1" }`  
**Actions:**
1. Update lead stage to PAID
2. Add to product-specific group

```json
{
  "name": "Fit1 Purchase",
  "triggerAdapter": "stripe",
  "triggerOperation": "payment_succeeded",
  "triggerFilter": { "product": "fit1" },
  "actions": [
    {
      "adapter": "revline",
      "operation": "update_lead_stage",
      "params": { "stage": "PAID" }
    },
    {
      "adapter": "mailerlite",
      "operation": "add_to_group",
      "params": { "group": "fit1_customers" }
    }
  ]
}
```

### Example 4: Cancellation Handling

**Trigger:** `calendly.booking_canceled`  
**Actions:**
1. Revert lead stage to CAPTURED
2. Remove from booked calls group

```json
{
  "name": "Handle Cancellation",
  "triggerAdapter": "calendly",
  "triggerOperation": "booking_canceled",
  "actions": [
    {
      "adapter": "revline",
      "operation": "update_lead_stage",
      "params": { "stage": "CAPTURED" }
    },
    {
      "adapter": "mailerlite",
      "operation": "remove_from_group",
      "params": { "group": "booked_calls" }
    }
  ]
}
```

---

## Database Schema

### Workflow Table

```sql
CREATE TABLE workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR NOT NULL,
  description     VARCHAR,
  enabled         BOOLEAN DEFAULT TRUE,
  trigger_adapter   VARCHAR NOT NULL,  -- 'calendly', 'stripe', etc.
  trigger_operation VARCHAR NOT NULL,  -- 'booking_created', 'payment_succeeded'
  trigger_filter    JSONB,             -- Optional filter conditions
  actions           JSONB NOT NULL,    -- Array of action definitions
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflows_client_enabled ON workflows(client_id, enabled);
CREATE INDEX idx_workflows_trigger ON workflows(client_id, trigger_adapter, trigger_operation);
```

### Workflow Execution Table

```sql
CREATE TABLE workflow_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trigger_adapter   VARCHAR NOT NULL,
  trigger_operation VARCHAR NOT NULL,
  trigger_payload   JSONB NOT NULL,
  status            VARCHAR DEFAULT 'RUNNING',  -- RUNNING, COMPLETED, FAILED
  action_results    JSONB,
  error             VARCHAR,
  started_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP
);

CREATE INDEX idx_executions_client ON workflow_executions(client_id, started_at);
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id, started_at);
CREATE INDEX idx_executions_status ON workflow_executions(status);
```

---

## Debugging Tips

### 1. Check Workflow Exists

```sql
SELECT * FROM workflows 
WHERE client_id = 'xxx' 
  AND enabled = true 
  AND trigger_adapter = 'stripe' 
  AND trigger_operation = 'payment_succeeded';
```

### 2. Check Recent Executions

```sql
SELECT * FROM workflow_executions 
WHERE client_id = 'xxx' 
ORDER BY started_at DESC 
LIMIT 10;
```

### 3. Check Event Log

```sql
SELECT * FROM events 
WHERE client_id = 'xxx' 
  AND system = 'WORKFLOW'
ORDER BY created_at DESC 
LIMIT 20;
```

### 4. Test a Trigger Manually

```typescript
import { emitTrigger } from '@/app/_lib/workflow';

const result = await emitTrigger(
  'client-uuid',
  { adapter: 'stripe', operation: 'payment_succeeded' },
  { email: 'test@example.com', amount: 100, product: 'test' }
);

console.log(result);
// {
//   workflowsFound: 2,
//   workflowsExecuted: 1,
//   executions: [{ workflowId: '...', status: 'completed', ... }]
// }
```

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System-wide architecture
- [Workflow Future Considerations](./plans/WORKFLOW-FUTURE-CONSIDERATIONS.md) - Planned features
- [Operations Guide](./OPERATIONS.md) - Day-to-day operations

