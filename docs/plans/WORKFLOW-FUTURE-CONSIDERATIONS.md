# Workflow Engine: Future Considerations

> **Related:** [WORKFLOW-ENGINE.md](./WORKFLOW-ENGINE.md)  
> **Status:** Documented for future reference  
> **Priority:** Post-v1 enhancements

This document captures architectural considerations that are **out of scope for v1** but should be kept in mind to ensure the workflow engine remains extensible.

---

## 1. Trigger Sources vs Trigger Types

### Current State (v1)

Triggers are emitted directly from webhook handlers:

```
Stripe Webhook → emitTrigger('stripe', 'payment_succeeded', payload)
```

### Future Consideration

Decouple the **source** (how a trigger arrives) from the **type** (what it means):

```
┌─────────────────────────┐     ┌──────────────────────────┐
│     TRIGGER SOURCES     │     │     TRIGGER TYPES        │
├─────────────────────────┤     ├──────────────────────────┤
│ Stripe webhook          │ ──► │ stripe.payment_succeeded │
│ Manual API call         │ ──► │ stripe.payment_succeeded │
│ CSV import              │ ──► │ stripe.payment_succeeded │
│ Replay from history     │ ──► │ stripe.payment_succeeded │
└─────────────────────────┘     └──────────────────────────┘
```

### Benefits

- **Trigger replay**: Re-run failed workflows from execution history
- **Testing**: Test workflows without real webhooks
- **Historical import**: Process past data through current workflows
- **Manual triggers**: Admin can manually trigger workflows for debugging

### Implementation Path

1. Add `source` field to WorkflowExecution: `{ source: 'webhook' | 'manual' | 'replay' | 'import' }`
2. Create admin endpoint: `POST /api/v1/workflows/[id]/trigger` for manual execution
3. Add replay button to execution history UI

---

## 2. Client Config vs Workflow Config

### Current State (v1)

Two-layer configuration:

```
Client Integration (MailerLite)
├── API Key (encrypted)
├── Groups: { "customers": { id: "123", name: "Customers" } }
└── (other config)

Workflow
├── Trigger: calendly.booking_created
└── Actions: [{ adapter: "mailerlite", operation: "add_to_group", params: { group: "customers" } }]
                                                                            ▲
                                                                            │
                                                          References group KEY, not ID
```

### Current Decision

Groups live in the **integration**, workflows reference by **key**. This is correct because:

- Changing the underlying MailerLite group ID doesn't break workflows
- Same group key can be used across multiple workflows
- Integration config is the "source of truth" for external service details

### Future Consideration: Workflow-Level Overrides

Some workflows might need group mappings that don't fit the general integration config:

```typescript
// Workflow-specific param resolution
actions: [{
  adapter: 'mailerlite',
  operation: 'add_to_group',
  params: { 
    group: 'customers',
    // Future: workflow-level override
    groupOverride: { id: '999', name: 'Special Customers' }
  }
}]
```

### Recommendation

Keep current approach for v1. Only add overrides if a concrete use case emerges.

---

## 3. Payload Normalization

### Current State (v1)

Each trigger produces its own payload shape:

| Trigger | Payload Shape |
|---------|---------------|
| `calendly.booking_created` | `{ email, name, eventType, scheduledAt }` |
| `stripe.payment_succeeded` | `{ email, name, amount, currency, product }` |
| `revline.email_captured` | `{ email, name, source }` |
| `manychat.dm_received` | `{ igUsername, email, keyword }` |

Actions must handle these variations via `WorkflowContext`.

### Future Consideration: Normalized Payload Layer

Add a normalization step at trigger emission:

```typescript
interface NormalizedPayload {
  // Always present
  email: string;
  
  // Common optional fields
  name?: string;
  amount?: number;
  product?: string;
  
  // Original payload preserved
  raw: Record<string, unknown>;
}

// Each adapter implements
interface TriggerNormalizer {
  normalize(rawPayload: unknown): NormalizedPayload;
}
```

### Benefits

- Actions don't need to know payload shapes
- Easier to add new triggers without updating actions
- Consistent field names across triggers

### Trade-offs

- Extra abstraction layer
- Some triggers have unique fields that don't normalize well
- May lose type safety

### Recommendation

Defer until adding 5+ integrations. Current approach is simpler and works.

---

## 4. Execution Modes

### Current State (v1)

Single execution mode: **immediate** (trigger fires, workflow runs synchronously).

### Future Consideration: Multiple Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Immediate** | Run when trigger fires | Normal webhook processing |
| **Scheduled** | Run at specific time | "Welcome email at 9am tomorrow" |
| **Batched** | Run for many leads at once | "Tag all leads in CAPTURED stage" |
| **Dry-run** | Simulate without side effects | Testing/debugging |
| **Queued** | Run async with retries | High-volume, reliability |

### Implementation Path

#### Scheduled Mode

```prisma
model ScheduledWorkflowRun {
  id          String   @id
  workflowId  String
  context     Json     // WorkflowContext to use
  runAt       DateTime
  status      ScheduleStatus // PENDING, RUNNING, COMPLETED, FAILED
}
```

Requires: Cron job or external scheduler to poll and execute.

#### Batched Mode

```typescript
// Admin endpoint
POST /api/v1/workflows/[id]/batch
{
  "filter": { "stage": "CAPTURED", "createdBefore": "2024-01-01" },
  "limit": 100
}
```

Requires: Lead query builder, rate limiting, progress tracking.

#### Dry-run Mode

```typescript
const result = await emitTrigger(clientId, trigger, payload, { dryRun: true });
// Returns what would happen without executing
```

Requires: Action executors return preview without API calls.

### Recommendation

Add **dry-run** first (most useful for debugging). Scheduled/batched can wait for concrete use cases.

---

## 5. Observability

### Current State (v1)

- `WorkflowExecution` table tracks each run
- Events emitted for workflow completion/failure
- Existing event log shows `workflow_completed`, `workflow_failed`

### Future Consideration: Enhanced Observability

#### Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflow Metrics (Last 24h)                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Executions:  1,234        Success Rate: 98.7%                       │
│ Avg Duration: 245ms       Errors: 16                                │
├─────────────────────────────────────────────────────────────────────┤
│ Top Workflows by Volume                                             │
│ ● Email Capture Flow      892 runs     99.1% success                │
│ ● Calendly Booking        234 runs     97.4% success                │
│ ● Stripe Purchase         108 runs     100% success                 │
├─────────────────────────────────────────────────────────────────────┤
│ Recent Failures                                                     │
│ ✗ Calendly Booking - "MailerLite rate limit" - 2 min ago           │
│ ✗ Email Capture - "Group not found" - 15 min ago                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Smart Alerts

```typescript
// Auto-disable workflow after repeated failures
if (recentFailures >= 5 && recentFailures / totalRecent > 0.5) {
  await disableWorkflow(workflowId);
  await sendAlert('Workflow auto-disabled due to failures');
}
```

#### Distributed Tracing

Link workflow executions to:
- The webhook request that triggered them
- All events emitted during execution
- External API calls made (MailerLite, etc.)

### Implementation Path

1. Add `metrics` endpoint aggregating `WorkflowExecution` data
2. Add failure alerting to health check cron
3. Add `traceId` to WorkflowContext, propagate to all events

---

## 6. Workflow Ownership and Templates

### Current State (v1)

All workflows are **client-scoped**:

```prisma
model Workflow {
  clientId String  // Every workflow belongs to one client
  // ...
}
```

### Future Consideration: Ownership Levels

#### Global Workflows

Workflows that run for all clients (e.g., internal monitoring):

```prisma
model Workflow {
  clientId String?  // null = global workflow
  scope    WorkflowScope @default(CLIENT)  // CLIENT | GLOBAL
}
```

#### Workflow Templates

Pre-built workflows to clone when onboarding clients:

```prisma
model WorkflowTemplate {
  id          String @id
  name        String
  description String
  trigger     Json
  actions     Json
}

// On client creation:
async function onboardClient(clientId: string) {
  const templates = await prisma.workflowTemplate.findMany();
  for (const template of templates) {
    await prisma.workflow.create({
      data: {
        clientId,
        name: template.name,
        triggerAdapter: template.trigger.adapter,
        triggerOperation: template.trigger.operation,
        actions: template.actions,
        enabled: false,  // Requires config before enabling
      }
    });
  }
}
```

#### Workflow Versioning

Track changes to workflows over time:

```prisma
model WorkflowVersion {
  id          String @id
  workflowId  String
  version     Int
  trigger     Json
  actions     Json
  createdAt   DateTime
  createdBy   String?  // Admin who made the change
}

// On workflow update, create new version
// Execution history links to version, not just workflow
```

### Benefits

- **Templates**: Faster client onboarding, consistency
- **Versioning**: Audit trail, rollback capability
- **Global**: Platform-wide automations without duplication

### Recommendation

Add **templates** when you have 5+ clients with similar setups. Versioning when compliance/audit becomes important.

---

## Summary: When to Implement

| Consideration | Priority | Trigger |
|---------------|----------|---------|
| Trigger replay/manual | Medium | First debugging session where you wish you could replay |
| Payload normalization | Low | When adding 5th integration |
| Execution modes (dry-run) | Medium | When first complex workflow needs testing |
| Execution modes (scheduled) | Low | When first "delayed action" use case appears |
| Enhanced metrics | Medium | When you need to report on automation health |
| Templates | Medium | When onboarding 5th similar client |
| Versioning | Low | When compliance/audit requirements emerge |

These are documented so future development doesn't accidentally break extensibility.


