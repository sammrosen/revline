/**
 * Agent Engine Type Definitions
 *
 * Types for the agent conversational loop, inbound message handling,
 * and responses. Channel-agnostic and AI-agnostic by design.
 */

import type { ConversationStatus, MessageRole } from '@prisma/client';

export { ConversationStatus, MessageRole };

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
  active: boolean;
}

export interface InitiateConversationParams {
  workspaceId: string;
  agentId: string;
  leadId: string;
  /** Override for agent's initialMessage (supports lead variables) */
  messageText?: string;
  testMode?: boolean;
}
