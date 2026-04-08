---
description: Draft a new implementation plan in docs/plans/ from the template, then stop for review
argument-hint: <feature description>
---

You are running `/plan` for: $ARGUMENTS

Sam's workflow is **plan → implement → audit**. Your job in this command is the *plan* phase only. Do not write code, do not run builds, do not start implementation.

## Steps

1. **Convert the feature description into an UPPERCASE-WITH-HYPHENS slug.** Examples:
   - "add hubspot adapter" → `HUBSPOT-ADAPTER`
   - "fix webchat token leak" → `FIX-WEBCHAT-TOKEN-LEAK`
   - "rate limit per workspace" → `RATE-LIMIT-PER-WORKSPACE`

2. **Check `docs/plans/` and `docs/plans/archive/` for an existing plan with that slug.** If one exists, stop and ask Sam whether to overwrite, branch, or pick a new slug.

3. **Read these references before drafting** (so the plan is grounded, not invented):
   - `docs/STANDARDS.md` — the rules every plan must comply with
   - `CLAUDE.md` — architecture overview
   - `docs/plans/_template.md` — the structure to follow
   - Any files the feature obviously touches (read them, don't guess)

4. **If scope is unclear, ask Sam 1–3 focused questions** before drafting. Canonical clarifications: public URL vs localhost, which workspace, sync vs async, db:push vs migration, hot path vs background. Don't ask trivial questions, but don't silently assume on ones that change the design.

5. **Draft the plan** at `docs/plans/{SLUG}.md` using `docs/plans/_template.md` as the structure. Fill in every section. Do not leave placeholders unless you genuinely don't have enough information — in which case ask.

6. **Hard rules for the draft:**
   - Concrete file paths in the "File-by-file changes" section. No vague "various files."
   - Standards checklist: tick boxes only for rules you've actually verified the plan complies with. Don't blanket-tick.
   - Todos must be sequential, single-responsibility, and small enough that each one can be marked completed in one pass.
   - Verification section must be concrete enough that someone else could run it.

7. **Stop. Print:**
   ```
   Plan written: docs/plans/{SLUG}.md
   Review it. When ready, run /implement docs/plans/{SLUG}.md
   ```

## Do NOT

- Do not start implementation. Even if Sam's prompt sounds urgent.
- Do not modify any file other than the new plan file.
- Do not run `npm run build`, `npm run test`, or any non-read-only command.
- Do not auto-approve the plan. The gate between plan and implement is where Sam's judgment lives.
