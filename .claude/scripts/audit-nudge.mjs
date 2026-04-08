#!/usr/bin/env node
// Stop hook. If files under app/ were modified during the session and no
// recent /audit appears to have run, suggest running it before ending.
// Exit 0 always — advisory only.

import { execSync } from "node:child_process";

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// Check if there are modified files under app/
const status = safeExec("git status --porcelain");
if (!status) process.exit(0);

const modifiedAppFiles = status
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => /^[MARC?]+\s+app\//.test(l) || /^[MARC?]+\s+prisma\//.test(l));

if (modifiedAppFiles.length === 0) process.exit(0);

process.stdout.write(
  `\n[audit-nudge] ${modifiedAppFiles.length} file(s) modified under app/ or prisma/ this session.\n` +
  `[audit-nudge] Consider running /audit before ending to catch standards drift.\n`
);

process.exit(0);
