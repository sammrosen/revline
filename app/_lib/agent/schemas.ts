/**
 * Agent API Zod Schemas
 *
 * Validation schemas for all agent API inputs.
 * STANDARDS: All external input validated with Zod.
 */

import { z } from 'zod';

const FaqOverrideSchema = z.object({
  patterns: z.array(z.string().min(1)),
  response: z.string().min(1),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullish(),
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
  rateLimitPerHour: z.number().int().min(0).default(10),
  fallbackMessage: z.string().nullish(),
  escalationPattern: z.string().nullish(),
  faqOverrides: z.array(FaqOverrideSchema).max(20).nullish(),
  allowedEvents: z.array(z.string()).default([]),
  enabledTools: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  followUpEnabled: z.boolean().default(false),
  followUpAiGenerated: z.boolean().default(true),
  followUpSequence: z.array(z.object({
    delayMinutes: z.number().int().positive(),
    message: z.string().max(500).optional(),
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
