#!/usr/bin/env node
// PreToolUse hook for Edit/Write/MultiEdit. Blocks edits to a plan file
// while `/implement` is active on it. Reads the locked plan path from
// .claude/state/active-implement.json.
// Exit 0 = allow, exit 2 = block.

import { readFileSync, existsSync } from "node:fs";
import { resolve, normalize } from "node:path";

const STATE_FILE = ".claude/state/active-implement.json";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

if (!existsSync(STATE_FILE)) process.exit(0);

let state;
try {
  state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
} catch {
  // Corrupt state file — fail open and let Claude proceed
  process.exit(0);
}

const lockedPath = state?.planPath;
if (!lockedPath || typeof lockedPath !== "string") process.exit(0);

const target = payload?.tool_input?.file_path;
if (!target || typeof target !== "string") process.exit(0);

// Normalize both paths for comparison (handle Windows backslashes, relative vs absolute)
function norm(p) {
  return resolve(normalize(p)).replace(/\\/g, "/").toLowerCase();
}

if (norm(target) === norm(lockedPath)) {
  process.stderr.write(
    `[block-plan-edit] BLOCKED: You are running /implement on ${lockedPath}.\n`
  );
  process.stderr.write(
    `[block-plan-edit] Editing the plan file mid-implementation is forbidden.\n`
  );
  process.stderr.write(
    `[block-plan-edit] If the plan needs to change, STOP and ask Sam. To unlock,\n`
  );
  process.stderr.write(
    `[block-plan-edit] delete .claude/state/active-implement.json and start over.\n`
  );
  process.exit(2);
}

process.exit(0);
