/**
 * Agent Guardrail Types
 *
 * Configuration and result types for the defense-in-depth guardrail pipeline.
 * See docs/plans/AGENT-GUARDRAILS.md for architecture details.
 */

// ---------------------------------------------------------------------------
// Guardrail config (stored as JSON on Agent.guardrails)
// ---------------------------------------------------------------------------

export interface GuardrailConfig {
  /** Keywords triggering immediate human escalation (e.g., "gas leak", "chest pain") */
  emergencyKeywords?: string[];
  /** Phrases blocked from agent output (e.g., "binding quote", "I guarantee") */
  prohibitedPhrases?: string[];
  /** Allowed intent categories for topic gating (empty = allow all) */
  allowedIntents?: string[];
  /** Response when user asks off-topic question */
  offTopicRefusal?: string;
  /** Max SMS segments per outbound message */
  maxSmsSegments?: number;
  /** AI disclosure text injected on first message (supports {agentName}) */
  aiDisclosureMessage?: string;
  /** Emergency escalation message text */
  emergencyRefusal?: string;
  /** Skip AI disclosure for this agent (e.g., internal test agents) */
  skipAiDisclosure?: boolean;
}

// ---------------------------------------------------------------------------
// Resolved config (GuardrailConfig merged with universal defaults)
// ---------------------------------------------------------------------------

export interface ResolvedGuardrailConfig {
  emergencyKeywords: string[];
  prohibitedPhrases: string[];
  allowedIntents: string[];
  offTopicRefusal: string;
  maxSmsSegments: number;
  aiDisclosureMessage: string;
  emergencyRefusal: string;
  skipAiDisclosure: boolean;
}

// ---------------------------------------------------------------------------
// Output filter result
// ---------------------------------------------------------------------------

export interface OutputFilterResult {
  /** Possibly modified text (or replacement if blocked) */
  text: string;
  /** True if the entire response was replaced */
  blocked: boolean;
  /** List of modifications for turn log */
  modifications: OutputModification[];
}

export interface OutputModification {
  type: 'commitment_blocked' | 'prompt_leak' | 'pii_scrubbed' | 'prohibited_phrase';
  detail: string;
}

// ---------------------------------------------------------------------------
// Emergency check result
// ---------------------------------------------------------------------------

export interface EmergencyCheckResult {
  triggered: boolean;
  keyword?: string;
}

// ---------------------------------------------------------------------------
// Hardened prompt result
// ---------------------------------------------------------------------------

export interface HardenedPrompt {
  /** The full hardened system prompt string */
  systemContent: string;
  /** The per-session salt (kept for leak detection in output filter) */
  salt: string;
}
