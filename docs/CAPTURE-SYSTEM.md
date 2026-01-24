# Form Capture System

> Comprehensive documentation for RevLine's unified form capture system.

## Overview

The Form Capture System is RevLine's **universal top-of-funnel pipe**. It enables **observational capture** of form data from ANY source without blocking or modifying the original form flow. Data is routed through RevLine for lead creation, custom field population, and workflow triggering.

### Key Principles

- **Observational**: Capture never blocks source forms - always returns success (204 for browser mode)
- **Email Optional**: Accepts any data. If email is present, a lead is created. If not, trigger still fires.
- **Source Agnostic**: Works with external sites, landing pages, bespoke forms, server-to-server
- **Future Proof**: Same endpoint works regardless of where the form lives or where you migrate to

### Unified Architecture

All form capture goes through the same pipe:

```
ANY SOURCE → POST /api/v1/capture/[formId] → Lead + Custom Fields + Workflow Trigger
```

| Source | Integration Method |
|--------|-------------------|
| External websites | `capture.js` script |
| Landing pages | `capture.js` or direct POST |
| Bespoke form pages | `submitToCapture()` SDK |
| Server-to-server | HMAC-signed POST |
| Legacy subscribe endpoint | Auto-routes to capture |

This system was built with the following principles from [STANDARDS.md](./STANDARDS.md):
- **Abstraction First**: Workspace-scoped, provider-agnostic design
- **Workspace Isolation**: All data scoped to workspace, no cross-contamination
- **Event-Driven Debugging**: Comprehensive event logging for traceability
- **Fail-Safe Defaults**: Browser mode never breaks client sites (always 204)
- **Defense in Depth**: Allowlists, denylists, rate limiting, signature verification

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Client Website                                  │
│  ┌─────────────┐    submit    ┌─────────────┐                           │
│  │ Client Form │──────────────│ capture.js  │                           │
│  └─────────────┘              └──────┬──────┘                           │
└─────────────────────────────────────│────────────────────────────────────┘
                                      │ POST (mapped fields)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RevLine Backend                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/capture/[formId]                                      │ │
│  │                                                                    │ │
│  │  1. Load WorkspaceForm config                                      │ │
│  │  2. Determine mode (browser vs server)                             │ │
│  │  3. Validate request (origin/signature)                            │ │
│  │  4. Rate limit check                                               │ │
│  │  5. Validate & sanitize payload                                    │ │
│  │  6. Process capture                                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                           │                                              │
│              ┌────────────┴────────────┐                                │
│              ▼                         ▼                                │
│  ┌─────────────────┐      ┌─────────────────┐                          │
│  │  Lead Service   │      │ Custom Fields   │                          │
│  │  (upsert lead)  │      │ (set custom)    │                          │
│  └────────┬────────┘      └────────┬────────┘                          │
│           │                        │                                    │
│           └────────────┬───────────┘                                    │
│                        ▼                                                │
│              ┌─────────────────┐                                        │
│              │ Workflow Engine │                                        │
│              │ (emit trigger)  │                                        │
│              └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Database Schema

#### WorkspaceForm Model

```prisma
model WorkspaceForm {
  id          String   @id @default(uuid())
  workspaceId String   @map("workspace_id")
  name        String   @db.VarChar(128)
  description String?
  enabled     Boolean  @default(true)
  
  // Security configuration (JSON)
  security    Json     @default("{...}")
  
  // Allowed target fields (JSON array)
  allowedTargets Json  @default("[\"email\"]")
  
  // Workflow trigger name
  triggerName   String  @default("form_captured")
  
  // Capture statistics
  captureCount  Int     @default(0)
  lastCaptureAt DateTime?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  workspace   Workspace @relation(...)
}
```

#### LeadCustomFieldDefinition Model

```prisma
model LeadCustomFieldDefinition {
  id           String   @id @default(uuid())
  workspaceId  String   @map("workspace_id")
  key          String   @db.VarChar(64)    // e.g., "barcode"
  label        String   @db.VarChar(128)   // e.g., "Member Barcode"
  fieldType    String   @default("TEXT")   // TEXT, NUMBER, DATE
  required     Boolean  @default(false)
  description  String?
  defaultValue String?
  displayOrder Int      @default(0)
  
  workspace Workspace @relation(...)
}
```

### 2. Security Configuration

The `security` JSON field on WorkspaceForm supports:

```typescript
{
  mode: 'browser' | 'server' | 'both',
  allowedOrigins: string[],      // e.g., ["https://example.com", "*.example.com"]
  rateLimitPerIp: number,        // 1-100, default 10
  signingSecret?: string         // Encrypted, server mode only
}
```

#### Security Modes

| Mode | Use Case | Authentication | Rate Limit |
|------|----------|----------------|------------|
| `browser` | Client-side JS capture | Origin validation | Per IP (10/min default) |
| `server` | Server-to-server | HMAC signature | Per workspace (100/min) |
| `both` | Hybrid | Either method | Mode-dependent |

### 3. Capture Endpoint

**`POST /api/v1/capture/[formId]`**

#### Browser Mode Flow

1. Parse body (supports `application/json` and `text/plain` for sendBeacon)
2. Validate `Origin` header against `allowedOrigins`
3. Rate limit by IP
4. Validate payload against `allowedTargets`
5. Sanitize values (trim, length cap, HTML strip, denylist check)
6. Upsert lead, set custom data, emit trigger
7. **Always return 204** (never break client flow)

#### Server Mode Flow

1. Verify `X-RevLine-Signature` header (HMAC SHA-256)
2. Validate `X-RevLine-Timestamp` (5-minute window)
3. Rate limit by workspace
4. Same payload validation/processing
5. Return proper status codes (200/400/401/403/429)

#### Signature Format

```
X-RevLine-Signature: sha256=<hex-digest>
X-RevLine-Timestamp: <unix-seconds>

Signature = HMAC-SHA256(signing_secret, "${timestamp}.${body}")
```

### 4. Capture Script

**`/capture.js`** - Lightweight (~2KB) vanilla JavaScript:

```html
<script
  src="https://revline.app/capture.js"
  data-form-id="abc123"
  data-form-selector="#signup-form"
  data-fields="email_field:email,name:firstName,member_id:custom.barcode"
  async
></script>
```

#### Features

- **Allowlist only**: Only captures explicitly mapped fields
- **Client-side denylist**: Blocks password, SSN, credit card fields
- **sendBeacon**: Non-blocking, survives page navigation
- **Silent failures**: Never breaks the client site
- **SPA support**: MutationObserver for dynamic forms

#### Field Mapping Format

```
data-fields="source:target,source:target,..."

Examples:
- email_field:email          → Maps form's "email_field" to lead.email
- full_name:firstName        → Maps to lead.firstName
- barcode:custom.barcode     → Maps to custom field "barcode"
```

### 5. Server-Side SDK (for Bespoke Forms)

For bespoke forms that need custom logic before capture (e.g., booking forms that
need to verify eligibility first), use the server-side SDK:

```typescript
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';

// After your custom form logic completes...
const result = await submitCaptureTrigger(
  workspaceId,
  'booking-confirmed',  // Must match WorkspaceForm.triggerName
  {
    email: customer.email,           // Optional
    firstName: customer.name,
    'custom.bookingId': bookingId,
    'custom.slotTime': slot.startTime,
  }
);

if (result.success) {
  console.log('Captured:', result.captureId);
}
```

**SDK Functions:**

| Function | Use Case |
|----------|----------|
| `submitCaptureTrigger(workspaceId, triggerName, payload)` | Submit by trigger name |
| `submitToCapture(formId, payload)` | Submit by form ID |

**Key Points:**
- Never throws - always returns `CaptureProcessResult`
- Email is optional - capture accepts any data
- Workflows decide what to do with incomplete data

### 6. Validation & Sanitization

#### Allowed Targets

Targets must be either:
- Known lead fields: `email`, `firstName`, `lastName`, `phone`, `source`
- Custom fields: `custom.<key>` where key matches a defined custom field

#### Denylist (Field Names)

The following field names are never accepted:
- `password`, `passwd`, `pwd`, `secret`, `token`
- `ssn`, `social_security`
- `creditcard`, `card_number`, `cvv`, `cvc`
- `routing`, `account_number`, `bank_account`

#### Denylist (Value Patterns)

Values matching these patterns are rejected:
- Credit card numbers (13-19 digits)
- SSN format (XXX-XX-XXXX or 9 digits)

#### Value Sanitization

- Trim whitespace
- Cap at 1000 characters
- Strip HTML tags
- Remove control characters

### 6. Custom Fields System

#### Defining Fields

Custom fields are defined per workspace in the Settings tab:

```typescript
await CustomFieldService.defineField({
  workspaceId: 'ws_123',
  key: 'barcode',
  label: 'Member Barcode',
  fieldType: 'TEXT',
  required: false,
  description: 'ABC Fitness member barcode',
});
```

#### Setting Custom Data

```typescript
await CustomFieldService.setLeadCustomData(leadId, {
  barcode: '12345678',
  memberType: 'premium',
}, {
  validate: true,  // Validate against definitions
  merge: true,     // Merge with existing data
});
```

#### Storage

Custom data is stored in `Lead.customData` (JSONB):

```json
{
  "barcode": "12345678",
  "memberType": "premium"
}
```

---

## Dashboard UI

### Capture Tab

The Capture tab in the workspace dashboard provides:

1. **Form List**: View all capture forms with stats
   - Enable/disable toggle
   - Capture count and last capture time
   - Security mode badge
   - Allowed target fields

2. **Form Editor**: Create and edit forms
   - Name and description
   - Security mode selection
   - Allowed origins configuration
   - Rate limit per IP
   - Target field selection (lead fields + custom fields)
   - Workflow trigger name

3. **Embed Code Modal**: Generate integration code
   - Form selector configuration
   - Field mapping builder
   - Copy-to-clipboard
   - Integration instructions

### Custom Fields Section (Settings Tab)

Manage custom field definitions:
- Add/edit/delete definitions
- Set field type (TEXT, NUMBER, DATE)
- Mark as required
- Set display order

### Lead Detail Modal

View and edit custom data on individual leads:
- See all custom field values
- Edit values (MEMBER+ role)
- Type-aware input controls

---

## API Routes

### Capture Forms Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/workspaces/[id]/capture-forms` | VIEWER+ | List all forms |
| POST | `/api/v1/workspaces/[id]/capture-forms` | ADMIN+ | Create form |
| GET | `/api/v1/workspaces/[id]/capture-forms/[formId]` | VIEWER+ | Get form |
| PATCH | `/api/v1/workspaces/[id]/capture-forms/[formId]` | ADMIN+ | Update form |
| DELETE | `/api/v1/workspaces/[id]/capture-forms/[formId]` | ADMIN+ | Delete form |
| GET | `/api/v1/workspaces/[id]/capture-forms/[formId]/embed` | VIEWER+ | Get embed code |

### Custom Fields Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/workspaces/[id]/custom-fields` | VIEWER+ | List definitions |
| POST | `/api/v1/workspaces/[id]/custom-fields` | ADMIN+ | Create definition |
| GET | `/api/v1/workspaces/[id]/custom-fields/[key]` | VIEWER+ | Get definition |
| PATCH | `/api/v1/workspaces/[id]/custom-fields/[key]` | ADMIN+ | Update definition |
| DELETE | `/api/v1/workspaces/[id]/custom-fields/[key]` | ADMIN+ | Delete definition |

### Capture Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/capture/[formId]` | Public* | Receive capture |
| OPTIONS | `/api/v1/capture/[formId]` | Public | CORS preflight |

*Rate limited, validated by origin or signature

---

## Workflow Integration

Captures emit triggers to the workflow engine:

```typescript
// Trigger emitted on successful capture
{
  adapter: 'capture',
  operation: form.triggerName,  // Default: 'form_captured'
}

// Trigger payload
{
  formId: 'form_123',
  formName: 'ABC Signup Capture',
  email: 'user@example.com',
  leadId: 'lead_456',
  isNewLead: true,
  captureId: 'cap_abc123',
  mode: 'browser',
  firstName: 'John',
  customFields: {
    barcode: '12345678'
  }
}
```

### Example Workflow

```yaml
name: ABC Signup Welcome
trigger:
  adapter: capture
  operation: form_captured
  filter:
    formName: "ABC Signup Capture"
actions:
  - adapter: resend
    operation: send_email
    params:
      template: welcome
      to: "{{email}}"
      variables:
        name: "{{firstName}}"
        barcode: "{{customFields.barcode}}"
```

---

## Event Logging

All capture operations emit events for debugging:

| Event | When | Metadata |
|-------|------|----------|
| `capture_received` | Request received | formId, mode, origin |
| `capture_validated` | Payload passed | formId, fieldsCount |
| `capture_rejected` | Validation failed | formId, reason |
| `capture_rate_limited` | Rate limited | formId, mode |
| `capture_lead_created` | New lead | formId, leadId |
| `capture_lead_updated` | Existing lead | formId, leadId |
| `capture_custom_data_set` | Custom fields stored | formId, fieldCount |
| `capture_trigger_emitted` | Workflow triggered | formId, triggerName |
| `capture_processing_failed` | Error occurred | formId, error |

---

## Rate Limits

| Context | Limit | Window |
|---------|-------|--------|
| Browser mode (per IP) | 10 requests | 1 minute |
| Server mode (per workspace) | 100 requests | 1 minute |
| Form-specific override | 1-100 | 1 minute |

---

## Security Checklist

### Request Handling
- ✅ Body size limit: 32KB max
- ✅ Content-Type: Accept JSON and text/plain
- ✅ Raw body preserved for signature verification

### Browser Mode
- ✅ Origin validation against allowedOrigins
- ✅ IP rate limiting (strict)
- ✅ CORS: Only specific origins, not `*`
- ✅ Always return 204 (never break client)

### Server Mode
- ✅ HMAC signature verification (timing-safe)
- ✅ Timestamp validation (5-minute window)
- ✅ Workspace rate limiting
- ✅ Proper error codes (400/401/403/429)

### Data Validation
- ✅ Email optional (observational - accepts any data)
- ✅ Only accept fields in allowedTargets
- ✅ Denylist sensitive field names
- ✅ Denylist sensitive value patterns
- ✅ Per-field length cap (1000 chars)
- ✅ Total payload size cap (32KB)
- ✅ HTML/script stripping

### Custom Fields
- ✅ Validate targets exist as definitions
- ✅ Type validation (TEXT/NUMBER/DATE)
- ✅ Required field enforcement

---

## File Structure

```
app/
├── _lib/
│   ├── types/
│   │   └── capture.ts              # Types, schemas, denylists
│   └── services/
│       ├── capture.service.ts      # Validation, processing, embed
│       └── custom-field.service.ts # Custom field CRUD
├── api/v1/
│   ├── capture/[formId]/
│   │   └── route.ts                # Public capture endpoint
│   └── workspaces/[id]/
│       ├── capture-forms/
│       │   ├── route.ts            # List/create forms
│       │   └── [formId]/
│       │       ├── route.ts        # CRUD single form
│       │       └── embed/route.ts  # Embed code generation
│       └── custom-fields/
│           ├── route.ts            # List/create definitions
│           └── [key]/route.ts      # CRUD single definition
└── (dashboard)/workspaces/[id]/
    ├── capture-forms-section.tsx   # Forms list UI
    ├── capture-form-editor.tsx     # Form create/edit UI
    ├── embed-code-modal.tsx        # Embed code UI
    ├── custom-fields-section.tsx   # Custom fields UI
    └── lead-detail-modal.tsx       # Lead custom data UI

public/
└── capture.js                      # Client-side capture script

prisma/
├── schema.prisma                   # WorkspaceForm, LeadCustomFieldDefinition
└── migrations/
    ├── 20260124.../migration.sql   # Add workspace_forms table
    └── ...

__tests__/unit/
└── capture.test.ts                 # 29 unit tests
```

---

## Usage Guide

### Setting Up a Capture Form

1. **Create custom fields** (if needed)
   - Go to Workspace → Settings → Custom Fields
   - Add fields like `barcode`, `memberType`

2. **Create capture form**
   - Go to Workspace → Capture tab
   - Click "Add Form"
   - Configure:
     - Name: "ABC Signup Capture"
     - Security mode: Browser
     - Allowed origins: `https://abcfitness.com`
     - Target fields: email, firstName, custom.barcode
     - Trigger name: `abc_signup`

3. **Get embed code**
   - Click the `</>` icon on the form
   - Configure form selector: `#signup-form`
   - Map fields:
     - `email` → `email`
     - `first_name` → `firstName`
     - `member_barcode` → `custom.barcode`
   - Copy embed code

4. **Install on client site**
   - Add the script tag before `</body>`
   - Test by submitting the form

5. **Create workflow** (optional)
   - Go to Workflows tab
   - Create workflow triggered by `capture.abc_signup`
   - Add actions (send email, update CRM, etc.)

### Monitoring

- **Capture stats**: View count and last capture on form cards
- **Events**: Check Events tab for capture events
- **Leads**: See captured leads in Leads tab
- **Workflows**: Check workflow executions

---

## Migration from Legacy System

If you were using the old RevLine form system (`FORM_REGISTRY`, `emitFormTrigger()`,
or the RevLine Config form enabler), here's how to migrate:

### 1. Create WorkspaceForms

For each form trigger you used, create a matching WorkspaceForm:

| Old Trigger | New WorkspaceForm |
|-------------|-------------------|
| `revline.booking-confirmed` | triggerName: `booking-confirmed` |
| `revline.email_captured` | triggerName: `email_captured` |

### 2. Update Code

```typescript
// OLD (deprecated)
import { emitFormTrigger } from '@/app/_lib/workflow';
await emitFormTrigger(workspaceId, 'sportswest-booking', 'booking-confirmed', payload);

// NEW
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';
await submitCaptureTrigger(workspaceId, 'booking-confirmed', payload);
```

### 3. Update Workflows

Run the migration script to update existing workflows:

```bash
npx tsx prisma/migrate-workflows-to-capture.ts
```

This changes `triggerAdapter: 'revline'` → `triggerAdapter: 'capture'`.

### 4. Deprecations

The following are deprecated and will be removed in a future version:

| Deprecated | Replacement |
|------------|-------------|
| `FORM_REGISTRY` | WorkspaceForm table |
| `emitFormTrigger()` | `submitCaptureTrigger()` |
| RevLine Config form enabler | Capture tab |
| `revline.triggerId` triggers | `capture.triggerName` triggers |

---

## Future Considerations

1. **Internal Form Builder**: The system is designed to eventually support RevLine-hosted forms using the same WorkspaceForm configuration.

2. **Server-to-Server Integration**: For clients who can integrate server-side, the HMAC authentication enables secure, reliable capture.

3. **Bulk Import**: Custom field infrastructure supports future bulk import functionality.

4. **Field Encryption**: The custom field system can be extended to support encrypted fields (e.g., for sensitive but necessary data).

5. **Analytics**: Capture statistics can be extended with conversion tracking, funnel analysis.

---

## Related Documentation

- [STANDARDS.md](./STANDARDS.md) - Core principles and security requirements
- [WORKFLOW-ENGINE.md](./WORKFLOW-ENGINE.md) - Workflow trigger/action system
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
