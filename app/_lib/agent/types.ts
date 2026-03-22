/**
 * Agent Engine Type Definitions
 *
 * Types for the agent conversational loop, inbound message handling,
 * and responses. Channel-agnostic and AI-agnostic by design.
 */

import type { ConversationStatus, MessageRole } from '@prisma/client';

export { ConversationStatus, MessageRole };

// ---------------------------------------------------------------------------
// Turn log: discriminated union capturing every engine action per turn
// ---------------------------------------------------------------------------

interface TurnLogBase { ts: number; }

export interface AiCallLog extends TurnLogBase {
  type: 'ai_call';
  model: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
  durationMs: number;
  iteration: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface ToolCallLog extends TurnLogBase {
  type: 'tool_call';
  tool: string;
  args: Record<string, unknown>;
  result: { success: boolean; data?: unknown; error?: string };
  durationMs: number;
  iteration: number;
}

export interface FaqMatchLog extends TurnLogBase {
  type: 'faq_match';
  pattern: string;
  response: string;
}

export interface EscalationLog extends TurnLogBase {
  type: 'escalation';
  pattern: string;
}

export interface GuardrailLog extends TurnLogBase {
  type: 'guardrail';
  guardrail: 'rate_limited' | 'timeout' | 'message_limit' | 'token_limit';
  detail: string;
}

export interface EventLog extends TurnLogBase {
  type: 'event';
  event: string;
}

export interface ErrorLog extends TurnLogBase {
  type: 'error';
  source: string;
  message: string;
}

export interface RetryLog extends TurnLogBase {
  type: 'retry';
  attempt: number;
  error: string;
  delayMs: number;
}

export type TurnLogEntry = AiCallLog | ToolCallLog | FaqMatchLog | EscalationLog | GuardrailLog | EventLog | ErrorLog | RetryLog;

export interface InboundMessageParams {
  workspaceId: string;
  agentId: string;
  contactAddress: string;
  channelAddress: string;
  channel: string;
  messageText: string;
  leadId?: string;
  testMode?: boolean;
  systemPromptOverride?: string;
  /** When provided, continue this specific conversation instead of lookup by address */
  conversationId?: string;
}

export interface AgentResponse {
  success: boolean;
  /** The AI-generated reply text (null if engine couldn't reply) */
  replyText: string | null;
  /** The conversation this message belongs to */
  conversationId: string;
  /** Whether this was the first message (new conversation) */
  isNewConversation: boolean;
  /** Current conversation status after processing */
  status: ConversationStatus;
  /** Token usage for this turn */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Error message if success is false */
  error?: string;
  /** Events emitted during processing */
  eventsEmitted: string[];
  /** AI response latency in milliseconds (only in test mode) */
  latencyMs?: number;
  /** Response delay that would have been applied (only in test mode, seconds) */
  responseDelaySkipped?: number;
  /** True if the response came from an FAQ override rather than AI */
  faqMatch?: boolean;
  /** True if the message was rate-limited (no reply sent) */
  rateLimited?: boolean;
  /** Tool names executed during this turn (only present when tools were used) */
  toolsUsed?: string[];
  /** Full turn activity log (AI calls, tool calls, guardrails, events, errors) */
  turnLog?: TurnLogEntry[];
  /** True if proactive send was blocked by quiet hours enforcement */
  blockedByQuietHours?: boolean;
  /** When the send window next opens (only set when blockedByQuietHours is true) */
  nextWindowAt?: Date;
}

export interface ConversationWithMessages {
  id: string;
  workspaceId: string;
  agentId: string;
  leadId: string | null;
  channel: string;
  contactAddress: string;
  channelAddress: string;
  status: ConversationStatus;
  messageCount: number;
  totalTokens: number;
  startedAt: Date;
  lastMessageAt: Date | null;
  endedAt: Date | null;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    promptTokens: number;
    completionTokens: number;
    createdAt: Date;
  }>;
}

export interface AgentConfig {
  id: string;
  name: string;
  channelType: string | null;
  channelIntegration: string | null;
  channelAddress: string | null;
  aiIntegration: string;
  systemPrompt: string;
  initialMessage: string | null;
  modelOverride: string | null;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
  maxMessagesPerConversation: number;
  maxTokensPerConversation: number;
  conversationTimeoutMinutes: number;
  responseDelaySeconds: number;
  autoResumeMinutes: number;
  rateLimitPerHour: number;
  fallbackMessage: string | null;
  escalationPattern: string | null;
  faqOverrides: Array<{ patterns: string[]; response: string }> | null;
  allowedEvents: string[];
  enabledTools: string[];
  active: boolean;
  /** IANA timezone from the parent workspace (e.g., "America/New_York") */
  timezone: string;
  /** When true, skip GSM-7 sanitization and allow Unicode SMS (UCS-2) */
  allowUnicode: boolean;
}

export interface InitiateConversationParams {
  workspaceId: string;
  agentId: string;
  leadId: string;
  /** Override for agent's initialMessage (supports lead variables) */
  messageText?: string;
  testMode?: boolean;
}
