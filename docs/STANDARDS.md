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

### 2. Client Isolation

All operations MUST be scoped to a specific client. Never allow cross-client data access.

```typescript
// ✅ CORRECT: Always pass clientId
await getClientIntegration(clientId, IntegrationType.MAILERLITE);

// ❌ WRONG: Global operations without client scope
await getMailerLiteConfig(); // Where's the client?
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
├── _lib/                    # Core libraries (server-only)
│   ├── types/               # Shared type definitions
│   │   └── index.ts         # Central type exports
│   ├── services/            # Business logic services
│   │   ├── lead.service.ts
│   │   └── capture.service.ts
│   ├── integrations/        # External service adapters
│   │   ├── base.ts          # Abstract base class
│   │   ├── mailerlite.ts
│   │   ├── stripe.ts
│   │   └── calendly.ts
│   ├── middleware/          # Route middleware
│   │   ├── rate-limit.ts
│   │   ├── validate.ts
│   │   └── security.ts
│   ├── utils/               # Pure utility functions
│   │   ├── crypto.ts
│   │   ├── api-response.ts
│   │   └── validation.ts
│   ├── auth.ts              # Authentication
│   ├── client-gate.ts       # Client lookup + execution gating
│   ├── db.ts                # Prisma client
│   └── event-logger.ts      # Event emission
├── _components/             # Shared React components
├── admin/                   # Admin dashboard (internal only)
├── api/                     # API routes
│   └── v1/                  # API v1 (all versioned endpoints)
│       ├── subscribe/       # Lead capture endpoint
│       ├── stripe-webhook/  # Stripe webhooks
│       ├── calendly-webhook/# Calendly webhooks
│       ├── cron/            # Scheduled tasks
│       └── admin/           # Admin API routes
└── [landing-pages]/         # Client-facing pages
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
- **Log with context** - Include clientId, leadId, integration type

```typescript
// ✅ CORRECT
try {
  const result = await processWebhook(params);
  return ApiResponse.success(result);
} catch (error) {
  console.error('Webhook processing failed:', {
    clientId: params.clientId,
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

All webhooks MUST verify signatures before processing:

```typescript
// ✅ REQUIRED: Verify before any processing
const isValid = await verifyWebhookSignature(payload, signature, secret);
if (!isValid) {
  await emitEvent({ eventType: 'webhook_invalid_signature', success: false });
  return ApiResponse.error('Invalid signature', 400);
}
```

### 2. Input Validation

All external input MUST be validated:

```typescript
// ✅ REQUIRED: Validate all inputs
const validated = validateCaptureInput(body);
if (!validated.success) {
  return ApiResponse.error(validated.error, 400);
}
```

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

- `/api/v1/subscribe`: 10 requests per minute per IP
- `/api/v1/*/webhook`: 100 requests per minute per client

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
- `app/_lib/integrations/config.ts` - Integration metadata
- `app/admin/clients/[id]/add-integration-form.tsx` - Add form
- `app/admin/clients/[id]/integration-actions.tsx` - Edit/Configure modal
- Custom config editor components

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
- [ ] Test with missing client
- [ ] Test with paused client
- [ ] Test with invalid signature (webhooks)
- [ ] Verify events are emitted correctly
- [ ] Check admin dashboard shows events

---

## Performance Guidelines

### Database

- **Index all foreign keys** and frequently queried columns
- **Avoid N+1 queries** - Use includes/joins
- **Paginate large results** - Never load unbounded lists

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

1. **Check admin dashboard** - Recent events show what happened
2. **Check logs** - Railway logs for errors
3. **Check integrations** - Health status in admin
4. **Pause if needed** - Stop the bleeding
5. **Fix and verify** - Don't rush
6. **Emit incident event** - For audit trail

### Common Issues

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Events not appearing | Client paused | Check client status |
| "Invalid signature" | Secret rotated | Update integration secret |
| Rate limit errors | Too many requests | Wait or upgrade plan |
| 503 responses | Client not found | Check slug matches |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial standards document |


