# FIX-PRE-PUSH-TEST-FAILURES

## Context

The husky `pre-push` hook (newly installed) caught 6 test failures on `adapter/pipedrive` when pushing the Claude Code automation commit. The failures are pre-existing and unrelated to the automation work — they were already broken on this branch and slipped through because no one was running `npm run pre-push` locally before pushing.

There are **three distinct issues** behind the 6 reported failures:

1. **Stale test assertion in `agent-schemas.test.ts`** — `CreateAgentSchema.rateLimitPerHour` was raised from `10` to `60` in `app/_lib/agent/schemas.ts:51`, but the unit test still asserts `10`. This is consistent with the transcript-documented decision that 10 msgs/hour was "way too low."

2. **Behavior drift in `agent-engine.test.ts`** — The test mocks `chatCompletion` to return the canned string `'Hello! How can I help you today?'`, but `handleInboundMessage` now returns `'Just so you know, I'm an AI assistant for Engine Test Bot. How can I help you today?'`. Something downstream of the AI mock is prepending an "I'm an AI" disclosure. Need to find what's doing it and decide whether the prefix is intentional (compliance / consent) — then either update the test to expect it, or remove the prefix.

3. **Vitest is running tests from `.claude/worktrees/sweet-cori/__tests__/`** — that's the embedded worktree from a separate Claude Code session. It pollutes results, doubles run time, and causes 4 of the 6 reported failures (mirrors of the main-repo issues plus 2 capture-service tests that only exist on that worktree branch). Fix: add `.claude/**` to the vitest exclude list.

## Goals

- `npm run pre-push` exits 0 on `adapter/pipedrive` so the husky hook stops blocking pushes
- Test suite reflects the actual current behavior of `app/_lib/agent/schemas.ts` and the agent engine
- Vitest runs only tests from this repo, not from embedded Claude Code worktrees

## Non-goals

- No changes to agent runtime behavior unless investigation in Issue #2 finds the disclosure prefix is a bug
- No changes to the schema defaults (60/hr is intentional per the rate-limit transcripts)
- No changes to the worktree contents — only the vitest config that picks them up
- Not fixing any other failing or flaky tests outside the 3 issues above

## Standards check

- [x] **Workspace isolation** — N/A, no Prisma queries changed
- [x] **Event-driven debugging** — N/A, no event emission changed
- [x] **Abstraction first** — N/A, no integration logic moved
- [x] **Fail-safe defaults** — N/A
- [x] **Input validation** — Issue #1 confirms an existing Zod default; no new validation introduced
- [x] **Error handling** — N/A
- [x] **Idempotency** — N/A
- [x] **Foreign key indexes** — N/A
- [x] **Webhook security** — N/A

## File-by-file changes

- `__tests__/unit/agent-schemas.test.ts:38` — change assertion from `expect(result.rateLimitPerHour).toBe(10)` to `expect(result.rateLimitPerHour).toBe(60)`. Reason: schema source-of-truth (`app/_lib/agent/schemas.ts:51`) defines the default as `60`.

- `app/_lib/agent/engine.ts` (read-only investigation first, then possibly modify) **OR** `__tests__/unit/agent-engine.test.ts` (update assertion):
  - Step 1: grep `app/_lib/agent/` for the string `"Just so you know"` and `"I'm an AI assistant"` to find where the prefix is added
  - Step 2: read the surrounding code to determine if it's a deliberate disclosure (probably under a config flag like `requireAiDisclosure` or `complianceMode`) or a bug
  - Step 3: if intentional, update the test's `CANNED_AI_RESPONSE` expectation OR change the test assertion at `agent-engine.test.ts:121` to use a `toContain('How can I help you today?')` partial match. Also update the corresponding messages assertion at lines 130–135 if needed.
  - Step 4: if NOT intentional, fix the code that adds the prefix and document why in the commit message
  - **Also check `agent-engine.test.ts:121` and any other places in the file that assert on `replyText` or message content** — there may be related broken assertions

- `vitest.config.ts` — add `exclude` to the `test` config:
  ```ts
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.claude/**',
  ]
  ```
  Reason: the default exclude doesn't cover `.claude/worktrees/`. Adding `**/.claude/**` is the surgical fix; the other entries are vitest defaults that we have to re-state once we override.

## Risks

- **Issue #2 unknown root cause.** If the AI disclosure prefix is being added by the agent engine itself (not by a guardrail or middleware), changing the test to match it codifies behavior that may need to be different in the future. Mitigation: investigate first, document the decision in the commit, prefer `toContain` partial matching over exact match if the disclosure is variable.

- **Removing the disclosure (if it turns out to be a bug)** could affect production agent responses. Mitigation: if the investigation lands here, escalate to Sam before changing — this is a runtime behavior change and deserves its own decision.

- **Vitest exclude could accidentally exclude legitimate tests** if the path globs are wrong. Mitigation: keep the exclude list narrow (`**/.claude/**`), confirm by running `npm run test` and verifying the test file count goes from 44 to 39 (or whatever the main-repo-only count is).

- **Production impact: zero.** Issues #1 and #3 touch test files and config only. Issue #2 might touch agent runtime if root-cause is in production code, but the plan stops to ask Sam in that case.

## Verification

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run test` passes — specifically `__tests__/unit/agent-schemas.test.ts` and `__tests__/unit/agent-engine.test.ts`
- [ ] Test file count is reduced (no more `.claude/worktrees/sweet-cori/__tests__/...` in the run output)
- [ ] `npm run pre-push` exits 0
- [ ] `git push` succeeds without `--no-verify`
- [ ] If Issue #2 required code changes: spot-check by running the agent locally (or via the dashboard test chat) and confirming the disclosure behavior matches the new test expectations
- [ ] `/audit` reports clean against the branch

## Todos

- [ ] Read `vitest.config.ts` again, add the `exclude` block, run `npm run test 2>&1 | head -20` to confirm the test file count drops
- [ ] Update `__tests__/unit/agent-schemas.test.ts:38` assertion from `10` to `60`
- [ ] Investigate the AI disclosure prefix: grep for the literal string `"I'm an AI assistant"` across `app/_lib/agent/`, read the file that contains it, determine if it's behind a flag or unconditional
- [ ] **CHECKPOINT — report findings to Sam before proceeding.** If the prefix is intentional, propose the test update. If it's a bug, propose the code fix. Wait for Sam's go-ahead.
- [ ] Apply the agreed fix from the previous step
- [ ] Run `npm run test` and confirm `agent-schemas` and `agent-engine` tests pass
- [ ] Run `npm run pre-push` end-to-end and confirm exit 0
- [ ] Commit with a clear message linking back to this plan
- [ ] Push without `--no-verify`
