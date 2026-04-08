/**
 * Agent Engine Tests
 *
 * Priority: P0 - Critical
 * If broken: All agent conversations fail
 *
 * Tests handleInboundMessage() covering:
 * - Happy path (new conversation, AI call, response)
 * - Opt-out detection and blocking
 * - Conversation timeout
 * - Message limit enforcement
 * - Rate limiting per lead
 * - FAQ override matching
 * - Paused conversation handling + auto-resume
 * - Agent not found / inactive
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testPrisma, createTestWorkspace, createTestAgent, createTestConversation } from '../setup';

// Mock the adapter registry so we control AI and channel responses
const mockChatCompletion = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('@/app/_lib/agent/adapter-registry', () => ({
  resolveAI: vi.fn(() => ({
    forWorkspace: vi.fn(async () => ({
      chatCompletion: mockChatCompletion,
    })),
    label: 'MockAI',
    defaultModel: 'mock-model',
  })),
  resolveChannel: vi.fn(() => ({
    forWorkspace: vi.fn(async () => ({
      sendMessage: mockSendMessage,
    })),
    label: 'MockChannel',
    contactField: 'phone',
  })),
  getContactFieldForChannel: vi.fn(() => 'phone'),
}));

// Mock tool registry (no tools enabled in tests)
vi.mock('@/app/_lib/agent/tool-registry', () => ({
  resolveTools: vi.fn(() => ({ definitions: [], executors: new Map() })),
  executeTool: vi.fn(async () => ({ success: true, data: {} })),
  registerTool: vi.fn(),
  getAvailableTools: vi.fn(() => []),
  isRegisteredTool: vi.fn(() => false),
}));

// Mock event emission and logging (no-op in tests)
vi.mock('@/app/_lib/event-logger', () => ({
  emitEvent: vi.fn(async () => {}),
  EventSystem: {
    AGENT: 'AGENT',
    TWILIO: 'TWILIO',
    OPENAI: 'OPENAI',
    ANTHROPIC: 'ANTHROPIC',
  },
}));

vi.mock('@/app/_lib/workflow', () => ({
  emitTrigger: vi.fn(async () => {}),
}));

vi.mock('@/app/_lib/reliability', () => ({
  logStructured: vi.fn(),
}));

const CANNED_AI_RESPONSE = {
  success: true,
  data: {
    content: 'Hello! How can I help you today?',
    finishReason: 'stop' as const,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'mock-model',
  },
};

describe('Agent Engine — handleInboundMessage', () => {
  let workspaceId: string;
  let agentId: string;

  const baseParams = () => ({
    workspaceId,
    agentId,
    contactAddress: '+15551234567',
    channelAddress: '+15559876543',
    channel: 'SMS',
    messageText: 'Hi there!',
    testMode: true,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockChatCompletion.mockResolvedValue(CANNED_AI_RESPONSE);
    mockSendMessage.mockResolvedValue({ success: true });

    const workspace = await createTestWorkspace({ slug: `engine-test-${Date.now()}` });
    workspaceId = workspace.id;

    const agent = await createTestAgent(workspaceId, {
      name: 'Engine Test Bot',
      aiIntegration: 'OPENAI',
      systemPrompt: 'You are a gym assistant.',
      // Disable AI disclosure prepend so tests assert exactly on AI mock output.
      // The disclosure feature is tested separately.
      guardrails: { skipAiDisclosure: true },
    });
    agentId = agent.id;
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('creates a new conversation and returns AI response', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');
    const result = await handleInboundMessage(baseParams());

    expect(result.success).toBe(true);
    expect(result.isNewConversation).toBe(true);
    expect(result.replyText).toBe('Hello! How can I help you today?');
    expect(result.conversationId).toBeTruthy();
    expect(result.usage.totalTokens).toBe(15);
    expect(result.status).toBe('ACTIVE');

    // Verify messages were stored
    const messages = await testPrisma.conversationMessage.findMany({
      where: { conversationId: result.conversationId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('USER');
    expect(messages[0].content).toBe('Hi there!');
    expect(messages[messages.length - 1].role).toBe('ASSISTANT');
  });

  it('continues an existing conversation on second message', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const first = await handleInboundMessage(baseParams());
    expect(first.isNewConversation).toBe(true);

    const second = await handleInboundMessage({
      ...baseParams(),
      messageText: 'What are your hours?',
    });
    expect(second.isNewConversation).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);
  });

  // -------------------------------------------------------------------------
  // Opt-out detection
  // -------------------------------------------------------------------------

  it('detects STOP keyword and creates opt-out record (non-test mode)', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // First, create a conversation so opt-out has something to close
    await handleInboundMessage(baseParams());

    // Now send STOP in non-test mode to trigger opt-out path
    const result = await handleInboundMessage({
      ...baseParams(),
      testMode: false,
      messageText: 'STOP',
    });

    expect(result.success).toBe(true);
    expect(result.eventsEmitted).toContain('contact_opted_out');

    const optOut = await testPrisma.optOutRecord.findFirst({
      where: { workspaceId, contactAddress: '+15551234567' },
    });
    expect(optOut).toBeTruthy();
    expect(optOut!.reason).toBe('STOP');
  });

  it('blocks messages from opted-out contacts (non-test mode)', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // Create an opt-out record directly
    await testPrisma.optOutRecord.create({
      data: {
        workspaceId,
        contactAddress: '+15551234567',
        reason: 'STOP',
        source: 'agent',
      },
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      testMode: false,
      messageText: 'Hello again',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('contact_opted_out');
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Conversation timeout
  // -------------------------------------------------------------------------

  it('returns TIMED_OUT when conversation exceeds timeout', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // Create agent with very short timeout
    const shortAgent = await createTestAgent(workspaceId, {
      name: 'Short Timeout Bot',
      conversationTimeoutMinutes: 1, // 1 minute timeout
    });

    // Create a conversation with old lastMessageAt
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await createTestConversation(workspaceId, shortAgent.id, {
      contactAddress: '+15552222222',
      channelAddress: '+15559876543',
      lastMessageAt: twoMinutesAgo,
      startedAt: twoMinutesAgo,
      isTest: true,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: shortAgent.id,
      contactAddress: '+15552222222',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('TIMED_OUT');
    expect(result.error).toBe('Conversation timed out');
  });

  // -------------------------------------------------------------------------
  // Message limit
  // -------------------------------------------------------------------------

  it('returns COMPLETED when conversation hits message limit', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // Create agent with very low message limit
    const limitedAgent = await createTestAgent(workspaceId, {
      name: 'Limited Bot',
      maxMessagesPerConversation: 2,
      fallbackMessage: 'Conversation limit reached. Goodbye!',
    });

    // Create a conversation that's already at the limit
    await createTestConversation(workspaceId, limitedAgent.id, {
      contactAddress: '+15553333333',
      channelAddress: '+15559876543',
      messageCount: 2,
      isTest: true,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: limitedAgent.id,
      contactAddress: '+15553333333',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.replyText).toBe('Conversation limit reached. Goodbye!');
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  it('rate-limits when lead exceeds rateLimitPerHour', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // Agent with a rate limit of 1 reply/hour
    const rateLimitAgent = await createTestAgent(workspaceId, {
      name: 'Rate Limited Bot',
      rateLimitPerHour: 1,
    });

    // First message goes through fine
    const first = await handleInboundMessage({
      ...baseParams(),
      agentId: rateLimitAgent.id,
      contactAddress: '+15554444444',
    });
    expect(first.success).toBe(true);
    expect(first.rateLimited).toBeUndefined();

    // Second message should be rate-limited
    const second = await handleInboundMessage({
      ...baseParams(),
      agentId: rateLimitAgent.id,
      contactAddress: '+15554444444',
      messageText: 'Another question!',
    });
    expect(second.success).toBe(true);
    expect(second.rateLimited).toBe(true);
    expect(second.replyText).toBeNull();
  });

  // -------------------------------------------------------------------------
  // FAQ override
  // -------------------------------------------------------------------------

  it('returns FAQ response and skips AI when pattern matches', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const faqAgent = await createTestAgent(workspaceId, {
      name: 'FAQ Bot',
      faqOverrides: [
        { patterns: ['hours', 'open'], response: 'We are open Mon-Fri 6am-9pm.' },
        { patterns: ['pricing', 'cost'], response: 'Memberships start at $29/mo.' },
      ],
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: faqAgent.id,
      contactAddress: '+15555555555',
      messageText: 'What are your hours?',
    });

    expect(result.success).toBe(true);
    expect(result.faqMatch).toBe(true);
    expect(result.replyText).toBe('We are open Mon-Fri 6am-9pm.');
    expect(result.usage.totalTokens).toBe(0);
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Paused conversation
  // -------------------------------------------------------------------------

  it('stores message but does not reply to a PAUSED conversation', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const pausedAgent = await createTestAgent(workspaceId, {
      name: 'Pause Bot',
      autoResumeMinutes: 0, // never auto-resume
    });

    await createTestConversation(workspaceId, pausedAgent.id, {
      contactAddress: '+15556666666',
      channelAddress: '+15559876543',
      status: 'PAUSED',
      pausedAt: new Date(),
      pausedBy: 'admin',
      isTest: true,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: pausedAgent.id,
      contactAddress: '+15556666666',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PAUSED');
    expect(result.replyText).toBeNull();
    expect(mockChatCompletion).not.toHaveBeenCalled();

    // Message was still stored
    const convo = await testPrisma.conversation.findFirst({
      where: { agentId: pausedAgent.id, contactAddress: '+15556666666' },
    });
    expect(convo!.messageCount).toBe(1);
  });

  it('auto-resumes a PAUSED conversation when autoResumeMinutes has elapsed', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const resumeAgent = await createTestAgent(workspaceId, {
      name: 'Resume Bot',
      autoResumeMinutes: 1, // 1 minute auto-resume
    });

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await createTestConversation(workspaceId, resumeAgent.id, {
      contactAddress: '+15557777777',
      channelAddress: '+15559876543',
      status: 'PAUSED',
      pausedAt: twoMinutesAgo,
      pausedBy: 'admin',
      isTest: true,
      lastMessageAt: twoMinutesAgo,
      startedAt: twoMinutesAgo,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: resumeAgent.id,
      contactAddress: '+15557777777',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(result.replyText).toBeTruthy();
    expect(mockChatCompletion).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Agent not found / inactive
  // -------------------------------------------------------------------------

  it('returns error when agent does not exist', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: '00000000-0000-0000-0000-000000000000',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it('returns error when agent is inactive', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    const inactiveAgent = await createTestAgent(workspaceId, {
      name: 'Inactive Bot',
      active: false,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: inactiveAgent.id,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  // -------------------------------------------------------------------------
  // AI failure with fallback
  // -------------------------------------------------------------------------

  it('sends fallback message when AI call fails', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    mockChatCompletion.mockResolvedValueOnce({
      success: false,
      error: 'API rate limit exceeded',
    });

    const fbAgent = await createTestAgent(workspaceId, {
      name: 'Fallback Bot',
      fallbackMessage: 'Sorry, I am having trouble right now. A team member will reach out!',
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      agentId: fbAgent.id,
      contactAddress: '+15558888888',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.replyText).toBe('Sorry, I am having trouble right now. A team member will reach out!');
  });

  // -------------------------------------------------------------------------
  // conversationId threading
  // -------------------------------------------------------------------------

  it('continues a specific conversation when conversationId is provided', async () => {
    const { handleInboundMessage } = await import('@/app/_lib/agent/engine');

    // Create a conversation directly
    const convo = await createTestConversation(workspaceId, agentId, {
      contactAddress: '+15559999999',
      channelAddress: '+15559876543',
      isTest: true,
    });

    const result = await handleInboundMessage({
      ...baseParams(),
      contactAddress: '+15559999999',
      conversationId: convo.id,
    });

    expect(result.success).toBe(true);
    expect(result.conversationId).toBe(convo.id);
    expect(result.isNewConversation).toBe(false);
  });
});
