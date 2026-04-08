#!/usr/bin/env node
// UserPromptSubmit hook. Detects build/implement intent phrases and injects
// a one-line reminder once per session. Exit 0 always — purely additive.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const prompt = payload?.prompt ?? "";
const sessionId = payload?.session_id ?? "default";

if (!prompt || typeof prompt !== "string") process.exit(0);

// Intent detection — be conservative, only fire on clear build language
const intentRegex = /\b(?:add|create|build|implement|wire up|set up|onboard)\s+(?:a\s+)?(?:new\s+)?(?:integration|adapter|webhook|feature|endpoint|route|service|cron|trigger|action)\b|\blet'?s\s+(?:add|create|build|implement)\b|\bnew\s+integration\b/i;

if (!intentRegex.test(prompt)) process.exit(0);

// Once-per-session: check state file
const stateFile = `.claude/state/prompt-hint-${sessionId}.flag`;

if (existsSync(stateFile)) process.exit(0);

try {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, new Date().toISOString());
} catch {
  // If we can't write state, still inject — better noisy than missed
}

// Inject the hint via stdout — Claude sees this as additional context
process.stdout.write(
  `Reminder: Sam's workflow is plan → implement → audit. For non-trivial work, consider running /plan first to draft the change in docs/plans/, then /implement once approved. Use /new-integration {name} for full adapter onboarding.`
);

process.exit(0);
