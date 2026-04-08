# Pipedrive Phase 3 — Custom Stage Fix + Prod Sandbox Deploy

> **INTENDED LOCATION:** `docs/plans/PIPEDRIVE-PHASE-3-STAGE-FIX.md`. First implementation step: move the plan into `docs/plans/`.

## Context

Phase 3 just shipped (deals, pipelines, 4 deal webhook triggers, config editor UI). During review we found one bug: the new "Pipelines & Stages" section in `pipedrive-config-editor.tsx` renders stage-map rows from a **hardcoded array** `['CAPTURED', 'ENGAGED', 'QUALIFIED', 'BOOKED', 'PAID']` at line 980, ignoring the workspace's actual custom stages stored in `workspace.leadStages` (JSON on the Workspace model at `prisma/schema.prisma:87`). That field is the canonical source of truth — every workspace can customize its stage list (default is `CAPTURED/BOOKED/PAID/DEAD`). Two of the hardcoded keys (`ENGAGED`, `QUALIFIED`) don't even exist in the default set.

Fix + deploy to Sam's sandbox workspace on Railway so he can run the end-to-end demo against real Pipedrive.

## Goals

- **G1.** Stage map UI in `pipedrive-config-editor.tsx` renders one row per entry in `workspace.leadStages`, falling back to `DEFAULT_LEAD_STAGES` only if the field is empty.
- **G2.** `/audit` runs clean on the full branch diff.
- **G3.** Branch pushed, PR opened against `main`.
- **G4.** Prod DB on Railway migrated (`20260408000000_add_pipedrive_enum` applies cleanly).
- **G5.** Sam can run the manual E2E flow from PIPEDRIVE-PHASE-3.md against his sandbox workspace.

## Non-goals

- Touching `LeadStage` Prisma enum. There is no such enum — `leadStages` is already a JSON field, so no schema changes needed.
- Backfilling custom stage keys for existing workspaces. Default JSON is already set at the column level.
- Any change to person-event handling, deal adapter methods, executors, registry, or tests. Scoped strictly to the UI stage-list source.

## Standards check

- [x] **Workspace isolation** — route already scopes by `workspaceId`; adding `leadStages` to the response is read-from-same-row.
- [x] **No engine leakage** — UI-only fix + one route field addition.
- [x] **Input validation** — validate `leadStages` shape with a small Zod schema on the route response side.
- [x] **Fail-safe defaults** — if `workspace.leadStages` is malformed or empty, fall back to `DEFAULT_LEAD_STAGES` from `app/_lib/types/index.ts`.
- [x] **Idempotent deploy** — the only prod-touching step is `prisma migrate deploy`, which is idempotent; the enum migration is `ADD VALUE IF NOT EXISTS` (additive, non-blocking).

## File-by-file changes

- **`app/api/v1/integrations/[id]/pipedrive-pipelines/route.ts`** — Include `workspace.leadStages` in the workspace fetch (select it alongside whatever's already selected) and add it to the response payload as `leadStages: Array<{key, label, color}>`. Validate shape with Zod before returning; fall back to `DEFAULT_LEAD_STAGES` on parse failure.

- **`app/(dashboard)/workspaces/[id]/pipedrive-config-editor.tsx`** — At line 980, replace the hardcoded `LEAD_STAGES` array with a derived list pulled from the `/pipedrive-pipelines` response. Store the list alongside pipelines in the existing pipelines-state hook. Row rendering iterates `leadStages.map(s => <row key={s.key} label={s.label} ...>)`. If the route response omits `leadStages` (old cached response), fall back to `DEFAULT_LEAD_STAGES` imported from `app/_lib/types`.

## Destructive-prod check

Everything on this branch is **additive**. No renames, no column drops, no data backfills, no workflow schema changes.

**Migration risk (`20260408000000_add_pipedrive_enum`)**:
```sql
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'PIPEDRIVE';
ALTER TYPE "EventSystem" ADD VALUE IF NOT EXISTS 'PIPEDRIVE';
```
- `ADD VALUE` on a Postgres enum does NOT rewrite rows or rebuild indexes — O(1).
- `IF NOT EXISTS` makes it safe to re-run.
- Postgres < 12 cannot run `ADD VALUE` inside a transaction; Railway runs PG 15/16, which Prisma Migrate handles by committing each enum alter standalone.
- No existing rows reference `PIPEDRIVE` today (since there was no migration, no writes succeeded), so there is zero dependency fallout.

**UI risk**: The config editor already stopped rendering the old free-text stage-map editor when Phase 3 landed. Any workspace that had pre-Phase-3 `meta.stageMap` entries keyed by e.g. `DEAD` was already silently dropped from the dropdown UI (DEAD wasn't in the hardcoded list). This fix actually **restores** visibility for those entries by reading real workspace stages. Net-positive for the sandbox and prod workspaces.

**Existing person-event webhook path**: The webhook route was refactored to share `findRecentLeadByPipedriveId` between person and deal branches. Person tests still pass (447/447 green). No behavioral change.

## Deploy / E2E sequence

Post-implementation, execute in this order:

1. **Audit** — run `standards-auditor` subagent on the branch diff. Fix any blockers (should be none — previous audit was clean after the workspace-isolation fix).
2. **Lint/typecheck/test** — `npm run type-check && npm run lint && npm run test`. Must be green.
3. **Commit** — single commit on `adapter/pipedrive`. Include unplanned enum migration in the commit message with a note that it's additive schema-drift repair.
4. **Push** — `git push -u origin adapter/pipedrive`.
5. **Open PR** — `gh pr create` against `main`. Body: reference `docs/plans/PIPEDRIVE-PHASE-3.md`, call out the enum migration explicitly, paste the Destructive-prod check section verbatim.
6. **Prod migrate** — after PR merges (or optionally via a Railway preview env first), Railway auto-runs `prisma migrate deploy` on deploy. Sam confirms the migration applies cleanly in the Railway deploy logs before testing.
7. **Sandbox E2E** — Sam runs the manual E2E flow from PIPEDRIVE-PHASE-3.md's Verification section against his prod sandbox workspace (custom stages now rendering correctly in the stage-map UI).

## Clarifications (resolved)

- ✅ Enum migration bundled in this PR (additive + idempotent).
- ✅ Testing target = normal prod app + Sam's designated sandbox workspace.
- ✅ `ENGAGED`/`QUALIFIED` are only referenced by the hardcoded array at `pipedrive-config-editor.tsx:980` — nothing else in the codebase uses those keys. Safe to drop entirely and source rows from `workspace.leadStages`. No "custom/advanced" fallback needed for non-leadStages keys.

## Verification

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (447+, no regressions)
- [ ] `/audit` reports clean
- [ ] Config editor: open a workspace with custom `leadStages`, click "Sync Pipelines", verify one row per custom stage (not the hardcoded 5)
- [ ] Config editor: workspace with default `leadStages` (CAPTURED/BOOKED/PAID/DEAD) renders 4 rows, not 5
- [ ] Railway deploy logs show `20260408000000_add_pipedrive_enum` applied successfully
- [ ] Sandbox E2E: submit landing-page form → person + deal in Pipedrive, `pipedrivePersonId` + `pipedriveDealId` on lead
- [ ] Sandbox E2E: move a deal in Pipedrive → `deal_updated` trigger fires a workflow → SMS received
- [ ] Sandbox E2E: mark deal won → `deal_won` fires, `deal_updated` does NOT

## Todos

- [ ] **0.** Move plan to `docs/plans/PIPEDRIVE-PHASE-3-STAGE-FIX.md`.
- [ ] **1.** Extend `pipedrive-pipelines/route.ts` to return workspace `leadStages`.
- [ ] **2.** Update `pipedrive-config-editor.tsx` to render stage rows from workspace leadStages with DEFAULT_LEAD_STAGES fallback.
- [ ] **3.** Run `npm run type-check && npm run lint && npm run test`. Fix anything red.
- [ ] **4.** Run `/audit` on branch diff. Fix any blockers.
- [ ] **5.** Commit (single commit, descriptive message including enum migration note).
- [ ] **6.** Push branch.
- [ ] **7.** Open PR against `main` with the Destructive-prod check section in the body.
- [ ] **8.** Wait for Sam to confirm merge + Railway deploy succeeded.
- [ ] **9.** Sam runs sandbox E2E from the Verification section.
