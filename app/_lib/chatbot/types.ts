/**
 * Chatbot Engine Type Definitions
 *
 * Types for the chatbot conversational loop, inbound message handling,
 * and responses. Channel-agnostic and AI-agnostic by design.
 */

import type { ConversationStatus, MessageRole } from '@prisma/client';

export { ConversationStatus, MessageRole };

export interface InboundMessageParams {
  workspaceId: string;
  chatbotId: string;
  contactAddress: string;
  channelAddress: string;
  channel: string;
  messageText: string;
  leadId?: string;
  testMode?: boolean;
  systemPromptOverride?: string;
}

export interface ChatbotResponse {
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
}

export interface ConversationWithMessages {
  id: string;
  workspaceId: string;
  chatbotId: string;
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

export interface ChatbotConfig {
  id: string;
  name: string;
  channelType: string;
  channelIntegration: string;
  aiIntegration: string;
  systemPrompt: string;
  modelOverride: string | null;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
  maxMessagesPerConversation: number;
  maxTokensPerConversation: number;
  conversationTimeoutMinutes: number;
  fallbackMessage: string | null;
  allowedEvents: string[];
  active: boolean;
}
