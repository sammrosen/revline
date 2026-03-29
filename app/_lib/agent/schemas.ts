/**
 * Agent API Zod Schemas
 *
 * Validation schemas for all agent API inputs.
 * STANDARDS: All external input validated with Zod.
 */

import { z } from 'zod';

export const GuardrailConfigSchema = z.object({
  emergencyKeywords: z.array(z.string().min(1).max(100)).max(50).default([]),
  prohibitedPhrases: z.array(z.string().min(1).max(200)).max(50).default([]),
  allowedIntents: z.array(z.string().min(1).max(50)).max(30).default([]),
  offTopicRefusal: z.string().max(500).optional(),
  maxSmsSegments: z.number().int().min(1).max(10).optional(),
  aiDisclosureMessage: z.string().max(500).optional(),
  emergencyRefusal: z.string().max(1000).optional(),
  skipAiDisclosure: z.boolean().optional(),
});

const FaqOverrideSchema = z.object({
  patterns: z.array(z.string().min(1)),
  response: z.string().min(1),
});

const AgentChannelSchema = z.object({
  channel: z.enum(['SMS', 'EMAIL', 'WEB_CHAT']),
  integration: z.enum(['TWILIO', 'RESEND', 'BUILT_IN']),
  address: z.string().optional(),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullish(),
  channels: z.array(AgentChannelSchema).max(5).default([]),
  // Deprecated — accepted for backward compat but not used by new code
  channelType: z.string().nullish(),
  channelIntegration: z.string().nullish(),
  channelAddress: z.string().nullish(),
  aiIntegration: z.string().min(1, 'AI integration is required'),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  initialMessage: z.string().nullish(),
  modelOverride: z.string().nullish(),
  temperatureOverride: z.number().min(0).max(2).nullish(),
  maxTokensOverride: z.number().int().positive().nullish(),
  maxMessagesPerConversation: z.number().int().positive().default(50),
  maxTokensPerConversation: z.number().int().positive().default(100000),
  conversationTimeoutMinutes: z.number().int().positive().default(1440),
  responseDelaySeconds: z.number().int().min(0).max(60).default(0),
  autoResumeMinutes: z.number().int().min(0).default(60),
  rateLimitPerHour: z.number().int().min(0).default(60),
  fallbackMessage: z.string().nullish(),
  escalationPattern: z.string().nullish(),
  faqOverrides: z.array(FaqOverrideSchema).max(20).nullish(),
  allowedEvents: z.array(z.string()).default([]),
  enabledTools: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  allowUnicode: z.boolean().default(false),
  guardrails: GuardrailConfigSchema.optional(),
  followUpEnabled: z.boolean().default(false),
  followUpAiGenerated: z.boolean().default(true),
  followUpSequence: z.array(z.object({
    delayMinutes: z.number().int().positive(),
    message: z.string().max(500).optional(),
    variants: z.array(z.string().max(500)).max(5).optional(),
  })).max(10).default([]),
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export const TestChatSchema = z.object({
  messageText: z.string().min(1, 'Message is required').max(5000),
  systemPromptOverride: z.string().nullish(),
  conversationId: z.string().uuid().optional(),
});

export const TestTriggerSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  messageBody: z.string().default('Hello'),
  systemPromptOverride: z.string().nullish(),
});

export const ConversationActionSchema = z.object({
  action: z.enum(['pause', 'resume']),
});
