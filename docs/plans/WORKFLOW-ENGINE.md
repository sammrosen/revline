# Workflow Engine Feature Requirements

> **Status:** Planning  
> **Priority:** P0 - Core Infrastructure  
> **Target:** Q1 2026

## Overview

Build a decoupled workflow engine that separates **adapters** (integrations), **operations** (what they can do), and **workflows** (how they connect). This enables flexible, extensible automation configuration without hardcoded logic.

### Goals

1. **Decouple integrations from business logic** - No MailerLite-specific code outside the adapter
2. **Make workflows data, not code** - Configure automations in the database, not in route handlers
3. **Enable extensibility** - Adding new integrations = adding adapter + declaring operations
4. **Maintain domain context** - Every workflow runs with client/lead awareness

### Non-Goals (v1)

- Visual node-graph editor (simple form-based UI is sufficient)
- Conditional branching within workflows (linear action sequences only)
- Parallel action execution (sequential is simpler to reason about)
- End-user workflow building (admin-only configuration)

---

## Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CONCEPTS                                  │
├──────────────┬──────────────────────────────────────────────────────┤
│ Adapter      │ An integration (Calendly, MailerLite, Stripe, etc.)  │
│ Operation    │ Something an adapter can trigger or execute          │
│ Trigger      │ An event emitted by an adapter (e.g., booking_created)│
│ Action       │ An operation executed by an adapter (e.g., add_to_group)│
│ Workflow     │ A trigger + sequence of actions configured per client │
│ Context      │ Runtime data passed through workflow execution        │
└──────────────┴──────────────────────────────────────────────────────┘
```

### Data Flow

```
Webhook Request
      │
      ▼
┌─────────────────┐
│ Webhook Handler │  Verify signature, extract payload
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trigger Emitter │  Emit: { adapter: 'calendly', operation: 'booking_created', payload }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Workflow Engine │  Find matching workflows, build context
└────────┬────────┘
         │
         ▼ (for each workflow)
┌─────────────────┐
│ Action Executor │  Execute actions sequentially, stop on error
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Event Logger    │  Log execution results
└─────────────────┘
```

---

## Data Model

### Operation Registry (Code)

Each adapter declares its capabilities in code:

```typescript
// app/_lib/workflow/registry.ts

import { z } from 'zod';

export interface OperationDefinition {
  name: string;
  label: string;
  description?: string;
  payloadSchema: z.ZodSchema;    // Data shape for triggers / required by actions
  paramsSchema?: z.ZodSchema;    // Configuration params (e.g., which group)
}

export interface AdapterDefinition {
  id: string;                                      // 'mailerlite'
  name: string;                                    // 'MailerLite'
  triggers: Record<string, OperationDefinition>;   // Events it emits
  actions: Record<string, OperationDefinition>;    // Operations it executes
  requiresIntegration: boolean;                    // Does client need this integration configured?
}
```

### Adapter Definitions

#### Calendly

```typescript
export const CALENDLY_ADAPTER: AdapterDefinition = {
  id: 'calendly',
  name: 'Calendly',
  requiresIntegration: true,
  triggers: {
    booking_created: {
      name: 'booking_created',
      label: 'Booking Created',
      description: 'Fires when someone books a call',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        eventType: z.string().optional(),
        eventUri: z.string().optional(),
        scheduledAt: z.string().optional(),
      }),
    },
    booking_canceled: {
      name: 'booking_canceled',
      label: 'Booking Canceled',
      description: 'Fires when a booking is canceled',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        reason: z.string().optional(),
      }),
    },
  },
  actions: {},
};
```

#### Stripe

```typescript
export const STRIPE_ADAPTER: AdapterDefinition = {
  id: 'stripe',
  name: 'Stripe',
  requiresIntegration: true,
  triggers: {
    payment_succeeded: {
      name: 'payment_succeeded',
      label: 'Payment Succeeded',
      description: 'Fires when a one-time payment completes',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        amount: z.number(),
        currency: z.string(),
        product: z.string().optional(),
        priceId: z.string().optional(),
      }),
    },
    subscription_created: {
      name: 'subscription_created',
      label: 'Subscription Created',
      description: 'Fires when a new subscription starts',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        amount: z.number(),
        currency: z.string(),
        product: z.string().optional(),
        interval: z.enum(['month', 'year']),
      }),
    },
    subscription_canceled: {
      name: 'subscription_canceled',
      label: 'Subscription Canceled',
      description: 'Fires when a subscription is canceled',
      payloadSchema: z.object({
        email: z.string().email(),
        product: z.string().optional(),
        canceledAt: z.string(),
      }),
    },
  },
  actions: {},
};
```

#### MailerLite

```typescript
export const MAILERLITE_ADAPTER: AdapterDefinition = {
  id: 'mailerlite',
  name: 'MailerLite',
  requiresIntegration: true,
  triggers: {},
  actions: {
    add_to_group: {
      name: 'add_to_group',
      label: 'Add to Group',
      description: 'Add subscriber to a MailerLite group',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
      paramsSchema: z.object({
        group: z.string(), // References key in client's MailerLite groups config
      }),
    },
    remove_from_group: {
      name: 'remove_from_group',
      label: 'Remove from Group',
      description: 'Remove subscriber from a MailerLite group',
      payloadSchema: z.object({
        email: z.string().email(),
      }),
      paramsSchema: z.object({
        group: z.string(),
      }),
    },
    add_tag: {
      name: 'add_tag',
      label: 'Add Tag',
      description: 'Add a tag to a subscriber',
      payloadSchema: z.object({
        email: z.string().email(),
      }),
      paramsSchema: z.object({
        tag: z.string(),
      }),
    },
  },
};
```

#### RevLine (Internal)

```typescript
export const REVLINE_ADAPTER: AdapterDefinition = {
  id: 'revline',
  name: 'RevLine',
  requiresIntegration: false, // Always available
  triggers: {
    email_captured: {
      name: 'email_captured',
      label: 'Email Captured',
      description: 'Fires when a lead submits email on a landing page',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        source: z.string(),
      }),
    },
  },
  actions: {
    create_lead: {
      name: 'create_lead',
      label: 'Create/Update Lead',
      description: 'Create or update a lead record',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
      paramsSchema: z.object({
        source: z.string().optional(),
      }),
    },
    update_lead_stage: {
      name: 'update_lead_stage',
      label: 'Update Lead Stage',
      description: 'Update the stage of a lead',
      payloadSchema: z.object({
        email: z.string().email(),
      }),
      paramsSchema: z.object({
        stage: z.enum(['CAPTURED', 'BOOKED', 'PAID', 'DEAD']),
      }),
    },
    emit_event: {
      name: 'emit_event',
      label: 'Log Custom Event',
      description: 'Emit a custom event to the event log',
      payloadSchema: z.object({}),
      paramsSchema: z.object({
        eventType: z.string(),
        success: z.boolean().default(true),
      }),
    },
  },
};
```

#### Future: ManyChat

```typescript
export const MANYCHAT_ADAPTER: AdapterDefinition = {
  id: 'manychat',
  name: 'ManyChat',
  requiresIntegration: true,
  triggers: {
    dm_received: {
      name: 'dm_received',
      label: 'DM Received',
      description: 'Fires when a DM is received matching a keyword',
      payloadSchema: z.object({
        igUsername: z.string(),
        email: z.string().email().optional(),
        keyword: z.string(),
      }),
    },
  },
  actions: {
    trigger_flow: {
      name: 'trigger_flow',
      label: 'Trigger Flow',
      description: 'Trigger a ManyChat flow for a subscriber',
      payloadSchema: z.object({
        igUsername: z.string().optional(),
        email: z.string().email().optional(),
      }),
      paramsSchema: z.object({
        flowId: z.string(),
      }),
    },
    add_tag: {
      name: 'add_tag',
      label: 'Add Tag',
      description: 'Add a tag to a ManyChat subscriber',
      payloadSchema: z.object({
        igUsername: z.string().optional(),
        email: z.string().email().optional(),
      }),
      paramsSchema: z.object({
        tag: z.string(),
      }),
    },
  },
};
```

### Database Schema

```prisma
// prisma/schema.prisma

model Workflow {
  id        String   @id @default(uuid())
  clientId  String   @map("client_id")
  name      String
  enabled   Boolean  @default(true)
  
  // Trigger configuration
  triggerAdapter    String  @map("trigger_adapter")    // 'calendly', 'stripe', etc.
  triggerOperation  String  @map("trigger_operation")  // 'booking_created', etc.
  triggerFilter     Json?   @map("trigger_filter")     // Optional: { "payload.product": "fit1" }
  
  // Actions to execute (ordered array)
  actions   Json     // WorkflowAction[]
  
  // Metadata
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
  
  @@index([clientId, enabled])
  @@index([clientId, triggerAdapter, triggerOperation])
  @@map("workflows")
}

model WorkflowExecution {
  id          String   @id @default(uuid())
  workflowId  String   @map("workflow_id")
  clientId    String   @map("client_id")
  
  // Trigger info
  triggerAdapter   String @map("trigger_adapter")
  triggerOperation String @map("trigger_operation")
  triggerPayload   Json   @map("trigger_payload")
  
  // Execution result
  status       WorkflowExecutionStatus @default(RUNNING)
  actionResults Json?   @map("action_results")  // Array of action execution results
  error        String?
  
  // Timing
  startedAt   DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")
  
  client   Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  
  @@index([clientId, startedAt])
  @@index([workflowId, startedAt])
  @@index([status])
  @@map("workflow_executions")
}

enum WorkflowExecutionStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

### TypeScript Types

```typescript
// app/_lib/workflow/types.ts

export interface WorkflowAction {
  adapter: string;                      // 'mailerlite', 'revline', etc.
  operation: string;                    // 'add_to_group', 'update_lead_stage'
  params: Record<string, unknown>;      // { group: 'customers' }
  conditions?: Record<string, unknown>; // Reserved for future: { 'ctx.amount': { $gt: 500 } }
}

export interface WorkflowContext {
  // Trigger info
  trigger: {
    adapter: string;
    operation: string;
    payload: Record<string, unknown>;
  };
  
  // Normalized fields (always available)
  email: string;
  name?: string;
  
  // RevLine context
  clientId: string;
  leadId?: string;
  
  // Accumulated data from previous actions
  actionData: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowName: string;
  status: 'completed' | 'failed';
  actionsExecuted: number;
  actionsTotal: number;
  results: Array<{
    action: WorkflowAction;
    result: ActionResult;
  }>;
  error?: string;
}
```

---

## Core Implementation

### 1. Registry Module

```typescript
// app/_lib/workflow/registry.ts

import { CALENDLY_ADAPTER, STRIPE_ADAPTER, MAILERLITE_ADAPTER, REVLINE_ADAPTER } from './adapters';

export const ADAPTER_REGISTRY: Record<string, AdapterDefinition> = {
  calendly: CALENDLY_ADAPTER,
  stripe: STRIPE_ADAPTER,
  mailerlite: MAILERLITE_ADAPTER,
  revline: REVLINE_ADAPTER,
};

export function getAdapter(id: string): AdapterDefinition | null {
  return ADAPTER_REGISTRY[id] ?? null;
}

export function getTrigger(adapterId: string, operationId: string): OperationDefinition | null {
  const adapter = getAdapter(adapterId);
  return adapter?.triggers[operationId] ?? null;
}

export function getAction(adapterId: string, operationId: string): OperationDefinition | null {
  const adapter = getAdapter(adapterId);
  return adapter?.actions[operationId] ?? null;
}

export function getAllTriggers(): Array<{ adapter: string; operation: OperationDefinition }> {
  return Object.entries(ADAPTER_REGISTRY).flatMap(([adapterId, adapter]) =>
    Object.values(adapter.triggers).map(op => ({ adapter: adapterId, operation: op }))
  );
}

export function getAllActions(): Array<{ adapter: string; operation: OperationDefinition }> {
  return Object.entries(ADAPTER_REGISTRY).flatMap(([adapterId, adapter]) =>
    Object.values(adapter.actions).map(op => ({ adapter: adapterId, operation: op }))
  );
}
```

### 2. Workflow Engine

```typescript
// app/_lib/workflow/engine.ts

import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem, upsertLead } from '@/app/_lib/event-logger';
import { WorkflowContext, WorkflowAction, WorkflowExecutionResult, ActionResult } from './types';
import { getActionExecutor } from './executors';

/**
 * Emit a trigger and execute all matching workflows
 */
export async function emitTrigger(
  clientId: string,
  trigger: { adapter: string; operation: string },
  payload: Record<string, unknown>
): Promise<WorkflowExecutionResult[]> {
  // 1. Find all enabled workflows matching this trigger
  const workflows = await prisma.workflow.findMany({
    where: {
      clientId,
      enabled: true,
      triggerAdapter: trigger.adapter,
      triggerOperation: trigger.operation,
    },
  });

  if (workflows.length === 0) {
    return [];
  }

  // 2. Build base context
  const baseContext: Omit<WorkflowContext, 'leadId'> = {
    trigger: { ...trigger, payload },
    email: extractEmail(payload),
    name: extractName(payload),
    clientId,
    actionData: {},
  };

  // 3. Execute each workflow
  const results: WorkflowExecutionResult[] = [];
  
  for (const workflow of workflows) {
    // Check trigger filter
    if (!matchesFilter(workflow.triggerFilter, payload)) {
      continue;
    }

    const result = await executeWorkflow(workflow, baseContext);
    results.push(result);
  }

  return results;
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  workflow: { id: string; name: string; actions: unknown },
  baseContext: Omit<WorkflowContext, 'leadId'>
): Promise<WorkflowExecutionResult> {
  const actions = workflow.actions as WorkflowAction[];
  const results: Array<{ action: WorkflowAction; result: ActionResult }> = [];
  
  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      clientId: baseContext.clientId,
      triggerAdapter: baseContext.trigger.adapter,
      triggerOperation: baseContext.trigger.operation,
      triggerPayload: baseContext.trigger.payload,
      status: 'RUNNING',
    },
  });

  // Build full context (may include leadId after create_lead action)
  const ctx: WorkflowContext = { ...baseContext, leadId: undefined };

  let failed = false;
  let errorMessage: string | undefined;

  for (const action of actions) {
    // Future: Check action conditions here
    // if (action.conditions && !evaluateConditions(action.conditions, ctx)) continue;

    try {
      const executor = getActionExecutor(action.adapter, action.operation);
      const result = await executor.execute(ctx, action.params);
      
      results.push({ action, result });

      if (result.success) {
        // Merge action output into context for subsequent actions
        if (result.data) {
          ctx.actionData = { ...ctx.actionData, ...result.data };
          // Special case: if action created/found a lead, update context
          if (result.data.leadId) {
            ctx.leadId = result.data.leadId as string;
          }
        }
      } else {
        // Stop on error
        failed = true;
        errorMessage = `${action.adapter}.${action.operation}: ${result.error}`;
        
        await emitEvent({
          clientId: ctx.clientId,
          leadId: ctx.leadId,
          system: EventSystem.BACKEND,
          eventType: 'workflow_action_failed',
          success: false,
          errorMessage,
        });
        
        break;
      }
    } catch (error) {
      failed = true;
      errorMessage = `${action.adapter}.${action.operation}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.push({ action, result: { success: false, error: errorMessage } });
      break;
    }
  }

  // Update execution record
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: failed ? 'FAILED' : 'COMPLETED',
      actionResults: results,
      error: errorMessage,
      completedAt: new Date(),
    },
  });

  // Emit workflow completion event
  await emitEvent({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    system: EventSystem.BACKEND,
    eventType: failed ? 'workflow_failed' : 'workflow_completed',
    success: !failed,
    errorMessage: failed ? `Workflow '${workflow.name}' failed: ${errorMessage}` : undefined,
  });

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: failed ? 'failed' : 'completed',
    actionsExecuted: results.length,
    actionsTotal: actions.length,
    results,
    error: errorMessage,
  };
}

/**
 * Check if payload matches filter conditions
 */
function matchesFilter(
  filter: Record<string, unknown> | null,
  payload: Record<string, unknown>
): boolean {
  if (!filter) return true;

  for (const [path, expected] of Object.entries(filter)) {
    const actual = getValueByPath(payload, path);
    if (actual !== expected) return false;
  }
  return true;
}

/**
 * Get nested value by dot-notation path
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

/**
 * Extract email from various payload shapes
 */
function extractEmail(payload: Record<string, unknown>): string {
  return (payload.email as string) || '';
}

/**
 * Extract name from various payload shapes
 */
function extractName(payload: Record<string, unknown>): string | undefined {
  return (payload.name as string) || undefined;
}
```

### 3. Action Executors

```typescript
// app/_lib/workflow/executors/index.ts

import { WorkflowContext, ActionResult } from '../types';
import { mailerliteExecutors } from './mailerlite';
import { revlineExecutors } from './revline';

export interface ActionExecutor {
  execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult>;
}

const EXECUTORS: Record<string, Record<string, ActionExecutor>> = {
  mailerlite: mailerliteExecutors,
  revline: revlineExecutors,
};

export function getActionExecutor(adapter: string, operation: string): ActionExecutor {
  const adapterExecutors = EXECUTORS[adapter];
  if (!adapterExecutors) {
    throw new Error(`No executors registered for adapter: ${adapter}`);
  }
  
  const executor = adapterExecutors[operation];
  if (!executor) {
    throw new Error(`No executor for operation: ${adapter}.${operation}`);
  }
  
  return executor;
}
```

```typescript
// app/_lib/workflow/executors/mailerlite.ts

import { MailerLiteAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult } from '../types';
import { ActionExecutor } from './index';

export const mailerliteExecutors: Record<string, ActionExecutor> = {
  add_to_group: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      const groupKey = params.group as string;
      
      const adapter = await MailerLiteAdapter.forClient(ctx.clientId);
      if (!adapter) {
        return { success: false, error: 'MailerLite not configured' };
      }

      const group = adapter.getGroup(groupKey);
      if (!group) {
        return { success: false, error: `Group '${groupKey}' not found in config` };
      }

      const result = await adapter.addToGroup(ctx.email, group.id, ctx.name);
      
      await emitEvent({
        clientId: ctx.clientId,
        leadId: ctx.leadId,
        system: EventSystem.MAILERLITE,
        eventType: result.success ? 'mailerlite_subscribe_success' : 'mailerlite_subscribe_failed',
        success: result.success,
        errorMessage: result.error,
      });

      return result.success 
        ? { success: true, data: { subscriberId: result.data?.subscriberId } }
        : { success: false, error: result.error };
    },
  },

  remove_from_group: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      // Similar implementation
      return { success: true };
    },
  },

  add_tag: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      // Implementation
      return { success: true };
    },
  },
};
```

```typescript
// app/_lib/workflow/executors/revline.ts

import { upsertLead, updateLeadStage, emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult } from '../types';
import { ActionExecutor } from './index';
import { LeadStage } from '@prisma/client';

export const revlineExecutors: Record<string, ActionExecutor> = {
  create_lead: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      try {
        const leadId = await upsertLead({
          clientId: ctx.clientId,
          email: ctx.email,
          source: (params.source as string) || ctx.trigger.adapter,
        });
        
        return { success: true, data: { leadId } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create lead' };
      }
    },
  },

  update_lead_stage: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      const stage = params.stage as LeadStage;
      
      // Need a lead to update
      if (!ctx.leadId) {
        // Try to find/create lead first
        const leadId = await upsertLead({
          clientId: ctx.clientId,
          email: ctx.email,
          source: ctx.trigger.adapter,
        });
        ctx.leadId = leadId;
      }

      try {
        await updateLeadStage(ctx.leadId, stage);
        return { success: true, data: { stage } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update stage' };
      }
    },
  },

  emit_event: {
    async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
      const eventType = params.eventType as string;
      const success = (params.success as boolean) ?? true;

      await emitEvent({
        clientId: ctx.clientId,
        leadId: ctx.leadId,
        system: EventSystem.BACKEND,
        eventType,
        success,
      });

      return { success: true };
    },
  },
};
```

### 4. Updated Webhook Handlers

```typescript
// app/api/calendly-webhook/route.ts (updated)

import { emitTrigger } from '@/app/_lib/workflow/engine';

export async function POST(request: NextRequest) {
  // ... signature verification (unchanged) ...

  const payload = JSON.parse(body);
  const utmSource = payload.payload?.tracking?.utm_source;
  
  // ... client lookup and validation (unchanged) ...

  // Emit trigger instead of hardcoded logic
  const email = payload.payload?.email;
  const name = payload.payload?.name;
  const eventType = payload.event;

  if (eventType === 'invitee.created') {
    await emitTrigger(client.id, {
      adapter: 'calendly',
      operation: 'booking_created',
    }, {
      email,
      name,
      eventType: payload.payload?.event_type?.name,
      eventUri: payload.payload?.event,
      scheduledAt: payload.payload?.scheduled_event?.start_time,
    });
  } else if (eventType === 'invitee.canceled') {
    await emitTrigger(client.id, {
      adapter: 'calendly',
      operation: 'booking_canceled',
    }, {
      email,
      name,
      reason: payload.payload?.cancellation?.reason,
    });
  }

  return NextResponse.json({ received: true });
}
```

```typescript
// app/api/stripe-webhook/route.ts (updated)

import { emitTrigger } from '@/app/_lib/workflow/engine';

export async function POST(request: NextRequest) {
  // ... signature verification (unchanged) ...

  // After extracting checkout data:
  await emitTrigger(client.id, {
    adapter: 'stripe',
    operation: 'payment_succeeded',
  }, {
    email: checkoutData.email,
    name: checkoutData.name,
    amount: checkoutData.amountTotal,
    currency: checkoutData.currency,
    product: checkoutData.program, // From product metadata
    priceId: checkoutData.priceId,
  });

  return ApiResponse.webhookAck({ processed: true });
}
```

```typescript
// app/api/subscribe/route.ts (updated)

import { emitTrigger } from '@/app/_lib/workflow/engine';

export async function POST(request: NextRequest) {
  // ... validation (unchanged) ...

  await emitTrigger(client.id, {
    adapter: 'revline',
    operation: 'email_captured',
  }, {
    email,
    name,
    source: source || 'landing',
  });

  return ApiResponse.success({ message: 'Subscribed successfully' });
}
```

---

## Admin UI

### Workflow List View

Display all workflows for a client:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflows                                            [+ New Workflow]│
├─────────────────────────────────────────────────────────────────────┤
│ ● Calendly Booking Flow                                    [Edit] ⋮ │
│   calendly.booking_created → 2 actions                     Enabled  │
├─────────────────────────────────────────────────────────────────────┤
│ ● FIT1 Purchase                                            [Edit] ⋮ │
│   stripe.payment_succeeded (product=fit1) → 3 actions      Enabled  │
├─────────────────────────────────────────────────────────────────────┤
│ ○ Email Capture                                            [Edit] ⋮ │
│   revline.email_captured → 2 actions                      Disabled  │
└─────────────────────────────────────────────────────────────────────┘
```

### Workflow Editor

```
┌─────────────────────────────────────────────────────────────────────┐
│ Edit Workflow: Calendly Booking Flow                                │
├─────────────────────────────────────────────────────────────────────┤
│ Name: [Calendly Booking Flow                            ]           │
│                                                                     │
│ TRIGGER                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ When: [Calendly ▼] [Booking Created ▼]                          │ │
│ │ Filter: (optional)                                              │ │
│ │   [payload.eventType ▼] [equals ▼] [discovery         ]  [+ Add]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ACTIONS (execute in order)                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 1. [RevLine ▼] [Create Lead ▼]                           [✕][↕] │ │
│ │    source: [calendly        ]                                   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 2. [RevLine ▼] [Update Lead Stage ▼]                     [✕][↕] │ │
│ │    stage: [BOOKED ▼]                                            │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 3. [MailerLite ▼] [Add to Group ▼]                       [✕][↕] │ │
│ │    group: [booked_calls ▼] (Booked Calls - 1,234 subscribers)   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                             [+ Add Action]          │
│                                                                     │
│ ☑ Enabled                                                           │
│                                                                     │
│                                    [Cancel] [Save Workflow]         │
└─────────────────────────────────────────────────────────────────────┘
```

### Workflow Execution History

```
┌─────────────────────────────────────────────────────────────────────┐
│ Execution History: Calendly Booking Flow                            │
├─────────────────────────────────────────────────────────────────────┤
│ Time              Status     Actions    Trigger Email               │
├─────────────────────────────────────────────────────────────────────┤
│ Jan 5, 10:23 AM   ✓ Success  3/3       john@example.com     [View] │
│ Jan 5, 09:15 AM   ✗ Failed   2/3       jane@example.com     [View] │
│ Jan 4, 04:32 PM   ✓ Success  3/3       bob@example.com      [View] │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Admin Endpoints

```
GET  /api/admin/workflows                    # List workflows for client
POST /api/admin/workflows                    # Create workflow
GET  /api/admin/workflows/[id]               # Get workflow details
PUT  /api/admin/workflows/[id]               # Update workflow
DELETE /api/admin/workflows/[id]             # Delete workflow
PATCH /api/admin/workflows/[id]/toggle       # Enable/disable workflow

GET  /api/admin/workflows/[id]/executions    # Execution history
GET  /api/admin/workflows/executions/[id]    # Single execution details

GET  /api/admin/workflow-registry            # Get available triggers/actions
```

### Registry Endpoint Response

```json
{
  "adapters": [
    {
      "id": "calendly",
      "name": "Calendly",
      "requiresIntegration": true,
      "triggers": [
        {
          "name": "booking_created",
          "label": "Booking Created",
          "description": "Fires when someone books a call"
        }
      ],
      "actions": []
    },
    {
      "id": "mailerlite",
      "name": "MailerLite",
      "requiresIntegration": true,
      "triggers": [],
      "actions": [
        {
          "name": "add_to_group",
          "label": "Add to Group",
          "params": [
            { "name": "group", "type": "group_select", "label": "Group" }
          ]
        }
      ]
    }
  ]
}
```

---

## Migration Plan

### Phase 1: Infrastructure

1. Add Prisma schema for `Workflow` and `WorkflowExecution`
2. Create migration
3. Implement registry module
4. Implement workflow engine
5. Implement action executors

### Phase 2: Migrate Existing Logic

Current hardcoded flows to convert:

| Current Code | New Workflow |
|--------------|--------------|
| `/api/subscribe` → CaptureService | `revline.email_captured` → `revline.create_lead` + `mailerlite.add_to_group` |
| `/api/calendly-webhook` invitee.created | `calendly.booking_created` → `revline.update_lead_stage(BOOKED)` |
| `/api/stripe-webhook` checkout.completed | `stripe.payment_succeeded` → `revline.update_lead_stage(PAID)` + `mailerlite.add_to_group` |

### Phase 3: Admin UI

1. Workflow list component
2. Workflow editor component
3. Execution history viewer
4. Registry-driven form generation

### Phase 4: Cleanup

1. Remove old action dispatcher
2. Remove old handler files
3. Remove deprecated routing config from MailerLite meta

---

## Validation & Safety

### Pre-save Validation

Before saving a workflow:

1. **Trigger exists**: Verify adapter + operation in registry
2. **Actions exist**: Verify all action adapter + operations
3. **Integration configured**: If adapter requires integration, verify client has it
4. **Params valid**: Validate action params against schema
5. **References valid**: Verify group/tag references exist in client config

### Runtime Safety

1. **Circuit breaker**: If a workflow fails 5 times in 1 hour, auto-disable
2. **Timeout**: 30s max per action, 2min max per workflow
3. **No loops**: Prevent workflows that trigger themselves

---

## Future Extensions (Out of Scope for v1)

### Conditions

```typescript
actions: [{
  adapter: 'mailerlite',
  operation: 'add_to_group',
  params: { group: 'vip' },
  conditions: {
    'trigger.payload.amount': { $gte: 500 }
  }
}]
```

### Branching

```typescript
{
  type: 'branch',
  condition: { 'trigger.payload.product': 'premium' },
  ifTrue: [{ adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'premium' } }],
  ifFalse: [{ adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'standard' } }],
}
```

### Delays

```typescript
actions: [
  { adapter: 'revline', operation: 'create_lead', params: {} },
  { type: 'delay', duration: '1h' },  // Wait 1 hour
  { adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'followup' } },
]
```

### Parallel Execution

```typescript
actions: [
  { adapter: 'revline', operation: 'create_lead', params: {} },
  {
    type: 'parallel',
    actions: [
      { adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'customers' } },
      { adapter: 'slack', operation: 'send_message', params: { channel: '#sales' } },
    ],
  },
]
```

---

## Success Criteria

1. **All existing flows migrated** to workflow-based execution
2. **No integration-specific code** outside adapters
3. **New integrations addable** by only adding adapter definition + executors
4. **Workflow CRUD** working in admin UI
5. **Execution history** viewable and debuggable
6. **<100ms overhead** added by workflow engine per execution

---

## References

- Current action dispatcher: `app/_lib/actions/dispatcher.ts`
- Current MailerLite handler: `app/_lib/actions/handlers/mailerlite.ts`
- Current webhook handlers: `app/api/*/route.ts`
- Integration adapters: `app/_lib/integrations/`


