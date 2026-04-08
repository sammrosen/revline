#!/usr/bin/env node
// PostToolUse advisory linter for Edit/Write on app/**/*.ts files.
// Flags common drift from RevLine standards. NEVER blocks — exits 0 always.
// Output goes to stderr so Claude sees it as a tool result advisory.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || typeof filePath !== "string") process.exit(0);

// Only lint TypeScript files under app/
const norm = filePath.replace(/\\/g, "/");
if (!/\/app\/.+\.tsx?$/.test(norm)) process.exit(0);

if (!existsSync(filePath)) process.exit(0);

let content;
try {
  content = readFileSync(filePath, "utf8");
} catch {
  process.exit(0);
}

const findings = [];

const lines = content.split("\n");

const isApiRoute = /\/app\/api\//.test(norm);
const isPrismaUsing = /\bprisma\.[a-zA-Z]+\.(findMany|findFirst|findUnique|update|delete|count|aggregate|groupBy|create|createMany|upsert)\b/.test(content);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  // 1. `as any` or `as unknown as <T>` (skip `as const`, `import as`, etc.)
  if (/\bas\s+any\b/.test(line) && !/\bas\s+const\b/.test(line)) {
    findings.push({
      line: lineNum,
      rule: "No `as any` without justification",
      snippet: line.trim(),
    });
  }
  if (/\bas\s+unknown\s+as\s+/.test(line)) {
    findings.push({
      line: lineNum,
      rule: "No `as unknown as <T>` without justification",
      snippet: line.trim(),
    });
  }

  // 2. Raw `throw new Error` in API routes (should return ApiResponse.error)
  if (isApiRoute && /\bthrow\s+new\s+Error\b/.test(line)) {
    findings.push({
      line: lineNum,
      rule: "API routes should return ApiResponse.error(), not throw raw Error",
      snippet: line.trim(),
    });
  }

  // 3. console.log of anything that looks like a secret
  if (/console\.(log|error|warn|info)/.test(line) && /\b(apiKey|api_key|token|secret|password|signing[Kk]ey|authorization)\b/.test(line)) {
    findings.push({
      line: lineNum,
      rule: "Never log secrets — even partially",
      snippet: line.trim(),
    });
  }

  // 4. Exported function without explicit return type
  // Match: export (async )?function name(...) { ... }   without ": Type" before {
  const exportFnMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(/);
  if (exportFnMatch) {
    // Find the closing paren and check what comes after
    const rest = line.slice(line.indexOf("(") + 1);
    // Check if there's a return type annotation before { or =>
    // Heuristic: look for ): on this line; if not, look ahead a couple lines
    const lookAhead = lines.slice(i, i + 3).join(" ");
    if (!/\)\s*:\s*[A-Za-z_<{]/.test(lookAhead)) {
      findings.push({
        line: lineNum,
        rule: `Exported function "${exportFnMatch[1]}" missing explicit return type`,
        snippet: line.trim(),
      });
    }
  }
}

// 5. Prisma calls without workspaceId (file-level heuristic)
if (isPrismaUsing) {
  const prismaCallRegex = /prisma\.([a-zA-Z]+)\.(findMany|findFirst|findUnique|update|delete|count|aggregate|groupBy)\s*\(\s*\{[\s\S]*?\}\s*\)/g;
  let m;
  while ((m = prismaCallRegex.exec(content)) !== null) {
    const callText = m[0];
    if (!/workspaceId/.test(callText)) {
      // Find line number of the match
      const before = content.slice(0, m.index);
      const lineNum = before.split("\n").length;
      findings.push({
        line: lineNum,
        rule: `Prisma .${m[2]}() on ${m[1]} appears to lack workspaceId scoping`,
        snippet: `prisma.${m[1]}.${m[2]}(...)`,
      });
    }
  }
}

if (findings.length === 0) process.exit(0);

process.stderr.write(`\n[quick-lint] ${filePath}\n`);
process.stderr.write(`[quick-lint] ${findings.length} advisory finding(s) — review before committing:\n`);
for (const f of findings) {
  process.stderr.write(`[quick-lint]   line ${f.line}: ${f.rule}\n`);
  if (f.snippet && f.snippet.length < 120) {
    process.stderr.write(`[quick-lint]     > ${f.snippet}\n`);
  }
}
process.stderr.write(`[quick-lint] (advisory only — exit 0)\n\n`);

process.exit(0);
