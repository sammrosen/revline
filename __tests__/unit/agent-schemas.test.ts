/**
 * Agent Zod Schema Tests
 *
 * Priority: P1 - High
 * If broken: API input validation is wrong, invalid data reaches engine
 *
 * Tests CreateAgentSchema, UpdateAgentSchema, TestChatSchema,
 * TestTriggerSchema, and ConversationActionSchema.
 */

import { describe, it, expect } from 'vitest';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  TestChatSchema,
  TestTriggerSchema,
  ConversationActionSchema,
} from '@/app/_lib/agent/schemas';

describe('CreateAgentSchema', () => {
  const validInput = {
    name: 'My Bot',
    aiIntegration: 'OPENAI',
    systemPrompt: 'You are a helpful assistant.',
  };

  it('accepts valid minimal input and applies defaults', () => {
    const result = CreateAgentSchema.parse(validInput);

    expect(result.name).toBe('My Bot');
    expect(result.aiIntegration).toBe('OPENAI');
    expect(result.systemPrompt).toBe('You are a helpful assistant.');
    expect(result.maxMessagesPerConversation).toBe(50);
    expect(result.maxTokensPerConversation).toBe(100000);
    expect(result.conversationTimeoutMinutes).toBe(1440);
    expect(result.responseDelaySeconds).toBe(0);
    expect(result.autoResumeMinutes).toBe(60);
    expect(result.rateLimitPerHour).toBe(10);
    expect(result.allowedEvents).toEqual([]);
    expect(result.enabledTools).toEqual([]);
    expect(result.active).toBe(true);
  });

  it('accepts full input with all optional fields', () => {
    const full = {
      ...validInput,
      description: 'A test bot',
      channelType: 'SMS',
      channelIntegration: 'TWILIO',
      channelAddress: '+15551234567',
      initialMessage: 'Welcome {{firstName}}!',
      modelOverride: 'gpt-4.1',
      temperatureOverride: 0.7,
      maxTokensOverride: 1024,
      maxMessagesPerConversation: 20,
      maxTokensPerConversation: 50000,
      conversationTimeoutMinutes: 720,
      responseDelaySeconds: 3,
      autoResumeMinutes: 30,
      rateLimitPerHour: 5,
      fallbackMessage: 'Sorry, try again later.',
      escalationPattern: '[ESCALATE]',
      faqOverrides: [{ patterns: ['hours'], response: 'Open 6am-9pm' }],
      allowedEvents: ['custom_event'],
      active: false,
    };

    const result = CreateAgentSchema.parse(full);
    expect(result.description).toBe('A test bot');
    expect(result.channelType).toBe('SMS');
    expect(result.responseDelaySeconds).toBe(3);
    expect(result.faqOverrides).toHaveLength(1);
    expect(result.active).toBe(false);
  });

  it('rejects missing name', () => {
    const result = CreateAgentSchema.safeParse({
      aiIntegration: 'OPENAI',
      systemPrompt: 'Hi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing aiIntegration', () => {
    const result = CreateAgentSchema.safeParse({
      name: 'Bot',
      systemPrompt: 'Hi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing systemPrompt', () => {
    const result = CreateAgentSchema.safeParse({
      name: 'Bot',
      aiIntegration: 'OPENAI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = CreateAgentSchema.safeParse({
      ...validInput,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects temperature out of range', () => {
    expect(
      CreateAgentSchema.safeParse({ ...validInput, temperatureOverride: 3 }).success
    ).toBe(false);
    expect(
      CreateAgentSchema.safeParse({ ...validInput, temperatureOverride: -1 }).success
    ).toBe(false);
  });

  it('rejects responseDelaySeconds out of range', () => {
    expect(
      CreateAgentSchema.safeParse({ ...validInput, responseDelaySeconds: 61 }).success
    ).toBe(false);
    expect(
      CreateAgentSchema.safeParse({ ...validInput, responseDelaySeconds: -1 }).success
    ).toBe(false);
  });

  it('rejects more than 20 FAQ overrides', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      patterns: [`keyword${i}`],
      response: `Answer ${i}`,
    }));
    const result = CreateAgentSchema.safeParse({
      ...validInput,
      faqOverrides: tooMany,
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateAgentSchema', () => {
  it('accepts partial updates (all fields optional)', () => {
    const result = UpdateAgentSchema.parse({ name: 'Renamed Bot' });
    expect(result.name).toBe('Renamed Bot');
    expect(result.aiIntegration).toBeUndefined();
  });

  it('accepts empty object (defaults still apply for fields with defaults)', () => {
    const result = UpdateAgentSchema.parse({});
    expect(result.name).toBeUndefined();
    expect(result.aiIntegration).toBeUndefined();
    expect(result.systemPrompt).toBeUndefined();
  });
});

describe('TestChatSchema', () => {
  it('accepts valid message', () => {
    const result = TestChatSchema.parse({ messageText: 'Hello!' });
    expect(result.messageText).toBe('Hello!');
  });

  it('accepts message with conversationId', () => {
    const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const result = TestChatSchema.parse({
      messageText: 'Hello!',
      conversationId: uuid,
    });
    expect(result.conversationId).toBe(uuid);
  });

  it('rejects empty message', () => {
    expect(TestChatSchema.safeParse({ messageText: '' }).success).toBe(false);
  });

  it('rejects invalid UUID for conversationId', () => {
    expect(
      TestChatSchema.safeParse({ messageText: 'Hi', conversationId: 'not-a-uuid' }).success
    ).toBe(false);
  });
});

describe('TestTriggerSchema', () => {
  it('accepts minimal input with defaults', () => {
    const result = TestTriggerSchema.parse({});
    expect(result.messageBody).toBe('Hello');
  });

  it('accepts full input', () => {
    const result = TestTriggerSchema.parse({
      from: '+15551234567',
      to: '+15559876543',
      messageBody: 'Test message',
    });
    expect(result.from).toBe('+15551234567');
  });
});

describe('ConversationActionSchema', () => {
  it('accepts pause', () => {
    const result = ConversationActionSchema.parse({ action: 'pause' });
    expect(result.action).toBe('pause');
  });

  it('accepts resume', () => {
    const result = ConversationActionSchema.parse({ action: 'resume' });
    expect(result.action).toBe('resume');
  });

  it('rejects invalid action', () => {
    expect(ConversationActionSchema.safeParse({ action: 'delete' }).success).toBe(false);
  });

  it('rejects missing action', () => {
    expect(ConversationActionSchema.safeParse({}).success).toBe(false);
  });
});

describe('CreateAgentSchema — follow-up and encoding fields', () => {
  const base = {
    name: 'Bot',
    aiIntegration: 'OPENAI',
    systemPrompt: 'Hi',
  };

  it('applies follow-up defaults', () => {
    const result = CreateAgentSchema.parse(base);
    expect(result.followUpEnabled).toBe(false);
    expect(result.followUpAiGenerated).toBe(true);
    expect(result.followUpSequence).toEqual([]);
  });

  it('applies allowUnicode default', () => {
    const result = CreateAgentSchema.parse(base);
    expect(result.allowUnicode).toBe(false);
  });

  it('accepts explicit allowUnicode true', () => {
    const result = CreateAgentSchema.parse({ ...base, allowUnicode: true });
    expect(result.allowUnicode).toBe(true);
  });

  it('accepts followUpSequence with variants', () => {
    const result = CreateAgentSchema.parse({
      ...base,
      followUpSequence: [
        { delayMinutes: 60, message: 'Hey!', variants: ['Hi!', 'Hello!'] },
      ],
    });
    expect(result.followUpSequence).toHaveLength(1);
    expect(result.followUpSequence[0].variants).toEqual(['Hi!', 'Hello!']);
  });

  it('rejects more than 10 follow-up steps', () => {
    const steps = Array.from({ length: 11 }, (_, i) => ({
      delayMinutes: (i + 1) * 60,
    }));
    const result = CreateAgentSchema.safeParse({ ...base, followUpSequence: steps });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 variants per step', () => {
    const result = CreateAgentSchema.safeParse({
      ...base,
      followUpSequence: [
        { delayMinutes: 60, variants: ['a', 'b', 'c', 'd', 'e', 'f'] },
      ],
    });
    expect(result.success).toBe(false);
  });
});
