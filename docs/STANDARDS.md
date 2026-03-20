# RevLine Architecture Standards

This document defines the architecture principles, coding standards, and security requirements for the RevLine platform. **All contributors must follow these standards.**

---

## Core Principles

### 1. Abstraction First

Every external integration MUST go through an abstraction layer. Never call external APIs directly from route handlers.

```
Route Handler → Service Layer → Integration Adapter → External API
```

**Why:** Allows swapping integrations, consistent error handling, centralized logging, and easier testing.

### 2. Workspace Isolation

All operations MUST be scoped to a specific workspace. Never allow cross-workspace data access.

```typescript
// ✅ CORRECT: Always pass workspaceId
await getWorkspaceIntegration(workspaceId, IntegrationType.MAILERLITE);

// ❌ WRONG: Global operations without workspace scope
await getMailerLiteConfig(); // Where's the workspace?
```

### 3. Event-Driven Debugging

Every meaningful state change MUST emit an event. Events are the primary debugging surface.

**DO emit:**
- `email_captured`, `lead_stage_changed`
- `mailerlite_subscribe_success/failed`
- `stripe_payment_succeeded/failed`
- `webhook_received`, `execution_blocked`

**DO NOT emit:**
- HTTP request/response details
- Full payloads
- Debug-level logs
- Retry attempts

### 4. Fail-Safe Defaults

- Webhooks return 200 on partial failures (to prevent retries)
- Logging failures never break the main flow
- Missing config returns clear errors, not crashes

---

## Directory Structure

```
app/
├── _lib/                       # Core libraries (server-only)
│   ├── integrations/           # External service adapters (10 adapters)
│   │   ├── base.ts             # Abstract base class
│   │   ├── config.ts           # Integration UI metadata
│   │   ├── mailerlite.adapter.ts
│   │   ├── stripe.adapter.ts
│   │   ├── abc-ignite.adapter.ts
│   │   ├── revline.adapter.ts
│   │   ├── resend.adapter.ts
│   │   ├── twilio.adapter.ts
│   │   ├── openai.adapter.ts
│   │   ├── anthropic.adapter.ts
│   │   └── index.ts
│   ├── workflow/               # Workflow engine
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── registry.ts         # Adapter definitions (11 adapters)
│   │   ├── engine.ts           # Core execution logic
│   │   ├── validation.ts       # Workflow config validation
│   │   ├── integration-config.ts
│   │   └── executors/          # Action executors (9 executors)
│   ├── agent/                  # AI agent engine
│   │   ├── engine.ts           # Core agent processing loop
│   │   ├── adapter-registry.ts # AI provider adapters
│   │   ├── tool-registry.ts    # Available agent tools
│   │   ├── escalation.ts       # Escalation detection
│   │   ├── pricing.ts          # Token cost calculation
│   │   ├── file-extract.ts     # Document parsing
│   │   ├── schemas.ts          # Zod schemas
│   │   └── types.ts
│   ├── booking/                # Booking system
│   │   ├── index.ts            # Booking flow orchestration
│   │   ├── get-provider.ts     # Provider resolution
│   │   ├── magic-link.ts       # Magic link tokens
│   │   └── types.ts
│   ├── reliability/            # Reliability infrastructure
│   │   ├── webhook-processor.ts
│   │   ├── idempotent-executor.ts
│   │   ├── resilient-client.ts
│   │   └── types.ts
│   ├── services/               # Business logic services
│   │   ├── capture.service.ts
│   │   ├── webhook.service.ts
│   │   ├── lead-properties.ts
│   │   └── payload-compatibility.ts
│   ├── middleware/             # Route middleware
│   │   └── rate-limit.ts
│   ├── domain/                # Custom domain verification
│   │   └── verification.service.ts
│   ├── forms/                 # Form system
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   ├── styles.ts
│   │   └── useFormState.ts
│   ├── observability/         # Metrics and monitoring
│   │   ├── metrics.ts
│   │   └── thresholds.ts
│   ├── auth.ts                # Authentication (multi-user)
│   ├── crypto.ts              # AES-256-GCM encryption
│   ├── client-gate.ts         # Workspace lookup + execution gating
│   ├── integrations-core.ts   # Low-level integration utilities
│   ├── organization-access.ts # Organization permission checks
│   ├── workspace-access.ts    # Workspace membership checks
│   ├── event-logger.ts        # Event emission
│   ├── pushover.ts            # Pushover notifications
│   ├── totp.ts                # TOTP 2FA support
│   ├── db.ts                  # Prisma client
│   └── api-paths.ts           # API path constants
├── _components/               # Shared React components
├── _config/                   # App configuration
├── (auth)/                    # Auth pages (login, setup)
├── (dashboard)/               # Protected dashboard
│   ├── workspaces/            # Workspace management
│   │   ├── [id]/              # Workspace detail + config editors
│   │   │   ├── _components/   # Workspace-specific components
│   │   │   └── workflows/     # Workflow list + editor
│   │   └── new/               # Create workspace
│   ├── settings/              # App settings
│   └── onboarding/            # Onboarding wizard
├── (sites)/                   # Site-specific layouts
├── api/v1/                    # API v1 (all versioned endpoints)
│   ├── auth/                  # Login, logout, 2FA
│   ├── organizations/         # Organization CRUD + members + templates
│   ├── workspaces/            # Workspace CRUD + agents, domain, health, events
│   ├── integrations/          # Integration CRUD + secrets, sync, models
│   ├── workflows/             # Workflow CRUD + executions + toggle
│   ├── booking/               # Booking request, create, confirm, lookup
│   ├── subscribe/             # Email capture
│   ├── forms/                 # Form endpoints
│   ├── stripe-webhook/        # Stripe webhooks
│   ├── calendly-webhook/      # Calendly webhooks
│   ├── resend-webhook/        # Resend webhooks
│   ├── twilio-webhook/        # Twilio webhooks
│   ├── cron/                  # Health check, data cleanup, ABC sync
│   ├── executions/            # Execution retry
│   └── workflow-registry/     # Available adapters
├── public/[slug]/             # Public signup flow
├── book/[workspaceSlug]/      # Booking pages
└── [landing-pages]/           # Client-facing pages (cyclic, demo, diet, fit1, semi-private)

__tests__/
├── unit/                      # Unit tests
└── integration/               # Integration tests

prisma/                        # Database schema & migrations
docs/                          # Documentation
types/                         # Global TypeScript type definitions
```

---

## Coding Standards

### TypeScript

- **Strict mode enabled** - No `any` types without explicit justification
- **Explicit return types** on all exported functions
- **Interface over type** for object shapes that may be extended
- **Const assertions** for literal types

```typescript
// ✅ CORRECT
export async function captureEmail(
  params: CaptureEmailParams
): Promise<CaptureEmailResult> {
  // ...
}

// ❌ WRONG
export async function captureEmail(params: any) {
  // ...
}
```

### Error Handling

- **Never throw raw errors** in API routes - always return structured responses
- **Catch at the boundary** - Let errors bubble up to route handlers
- **Log with context** - Include workspaceId, leadId, integration type

```typescript
// ✅ CORRECT
try {
  const result = await processWebhook(params);
  return ApiResponse.success(result);
} catch (error) {
  console.error('Webhook processing failed:', {
    workspaceId: params.workspaceId,
    error: error instanceof Error ? error.message : 'Unknown',
  });
  return ApiResponse.error('Processing failed', 500);
}

// ❌ WRONG
const result = await processWebhook(params); // Unhandled errors
return { success: true };
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `client-gate.ts` |
| Functions | camelCase | `getActiveClient()` |
| Classes | PascalCase | `MailerLiteAdapter` |
| Interfaces | PascalCase, I-prefix optional | `IntegrationConfig` |
| Enums | PascalCase | `LeadStage.CAPTURED` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_ATTEMPTS` |
| Route params | camelCase | `clientSlug` |

### Event Naming

Format: `{system}_{action}_{outcome}`

```
mailerlite_subscribe_success
stripe_payment_failed
calendly_booking_created
execution_blocked
health_status_changed
```

---

## Security Requirements

### 1. Webhook Security

All webhooks MUST:
1. Verify signatures before processing
2. Use timing-safe comparison (`crypto.timingSafeEqual`) to prevent timing attacks
3. Validate timestamp to prevent replay attacks (within 3-5 minute window)

```typescript
import { timingSafeEqual } from 'crypto';

// ✅ REQUIRED: Timing-safe signature comparison
const expectedBuffer = Buffer.from(expectedSignature, 'hex');
const providedBuffer = Buffer.from(providedSignature, 'hex');

if (expectedBuffer.length !== providedBuffer.length || 
    !timingSafeEqual(expectedBuffer, providedBuffer)) {
  await emitEvent({ eventType: 'webhook_invalid_signature', success: false });
  return ApiResponse.error('Invalid signature', 400);
}

// ❌ WRONG: Regular string comparison (vulnerable to timing attacks)
if (expectedSignature !== providedSignature) { ... }
```

### 2. Input Validation

All external input MUST be validated using Zod schemas:

```typescript
import { z } from 'zod';
import { validateBody } from '@/app/_lib/utils/validation';

// Define schema
const BookingSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  slotId: z.string().uuid(),
});

// ✅ REQUIRED: Validate with Zod in route handlers
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, BookingSchema);
  if (!validation.success) return validation.response;
  
  const { email, name, slotId } = validation.data;
  // Now type-safe and validated
}
```

For existing code, manual validators in `@/app/_lib/utils/validation` are also acceptable.

### 3. Secret Management

- **Never log secrets** - Not even partially
- **Never return secrets in responses** - Including error messages
- **Encrypt at rest** - Use `encryptSecret()` for all stored secrets
- **Decrypt in memory only** - Never persist decrypted secrets

```typescript
// ✅ CORRECT
console.log('Processing integration for client:', clientId);

// ❌ WRONG
console.log('Using API key:', apiKey.substring(0, 10) + '...');
```

### 4. Rate Limiting

Public endpoints MUST implement rate limiting:

- `/api/v1/auth/login`: 5 requests per 5 minutes per IP (strict - prevents brute force)
- `/api/v1/auth/login/verify-2fa`: 5 requests per 5 minutes per IP
- `/api/v1/subscribe`: 10 requests per minute per IP
- `/api/v1/*/webhook`: 100 requests per minute per workspace
- `/api/v1/booking/*`: 3 requests per minute per identifier

A global rate limit (100 req/min per IP) is enforced in `proxy.ts` as a safety net.

### 5. Security Headers

All responses MUST include security headers (handled by middleware):

```typescript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}
```

---

## Integration Pattern

### Adding a New Integration

1. **Create type definitions** in `app/_lib/types/index.ts`:

```typescript
export interface CalendlyMeta {
  schedulingUrls?: Record<string, string>;
  webhookSigningKey?: string;
}
```

2. **Create adapter** in `app/_lib/integrations/`:

```typescript
// calendly.ts
import { BaseIntegrationAdapter } from './base';

export class CalendlyAdapter extends BaseIntegrationAdapter {
  readonly type = IntegrationType.CALENDLY;
  
  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    // Implementation
  }
  
  async processEvent(event: CalendlyEvent): Promise<ProcessResult> {
    // Implementation
  }
}
```

3. **Add to integration registry**:

```typescript
// app/_lib/integrations/index.ts
export const integrations = {
  [IntegrationType.MAILERLITE]: MailerLiteAdapter,
  [IntegrationType.STRIPE]: StripeAdapter,
  [IntegrationType.CALENDLY]: CalendlyAdapter,
};
```

4. **Create webhook route** following the standard pattern.

5. **Wire frontend components** - See `docs/workflows/INTEGRATION-ONBOARDING.md` for full checklist.

**Critical:** The frontend requires updates in **multiple files**:
- `app/_lib/integrations/config.ts` — Integration metadata and UI config
- `app/(dashboard)/workspaces/[id]/add-integration-form.tsx` — Add integration form
- `app/(dashboard)/workspaces/[id]/integration-actions.tsx` — Edit/Configure modal
- Custom config editor components (e.g., `*-config-editor.tsx`, `*-add-config.tsx`)

Missing any wire-up causes **runtime errors** (e.g., `ReferenceError: isYourIntegration is not defined`).

---

## Testing Requirements

### Unit Tests

- All service functions must have unit tests
- Mock external dependencies
- Test error paths, not just happy paths

### Integration Tests

- Test complete flows (capture → MailerLite → event)
- Use test credentials/sandboxes
- Never test against production APIs

### Manual Testing Checklist

Before deploying any integration change:

- [ ] Test with valid input
- [ ] Test with invalid input
- [ ] Test with missing workspace
- [ ] Test with paused workspace
- [ ] Test with invalid signature (webhooks)
- [ ] Verify events are emitted correctly
- [ ] Check workspaces dashboard shows events

---

## Performance Guidelines

### Database

- **Index all foreign keys** and frequently queried columns
- **Avoid N+1 queries** - Use includes/joins
- **Paginate large results** - Never load unbounded lists

### Database Transactions

Multi-step operations MUST use transactions to ensure atomicity:

```typescript
import { withTransaction } from '@/app/_lib/utils/transaction';

// ✅ REQUIRED: Wrap related operations in a transaction
const leadId = await withTransaction(async (tx) => {
  const id = await upsertLead({ workspaceId, email, tx });
  await updateLeadStage(id, 'PAID', tx);
  await emitEvent({ workspaceId, leadId: id, ..., tx });
  return id;
});
```

Use transactions when:
- Creating a lead AND updating its stage
- Multiple database writes that must succeed together
- Any operation where partial failure would leave inconsistent state

### External APIs

- **Respect rate limits** - Log warnings when approaching limits
- **Set reasonable timeouts** - 30s max for external calls
- **Don't retry automatically** - Let the system handle failures

### Caching

- **Don't cache secrets** - Always fetch fresh
- **Cache integration metadata** - TTL 5 minutes max
- **Invalidate on updates** - Clear cache when config changes

---

## Deployment Checklist

### Before First Production Deploy

- [ ] All environment variables set
- [ ] Database migrated
- [ ] Admin account created
- [ ] Health check endpoint responding
- [ ] Alert email configured
- [ ] Cron job scheduled (external service)
- [ ] SSL/TLS configured
- [ ] Domain pointed correctly

### Before Each Deploy

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Migrations included if needed
- [ ] Environment variables added if new
- [ ] Documentation updated if behavior changed

---

## Incident Response

### When Something Breaks

1. **Check workspaces dashboard** - Recent events show what happened
2. **Check logs** - Railway logs for errors
3. **Check integrations** - Health status in workspace
4. **Pause if needed** - Stop the bleeding
5. **Fix and verify** - Don't rush
6. **Emit incident event** - For audit trail

### Common Issues

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Events not appearing | Workspace paused | Check workspace status |
| "Invalid signature" | Secret rotated | Update integration secret |
| Rate limit errors | Too many requests | Wait or upgrade plan |
| 503 responses | Workspace not found | Check slug matches |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial standards document |
| 1.1 | 2026-01 | Updated "client" → "workspace" terminology, added timing-safe comparison guidance, Zod validation, database transactions, rate limiting for auth routes |
| 1.2 | 2026-03 | Updated directory structure to reflect full codebase (agent, booking, reliability, forms, observability, domain), corrected frontend component paths to (dashboard) route group, expanded integration adapter listing |


