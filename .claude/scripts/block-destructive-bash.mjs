#!/usr/bin/env node
// PreToolUse hook for Bash. Blocks destructive ops unless Sam explicitly bypasses.
// Exit 0 = allow, exit 2 = block (stderr is fed back to Claude).

import { readFileSync } from "node:fs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // If we can't parse the input, fail open — better than blocking everything
  process.exit(0);
}

const cmd = payload?.tool_input?.command ?? "";
if (!cmd || typeof cmd !== "string") process.exit(0);

// Normalize for matching: collapse whitespace, lowercase
const norm = cmd.replace(/\s+/g, " ").trim();

// Patterns that are nearly always destructive and rarely accidental
const denyPatterns = [
  {
    pattern: /\bgit\s+push\s+(?:.*\s)?(?:--force\b(?!-with-lease)|-f\b)/i,
    reason:
      "Refusing `git push --force`. Use `--force-with-lease` if you need to overwrite remote, or pass through bash with --no-verify if you really mean it. Sam: confirm before running this.",
  },
  {
    pattern: /\bgit\s+reset\s+(?:.*\s)?--hard\b/i,
    reason:
      "Refusing `git reset --hard`. This destroys uncommitted work. If you really need it, run it manually after confirming with Sam.",
  },
  {
    pattern: /\bgit\s+clean\s+-[a-z]*f/i,
    reason:
      "Refusing `git clean -f`. Investigate untracked files before deleting them — they may be Sam's in-progress work.",
  },
  {
    pattern: /\bgit\s+branch\s+-D\b/i,
    reason:
      "Refusing `git branch -D` (force delete). Use `git branch -d` (safe delete) or confirm with Sam first.",
  },
  {
    pattern: /\bgit\s+checkout\s+--\s/i,
    reason:
      "Refusing `git checkout --` which discards local changes. Confirm with Sam before discarding work.",
  },
  {
    pattern: /\bgit\s+restore\s+--/i,
    reason:
      "Refusing `git restore --` which discards local changes. Confirm with Sam before discarding work.",
  },
  {
    pattern: /\bprisma\s+migrate\s+reset\b/i,
    reason:
      "Refusing `prisma migrate reset`. This DROPS the database. Confirm with Sam and target a local DB explicitly.",
  },
  {
    pattern: /\brm\s+(?:.*\s)?-[a-z]*r[a-z]*f|\brm\s+(?:.*\s)?-[a-z]*f[a-z]*r|\brm\s+--force\s+--recursive|\brm\s+--recursive\s+--force/i,
    reason:
      "Refusing `rm -rf`. Identify the root cause before deleting. If a lock file or unfamiliar directory exists, investigate it — don't nuke it.",
  },
  {
    pattern: /\bnpm\s+publish\b/i,
    reason:
      "Refusing `npm publish`. RevLine is a private app, not a package. If this is intentional, run it manually.",
  },
  {
    pattern: /\byarn\s+publish\b/i,
    reason: "Refusing `yarn publish`. See `npm publish` reason.",
  },
];
// Note: `--no-verify` is intentionally NOT blocked. It's the escape hatch
// for husky hooks when Sam needs to bypass them in an emergency.

for (const { pattern, reason } of denyPatterns) {
  if (pattern.test(norm)) {
    process.stderr.write(`[block-destructive-bash] BLOCKED: ${reason}\n`);
    process.stderr.write(`[block-destructive-bash] Command: ${cmd}\n`);
    process.exit(2);
  }
}

process.exit(0);
