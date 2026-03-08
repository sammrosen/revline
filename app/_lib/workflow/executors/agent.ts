/**
 * Agent Action Executors
 *
 * Executors for agent workflow actions.
 * Supports two modes:
 * - Reactive: inbound message (from + body in trigger) -> handleInboundMessage
 * - Proactive: no inbound message -> initiateConversation (agent texts first)
 */

import { handleInboundMessage, initiateConversation } from '@/app/_lib/agent';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

/**
 * Route to an agent -- dual mode.
 *
 * REACTIVE (trigger has body + from):
 *   Inbound message from contact -> agent responds via AI + channel.
 *   Example: twilio.sms_received -> agent.route_to_agent
 *
 * PROACTIVE (trigger has no body):
 *   Agent initiates outreach -> sends initialMessage to lead via channel.
 *   Example: revline.create_lead -> agent.route_to_agent
 *   Requires: leadId on context, agent has channel + channelAddress configured.
 */
const routeToAgent: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const agentId = params.agentId as string | undefined;
    if (!agentId) {
      return { success: false, error: 'Missing agentId parameter' };
    }

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, workspaceId: ctx.workspaceId },
      select: { channelType: true, channelIntegration: true, channelAddress: true },
    });
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const from = ctx.trigger.payload.from as string | undefined;
    const body = ctx.trigger.payload.body as string | undefined;
    const to = ctx.trigger.payload.to as string | undefined;

    let result;

    if (body && from) {
      // REACTIVE MODE: inbound message, agent responds
      if (!ctx.isTest && (!agent.channelType || !agent.channelIntegration)) {
        return {
          success: false,
          error: 'Agent has no channel configured. Add a channel integration before using in workflows.',
        };
      }

      result = await handleInboundMessage({
        workspaceId: ctx.workspaceId,
        agentId,
        contactAddress: from,
        channelAddress: to || agent.channelAddress || '',
        channel: agent.channelType || 'SMS',
        messageText: body,
        leadId: ctx.leadId,
        testMode: ctx.isTest,
      });
    } else {
      // PROACTIVE MODE: agent initiates outreach
      if (!ctx.leadId) {
        return {
          success: false,
          error: 'Proactive outreach requires a leadId on the workflow context',
        };
      }

      const messageText = params.messageText as string | undefined;

      result = await initiateConversation({
        workspaceId: ctx.workspaceId,
        agentId,
        leadId: ctx.leadId,
        messageText,
        testMode: ctx.isTest,
      });
    }

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.AGENT,
      eventType: result.success
        ? 'agent_route_success'
        : 'agent_route_failed',
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
        mode: body && from ? 'reactive' : 'proactive',
      },
    };
  },
};

export const agentExecutors: Record<string, ActionExecutor> = {
  route_to_agent: routeToAgent,
};
