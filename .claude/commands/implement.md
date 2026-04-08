---
description: Execute an approved plan from docs/plans/, locking the plan file from edits
argument-hint: <plan-path>
---

You are running `/implement` against: $ARGUMENTS

This is Sam's implementation ritual. Read the rules carefully — they are non-negotiable.

## Preflight

1. **Validate the argument.** It must be a path to an existing `.md` file under `docs/plans/`. If not, stop and ask Sam to provide a valid path.

2. **Read the plan file fully.** Compute its content hash (you don't need a real cryptographic hash — just remember the exact contents so you can detect mid-flight modifications).

3. **Write `.claude/state/active-implement.json`** with:
   ```json
   {
     "planPath": "<absolute path to the plan>",
     "startedAt": "<ISO timestamp>",
     "branch": "<current git branch from `git branch --show-current`>"
   }
   ```
   This file is what the plan-lock hook reads to block edits to the active plan. Create the file with the Write tool.

4. **Confirm the standards checklist in the plan is meaningfully filled out.** If it's blank or all boxes are blanket-ticked without evidence, stop and tell Sam the plan needs review before implementation.

## Execution

Work through the plan's "Todos" section in order. For each todo:

1. **Mark it `in_progress` in your task list** (use TaskCreate / TaskUpdate). One todo at a time. Don't batch.
2. **Do the work.** Make the edits. Run any necessary read commands. Stay within the file-by-file scope declared in the plan.
3. **If you discover the plan is wrong or incomplete** — STOP. Do not silently deviate. Print what you found and ask Sam whether to update the plan. (Updating the plan requires clearing `.claude/state/active-implement.json` first; the hook will block plan edits otherwise. Tell Sam the exact command if needed.)
4. **Mark the todo `completed`** only when the work is genuinely done (typecheck passes for the touched files, tests added if applicable).
5. **Move to the next todo.**

After every chunk of related todos (or at natural commit boundaries), invoke the `standards-auditor` subagent on the staged changes. If it reports blockers, fix them before continuing. If it reports warnings, surface them to Sam and ask whether to address now or defer.

## Hard rules

- **Never edit the plan file at `$ARGUMENTS` during `/implement`.** A `PreToolUse` hook will block the Edit/Write call. This is intentional — if the plan needs to change, that's a stop-and-ask moment.
- **Never start the next todo before marking the current one completed.**
- **Never skip the standards audit at chunk boundaries.**
- **Never run destructive commands** (`git push --force`, `prisma migrate reset`, `db:push` against non-local DBs, `rm -rf`). A hook will block these too.
- **Don't stop mid-plan unless blocked.** If everything is going well, work through every todo before reporting back to Sam.

## When done

After all todos are completed and the final audit is clean:

1. Print a short summary: which todos completed, which files were touched, what the audit said.
2. Suggest Sam run `/audit` one more time before merging if substantial work landed.
3. Tell Sam to delete `.claude/state/active-implement.json` when the implementation session is over (or note that the Stop hook will surface a reminder).
