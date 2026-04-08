---
name: revline-workspace-isolation
description: Use whenever editing Prisma queries, services in app/_lib/services/, route handlers in app/api/, or anything that touches workspace-scoped data. Enforces that every query is scoped to workspaceId — non-negotiable in this multi-tenant codebase.
---

# RevLine Workspace Isolation

RevLine is multi-tenant. Every workspace gets isolated leads, events, integrations, agents, and conversations. **Cross-workspace data leaks are the worst class of bug** — a customer seeing another customer's data is a P0 incident.

This skill triggers any time you touch a Prisma query, a service function, or a route handler. The rule is simple but absolute: every query is scoped to `workspaceId`.

## The rule (from `docs/STANDARDS.md` §2)

> All operations MUST be scoped to a specific workspace. Never allow cross-workspace data access.

```typescript
// ✅ CORRECT
await getWorkspaceIntegration(workspaceId, IntegrationType.MAILERLITE);

// ❌ WRONG
await getMailerLiteConfig(); // Where's the workspace?
```

## What to check

### Prisma queries

Every `findMany`, `findFirst`, `findUnique`, `update`, `delete`, `count`, `aggregate`, `groupBy` MUST include `workspaceId` in the `where` clause — directly, or via a unique constraint that includes it.

```typescript
// ✅ CORRECT
const lead = await prisma.lead.findFirst({
  where: { workspaceId, email },
});

// ✅ CORRECT (composite unique includes workspaceId)
const config = await prisma.phoneConfig.findUnique({
  where: { workspaceId_twilioNumberKey: { workspaceId, twilioNumberKey } },
});

// ❌ WRONG
const lead = await prisma.lead.findFirst({ where: { email } });
//   ^ this can return a lead from ANY workspace
```

`create` and `createMany` must include `workspaceId` in the data. `upsert` must include it in both `where` and `create`.

### Service functions

Every function in `app/_lib/services/` that touches workspace-scoped data MUST take `workspaceId` as a required (not optional) parameter. If the function reads it from a session or context object, the function passing it must have already validated the workspace.

```typescript
// ✅ CORRECT
export async function captureLead(params: {
  workspaceId: string;
  email: string;
  source: string;
}): Promise<CaptureResult> { ... }

// ❌ WRONG
export async function captureLead(params: {
  email: string;
  source: string;
}): Promise<CaptureResult> { ... }
```

### Route handlers

Routes under `app/api/v1/` resolve a workspace via `app/_lib/client-gate.ts` (look at `getWorkspaceFromRequest` or similar) at the top of the handler, then pass `workspaceId` down. Routes that don't resolve a workspace must be admin-only or explicitly global (very rare — proxy.ts and the auth routes are the main exceptions).

### Tests

Tests should use `createTestWorkspace()` from `__tests__/setup.ts` and pass `workspaceId` through to the code under test. Never bypass workspace scoping in tests just to make a test pass — that hides the bug you're testing for.

## Reference code

- `app/_lib/client-gate.ts` — workspace lookup + execution gating
- `app/_lib/services/` — scan any service file for the parameter pattern
- `app/_lib/db.ts` — singleton Prisma client
- `__tests__/setup.ts` — `createTestWorkspace`, `createTestIntegration`, `createTestLead` helpers

## Audit checklist

What `standards-auditor` checks on Prisma/service/route changes:

- [ ] Every Prisma query has `workspaceId` in `where` (or via composite unique)
- [ ] Every service function takes `workspaceId` as a required parameter
- [ ] Route handlers resolve workspace via `client-gate.ts` before doing anything else
- [ ] No `prisma.<model>.findMany()` without a where clause
- [ ] No global queries dressed up as "system-level" without explicit justification

## Anti-patterns to flag

- `prisma.lead.findMany({ where: { email } })` — missing workspaceId
- `prisma.integration.findFirst({ where: { type: 'MAILERLITE' } })` — missing workspaceId
- A service function without `workspaceId` in its params
- A route handler that fetches data before calling `client-gate.ts`
- A migration that adds a new model without a `workspaceId` column on workspace-scoped data
