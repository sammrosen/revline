/**
 * Agent Output Filter
 *
 * Post-processes every AI response before it reaches the user.
 * Runs commitment language blocking, system prompt leak detection,
 * PII scrubbing, and configurable prohibited phrase matching.
 *
 * Also exports emergency keyword checking (runs on inbound input, not output).
 */

import type { ResolvedGuardrailConfig, OutputFilterResult, OutputModification, EmergencyCheckResult } from './types';
import {
  COMMITMENT_PATTERNS,
  PII_PATTERNS,
  PROMPT_LEAK_INDICATORS,
  COMMITMENT_BLOCK_RESPONSE,
  PROMPT_LEAK_RESPONSE,
} from './constants';

// ---------------------------------------------------------------------------
// Output filter — runs on every AI response
// ---------------------------------------------------------------------------

const PROMPT_LEAK_SUBSTRING_MIN_LENGTH = 40;

export function filterOutput(
  text: string,
  systemPrompt: string,
  config: ResolvedGuardrailConfig,
): OutputFilterResult {
  const modifications: OutputModification[] = [];
  let result = text;
  let blocked = false;

  // 1. System prompt leak detection (highest priority — full replacement)
  if (detectPromptLeak(result, systemPrompt)) {
    modifications.push({ type: 'prompt_leak', detail: 'Output contained system prompt fragments' });
    return { text: PROMPT_LEAK_RESPONSE, blocked: true, modifications };
  }

  // 2. Commitment language blocking (full replacement with escalation)
  const commitmentMatch = detectCommitmentLanguage(result);
  if (commitmentMatch) {
    modifications.push({ type: 'commitment_blocked', detail: `Matched: "${commitmentMatch}"` });
    return { text: COMMITMENT_BLOCK_RESPONSE, blocked: true, modifications };
  }

  // 3. PII scrubbing (in-place replacement)
  for (const { pattern, replacement, label } of PII_PATTERNS) {
    const before = result;
    result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
    if (result !== before) {
      modifications.push({ type: 'pii_scrubbed', detail: `Redacted ${label} pattern` });
    }
  }

  // 4. Configurable prohibited phrases (full replacement)
  if (config.prohibitedPhrases.length > 0) {
    const phraseMatch = detectProhibitedPhrase(result, config.prohibitedPhrases);
    if (phraseMatch) {
      modifications.push({ type: 'prohibited_phrase', detail: `Matched: "${phraseMatch}"` });
      return { text: config.offTopicRefusal, blocked: true, modifications };
    }
  }

  blocked = modifications.some((m) => m.type === 'commitment_blocked' || m.type === 'prompt_leak' || m.type === 'prohibited_phrase');

  return { text: result, blocked, modifications };
}

// ---------------------------------------------------------------------------
// Inbound PII masking — runs on USER INPUT before it enters the AI prompt
// ---------------------------------------------------------------------------

export function maskPiiForPrompt(text: string): { masked: string; hadPii: boolean } {
  let result = text;
  let hadPii = false;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const before = result;
    result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
    if (result !== before) {
      hadPii = true;
    }
  }

  return { masked: result, hadPii };
}

// ---------------------------------------------------------------------------
// Emergency keyword check — runs on USER INPUT before AI call
// ---------------------------------------------------------------------------

export function checkEmergencyKeywords(
  userMessage: string,
  config: ResolvedGuardrailConfig,
): EmergencyCheckResult {
  if (config.emergencyKeywords.length === 0) {
    return { triggered: false };
  }

  const lower = userMessage.toLowerCase();
  for (const keyword of config.emergencyKeywords) {
    if (lower.includes(keyword.toLowerCase())) {
      return { triggered: true, keyword };
    }
  }

  return { triggered: false };
}

// ---------------------------------------------------------------------------
// Internal detection helpers
// ---------------------------------------------------------------------------

function detectPromptLeak(output: string, systemPrompt: string): boolean {
  // Check known leak indicator phrases
  for (const pattern of PROMPT_LEAK_INDICATORS) {
    if (pattern.test(output)) {
      return true;
    }
  }

  // Check if significant substrings of the system prompt appear in output.
  // We extract chunks from the start and end of the prompt and check for matches.
  if (systemPrompt.length >= PROMPT_LEAK_SUBSTRING_MIN_LENGTH) {
    const outputLower = output.toLowerCase();
    const promptLower = systemPrompt.toLowerCase();

    const chunks = [
      promptLower.slice(0, PROMPT_LEAK_SUBSTRING_MIN_LENGTH),
      promptLower.slice(-PROMPT_LEAK_SUBSTRING_MIN_LENGTH),
    ];

    // Also sample from the middle if the prompt is long enough
    if (promptLower.length > PROMPT_LEAK_SUBSTRING_MIN_LENGTH * 3) {
      const mid = Math.floor(promptLower.length / 2);
      chunks.push(promptLower.slice(mid, mid + PROMPT_LEAK_SUBSTRING_MIN_LENGTH));
    }

    for (const chunk of chunks) {
      if (outputLower.includes(chunk)) {
        return true;
      }
    }
  }

  return false;
}

function detectCommitmentLanguage(output: string): string | null {
  for (const pattern of COMMITMENT_PATTERNS) {
    const match = pattern.exec(output);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function detectProhibitedPhrase(output: string, phrases: string[]): string | null {
  const lower = output.toLowerCase();
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
}
