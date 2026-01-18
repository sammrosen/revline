# Workflow Validation & Dependency System Plan

> **Status:** Planning  
> **Created:** January 2026  
> **Priority:** High - prevents broken automations in production

---

## Problem Statement

Currently, the workflow system allows dangerous operations:

1. **Enabling workflows without required integrations** - Can enable a workflow that uses `mailerlite.add_to_group` when MailerLite isn't configured → silent failures at runtime
2. **Editing active workflows** - Can modify trigger/actions while workflow is live → inconsistent behavior, hard to debug
3. **No dependency awareness** - No visibility into how workflows connect, what depends on what
4. **Blind deletions** - Can delete integrations that workflows depend on

---

## Solution Overview

### 1. Validation Layer

A validation service that checks:
- **Pre-enable validation:** Before turning on a workflow
- **Pre-edit validation:** Before opening editor for active workflow
- **Pre-save validation:** Before persisting workflow changes
- **Pre-delete validation:** Before removing integrations

### 2. Dependency Graph

A data structure that tracks:
- Which workflows use which integrations
- Which MailerLite groups are used by which workflows
- Potential future: workflow chaining (output of one → input of another)

### 3. UI Changes

- **Workflow list:** Validation badges, locked indicators
- **Workflow editor:** Integration warnings, lock-to-edit flow
- **New view toggle:** Dependency tree visualization
- **Integration tab:** "Used by X workflows" indicators

---

## Detailed Design

### Part 1: Validation Service (`app/_lib/workflow/validation.ts`)

```typescript
/**
 * Workflow Validation Service
 * 
 * Validates workflow configurations against client state.
 * Used by both API routes and UI components.
 */

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  integration?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate workflow can be enabled
 * Checks all required integrations are configured and healthy
 */
export async function validateCanEnable(
  workflowId: string
): Promise<ValidationResult>;

/**
 * Validate workflow can be edited
 * Must be disabled first if active
 */
export function validateCanEdit(
  workflow: { enabled: boolean }
): ValidationResult;

/**
 * Validate workflow configuration before save
 * Checks integrations exist and have required config
 */
export async function validateWorkflowConfig(
  clientId: string,
  config: WorkflowConfig
): Promise<ValidationResult>;

/**
 * Validate integration can be deleted
 * Checks no workflows depend on it
 */
export async function validateCanDeleteIntegration(
  clientId: string,
  integrationType: IntegrationType
): Promise<ValidationResult>;
```

#### Validation Rules

| Rule | Error Code | When |
|------|------------|------|
| Integration not configured | `INTEGRATION_NOT_CONFIGURED` | Workflow uses adapter but client lacks integration |
| Integration unhealthy | `INTEGRATION_UNHEALTHY` | Integration health is RED |
| MailerLite group missing | `MAILERLITE_GROUP_NOT_FOUND` | Action references group key not in meta |
| Workflow is active | `WORKFLOW_ACTIVE` | Attempting to edit enabled workflow |
| Workflow has dependents | `HAS_DEPENDENTS` | Attempting delete with dependent workflows |
| Circular dependency | `CIRCULAR_DEPENDENCY` | Future: workflow chains create loop |

### Part 2: API Changes

#### `PATCH /api/v1/workflows/[id]/toggle`

**Before enabling, validate:**

```typescript
// Current (no validation)
const workflow = await prisma.workflow.update({
  where: { id },
  data: { enabled: !existing.enabled },
});

// New (with validation)
if (!existing.enabled) {
  // Enabling - run validation
  const validation = await validateCanEnable(id);
  if (!validation.valid) {
    return ApiResponse.error(
      validation.errors[0].message,
      400,
      ErrorCodes.VALIDATION_FAILED,
      { errors: validation.errors }
    );
  }
}
```

#### `PUT /api/v1/workflows/[id]`

**Before updating, check if active:**

```typescript
const existing = await prisma.workflow.findUnique({ where: { id } });

if (existing.enabled) {
  return ApiResponse.error(
    'Cannot edit active workflow. Disable it first.',
    400,
    ErrorCodes.WORKFLOW_ACTIVE
  );
}

// Also validate new configuration
const validation = await validateWorkflowConfig(existing.clientId, data);
if (!validation.valid) {
  return ApiResponse.error(...);
}
```

#### `DELETE /api/v1/integrations/[id]`

**Before deleting, check dependents:**

```typescript
const validation = await validateCanDeleteIntegration(clientId, integrationType);
if (!validation.valid) {
  return ApiResponse.error(
    `Cannot delete: ${validation.errors[0].message}`,
    400,
    ErrorCodes.HAS_DEPENDENTS,
    { 
      dependentWorkflows: getDependentWorkflows(clientId, integrationType) 
    }
  );
}
```

#### New Endpoint: `GET /api/workspaces/[id]/dependency-graph`

Returns the full dependency graph for a client:

```typescript
interface DependencyGraph {
  integrations: {
    [type: string]: {
      configured: boolean;
      healthy: boolean;
      usedBy: Array<{
        workflowId: string;
        workflowName: string;
        operations: string[]; // e.g., ['add_to_group']
      }>;
    };
  };
  workflows: {
    [id: string]: {
      name: string;
      enabled: boolean;
      trigger: {
        adapter: string;
        operation: string;
      };
      dependencies: {
        integrations: string[];
        mailerliteGroups: string[];
      };
    };
  };
  // Future: workflow chains
  chains: Array<{
    from: string;
    to: string;
    via: string; // event type
  }>;
}
```

### Part 3: UI Changes

#### A. Workflow List - Validation Indicators

Add validation status to each workflow card:

```tsx
// workflow-card.tsx additions

interface WorkflowCardProps {
  // ... existing
  validationStatus?: {
    canEnable: boolean;
    errors: string[];
  };
}

// Visual indicator
{!validationStatus?.canEnable && (
  <Tooltip content={validationStatus.errors.join('\n')}>
    <AlertTriangle className="w-4 h-4 text-yellow-500" />
  </Tooltip>
)}

// Disable toggle with tooltip
<button
  onClick={onToggle}
  disabled={isToggling || (!enabled && !validationStatus?.canEnable)}
  title={!validationStatus?.canEnable ? validationStatus?.errors[0] : undefined}
  // ...
>
```

#### B. Workflow Editor - Edit Lock

When editing an active workflow, show lock modal:

```tsx
// workflow-editor.tsx additions

const [showDisablePrompt, setShowDisablePrompt] = useState(false);

// Check on load
useEffect(() => {
  if (workflowId && initialData?.enabled) {
    setShowDisablePrompt(true);
  }
}, [workflowId, initialData]);

// Lock modal
{showDisablePrompt && (
  <Modal>
    <h3>Workflow is Active</h3>
    <p>This workflow is currently enabled. To edit it safely, you must disable it first.</p>
    <p className="text-yellow-500">Disabling will stop the workflow from processing new events.</p>
    <div className="flex gap-2">
      <button onClick={handleDisableAndEdit}>
        Disable & Edit
      </button>
      <button onClick={onClose}>
        Cancel
      </button>
    </div>
  </Modal>
)}
```

#### C. Workflow Editor - Integration Warnings

Show warnings when selecting actions without configured integrations:

```tsx
// In ActionEditor component

const isIntegrationConfigured = configuredIntegrations.includes(
  action.adapter.toUpperCase()
);

{!isIntegrationConfigured && action.adapter && (
  <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-xs">
    ⚠️ {action.adapter} is not configured for this client. 
    Configure it in the Integrations tab before enabling this workflow.
  </div>
)}
```

#### D. View Toggle - Dependency Tree

Add a toggle between list view and dependency view:

```tsx
// workflow-list.tsx additions

type ViewMode = 'list' | 'dependencies';
const [viewMode, setViewMode] = useState<ViewMode>('list');

// Toggle buttons
<div className="flex items-center gap-1 bg-zinc-800 rounded p-1">
  <button
    onClick={() => setViewMode('list')}
    className={viewMode === 'list' ? 'bg-zinc-700' : ''}
  >
    <List className="w-4 h-4" />
  </button>
  <button
    onClick={() => setViewMode('dependencies')}
    className={viewMode === 'dependencies' ? 'bg-zinc-700' : ''}
  >
    <GitBranch className="w-4 h-4" />
  </button>
</div>

// Conditional render
{viewMode === 'list' ? (
  <WorkflowCards ... />
) : (
  <DependencyTree clientId={clientId} />
)}
```

#### E. Dependency Tree Component

Visual representation of integration → workflow relationships:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY TREE VIEW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ TRIGGERS ────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  📅 Calendly                    ⚡ Stripe                  │  │
│  │  └─ booking_created             └─ payment_succeeded       │  │
│  │     └─→ "Fit1 Booked" ✓            └─→ "Payment Flow" ✓   │  │
│  │     └─→ "VIP Booking" ✓                                    │  │
│  │                                                            │  │
│  │  📧 RevLine (internal)                                     │  │
│  │  └─ email_captured                                         │  │
│  │     └─→ "Lead Capture" ✓                                   │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ACTIONS ─────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  📬 MailerLite                                             │  │
│  │  ├─ Groups:                                                │  │
│  │  │  ├─ "leads" → used by 2 workflows                      │  │
│  │  │  │  ├─ "Lead Capture"                                  │  │
│  │  │  │  └─ "Fit1 Booked"                                   │  │
│  │  │  └─ "customers" → used by 1 workflow                   │  │
│  │  │     └─ "Payment Flow"                                  │  │
│  │  └─ Operations: add_to_group (3), remove_from_group (0)   │  │
│  │                                                            │  │
│  │  ⚡ RevLine (internal)                                     │  │
│  │  └─ update_lead_stage → used by 2 workflows               │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ WARNINGS ────────────────────────────────────────────────┐  │
│  │  ⚠️ "VIP Booking" uses calendly trigger but Calendly      │  │
│  │     integration health is YELLOW                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### F. Integration Tab - Dependency Info

Show which workflows depend on each integration:

```tsx
// In integration card/row

<div className="text-xs text-zinc-500 mt-2">
  {dependentWorkflows.length > 0 ? (
    <span>
      Used by {dependentWorkflows.length} workflow{dependentWorkflows.length !== 1 ? 's' : ''}:
      {dependentWorkflows.map(w => w.name).join(', ')}
    </span>
  ) : (
    <span className="text-zinc-600">Not used by any workflows</span>
  )}
</div>

// Delete button disabled with reason
<button
  disabled={dependentWorkflows.length > 0}
  title={dependentWorkflows.length > 0 
    ? `Cannot delete: used by ${dependentWorkflows.length} workflows` 
    : 'Delete integration'}
>
  <Trash className="w-4 h-4" />
</button>
```

---

## Implementation Plan

### Phase 1: Core Validation (Backend)
**Files to create/modify:**
- [ ] `app/_lib/workflow/validation.ts` - New validation service
- [ ] `app/api/v1/workflows/[id]/toggle/route.ts` - Add enable validation
- [ ] `app/api/v1/workflows/[id]/route.ts` - Add edit validation
- [ ] `app/api/v1/integrations/[id]/route.ts` - Add delete validation

### Phase 2: Validation API & Dependencies
**Files to create/modify:**
- [ ] `app/api/workspaces/[id]/dependency-graph/route.ts` - New endpoint
- [ ] `app/_lib/workflow/dependencies.ts` - Dependency graph builder

### Phase 3: UI - List View Updates
**Files to modify:**
- [ ] `app/workspaces/[id]/workflows/workflow-list.tsx` - Add validation badges
- [ ] `app/workspaces/[id]/_components/workflow-card.tsx` - Add indicators

### Phase 4: UI - Editor Updates
**Files to modify:**
- [ ] `app/workspaces/[id]/workflows/workflow-editor.tsx` - Add lock modal, warnings

### Phase 5: UI - Dependency Tree
**Files to create:**
- [ ] `app/workspaces/[id]/_components/dependency-tree.tsx` - New component
- [ ] `app/workspaces/[id]/workflows/workflow-list.tsx` - Add view toggle

### Phase 6: Integration Tab Updates
**Files to modify:**
- [ ] Integration delete logic (need to locate file)
- [ ] Add "used by" indicators

---

## Error Codes Reference

| Code | HTTP | Message |
|------|------|---------|
| `INTEGRATION_NOT_CONFIGURED` | 400 | {integration} is not configured for this client |
| `INTEGRATION_UNHEALTHY` | 400 | {integration} integration is unhealthy (status: {status}) |
| `MAILERLITE_GROUP_NOT_FOUND` | 400 | MailerLite group "{key}" is not configured |
| `WORKFLOW_ACTIVE` | 400 | Cannot edit active workflow. Disable it first. |
| `HAS_DEPENDENTS` | 400 | Cannot delete: used by {count} workflows |
| `CIRCULAR_DEPENDENCY` | 400 | Workflow chain creates circular dependency |

---

## Testing Plan

### Unit Tests (`__tests__/unit/workflow-validation.test.ts`)

```typescript
describe('validateCanEnable', () => {
  it('passes when all integrations configured');
  it('fails when trigger integration missing');
  it('fails when action integration missing');
  it('warns when integration unhealthy');
  it('fails when mailerlite group missing');
});

describe('validateCanEdit', () => {
  it('passes when workflow disabled');
  it('fails when workflow enabled');
});

describe('validateCanDeleteIntegration', () => {
  it('passes when no workflows use integration');
  it('fails when workflows depend on integration');
  it('returns list of dependent workflows');
});
```

### Integration Tests

```typescript
describe('Workflow Toggle API', () => {
  it('rejects enable when integration missing');
  it('allows enable when all configured');
  it('returns validation errors in response');
});

describe('Workflow Edit API', () => {
  it('rejects edit when workflow active');
  it('allows edit when workflow disabled');
});
```

---

## Future Considerations

### Workflow Chaining
Currently out of scope, but the dependency graph structure supports it:

```typescript
// Future: one workflow output triggers another
interface WorkflowChain {
  sourceWorkflow: string;
  targetWorkflow: string;
  via: 'emit_event'; // custom event type
}
```

### Soft Warnings vs Hard Errors
Current design treats missing integration as hard error for enable.
Could add "soft enable" mode that allows enabling with warnings:

```typescript
// Future API
PATCH /api/v1/workflows/[id]/toggle?force=true
```

### Audit Log for Validation Failures
Log when admin attempts invalid operations:

```typescript
await emitEvent({
  clientId,
  system: EventSystem.BACKEND,
  eventType: 'workflow_enable_blocked',
  success: false,
  errorMessage: validation.errors[0].message,
});
```

---

## Questions to Resolve

1. **Should we auto-disable workflows when an integration is removed?**
   - Current plan: Block integration deletion
   - Alternative: Disable dependent workflows with warning

2. **Granularity of MailerLite validation**
   - Current plan: Check group key exists in meta
   - Alternative: API call to verify group exists in MailerLite

3. **Real-time validation in editor?**
   - Current plan: Validate on save
   - Alternative: Live validation as user types (more complex)

---

## Success Metrics

- [ ] Zero runtime failures from misconfigured workflows
- [ ] Clear error messages explaining why operation blocked
- [ ] Admin can see full dependency picture in one view
- [ ] No accidental breakage from integration deletion

---

*Last updated: January 2026*

