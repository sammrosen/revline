---
description: Run the standards-auditor subagent against the current branch diff
argument-hint: [--base main | --staged | <file-path>]
---

Run a standards audit against: $ARGUMENTS (default: diff vs `origin/main`)

## What to do

1. **Determine the diff scope:**
   - No args, or `--base <branch>` → `git diff <branch>...HEAD` (default `origin/main`)
   - `--staged` → `git diff --cached`
   - A file path → audit just that file against `docs/STANDARDS.md`

2. **Delegate to the `standards-auditor` subagent.** Pass it the diff scope and any context it needs. Do not run the audit checks yourself in the main thread — the subagent has its own context window for reading STANDARDS.md, the changed files, and the schema simultaneously.

3. **Format and return the report inline.** Group findings by severity:
   - **Blockers** — things that must be fixed before merge (workspace isolation breaks, missing event emission, integration logic in core, raw error throws in routes)
   - **Warnings** — things Sam should know about but can decide on (missing return types on exports, weak metadata in events)
   - **Nits** — style and consistency suggestions

4. **For each finding, include:**
   - File and line number (`file_path:line`)
   - The rule from STANDARDS.md being violated (quote it, don't paraphrase)
   - A specific suggested fix

5. **Do not auto-fix.** The audit's value is that Sam sees the violation and decides. The auditor never writes files.

6. **End with a one-line verdict:** `PASS`, `PASS WITH WARNINGS`, or `FAIL — <N> blockers`.
