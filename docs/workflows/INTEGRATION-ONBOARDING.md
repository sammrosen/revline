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
| 7. **Config Editor (UI)** | `app/admin/clients/[id]/{name}-config-editor.tsx` | 45 min |
| 8. Wire Config Editor | `app/admin/clients/[id]/add-integration-form.tsx` | 10 min |
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

## Step 7: Structured Config Editor (REQUIRED)

**Every integration MUST have a structured config editor.** Raw JSON editing should only be a fallback option.

**File:** `app/admin/clients/[id]/your-integration-config-editor.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface YourIntegrationMeta {
  requiredField: string;
  optionalField?: string;
  lookupTable?: Record<string, { id: string; name: string }>;
}

interface YourIntegrationConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
}

const DEFAULT_CONFIG: YourIntegrationMeta = {
  requiredField: '',
  optionalField: '',
  lookupTable: {},
};

function parseMeta(value: string): YourIntegrationMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      requiredField: parsed.requiredField || '',
      optionalField: parsed.optionalField || '',
      lookupTable: parsed.lookupTable || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function YourIntegrationConfigEditor({ 
  value, 
  onChange,
  error: externalError,
}: YourIntegrationConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<YourIntegrationMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      const newJson = JSON.stringify(meta, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // ... implement mode switching (see existing editors for pattern)

  // Structured Mode UI
  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded"
        >
          Switch to JSON
        </button>
      </div>

      {/* Required Field */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Configuration</h4>
        <div className="space-y-4 p-4 bg-zinc-950 rounded border border-zinc-800">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Required Field <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={meta.requiredField}
              onChange={(e) => setMeta(prev => ({ ...prev, requiredField: e.target.value }))}
              placeholder="Enter value"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Lookup Table Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Lookup Table</h4>
        {/* Implement add/edit/delete for lookup entries */}
        {/* See MailerLite or ABC Ignite editors for pattern */}
      </div>

      {/* Validation Warning */}
      {!meta.requiredField.trim() && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-200/90">
          <span className="text-amber-400 font-medium">⚠️ Required:</span> Required Field must be set.
        </div>
      )}
    </div>
  );
}
```

### Editor UI Patterns

Reference existing editors for these patterns:

| Pattern | Reference File |
|---------|----------------|
| Lookup table (add/edit/delete) | `mailerlite-config-editor.tsx` |
| Simple key-value config | `abc-ignite-config-editor.tsx` |
| Product mapping | `stripe-config-editor.tsx` |
| JSON mode toggle | All editors |
| Delete confirmation modal | `mailerlite-config-editor.tsx` |

---

## Step 8: Wire Config Editor

Connect your editor to the add integration form.

**File:** `app/admin/clients/[id]/add-integration-form.tsx`

```typescript
// 1. Add import
import { YourIntegrationConfigEditor } from './your-integration-config-editor';

// 2. Add type check
const isYourIntegration = integration === 'YOUR_NEW_INTEGRATION';

// 3. Update help/template button condition (hide for structured editors)
{!isMailerLite && !isStripe && !isAbcIgnite && !isYourIntegration && (
  <IntegrationHelp ... />
)}

// 4. Add to editor rendering
{isMailerLite ? (
  <MailerLiteConfigEditor ... />
) : isStripe ? (
  <StripeConfigEditor ... />
) : isAbcIgnite ? (
  <AbcIgniteConfigEditor ... />
) : isYourIntegration ? (
  <YourIntegrationConfigEditor
    value={meta}
    onChange={setMeta}
  />
) : (
  <textarea ... />
)}
```

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
