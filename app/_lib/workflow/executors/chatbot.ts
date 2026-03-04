/**
 * Chatbot Action Executors
 *
 * Executors for chatbot workflow actions.
 * Routes inbound messages to the chatbot engine for autonomous handling.
 */

import { handleInboundMessage } from '@/app/_lib/chatbot';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

/**
 * Route an inbound message to a chatbot.
 *
 * Reads the chatbotId from action params, then forwards the trigger payload
 * (from, to, body, channel info) to the chatbot engine.
 *
 * Typically triggered by twilio.sms_received → chatbot.route_to_chatbot.
 */
const routeToChatbot: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const chatbotId = params.chatbotId as string | undefined;
    if (!chatbotId) {
      return { success: false, error: 'Missing chatbotId parameter' };
    }

    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, workspaceId: ctx.workspaceId },
      select: { channelType: true, channelIntegration: true },
    });
    if (!chatbot) {
      return { success: false, error: 'Chatbot not found' };
    }
    if (!chatbot.channelType || !chatbot.channelIntegration) {
      return {
        success: false,
        error: 'Chatbot has no channel configured. Add a channel integration before using in workflows.',
      };
    }

    const from = ctx.trigger.payload.from as string | undefined;
    const to = ctx.trigger.payload.to as string | undefined;
    const body = ctx.trigger.payload.body as string | undefined;

    if (!from || !body) {
      return {
        success: false,
        error: 'Trigger payload missing required fields: from, body',
      };
    }

    const result = await handleInboundMessage({
      workspaceId: ctx.workspaceId,
      chatbotId,
      contactAddress: from,
      channelAddress: to || '',
      channel: 'SMS',
      messageText: body,
      leadId: ctx.leadId,
    });

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.CHATBOT,
      eventType: result.success
        ? 'chatbot_route_success'
        : 'chatbot_route_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        conversationId: result.conversationId,
        isNewConversation: result.isNewConversation,
        replyText: result.replyText,
        status: result.status,
        tokensUsed: result.usage.totalTokens,
      },
    };
  },
};

export const chatbotExecutors: Record<string, ActionExecutor> = {
  route_to_chatbot: routeToChatbot,
};
