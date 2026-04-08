/**
 * Agent Guardrails
 *
 * Defense-in-depth pipeline for conversational AI agents.
 * See docs/plans/AGENT-GUARDRAILS.md for architecture.
 */

export type {
  GuardrailConfig,
  ResolvedGuardrailConfig,
  OutputFilterResult,
  OutputModification,
  EmergencyCheckResult,
  HardenedPrompt,
} from './types';

export { resolveGuardrails } from './constants';
export {
  COMMITMENT_PATTERNS,
  PII_PATTERNS,
  PROMPT_LEAK_INDICATORS,
  INJECTION_DEFENSE_INSTRUCTIONS,
  DEFAULT_AI_DISCLOSURE,
  DEFAULT_EMERGENCY_REFUSAL,
  DEFAULT_OFF_TOPIC_REFUSAL,
  COMMITMENT_BLOCK_RESPONSE,
  PROMPT_LEAK_RESPONSE,
  SANDWICH_REMINDER,
} from './constants';

export { filterOutput, checkEmergencyKeywords, maskPiiForPrompt } from './output-filter';
export { hardenPrompt, wrapUserMessage, buildSandwich } from './prompt-hardening';
export { screenInput } from './input-screen';
export type { ScreenResult } from './input-screen';
