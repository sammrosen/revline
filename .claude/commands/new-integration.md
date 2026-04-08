---
description: Plan and (with approval) onboard a new integration adapter using the Pipedrive reference pattern
argument-hint: <integration name> [optional capability description]
---

You are running `/new-integration` for: $ARGUMENTS

This command kicks off the integration onboarding ritual via the `integration-onboarder` subagent.

## Steps

1. **Parse the argument.** The first word is the integration name (e.g., `hubspot`, `attio`). The rest is an optional capability description.

2. **Convert the name to the canonical slug:** uppercase with hyphens, suffixed with `-ADAPTER`. Example: `hubspot` → `HUBSPOT-ADAPTER`. The plan will be written to `docs/plans/{SLUG}.md`.

3. **Check `docs/plans/` and `docs/plans/archive/`** for an existing plan with that slug. If one exists, stop and ask Sam whether to overwrite, branch, or pick a new name.

4. **Delegate to the `integration-onboarder` subagent.** Pass it:
   - The integration name
   - The capability description (if provided)
   - Whatever Sam mentioned in the prompt about triggers, actions, or auth method

5. **The subagent will:**
   - Read STANDARDS, INTEGRATION-ONBOARDING, the Pipedrive reference adapter, and the existing registry/config/types files (Phase 1: discovery)
   - Write a plan to `docs/plans/{SLUG}.md` covering all 8–9 file touch-points (Phase 2)
   - **Stop**. Implementation is gated behind `/implement`.

6. **After the subagent returns, print the next step:**
   ```
   Plan written: docs/plans/{SLUG}.md
   Review it. When ready, run /implement docs/plans/{SLUG}.md
   ```

## Do NOT

- Do not start implementation in this command. The subagent stops at Phase 2 for a reason.
- Do not bypass the plan gate even if Sam says "just do it" — that's exactly when planning matters most.
- Do not modify any file in `app/`, `prisma/`, or the dashboard during this command.
