---
name: revline-integration-adapter
description: Use when editing files under app/_lib/integrations/, app/_lib/workflow/registry.ts, app/_lib/workflow/engine.ts, or anywhere integration logic might leak. Enforces the abstraction boundary so per-integration code stays in adapters and never in core.
---

# RevLine Integration Adapter Pattern

This skill triggers when you're touching integration adapters or core workflow code. The goal is to prevent integration-specific logic from leaking into shared modules.

## The rule

Per `docs/STANDARDS.md` §1 ("Abstraction First"):

> Every external integration MUST go through an abstraction layer. Never call external APIs directly from route handlers.
>
> `Route Handler → Service Layer → Integration Adapter → External API`

The flip side of this rule, learned the hard way: **per-integration logic must NEVER live in core modules**.

Past pain: `logPipedriveActivity()` was hardcoded into `app/_lib/workflow/engine.ts`. The moment you add HubSpot or Salesforce, you'd add another hardcoded line. That's not a registry, that's a pile of special cases. Sam will reject this pattern in audit.

## Where things belong

| Concern | Lives in | Does NOT live in |
|---|---|---|
| Per-provider HTTP calls | `{name}.adapter.ts` | services, routes, engine.ts, registry.ts |
| Per-provider field mappings | `{name}.adapter.ts` or `app/_lib/integrations/config.ts` | core types, engine.ts |
| Per-provider event types | adapter or its executor | engine.ts |
| Per-provider webhook parsing | `app/api/v1/{name}-webhook/route.ts` | shared route handlers |
| Trigger/action definitions | `app/_lib/workflow/registry.ts` (declarative entry only) | engine.ts |
| Workflow execution loop | `app/_lib/workflow/engine.ts` | adapters |
| "After SMS sent, log to CRM" hooks | A registered post-send hook in the adapter | engine.ts directly |

If you find yourself writing `if (integrationType === 'PIPEDRIVE')` in `engine.ts` or any other shared module, **stop**. The right move is to add a hook or callback to the adapter interface and let the registry iterate adapters.

## Reference adapter

`app/_lib/integrations/pipedrive.adapter.ts` is the canonical pattern. When building or reviewing an adapter, compare against it. Pipedrive uses:

- `static forWorkspace(workspaceId)` factory (older adapters use `.forClient()` — use `.forWorkspace()` for new code)
- A custom `request<T>()` method with retry headers, timeout (30s), abort controller, and rate-limit parsing
- `IntegrationResult<T>` return type with `{ success, data, error, retryable, retryAfterMs }` for every public method
- `validateConfig()` that makes a real test API call (e.g., `/users/me`) at config time
- Webhook secrets stored in `meta` (config), API tokens stored in encrypted `secrets`
- Field key cache in meta to avoid repeated API calls for field discovery

Older adapters (Stripe, Resend, Twilio, MailerLite) predate this pattern. They mix concerns and use SDKs directly. **Don't copy from them** unless you're matching an existing pattern in that specific adapter.

## The 8–9 file checklist (when adding a new integration)

For a full new adapter, you must touch all of these. Missing any one causes runtime errors like `ReferenceError: isYourIntegration is not defined`.

1. **`prisma/schema.prisma`** — add the integration name to the `IntegrationType` enum
2. **`app/_lib/types/index.ts`** — define `{Name}Meta` interface, add to `IntegrationMeta` union, write `is{Name}Meta()` type guard
3. **`app/_lib/integrations/config.ts`** — add to `INTEGRATION_TYPES` array and full config object to `INTEGRATIONS` record (secrets, metaTemplate, metaFields, tips, warnings)
4. **`app/_lib/integrations/{name}.adapter.ts`** — extends `BaseIntegrationAdapter<{Name}Meta>`, implements `static forWorkspace()`, defines secret constants, implements public ops returning `IntegrationResult<T>`
5. **`app/_lib/integrations/index.ts`** — export adapter class and public types
6. **`app/_lib/workflow/registry.ts`** — `ADAPTER_DEFINITION` with triggers and actions, register in `ADAPTER_REGISTRY`
7. **`app/api/v1/{name}-webhook/route.ts`** — webhook handler if event-driven (validate source, register with `WebhookProcessor` for dedup, verify signature with `timingSafeEqual`, replay window check, emit trigger via `emitTrigger`, always return 200)
8. **`app/(dashboard)/workspaces/[id]/`** — config editor component + wire it into `add-integration-form.tsx` and `integration-actions.tsx`
9. **`app/_lib/workflow/executors/{name}.ts`** — outbound action executors (optional, only if the integration has workflow actions)

The full step-by-step is in `docs/workflows/INTEGRATION-ONBOARDING.md`. Read that, don't reinvent the order.

## Prisma migration

After step 1, run `npm run db:migrate -- --name add_{integration}_type` to generate a numbered migration. Don't `db:push` for enum changes — they need a real migration.

## Testing

- Unit tests for adapter methods that have pure logic (field mapping, payload transforms)
- Integration test for `validateConfig()` against the real API (with test credentials)
- Manual webhook test with the provider's signing key, ideally via ngrok if local
- Verify events show up in the dashboard Events tab after each operation

## Audit checklist

What `standards-auditor` checks on integration changes:

- [ ] All 8–9 touch-points present (no missing files)
- [ ] No `if (integrationType === ...)` special cases in `engine.ts` or other core modules
- [ ] Adapter extends `BaseIntegrationAdapter` and uses `forWorkspace()`
- [ ] Public ops return `IntegrationResult<T>`
- [ ] `validateConfig()` makes a real test call
- [ ] Webhook routes use `timingSafeEqual` and replay window check
- [ ] Webhook routes return 200 even on partial failure
- [ ] Workspace isolation: every Prisma query in the adapter scoped to workspaceId
- [ ] Events emitted on every meaningful state change with proper metadata (see `revline-event-logging` skill)
- [ ] Secrets stored encrypted, accessed via `getSecret()`, never logged

## Anti-patterns to flag

- `import { ... } from '../integrations/pipedrive'` inside `engine.ts` — leak
- `if (integration.type === 'PIPEDRIVE') { logPipedriveActivity(...) }` in core — leak
- New adapter without `validateConfig()` — incomplete
- New adapter that uses `fetch()` directly instead of a `request<T>()` helper — drift from Pipedrive pattern
- Webhook route that compares signatures with `===` — security blocker
- Webhook route that returns non-200 on partial failure — provider retry storm
- New integration where the dashboard form doesn't have the conditional editor — `ReferenceError` waiting to happen
