# Integration Onboarding Checklist

Complete guide for adding new integrations to RevLine. Follow this checklist to ensure full integration across backend, frontend, and documentation.

---

## Quick Reference

| Step | Files to Touch | Time Est. |
|------|----------------|-----------|
| 1. Database Schema | `prisma/schema.prisma` | 5 min |
| 2. Type Definitions | `app/_lib/types/index.ts` | 5 min |
| 3. Integration Config | `app/_lib/integrations/config.ts` | 10 min |
| 4. Adapter Implementation | `app/_lib/integrations/{name}.adapter.ts` | 30 min |
| 5. Workflow Registry | `app/_lib/workflow/registry.ts` | 15 min |
| 6. Action Executors | `app/_lib/workflow/executors/{name}.ts` | 30 min |
| 7. **Config Editor (UI)** | `app/workspaces/[id]/{name}-config-editor.tsx` | 45 min |
| 8. Wire Config Editor | `app/workspaces/[id]/add-integration-form.tsx` | 10 min |
| 9. Migration | Run prisma migrate | 5 min |
| 10. Testing | Manual + integration tests | 30 min |

**Total: ~3 hours** for a standard integration with structured editor.

---

## Step 1: Database Schema

Add the integration to Prisma enums.

**File:** `prisma/schema.prisma`

```prisma
enum IntegrationType {
  MAILERLITE
  STRIPE
  CALENDLY
  MANYCHAT
  ABC_IGNITE
  YOUR_NEW_INTEGRATION  // Add here
}

enum EventSystem {
  BACKEND
  MAILERLITE
  STRIPE
  CALENDLY
  MANYCHAT
  CRON
  WORKFLOW
  ABC_IGNITE
  YOUR_NEW_INTEGRATION  // Add here if it produces events
}
```

**Why both enums?**
- `IntegrationType`: Used for storing client integrations
- `EventSystem`: Used in event ledger for audit trail

---

## Step 2: Type Definitions

Define the meta configuration interface.

**File:** `app/_lib/types/index.ts`

```typescript
// Add the meta interface
export interface YourNewIntegrationMeta {
  // Required fields
  requiredField: string;
  // Optional fields
  optionalField?: string;
  // Lookup tables for workflow references
  lookupTable?: Record<string, { id: string; name: string }>;
}

// Add to the union type
export type IntegrationMeta =
  | MailerLiteMeta
  | StripeMeta
  | CalendlyMeta
  | ManyChatMeta
  | AbcIgniteMeta
  | YourNewIntegrationMeta  // Add here
  | Record<string, unknown>;
```

---

## Step 3: Integration Config (CRITICAL)

This is the **single source of truth** for integration UI configuration.

**File:** `app/_lib/integrations/config.ts`

```typescript
export const INTEGRATION_TYPES = [
  'MAILERLITE',
  'STRIPE',
  'CALENDLY',
  'MANYCHAT',
  'ABC_IGNITE',
  'YOUR_NEW_INTEGRATION',  // Add here - must match Prisma enum
] as const;

// Add full configuration
export const INTEGRATIONS: Record<IntegrationTypeId, IntegrationConfig> = {
  // ... existing integrations
  
  YOUR_NEW_INTEGRATION: {
    id: 'YOUR_NEW_INTEGRATION',
    name: 'your_new_integration',  // lowercase for internal use
    displayName: 'Your Integration',  // Human-readable
    color: 'text-blue-400',  // Tailwind color class
    hasStructuredEditor: true,  // Set true when you create the editor
    secrets: [
      {
        name: 'API Key',
        placeholder: 'your_api_key_here',
        description: 'Get from Your Integration → Settings → API',
        required: true,
      },
      // Add more secrets as needed
    ],
    metaTemplate: {
      requiredField: '',
      optionalField: '',
      lookupTable: {},
    },
    metaDescription: 'Brief description of what the config does',
    metaFields: [
      { key: 'requiredField', description: 'Description of this field', required: true },
      { key: 'optionalField', description: 'Description (optional)' },
      { key: 'lookupTable.*', description: 'Named entries for workflow references' },
    ],
    tips: [
      'Helpful tip for users',
      'Another tip',
    ],
    warnings: [
      'Important warnings go here',
    ],
  },
};
```

**Important:** Setting `hasStructuredEditor: true` tells the form to expect a custom editor component.

---

## Step 4: Adapter Implementation

Create the backend adapter for API communication.

**File:** `app/_lib/integrations/your-integration.adapter.ts`

```typescript
import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { YourNewIntegrationMeta, IntegrationResult } from '@/app/_lib/types';

// Secret names must match config.ts
export const YOUR_INTEGRATION_API_KEY = 'API Key';

export class YourIntegrationAdapter extends BaseIntegrationAdapter<YourNewIntegrationMeta> {
  readonly type = IntegrationType.YOUR_NEW_INTEGRATION;

  /**
   * Factory method - loads credentials from database
   */
  static async forClient(clientId: string): Promise<YourIntegrationAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<YourNewIntegrationMeta>(
      clientId,
      IntegrationType.YOUR_NEW_INTEGRATION
    );
    if (!data) return null;
    return new YourIntegrationAdapter(data.clientId, data.secrets, data.meta);
  }

  /**
   * Example API method
   */
  async doSomething(params: { id: string }): Promise<IntegrationResult<{ success: boolean }>> {
    const apiKey = this.getSecret(YOUR_INTEGRATION_API_KEY);
    if (!apiKey) {
      return { success: false, error: 'API Key not configured' };
    }

    try {
      const response = await fetch(`https://api.example.com/endpoint/${params.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, data: { success: true } };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
```

**Export from index:**

**File:** `app/_lib/integrations/index.ts`

```typescript
export { YourIntegrationAdapter } from './your-integration.adapter';
```

---

## Step 5: Workflow Registry

Define available triggers and actions for the workflow engine.

**File:** `app/_lib/workflow/registry.ts`

```typescript
export const YOUR_INTEGRATION_ADAPTER: AdapterDefinition = {
  id: 'your_integration',
  name: 'Your Integration',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['requiredField'],
  },
  triggers: {
    // Only if your integration has webhooks
    event_received: {
      name: 'event_received',
      label: 'Event Received',
      description: 'Triggered when your integration sends a webhook',
      payloadSchema: z.object({
        eventId: z.string(),
        data: z.record(z.unknown()),
      }),
    },
  },
  actions: {
    do_something: {
      name: 'do_something',
      label: 'Do Something',
      description: 'Performs an action via Your Integration API',
      payloadSchema: z.object({
        id: z.string(),
      }),
      paramsSchema: z.object({
        id: z.string().describe('The ID to operate on'),
      }),
    },
  },
};

// Add to registry
export const ADAPTER_REGISTRY: Record<string, AdapterDefinition> = {
  // ... existing
  your_integration: YOUR_INTEGRATION_ADAPTER,
};
```

---

## Step 6: Action Executors

Implement workflow action handlers.

**File:** `app/_lib/workflow/executors/your-integration.ts`

```typescript
import { YourIntegrationAdapter } from '@/app/_lib/integrations/your-integration.adapter';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

const doSomething: ActionExecutor = {
  async execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult> {
    const id = params.id as string;

    const adapter = await YourIntegrationAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return {
        success: false,
        error: 'Your Integration not configured for this client',
      };
    }

    const result = await adapter.doSomething({ id });

    await emitEvent({
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      system: EventSystem.YOUR_NEW_INTEGRATION,
      eventType: result.success ? 'your_integration_action_success' : 'your_integration_action_failed',
      success: result.success,
      errorMessage: result.error,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  },
};

export const yourIntegrationExecutors: Record<string, ActionExecutor> = {
  do_something: doSomething,
};
```

**Register in index:**

**File:** `app/_lib/workflow/executors/index.ts`

```typescript
import { yourIntegrationExecutors } from './your-integration';

const EXECUTORS: Record<string, Record<string, ActionExecutor>> = {
  // ... existing
  your_integration: yourIntegrationExecutors,
};
```

---

## Step 7: Config Editors (Add vs Configure)

**Key Architecture:** RevLine uses **two separate UI components** for integration configuration:

| Component | File Pattern | Context | Purpose |
|-----------|--------------|---------|---------|
| **Add Config** | `*-add-config.tsx` | "+ Add Integration" form | Collect credentials + minimal required config |
| **Edit Config** | `*-config-editor.tsx` | "Configure" button on existing integration | Full configuration with API sync, lookups, etc. |

### Why Two Components?

1. **Add Integration** - User doesn't have saved credentials yet, so can't make API calls
2. **Configure (Edit)** - Integration is saved, has `integrationId`, can call sync APIs

```
┌─────────────────────────────────────────────────────────────────┐
│  ADD INTEGRATION (add-integration-form.tsx)                      │
│  ─────────────────────────────────────────                       │
│  • Credentials (App ID, API Key, etc.)                          │
│  • Basic required config (e.g., Club Number)                    │
│  • Info box: "After saving, you can sync/configure..."          │
│                                                                  │
│  Uses: YourIntegrationAddConfig component                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         [Save]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CONFIGURE / EDIT (integration-actions.tsx)                      │
│  ──────────────────────────────────────────                      │
│  • Has integrationId (can make API calls)                       │
│  • Sync data from external API (e.g., event types)              │
│  • Full lookup tables, defaults, advanced options               │
│  • JSON mode fallback for power users                           │
│                                                                  │
│  Uses: YourIntegrationConfigEditor component                     │
└─────────────────────────────────────────────────────────────────┘
```

### Step 7a: Add Config Component (Simple)

**File:** `app/workspaces/[id]/your-integration-add-config.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface YourIntegrationMeta {
  requiredField: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function YourIntegrationAddConfig({ value, onChange }: Props) {
  const [meta, setMeta] = useState(() => {
    try { return JSON.parse(value); } catch { return { requiredField: '' }; }
  });

  useEffect(() => {
    onChange(JSON.stringify(meta, null, 2));
  }, [meta, onChange]);

  return (
    <div className="space-y-4">
      {/* Required field only */}
      <div>
        <label className="text-xs text-zinc-400 block mb-1.5">
          Required Field <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={meta.requiredField}
          onChange={(e) => setMeta({ ...meta, requiredField: e.target.value })}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
        />
      </div>

      {/* Info box about what's available after saving */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-400 mb-2">
          After saving, you'll be able to:
        </h4>
        <ul className="text-xs text-blue-200/70 space-y-1">
          <li>• Sync data from Your Integration API</li>
          <li>• Configure lookup tables and defaults</li>
          <li>• Set up advanced options</li>
        </ul>
      </div>
    </div>
  );
}
```

### Step 7b: Edit Config Component (Full Featured)

**File:** `app/workspaces/[id]/your-integration-config-editor.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface YourIntegrationMeta {
  requiredField: string;
  lookupTable?: Record<string, { id: string; name: string }>;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string; // For API calls
}

export function YourIntegrationConfigEditor({ 
  value, onChange, error, integrationId 
}: Props) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [meta, setMeta] = useState<YourIntegrationMeta>(() => parseMeta(value));
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync function - can call API because we have integrationId
  async function handleSync() {
    if (!integrationId) return;
    setIsSyncing(true);
    const res = await fetch(`/api/v1/integrations/${integrationId}/sync-data`);
    // ... handle response, show selection dialog, etc.
    setIsSyncing(false);
  }

  return (
    <div className="space-y-6">
      {/* JSON mode toggle */}
      {/* Required fields */}
      
      {/* Sync button - only works with integrationId */}
      <button onClick={handleSync} disabled={!integrationId || isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync from API'}
      </button>
      
      {/* Lookup tables, defaults, etc. */}
    </div>
  );
}
```

### Editor UI Patterns

| Pattern | Reference File |
|---------|----------------|
| Add config (simple) | `abc-ignite-add-config.tsx` |
| Edit config with sync | `abc-ignite-config-editor.tsx` |
| Lookup table (add/edit/delete) | `mailerlite-config-editor.tsx` |
| Product mapping | `stripe-config-editor.tsx` |
| JSON mode toggle | All `*-config-editor.tsx` files |

---

## Step 8: Wire Config Editors

You need to wire **both** components into their respective forms.

### 8a: Wire Add Config

**File:** `app/workspaces/[id]/add-integration-form.tsx`

```typescript
// 1. Import the ADD config (simple version)
import { YourIntegrationAddConfig } from './your-integration-add-config';

// 2. Add type check
const isYourIntegration = integration === 'YOUR_NEW_INTEGRATION';

// 3. Hide help for structured editors
{!isMailerLite && !isStripe && !isAbcIgnite && !isYourIntegration && (
  <IntegrationHelp ... />
)}

// 4. Render the ADD config
{isYourIntegration ? (
  <YourIntegrationAddConfig value={meta} onChange={setMeta} />
) : ...}
```

### 8b: Wire Edit Config

**File:** `app/workspaces/[id]/integration-actions.tsx`

```typescript
// 1. Import the EDIT config (full version)
import { YourIntegrationConfigEditor } from './your-integration-config-editor';

// 2. Add to IntegrationType union
type IntegrationType = '...' | 'YOUR_NEW_INTEGRATION';

// 3. Add to AVAILABLE_SECRET_NAMES
YOUR_NEW_INTEGRATION: ['API Key'],

// 4. Add type check
const isYourIntegration = integrationType === 'YOUR_NEW_INTEGRATION';

// 5. Update hasStructuredEditor
const hasStructuredEditor = isMailerLite || isStripe || isAbcIgnite || isYourIntegration;

// 6. Render the EDIT config with integrationId
{isYourIntegration ? (
  <YourIntegrationConfigEditor
    value={metaText}
    onChange={setMetaText}
    error={error}
    integrationId={integration.id}  // Enables API calls!
  />
) : ...}
```

### 8c: Critical Checklist (MUST DO)

Missing any of these causes **runtime errors** that crash the page:

**In `integration-actions.tsx`:**
- [ ] Import the config editor component
- [ ] Add integration to `IntegrationType` union type
- [ ] Add secrets to `AVAILABLE_SECRET_NAMES` map
- [ ] Add `isYourIntegration` boolean check
- [ ] Add to `hasStructuredEditor` condition
- [ ] Add conditional render in the edit modal

**In `add-integration-form.tsx`:**
- [ ] Import the add config component
- [ ] Add `isYourIntegration` boolean check
- [ ] Add to help button visibility conditions
- [ ] Add conditional render in the form

**Common Runtime Error:**
```
ReferenceError: isYourIntegration is not defined
```
This means you added the integration to conditional checks but forgot to define the boolean variable.

---

## Step 9: Database Migration

Apply schema changes.

```bash
# Create migration
npx prisma migrate dev --name add_your_integration

# If migrate dev fails (Windows file lock), try:
rm -rf node_modules/.prisma
npx prisma generate
npx prisma migrate deploy
```

---

## Step 10: Testing

### Manual Testing Checklist

- [ ] Integration appears in dropdown on add integration form
- [ ] Structured editor displays properly
- [ ] Required field validation shows warning
- [ ] JSON mode toggle works both ways
- [ ] Saving integration stores correct values
- [ ] Editing existing integration loads values into editor
- [ ] Workflows can reference the new integration's actions

### Integration Test

Add to `__tests__/integration/`:

```typescript
describe('YourIntegration', () => {
  it('should save integration with valid config', async () => {
    // Test implementation
  });
  
  it('should execute workflow action', async () => {
    // Test implementation
  });
});
```

---

## Common Gotchas

### 1. TypeScript enum not found after schema change
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### 2. Integration not showing in dropdown
Check that `INTEGRATION_TYPES` array in `config.ts` includes your type.

### 3. Config editor not rendering
Verify:
- Import added to `add-integration-form.tsx`
- Type check variable created (e.g., `isYourIntegration`)
- Added to the conditional render chain

### 4. JSON mode losing data
Ensure `parseMeta()` handles all fields and provides defaults.

### 5. Workflow actions not executing
Check:
- Executor registered in `executors/index.ts`
- Adapter ID matches in registry and executor map

---

## File Location Summary

```
app/
├── _lib/
│   ├── integrations/
│   │   ├── config.ts           # Single source of truth for UI
│   │   ├── your-integration.adapter.ts
│   │   └── index.ts            # Re-export adapter
│   ├── types/
│   │   └── index.ts            # Meta interface
│   └── workflow/
│       ├── registry.ts         # Triggers & actions definition
│       └── executors/
│           ├── your-integration.ts
│           └── index.ts        # Register executor
├── admin/
│   └── clients/
│       └── [id]/
│           ├── your-integration-config-editor.tsx
│           └── add-integration-form.tsx  # Wire editor
prisma/
└── schema.prisma               # Enum definitions
```

---

## Review Checklist

Before merging:

- [ ] Prisma enums updated (`IntegrationType`, `EventSystem`)
- [ ] Meta interface defined in types
- [ ] `config.ts` has complete integration config with `hasStructuredEditor: true`
- [ ] Adapter implements all required methods
- [ ] Registry defines triggers/actions with schemas
- [ ] Executors emit appropriate events
- [ ] **Structured config editor created** (not just JSON textarea)
- [ ] Editor wired into form with type check
- [ ] Migration applied
- [ ] Manual testing complete
