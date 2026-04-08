---
description: Run the plans-triage subagent to classify everything in docs/plans/ and propose archive moves
---

You are running `/triage-plans`.

## What to do

1. **Delegate to the `plans-triage` subagent.** It will:
   - Inventory `docs/plans/`
   - Read each plan and check its git history
   - Cross-reference against the codebase to see if the work is done
   - Classify each as Active / Complete / Stale / Superseded
   - Propose `git mv` commands to archive the Complete and Superseded plans

2. **Surface the report inline.** The subagent's output is the deliverable.

3. **Do NOT execute any `git mv` commands automatically.** The proposed moves are for Sam to review and approve. After the report is shown, ask:

   ```
   Approve any of these archive moves? (y/n/specific-files)
   ```

4. **If Sam approves**, run only the specific `git mv` commands he OK'd. Then run `git status` to confirm the moves landed.

5. **If Sam says no**, just stop. The triage is its own deliverable — sometimes the report is enough.

## Hard rules

- Never move files without explicit approval (specific to this run, not "in general")
- Never delete plans — only move to `docs/plans/archive/`
- Never modify the contents of any plan during this command — that's not what triage is for
