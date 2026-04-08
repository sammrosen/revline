---
name: revline-testing
description: Use when writing or modifying tests, or when changing service/adapter code that should have test coverage. Enforces use of __tests__/setup.ts helpers, the isolated-DB pattern, and error-path coverage.
---

# RevLine Testing

RevLine uses Vitest with isolated databases per worker. Tests are real — they hit a real Postgres instance, not mocks. This is intentional: past pain showed that mock/prod divergence masked real bugs (broken migrations, missing indexes, workspace leaks).

This skill triggers when you're writing tests or when you change code that should have test coverage.

## The setup

- Tests live in `__tests__/`
- `__tests__/globalSetup.ts` provisions an isolated database per Vitest worker (`test_db_0`, `test_db_1`, etc.) at the start of the run
- `__tests__/setup.ts` exports test helpers — use them, don't roll your own
- `TEST_DATABASE_URL` must be set in `.env.local` or env
- Run a single test file: `npx vitest run __tests__/unit/crypto.test.ts`
- Run all tests: `npm run test`
- Watch mode: `npm run test:watch`

## Helpers in `__tests__/setup.ts`

Always use these instead of constructing raw Prisma data:

- `createTestWorkspace()` — creates a workspace with sane defaults
- `createTestIntegration()` — creates a `WorkspaceIntegration` with valid encrypted secrets
- `createTestLead()` — creates a `Lead` scoped to a workspace
- (others — read the file before assuming)

These helpers handle the multi-tenant scoping correctly. Skipping them is a common source of flaky tests.

## What to test

### Always test

- **Happy path** — the operation succeeds with valid input
- **Error paths** — invalid input, missing config, paused workspace, wrong workspace, network failure
- **Workspace isolation** — set up TWO workspaces, verify operations on workspace A don't affect workspace B
- **Idempotency** — call the operation twice with the same input, verify no duplicates and no errors
- **Event emission** — for state changes, verify the expected event was emitted with the expected metadata

### Don't bother testing

- Pure framework code (Next.js routing, Prisma client behavior)
- Generated code (Prisma client types)
- Trivial getters

## The error-path rule

From `docs/STANDARDS.md`:

> Test error paths, not just happy paths.

Sam will reject a service with no error tests. The minimum bar:

```typescript
describe("captureLead", () => {
  it("captures with valid input", async () => { ... });
  it("rejects invalid email", async () => { ... });
  it("returns clear error when workspace is paused", async () => { ... });
  it("doesn't leak across workspaces", async () => {
    const wsA = await createTestWorkspace();
    const wsB = await createTestWorkspace();
    await captureLead({ workspaceId: wsA.id, email: "x@y.com" });
    const leadsB = await prisma.lead.findMany({ where: { workspaceId: wsB.id } });
    expect(leadsB).toHaveLength(0);
  });
});
```

## Adapter testing

For new integration adapters:

- Unit test pure transforms (field mapping, payload shaping) — no DB, no network
- Integration test `validateConfig()` against the real provider with test credentials (gated behind `SKIP_EXTERNAL_TESTS=1` if needed for CI)
- Test error classification: 401 → `retryable: false`, 429 → `retryable: true, retryAfterMs: ...`, 5xx → `retryable: true`

## Test file naming

- `__tests__/unit/<thing>.test.ts` for pure logic
- `__tests__/integration/<thing>.test.ts` for things that hit the DB or external services
- Match the file under test where reasonable

## What `standards-auditor` checks

- [ ] New service functions have at least happy-path + one error-path test
- [ ] New adapters have a test for `validateConfig()`
- [ ] Tests use `createTestWorkspace()` etc., not raw Prisma inserts
- [ ] Workspace isolation tests exist for any cross-tenant-risky code
- [ ] No `.skip` or `.only` left in test files
- [ ] No mocked Prisma — tests hit the real isolated DB

## Anti-patterns to flag

- `vi.mock('@/app/_lib/db')` — mocking Prisma defeats the isolated-DB pattern
- A test that only covers the happy path
- Tests that share state between workspaces
- A new service shipped without any tests
- `.only` left in a committed file
- Hardcoded test data with random IDs that drift across runs (use the helpers)
