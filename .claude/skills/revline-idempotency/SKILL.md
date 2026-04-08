---
name: revline-idempotency
description: Use when writing or modifying schema sync, provisioning, webhook handlers, cron jobs, or anything that might be retried. Enforces upsert-over-insert and the WebhookEvent dedup pattern so operations are safe to repeat.
---

# RevLine Idempotency

In a multi-tenant system with external providers, every operation can be retried — by webhooks, by cron jobs, by Sam manually, by you re-running a script after a crash. **An operation that's not idempotent is a footgun**.

This skill triggers when you're touching anything that might run more than once on the same input.

## The principles

1. **Upsert over insert** when the natural key is known
2. **Dedup webhooks** via `WebhookEvent` records
3. **Provisioning checks existence first** (e.g., schema property addition)
4. **Cron jobs are safe to run twice**

## When to use upsert

If a record has a natural key (workspace + provider id, workspace + email, etc.), use `upsert` instead of `create`:

```typescript
// ✅ CORRECT
await prisma.lead.upsert({
  where: { workspaceId_email: { workspaceId, email } },
  create: { workspaceId, email, source: "form" },
  update: { lastSeenAt: new Date() },
});

// ❌ WRONG
await prisma.lead.create({
  data: { workspaceId, email, source: "form" },
});
//   ^ throws on the second call with the same email
```

If the schema doesn't have a unique constraint that lets you upsert, that's a sign the schema is wrong — flag it instead of working around it with try/catch.

## Webhook dedup

Inbound webhooks must dedupe via `WebhookEvent` records. The pattern lives in `app/_lib/reliability/` — read it before writing a new webhook handler.

```typescript
import { WebhookProcessor } from "@/app/_lib/reliability/webhook-processor";

const result = await WebhookProcessor.register({
  workspaceId,
  provider: "pipedrive",
  externalId: payload.event_id, // must be stable per webhook
  rawPayload: payload,
});

if (result.isDuplicate) {
  // Already processed — return 200 immediately, don't re-process
  return ApiResponse.success({ duplicate: true });
}

// ... process the webhook ...
```

The `externalId` must be:
- Stable for the same logical event (the same provider event ID, not a random UUID)
- Scoped within `workspaceId + provider` (so different workspaces don't collide)

If the provider doesn't give you a stable event ID, derive one from the content (e.g., a hash of `{type, timestamp, entity_id}`).

## Schema provisioning

Past pain: when adding a new property to `workspace.leadPropertySchema` (e.g., `pipedrivePersonId`), the provisioning code must check if the property already exists before creating it. Otherwise the second call duplicates or errors.

```typescript
// ✅ CORRECT
async function ensurePipedrivePropertyInSchema(workspaceId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { leadPropertySchema: true },
  });

  const existing = workspace?.leadPropertySchema?.find(
    (p) => p.key === "pipedrivePersonId"
  );
  if (existing) return; // already provisioned, no-op

  // ... add the property ...
}
```

Test: call the same operation twice. Verify no duplicates, no errors, no observable state change on the second call.

## Cron jobs

Cron handlers in `app/api/v1/cron/` must be safe to run multiple times in close succession (Railway might retry on failure, you might trigger one manually). Patterns:

- Use `upsert` for any state changes
- Use idempotency tokens if calling external APIs (Stripe supports `Idempotency-Key` header — use it)
- Track last-run timestamps so you don't reprocess events you've already handled

## Reference code

- `app/_lib/reliability/` — webhook-processor, idempotent executor, correlation IDs
- `app/_lib/services/` — search for `upsert` patterns in existing services
- `app/api/v1/pipedrive-webhook/route.ts` — reference webhook handler with dedup

## Audit checklist

What `standards-auditor` looks for:

- [ ] New webhook routes use `WebhookProcessor.register()` for dedup
- [ ] New leads/integrations use `upsert` not `create` when there's a natural key
- [ ] Schema provisioning checks existence first
- [ ] Cron handlers can be re-run without side effects
- [ ] External API calls that mutate state use idempotency keys when the provider supports them

## Anti-patterns to flag

- A new webhook route that doesn't use `WebhookProcessor`
- `prisma.lead.create({ data: { workspaceId, email } })` when there's a unique constraint on `(workspaceId, email)`
- Schema provisioning that does `array.push(newProperty)` without checking for existence first
- A cron handler that processes events without tracking what it's already processed
- A try/catch that swallows "already exists" errors as a substitute for upsert (this is a smell — fix the schema or use upsert)
