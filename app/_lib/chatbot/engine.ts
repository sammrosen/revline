/**
 * Chatbot Engine
 *
 * Core conversational loop for the chatbot system. Handles:
 * - Finding or creating conversations
 * - Loading message history and building AI requests
 * - Calling the configured AI adapter (OpenAI or Anthropic)
 * - Storing messages and updating conversation state
 * - Sending replies via the configured channel adapter (Twilio)
 * - Emitting events into the workflow system
 *
 * Channel-agnostic and AI-agnostic: the chatbot config determines which
 * adapters are used for messaging and AI completion.
 *
 * STANDARDS:
 * - Fail-safe: sends fallback message on AI failure rather than silence
 * - Workspace-isolated: all queries scoped to workspaceId
 * - Event-driven: emits events for workflow triggers
 */

import { prisma } from '@/app/_lib/db';
import { ConversationStatus } from '@prisma/client';
import { OpenAIAdapter, TwilioAdapter, AnthropicAdapter } from '@/app/_lib/integrations';
import type { ChatMessage, ChatCompletionResult } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
import { logStructured } from '@/app/_lib/reliability';
import type { InboundMessageParams, ChatbotResponse, ChatbotConfig } from './types';
import type { IntegrationResult } from '@/app/_lib/types';

export async function handleInboundMessage(
  params: InboundMessageParams
): Promise<ChatbotResponse> {
  const correlationId = crypto.randomUUID();
  const eventsEmitted: string[] = [];

  try {
    // 1. Load chatbot config
    const chatbot = await loadChatbot(params.workspaceId, params.chatbotId);
    if (!chatbot) {
      return errorResponse('Chatbot not found or inactive', correlationId);
    }

    // 2. Find or create conversation
    const { conversation, isNew } = await findOrCreateConversation(params, chatbot);

    // 3. Check if conversation is still active
    if (conversation.status !== ConversationStatus.ACTIVE) {
      return {
        success: false,
        replyText: null,
        conversationId: conversation.id,
        isNewConversation: false,
        status: conversation.status,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: `Conversation is ${conversation.status}`,
        eventsEmitted: [],
      };
    }

    // 4. Check timeout
    if (isConversationTimedOut(conversation.lastMessageAt || conversation.startedAt, chatbot.conversationTimeoutMinutes)) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: ConversationStatus.TIMED_OUT, endedAt: new Date() },
      });

      await emitChatbotEvent(params.workspaceId, 'conversation_completed', {
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        reason: 'timeout',
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');

      return {
        success: false,
        replyText: null,
        conversationId: conversation.id,
        isNewConversation: false,
        status: ConversationStatus.TIMED_OUT,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: 'Conversation timed out',
        eventsEmitted,
      };
    }

    // 5. Check message limit
    if (conversation.messageCount >= chatbot.maxMessagesPerConversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: ConversationStatus.COMPLETED, endedAt: new Date() },
      });

      await emitChatbotEvent(params.workspaceId, 'conversation_completed', {
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        reason: 'message_limit',
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');

      if (chatbot.fallbackMessage) {
        await sendReply(params.workspaceId, chatbot, params.channelAddress, params.contactAddress, chatbot.fallbackMessage);
      }

      return {
        success: true,
        replyText: chatbot.fallbackMessage,
        conversationId: conversation.id,
        isNewConversation: false,
        status: ConversationStatus.COMPLETED,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        eventsEmitted,
      };
    }

    // 6. Store inbound USER message
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: params.messageText,
      },
    });

    // 7. Emit new conversation event if applicable
    if (isNew) {
      await emitChatbotEvent(params.workspaceId, 'conversation_started', {
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        contactAddress: params.contactAddress,
        channel: params.channel,
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_started');
    }

    // 8. Load conversation history
    const history = await prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    // 9. Build AI messages
    const aiMessages: ChatMessage[] = [
      { role: 'developer', content: chatbot.systemPrompt },
      ...history.map((msg) => ({
        role: mapRoleToAI(msg.role),
        content: msg.content,
      })),
    ];

    // 10. Call AI adapter
    const aiResult = await callAI(params.workspaceId, chatbot, aiMessages);

    if (!aiResult.success || !aiResult.data) {
      logStructured({
        correlationId,
        event: 'chatbot_ai_failure',
        workspaceId: params.workspaceId,
        provider: chatbot.aiIntegration,
        error: aiResult.error || 'AI call failed',
        metadata: { chatbotId: chatbot.id, conversationId: conversation.id },
      });

      await emitEvent({
        workspaceId: params.workspaceId,
        system: EventSystem.CHATBOT,
        eventType: 'chatbot_ai_failure',
        success: false,
        errorMessage: aiResult.error,
      });

      // Send fallback if available
      if (chatbot.fallbackMessage) {
        await sendReply(params.workspaceId, chatbot, params.channelAddress, params.contactAddress, chatbot.fallbackMessage);
      }

      return {
        success: false,
        replyText: chatbot.fallbackMessage,
        conversationId: conversation.id,
        isNewConversation: isNew,
        status: ConversationStatus.ACTIVE,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: aiResult.error || 'AI completion failed',
        eventsEmitted,
      };
    }

    const completion = aiResult.data;
    const replyText = completion.content || '';

    // 11. Store ASSISTANT response
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: replyText,
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens,
      },
    });

    // 12. Update conversation counters
    const newMessageCount = conversation.messageCount + 2; // USER + ASSISTANT
    const newTotalTokens = conversation.totalTokens + completion.usage.totalTokens;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: newMessageCount,
        totalTokens: newTotalTokens,
        lastMessageAt: new Date(),
      },
    });

    // 13. Check token limit after update
    let finalStatus: ConversationStatus = ConversationStatus.ACTIVE;
    if (newTotalTokens >= chatbot.maxTokensPerConversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: ConversationStatus.COMPLETED, endedAt: new Date() },
      });
      finalStatus = ConversationStatus.COMPLETED;

      await emitChatbotEvent(params.workspaceId, 'conversation_completed', {
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        reason: 'token_limit',
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');
    }

    // 14. Send reply via channel adapter
    if (replyText) {
      await sendReply(
        params.workspaceId,
        chatbot,
        params.channelAddress,
        params.contactAddress,
        replyText
      );
    }

    // 15. Emit response event
    await emitEvent({
      workspaceId: params.workspaceId,
      system: EventSystem.CHATBOT,
      eventType: 'chatbot_response_sent',
      success: true,
    });

    logStructured({
      correlationId,
      event: 'chatbot_turn_complete',
      workspaceId: params.workspaceId,
      provider: chatbot.aiIntegration,
      success: true,
      metadata: {
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        messageCount: newMessageCount,
        tokensUsed: completion.usage.totalTokens,
        finishReason: completion.finishReason,
      },
    });

    return {
      success: true,
      replyText,
      conversationId: conversation.id,
      isNewConversation: isNew,
      status: finalStatus,
      usage: completion.usage,
      eventsEmitted,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown engine error';

    logStructured({
      correlationId,
      event: 'chatbot_engine_error',
      workspaceId: params.workspaceId,
      provider: 'chatbot',
      error: msg,
      metadata: { chatbotId: params.chatbotId },
    });

    return errorResponse(msg, correlationId);
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function loadChatbot(
  workspaceId: string,
  chatbotId: string
): Promise<ChatbotConfig | null> {
  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId, active: true },
  });

  if (!chatbot) return null;

  return {
    id: chatbot.id,
    name: chatbot.name,
    channelType: chatbot.channelType,
    channelIntegration: chatbot.channelIntegration,
    aiIntegration: chatbot.aiIntegration,
    systemPrompt: chatbot.systemPrompt,
    modelOverride: chatbot.modelOverride,
    temperatureOverride: chatbot.temperatureOverride,
    maxTokensOverride: chatbot.maxTokensOverride,
    maxMessagesPerConversation: chatbot.maxMessagesPerConversation,
    maxTokensPerConversation: chatbot.maxTokensPerConversation,
    conversationTimeoutMinutes: chatbot.conversationTimeoutMinutes,
    fallbackMessage: chatbot.fallbackMessage,
    allowedEvents: (chatbot.allowedEvents as string[]) || [],
    active: chatbot.active,
  };
}

async function findOrCreateConversation(
  params: InboundMessageParams,
  chatbot: ChatbotConfig
): Promise<{ conversation: { id: string; status: ConversationStatus; messageCount: number; totalTokens: number; startedAt: Date; lastMessageAt: Date | null }; isNew: boolean }> {
  // Look for an active conversation for this contact+channel+bot
  const existing = await prisma.conversation.findFirst({
    where: {
      workspaceId: params.workspaceId,
      chatbotId: chatbot.id,
      contactAddress: params.contactAddress,
      channelAddress: params.channelAddress,
      status: ConversationStatus.ACTIVE,
    },
    select: {
      id: true,
      status: true,
      messageCount: true,
      totalTokens: true,
      startedAt: true,
      lastMessageAt: true,
    },
  });

  if (existing) {
    return { conversation: existing, isNew: false };
  }

  const created = await prisma.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      chatbotId: chatbot.id,
      leadId: params.leadId || null,
      channel: params.channel,
      contactAddress: params.contactAddress,
      channelAddress: params.channelAddress,
      status: ConversationStatus.ACTIVE,
    },
    select: {
      id: true,
      status: true,
      messageCount: true,
      totalTokens: true,
      startedAt: true,
      lastMessageAt: true,
    },
  });

  return { conversation: created, isNew: true };
}

function isConversationTimedOut(
  lastActivity: Date,
  timeoutMinutes: number
): boolean {
  const elapsed = Date.now() - lastActivity.getTime();
  return elapsed > timeoutMinutes * 60 * 1000;
}

function mapRoleToAI(role: string): ChatMessage['role'] {
  switch (role) {
    case 'USER':
      return 'user';
    case 'ASSISTANT':
      return 'assistant';
    case 'SYSTEM':
      return 'developer';
    default:
      return 'user';
  }
}

async function callAI(
  workspaceId: string,
  chatbot: ChatbotConfig,
  messages: ChatMessage[]
): Promise<IntegrationResult<ChatCompletionResult>> {
  const integration = chatbot.aiIntegration.toUpperCase();

  if (integration === 'OPENAI') {
    const adapter = await OpenAIAdapter.forWorkspace(workspaceId);
    if (!adapter) {
      return { success: false, error: 'OpenAI not configured for this workspace' };
    }
    return adapter.chatCompletion({
      messages,
      model: chatbot.modelOverride || undefined,
      temperature: chatbot.temperatureOverride ?? undefined,
      maxTokens: chatbot.maxTokensOverride ?? undefined,
    });
  }

  if (integration === 'ANTHROPIC') {
    const adapter = await AnthropicAdapter.forWorkspace(workspaceId);
    if (!adapter) {
      return { success: false, error: 'Anthropic not configured for this workspace' };
    }
    return adapter.chatCompletion({
      messages,
      model: chatbot.modelOverride || undefined,
      temperature: chatbot.temperatureOverride ?? undefined,
      maxTokens: chatbot.maxTokensOverride ?? undefined,
    });
  }

  return { success: false, error: `Unsupported AI integration: ${chatbot.aiIntegration}` };
}

async function sendReply(
  workspaceId: string,
  chatbot: ChatbotConfig,
  fromAddress: string,
  toAddress: string,
  body: string
): Promise<void> {
  const channel = chatbot.channelIntegration.toUpperCase();

  if (channel === 'TWILIO') {
    const adapter = await TwilioAdapter.forWorkspace(workspaceId);
    if (!adapter) {
      console.error('Twilio not configured for chatbot reply:', { workspaceId, chatbotId: chatbot.id });
      return;
    }

    // Find the phone number key that matches our channelAddress
    const phoneKeys = Object.entries(
      (adapter as unknown as { meta: { phoneNumbers: Record<string, { number: string }> } }).meta?.phoneNumbers || {}
    );
    const matchingKey = phoneKeys.find(([, v]) => v.number === fromAddress)?.[0];

    const result = await adapter.sendSms({
      to: toAddress,
      body,
      from: matchingKey,
    });

    if (!result.success) {
      console.error('Chatbot SMS send failed:', { workspaceId, error: result.error });
    }

    return;
  }

  console.error('Unsupported channel for chatbot reply:', { channel, workspaceId });
}

async function emitChatbotEvent(
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await emitEvent({
    workspaceId,
    leadId: payload.leadId as string | undefined,
    system: EventSystem.CHATBOT,
    eventType: `chatbot_${eventType}`,
    success: true,
  });

  await emitTrigger(
    workspaceId,
    { adapter: 'chatbot', operation: eventType },
    payload
  );
}

function errorResponse(error: string, _correlationId: string): ChatbotResponse {
  return {
    success: false,
    replyText: null,
    conversationId: '',
    isNewConversation: false,
    status: ConversationStatus.ACTIVE,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    error,
    eventsEmitted: [],
  };
}
