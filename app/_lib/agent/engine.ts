/**
 * Agent Engine
 *
 * Core conversational loop for the agent system. Handles:
 * - Finding or creating conversations
 * - Loading message history and building AI requests
 * - Calling the configured AI adapter (OpenAI or Anthropic)
 * - Storing messages and updating conversation state
 * - Sending replies via the configured channel adapter (Twilio)
 * - Emitting events into the workflow system
 *
 * Channel-agnostic and AI-agnostic: the agent config determines which
 * adapters are used for messaging and AI completion.
 *
 * STANDARDS:
 * - Fail-safe: sends fallback message on AI failure rather than silence
 * - Workspace-isolated: all queries scoped to workspaceId
 * - Event-driven: emits events for workflow triggers
 */

import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus, Prisma } from '@prisma/client';
import type { ChatMessage, ChatCompletionResult } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { emitTrigger } from '@/app/_lib/workflow';
import { logStructured } from '@/app/_lib/reliability';
import type { InboundMessageParams, InitiateConversationParams, AgentResponse, AgentConfig, TurnLogEntry, SendChannelContext } from './types';
import type { IntegrationResult } from '@/app/_lib/types';
import { resolveAI, resolveChannel, getContactFieldForChannel } from './adapter-registry';
import type { ChannelMessageMetadata } from './adapter-registry';
import { resolveTools, executeTool } from './tool-registry';
import type { ToolDefinition } from '@/app/_lib/integrations';
import { checkSendWindow, shouldEnforceQuietHours } from './quiet-hours';
import type { SendType, SendReplyResult } from './quiet-hours';
import { sanitizeForGsm7, estimateSegments, shouldSanitizeSms } from './sms-encoding';
import { retryWithBackoff } from './retry';
import { cancelPendingFollowUps } from './follow-up';
import { notifyResolution } from '@/app/_lib/phone';
import { checkConsent, revokeConsent } from '@/app/_lib/services/consent.service';
import { dispatchPostSendHooks } from './post-send-hooks';
import { withTransaction } from '@/app/_lib/utils/transaction';
import { maskContact } from '@/app/_lib/utils/validation';
import { resolveGuardrails } from './guardrails/constants';
import type { GuardrailConfig } from './guardrails/types';
import { checkEmergencyKeywords, filterOutput, maskPiiForPrompt } from './guardrails/output-filter';
import { hardenPrompt, wrapUserMessage, buildSandwich } from './guardrails/prompt-hardening';
import { screenInput } from './guardrails/input-screen';
import { truncateToSegments } from './sms-encoding';

// Register all tools with the tool registry at module load
import './tools';

/** Whether to skip the intentional response delay (webhook callers can't afford it). */
function shouldApplyDelay(params: InboundMessageParams): boolean {
  return params.callerContext !== 'webhook' && !params.testMode;
}

export async function handleInboundMessage(
  params: InboundMessageParams
): Promise<AgentResponse> {
  const correlationId = crypto.randomUUID();
  const eventsEmitted: string[] = [];
  const turnLog: TurnLogEntry[] = [];
  const channelCtx: SendChannelContext | undefined = params.channelIntegration
    ? { channel: params.channel, channelIntegration: params.channelIntegration, channelAddress: params.channelAddress }
    : undefined;

  try {
    // 0a. Check if contact has opted out (skip in test mode)
    if (!params.testMode) {
      const optOut = await prisma.optOutRecord.findUnique({
        where: {
          workspaceId_contactAddress: {
            workspaceId: params.workspaceId,
            contactAddress: params.contactAddress,
          },
        },
      });
      if (optOut) {
        return {
          success: false,
          replyText: null,
          conversationId: '',
          isNewConversation: false,
          status: ConversationStatus.COMPLETED,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          error: 'contact_opted_out',
          eventsEmitted: [],
        };
      }
    }

    // 0b. Check if inbound message is an opt-out keyword (skip in test mode)
    if (!params.testMode) {
      const optOutKeyword = isOptOutMessage(params.messageText);
      if (optOutKeyword) {
        const activeConvo = await prisma.conversation.findFirst({
          where: {
            workspaceId: params.workspaceId,
            agentId: params.agentId,
            contactAddress: params.contactAddress,
            status: ConversationStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (activeConvo) {
          await prisma.conversation.update({
            where: { id: activeConvo.id },
            data: { status: ConversationStatus.COMPLETED, endedAt: new Date() },
          });
        }

        await prisma.optOutRecord.upsert({
          where: {
            workspaceId_contactAddress: {
              workspaceId: params.workspaceId,
              contactAddress: params.contactAddress,
            },
          },
          update: { reason: optOutKeyword, source: 'agent', agentId: params.agentId, conversationId: activeConvo?.id || null },
          create: {
            workspaceId: params.workspaceId,
            contactAddress: params.contactAddress,
            reason: optOutKeyword,
            source: 'agent',
            agentId: params.agentId,
            conversationId: activeConvo?.id || null,
          },
        });

        const agentRecord = await prisma.agent.findUnique({
          where: { id: params.agentId },
          select: { channelType: true },
        });
        await revokeConsent(params.workspaceId, params.contactAddress, agentRecord?.channelType || params.channel);

        if (activeConvo) {
          await cancelPendingFollowUps(activeConvo.id, 'opted_out', params.workspaceId);
        }

        await emitAgentEvent(params.workspaceId, 'contact_opted_out', {
          agentId: params.agentId,
          conversationId: activeConvo?.id,
          contactAddress: params.contactAddress,
          keyword: optOutKeyword,
        });

        return {
          success: true,
          replyText: null,
          conversationId: activeConvo?.id || '',
          isNewConversation: false,
          status: ConversationStatus.COMPLETED,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          eventsEmitted: ['contact_opted_out'],
        };
      }
    }

    // 1. Load agent config
    const agent = await loadAgent(params.workspaceId, params.agentId);
    if (!agent) {
      return errorResponse('Agent not found or inactive', correlationId);
    }

    // 2. Find or create conversation
    const { conversation, isNew } = await findOrCreateConversation(params, agent);

    // 2a. Proactive outreach path (missed-call handler) — send first message without inbound
    if (params.callerContext === 'proactive') {
      if (!isNew) {
        return {
          success: false,
          replyText: null,
          conversationId: conversation.id,
          isNewConversation: false,
          status: conversation.status,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          error: 'active_conversation_exists',
          eventsEmitted: [],
        };
      }

      const outboundText = params.proactiveMessage || agent.initialMessage || '';
      if (outboundText) {
        await prisma.conversationMessage.create({
          data: { conversationId: conversation.id, role: 'ASSISTANT', content: outboundText },
        });

        if (!params.testMode) {
          await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, outboundText, 'proactive', conversation.id, channelCtx);
        }
      }

      await emitAgentEvent(params.workspaceId, 'conversation_started', {
        agentId: agent.id,
        conversationId: conversation.id,
        contactAddress: params.contactAddress,
        channel: params.channel,
        leadId: params.leadId,
      });

      return {
        success: true,
        replyText: outboundText || null,
        conversationId: conversation.id,
        isNewConversation: true,
        status: ConversationStatus.ACTIVE,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        eventsEmitted: ['conversation_started'],
      };
    }

    // 2b. Cancel pending follow-ups on any inbound message
    if (!isNew) {
      await cancelPendingFollowUps(conversation.id, 'lead_responded', params.workspaceId);
    }

    // 3. Handle PAUSED conversations -- auto-resume or guard
    if (conversation.status === ConversationStatus.PAUSED) {
      const canAutoResume =
        agent.autoResumeMinutes > 0 &&
        conversation.pausedAt &&
        Date.now() - conversation.pausedAt.getTime() >= agent.autoResumeMinutes * 60 * 1000;

      if (canAutoResume) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: ConversationStatus.ACTIVE, pausedAt: null, pausedBy: null },
        });
        conversation.status = ConversationStatus.ACTIVE;
      } else {
        await prisma.conversationMessage.create({
          data: { conversationId: conversation.id, role: 'USER', content: params.messageText },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
        });
        return {
          success: true,
          replyText: null,
          conversationId: conversation.id,
          isNewConversation: false,
          status: ConversationStatus.PAUSED,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          eventsEmitted: [],
        };
      }
    }

    // 3b. Check if conversation is in a terminal state
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
    if (isConversationTimedOut(conversation.lastMessageAt || conversation.startedAt, agent.conversationTimeoutMinutes)) {
      const resolution = deriveResolution(ConversationStatus.TIMED_OUT, [], conversation.messageCount);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.TIMED_OUT,
          endedAt: new Date(),
          metadata: mergeResolutionMetadata(conversation.metadata, resolution),
        },
      });

      await emitAgentEvent(params.workspaceId, 'conversation_completed', {
        agentId: agent.id,
        conversationId: conversation.id,
        reason: 'timeout',
        resolution,
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');

      notifyResolution({
        workspaceId: params.workspaceId, agentId: agent.id, conversationId: conversation.id,
        contactAddress: params.contactAddress, resolution, channel: params.channel, channelIntegration: params.channelIntegration,
      }).catch(() => {});

      turnLog.push({ type: 'guardrail', guardrail: 'timeout', detail: `Timed out after ${agent.conversationTimeoutMinutes}m`, ts: Date.now() });
      turnLog.push({ type: 'event', event: 'conversation_completed', ts: Date.now() });

      return {
        success: false,
        replyText: null,
        conversationId: conversation.id,
        isNewConversation: false,
        status: ConversationStatus.TIMED_OUT,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: 'Conversation timed out',
        eventsEmitted,
        turnLog,
      };
    }

    // 5. Check message limit
    if (conversation.messageCount >= agent.maxMessagesPerConversation) {
      const resolution = deriveResolution(ConversationStatus.COMPLETED, [], conversation.messageCount);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.COMPLETED,
          endedAt: new Date(),
          metadata: mergeResolutionMetadata(conversation.metadata, resolution),
        },
      });

      await emitAgentEvent(params.workspaceId, 'conversation_completed', {
        agentId: agent.id,
        conversationId: conversation.id,
        reason: 'message_limit',
        resolution,
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');

      notifyResolution({
        workspaceId: params.workspaceId, agentId: agent.id, conversationId: conversation.id,
        contactAddress: params.contactAddress, resolution, channel: params.channel, channelIntegration: params.channelIntegration,
      }).catch(() => {});

      turnLog.push({ type: 'guardrail', guardrail: 'message_limit', detail: `Reached ${agent.maxMessagesPerConversation} message limit`, ts: Date.now() });
      turnLog.push({ type: 'event', event: 'conversation_completed', ts: Date.now() });

      if (agent.fallbackMessage && !params.testMode) {
        await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, agent.fallbackMessage, 'reactive', conversation.id, channelCtx);
      }

      return {
        success: true,
        replyText: agent.fallbackMessage,
        conversationId: conversation.id,
        isNewConversation: false,
        status: ConversationStatus.COMPLETED,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        eventsEmitted,
        turnLog,
      };
    }

    // 5b. Rate limit check
    if (agent.rateLimitPerHour > 0) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentReplies = await prisma.conversationMessage.count({
        where: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          createdAt: { gte: oneHourAgo },
        },
      });
      if (recentReplies >= agent.rateLimitPerHour) {
        await withTransaction(async (tx) => {
          await tx.conversationMessage.create({
            data: { conversationId: conversation.id, role: 'USER', content: params.messageText },
          });
          await tx.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
          });
        });
        logStructured({
          correlationId,
          event: 'agent_rate_limited',
          workspaceId: params.workspaceId,
          provider: agent.aiIntegration,
          success: false,
          metadata: { agentId: agent.id, conversationId: conversation.id, recentReplies },
        });

        await emitEvent({
          workspaceId: params.workspaceId,
          system: EventSystem.AGENT,
          eventType: 'agent_rate_limited',
          success: false,
          errorMessage: `Rate limited: ${recentReplies}/${agent.rateLimitPerHour} replies per hour`,
          metadata: {
            agentId: agent.id,
            conversationId: conversation.id,
            channel: params.channel,
            channelIntegration: params.channelIntegration,
            correlationId,
            recentReplies,
            rateLimitPerHour: agent.rateLimitPerHour,
          },
        });

        turnLog.push({ type: 'guardrail', guardrail: 'rate_limited', detail: `${recentReplies}/${agent.rateLimitPerHour} replies/hr`, ts: Date.now() });

        return {
          success: true,
          replyText: null,
          conversationId: conversation.id,
          isNewConversation: false,
          status: ConversationStatus.ACTIVE,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          eventsEmitted: [],
          rateLimited: true,
          turnLog,
        };
      }
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
      await emitAgentEvent(params.workspaceId, 'conversation_started', {
        agentId: agent.id,
        conversationId: conversation.id,
        contactAddress: params.contactAddress,
        channel: params.channel,
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_started');
      turnLog.push({ type: 'event', event: 'conversation_started', ts: Date.now() });

      // 7b. Send initial message if configured
      if (agent.initialMessage) {
        let lead: { email: string; source: string | null; stage: string; properties: unknown } | null = null;
        let workspaceName = '';

        if (params.leadId) {
          const leadRecord = await prisma.lead.findUnique({
            where: { id: params.leadId },
            select: { email: true, source: true, stage: true, properties: true },
          });
          if (leadRecord) lead = leadRecord;
        }

        const workspace = await prisma.workspace.findUnique({
          where: { id: params.workspaceId },
          select: { name: true },
        });
        workspaceName = workspace?.name || '';

        const initialText = interpolateLeadVariables(agent.initialMessage, lead, workspaceName);

        await prisma.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: initialText,
          },
        });

        if (!params.testMode) {
          if (shouldApplyDelay(params) && agent.responseDelaySeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
          }
          await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, initialText, 'reactive', conversation.id, channelCtx);
        }
      }
    }

    // 7c. FAQ override check — bypass AI for matched patterns
    if (agent.faqOverrides && agent.faqOverrides.length > 0) {
      const faqMatch = matchFaq(params.messageText, agent.faqOverrides);
      if (faqMatch) {
        const matchedRule = agent.faqOverrides.find((r) =>
          r.patterns.some((p) => params.messageText.toLowerCase().includes(p.toLowerCase()))
        );
        turnLog.push({ type: 'faq_match', pattern: matchedRule?.patterns.join(', ') || '?', response: faqMatch, ts: Date.now() });

        await withTransaction(async (tx) => {
          await tx.conversationMessage.create({
            data: { conversationId: conversation.id, role: 'ASSISTANT', content: faqMatch, turnLog: turnLog.length > 0 ? (turnLog as unknown as Prisma.InputJsonValue) : undefined },
          });
          await tx.conversation.update({
            where: { id: conversation.id },
            data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
          });
        });
        if (!params.testMode) {
          if (shouldApplyDelay(params) && agent.responseDelaySeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
          }
          await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, faqMatch, 'reactive', conversation.id, channelCtx);
        }
        return {
          success: true,
          replyText: faqMatch,
          conversationId: conversation.id,
          isNewConversation: isNew,
          status: ConversationStatus.ACTIVE,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          eventsEmitted,
          faqMatch: true,
          responseDelaySkipped: params.testMode && agent.responseDelaySeconds > 0 ? agent.responseDelaySeconds : undefined,
          turnLog,
        };
      }
    }

    // 7d. Emergency keyword check — skip AI entirely on match
    const emergencyCheck = checkEmergencyKeywords(params.messageText, agent.guardrails);
    if (emergencyCheck.triggered) {
      const emergencyReply = agent.guardrails.emergencyRefusal;
      turnLog.push({ type: 'guardrail', guardrail: 'emergency_escalation', detail: `Matched keyword: "${emergencyCheck.keyword}"`, ts: Date.now() });

      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, role: 'ASSISTANT', content: emergencyReply },
      });

      const emergencyResolution = deriveResolution(ConversationStatus.ESCALATED, [], conversation.messageCount + 2);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.ESCALATED,
          endedAt: new Date(),
          messageCount: { increment: 2 },
          lastMessageAt: new Date(),
          metadata: mergeResolutionMetadata(conversation.metadata, emergencyResolution),
        },
      });

      if (!params.testMode) {
        await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, emergencyReply, 'reactive', conversation.id, channelCtx);
      }

      await emitAgentEvent(params.workspaceId, 'escalation_requested', {
        agentId: agent.id,
        conversationId: conversation.id,
        reason: 'emergency_keyword',
        keyword: emergencyCheck.keyword,
        resolution: emergencyResolution,
        leadId: params.leadId,
      });
      eventsEmitted.push('escalation_requested');
      turnLog.push({ type: 'event', event: 'escalation_requested', ts: Date.now() });

      try {
        const { notifyEscalation } = await import('./escalation');
        const summary = await buildConversationSummary(conversation.id);
        await notifyEscalation({
          workspaceId: params.workspaceId,
          agentId: agent.id,
          conversationId: conversation.id,
          contactAddress: params.contactAddress,
          summary,
        });
      } catch (err) {
        logStructured({
          correlationId,
          event: 'agent_escalation_notification_failed',
          workspaceId: params.workspaceId,
          provider: 'agent',
          error: err instanceof Error ? err.message : 'Emergency escalation notification failed',
          metadata: { agentId: agent.id, conversationId: conversation.id, reason: 'emergency_keyword' },
        });
      }

      notifyResolution({
        workspaceId: params.workspaceId, agentId: agent.id, conversationId: conversation.id,
        contactAddress: params.contactAddress, resolution: emergencyResolution, channel: params.channel, channelIntegration: params.channelIntegration,
      }).catch(() => {});

      return {
        success: true,
        replyText: emergencyReply,
        conversationId: conversation.id,
        isNewConversation: isNew,
        status: ConversationStatus.ESCALATED,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        eventsEmitted,
        turnLog,
      };
    }

    // 7e. Input screening — injection detection + topic gating
    const screenResult = await screenInput(params.workspaceId, agent, params.messageText);
    if (!screenResult.allowed) {
      const guardrailType = screenResult.intent === 'injection' ? 'injection' as const : 'off_topic' as const;
      turnLog.push({ type: 'guardrail', guardrail: guardrailType, detail: screenResult.reason || `Blocked: ${screenResult.intent}`, ts: Date.now() });

      const refusalText = screenResult.intent === 'injection'
        ? 'I\'m here to help with your questions! What can I assist you with?'
        : agent.guardrails.offTopicRefusal;

      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, role: 'ASSISTANT', content: refusalText, turnLog: turnLog.length > 0 ? (turnLog as unknown as Prisma.InputJsonValue) : undefined },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
      });

      if (!params.testMode) {
        await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, refusalText, 'reactive', conversation.id, channelCtx);
      }

      return {
        success: true,
        replyText: refusalText,
        conversationId: conversation.id,
        isNewConversation: isNew,
        status: ConversationStatus.ACTIVE,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        eventsEmitted,
        turnLog,
      };
    }

    // 7f. Inbound PII masking — scrub before the message enters the AI prompt
    const piiResult = maskPiiForPrompt(params.messageText);
    const maskedMessageText = piiResult.masked;
    if (piiResult.hadPii) {
      turnLog.push({ type: 'guardrail', guardrail: 'pii_scrubbed', detail: 'Masked PII in inbound message before AI prompt', ts: Date.now() });
    }

    // 8. Load conversation history
    const history = await prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    // 9. Load reference files and build hardened system prompt
    const basePrompt = params.systemPromptOverride || agent.systemPrompt;
    const refFiles = await prisma.agentFile.findMany({
      where: { agentId: agent.id },
      select: { filename: true, textContent: true },
      orderBy: { createdAt: 'asc' },
    });

    const hardened = hardenPrompt(basePrompt, refFiles, agent.name);
    const systemPrompt = hardened.systemContent;

    // The last USER message in history is the current turn (stored unmasked at step 6).
    // Replace its content with the PII-masked version for the AI prompt.
    const lastUserIdx = history.findLastIndex((m) => m.role === 'USER');

    const aiMessages: ChatMessage[] = [
      { role: 'developer', content: systemPrompt },
      ...history.map((msg, i) => ({
        role: mapRoleToAI(msg.role),
        content: msg.role === 'USER'
          ? wrapUserMessage(i === lastUserIdx ? maskedMessageText : msg.content)
          : msg.content,
      })),
      { role: 'developer', content: buildSandwich() },
    ];

    // 10. Resolve tools and call AI adapter with tool loop
    const MAX_TOOL_ITERATIONS = 10;
    const toolsUsed: string[] = [];
    const aiModel = agent.modelOverride || agent.aiIntegration;
    const { definitions: toolDefs, executors: toolExecutors } = resolveTools(agent.enabledTools);

    const aiStartMs = performance.now();
    const initialCallStart = performance.now();
    const aiResult = await retryWithBackoff(
      () => callAI(params.workspaceId, agent, aiMessages, toolDefs),
      {
        shouldRetry: (r) => !r.success && r.retryable === true,
        getRetryAfterMs: (r) => r.retryAfterMs,
        onRetry: (attempt, r, delayMs) => {
          turnLog.push({ type: 'retry', attempt, error: r.error || 'Unknown', delayMs, ts: Date.now() });
        },
      },
    );
    const initialCallMs = Math.round(performance.now() - initialCallStart);
    const accumulatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    if (!aiResult.success || !aiResult.data) {
      const latencyMs = Math.round(performance.now() - aiStartMs);

      turnLog.push({ type: 'error', source: 'ai_failure', message: aiResult.error || 'AI call failed', ts: Date.now() });

      logStructured({
        correlationId,
        event: 'agent_ai_failure',
        workspaceId: params.workspaceId,
        provider: agent.aiIntegration,
        error: aiResult.error || 'AI call failed',
        metadata: { agentId: agent.id, conversationId: conversation.id, latencyMs },
      });

      await emitEvent({
        workspaceId: params.workspaceId,
        system: EventSystem.AGENT,
        eventType: 'agent_ai_failure',
        success: false,
        errorMessage: aiResult.error,
        metadata: {
          agentId: agent.id,
          conversationId: conversation.id,
          channel: params.channel,
          channelIntegration: params.channelIntegration,
          provider: agent.aiIntegration,
          correlationId,
          latencyMs: Math.round(performance.now() - aiStartMs),
        },
      });

      if (agent.fallbackMessage && !params.testMode) {
        await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, agent.fallbackMessage, 'reactive', conversation.id, channelCtx);
      }

      return {
        success: false,
        replyText: agent.fallbackMessage,
        conversationId: conversation.id,
        isNewConversation: isNew,
        status: ConversationStatus.ACTIVE,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: aiResult.error || 'AI completion failed',
        eventsEmitted,
        turnLog,
      };
    }

    // Tool loop: keep calling AI while it requests tool executions
    let completion = aiResult.data;
    accumulatedUsage.promptTokens += completion.usage.promptTokens;
    accumulatedUsage.completionTokens += completion.usage.completionTokens;
    accumulatedUsage.totalTokens += completion.usage.totalTokens;

    turnLog.push({
      type: 'ai_call',
      model: aiModel,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      finishReason: completion.finishReason,
      durationMs: initialCallMs,
      iteration: 0,
      ts: Date.now(),
      cacheCreationTokens: completion.usage.cacheCreationTokens,
      cacheReadTokens: completion.usage.cacheReadTokens,
    });

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (completion.finishReason !== 'tool_calls' || completion.toolCalls.length === 0) {
        break;
      }

      // Append assistant message with tool calls to conversation for the AI
      aiMessages.push({
        role: 'assistant',
        content: completion.content || '',
      });

      // Execute each tool call and append results
      for (const toolCall of completion.toolCalls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          parsedArgs = {};
        }

        const toolStart = performance.now();
        const toolResult = await executeTool(toolName, {
          workspaceId: params.workspaceId,
          agentId: agent.id,
          conversationId: conversation.id,
          leadId: params.leadId,
          args: parsedArgs,
        });
        const durationMs = Math.round(performance.now() - toolStart);

        turnLog.push({
          type: 'tool_call',
          tool: toolName,
          args: parsedArgs,
          result: {
            success: toolResult.success,
            data: toolResult.success ? toolResult.data : undefined,
            error: toolResult.success ? undefined : toolResult.error,
          },
          durationMs,
          iteration: iteration + 1,
          ts: Date.now(),
        });

        logStructured({
          correlationId,
          event: 'agent_tool_executed',
          workspaceId: params.workspaceId,
          provider: 'agent',
          success: toolResult.success,
          metadata: {
            agentId: agent.id,
            conversationId: conversation.id,
            tool: toolName,
            iteration,
            durationMs,
          },
        });

        aiMessages.push({
          role: 'tool',
          content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
          tool_call_id: toolCall.id,
        });
      }

      // Re-call AI with tool results
      const loopCallStart = performance.now();
      const loopResult = await retryWithBackoff(
        () => callAI(params.workspaceId, agent, aiMessages, toolDefs),
        {
          shouldRetry: (r) => !r.success && r.retryable === true,
          getRetryAfterMs: (r) => r.retryAfterMs,
          onRetry: (attempt, r, delayMs) => {
            turnLog.push({ type: 'retry', attempt, error: r.error || 'Unknown', delayMs, ts: Date.now() });
          },
        },
      );
      const loopCallMs = Math.round(performance.now() - loopCallStart);

      if (!loopResult.success || !loopResult.data) {
        turnLog.push({ type: 'error', source: 'ai_failure_in_tool_loop', message: loopResult.error || 'AI call failed during tool loop', ts: Date.now() });

        logStructured({
          correlationId,
          event: 'agent_ai_failure_in_tool_loop',
          workspaceId: params.workspaceId,
          provider: agent.aiIntegration,
          error: loopResult.error || 'AI call failed during tool loop',
          metadata: { agentId: agent.id, conversationId: conversation.id, iteration },
        });

        await emitEvent({
          workspaceId: params.workspaceId,
          system: EventSystem.AGENT,
          eventType: 'agent_ai_failure_in_tool_loop',
          success: false,
          errorMessage: loopResult.error || 'AI call failed during tool loop',
          metadata: {
            agentId: agent.id,
            conversationId: conversation.id,
            channel: params.channel,
            channelIntegration: params.channelIntegration,
            provider: agent.aiIntegration,
            correlationId,
            iteration,
          },
        });
        break;
      }

      completion = loopResult.data;
      accumulatedUsage.promptTokens += completion.usage.promptTokens;
      accumulatedUsage.completionTokens += completion.usage.completionTokens;
      accumulatedUsage.totalTokens += completion.usage.totalTokens;

      turnLog.push({
        type: 'ai_call',
        model: aiModel,
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens,
        finishReason: completion.finishReason,
        durationMs: loopCallMs,
        iteration: iteration + 1,
        ts: Date.now(),
        cacheCreationTokens: completion.usage.cacheCreationTokens,
        cacheReadTokens: completion.usage.cacheReadTokens,
      });
    }

    const latencyMs = Math.round(performance.now() - aiStartMs);
    completion = { ...completion, usage: accumulatedUsage };
    let replyText = completion.content || '';

    // 10a. Output guardrails — filter before any further processing
    const outputResult = filterOutput(replyText, basePrompt, agent.guardrails);
    if (outputResult.modifications.length > 0) {
      replyText = outputResult.text;
      for (const mod of outputResult.modifications) {
        turnLog.push({ type: 'guardrail', guardrail: mod.type, detail: mod.detail, ts: Date.now() });
      }
      if (outputResult.blocked) {
        turnLog.push({ type: 'guardrail', guardrail: 'output_blocked', detail: 'Response replaced by guardrail', ts: Date.now() });
      }
    }

    // 10b. Escalation detection
    const escPattern = agent.escalationPattern || '[ESCALATE]';
    if (replyText.includes(escPattern)) {
      const cleanedReply = replyText.replace(escPattern, '').trim();

      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: cleanedReply || 'Let me connect you with a team member.',
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          turnLog: turnLog.length > 0 ? (turnLog as unknown as Prisma.InputJsonValue) : undefined,
        },
      });

      const aiEscResolution = deriveResolution(ConversationStatus.ESCALATED, toolsUsed, conversation.messageCount + 2);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: ConversationStatus.ESCALATED,
          endedAt: new Date(),
          messageCount: { increment: 2 },
          totalTokens: { increment: completion.usage.totalTokens },
          lastMessageAt: new Date(),
          metadata: mergeResolutionMetadata(conversation.metadata, aiEscResolution),
        },
      });

      if (cleanedReply && !params.testMode) {
        if (shouldApplyDelay(params) && agent.responseDelaySeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
        }
        await sendReply(params.workspaceId, agent, params.channelAddress, params.contactAddress, cleanedReply, 'reactive', conversation.id, channelCtx);
      }

      await emitAgentEvent(params.workspaceId, 'escalation_requested', {
        agentId: agent.id,
        conversationId: conversation.id,
        reason: 'ai_escalation',
        resolution: aiEscResolution,
        leadId: params.leadId,
      });
      eventsEmitted.push('escalation_requested');

      turnLog.push({ type: 'escalation', pattern: escPattern, ts: Date.now() });
      turnLog.push({ type: 'event', event: 'escalation_requested', ts: Date.now() });

      try {
        const { notifyEscalation } = await import('./escalation');
        const summary = await buildConversationSummary(conversation.id);
        await notifyEscalation({
          workspaceId: params.workspaceId,
          agentId: agent.id,
          conversationId: conversation.id,
          contactAddress: params.contactAddress,
          summary,
        });
      } catch (err) {
        logStructured({
          correlationId,
          event: 'agent_escalation_notification_failed',
          workspaceId: params.workspaceId,
          provider: 'agent',
          error: err instanceof Error ? err.message : 'Escalation notification failed',
          metadata: { agentId: agent.id, conversationId: conversation.id },
        });
      }

      notifyResolution({
        workspaceId: params.workspaceId, agentId: agent.id, conversationId: conversation.id,
        contactAddress: params.contactAddress, resolution: aiEscResolution, channel: params.channel, channelIntegration: params.channelIntegration,
      }).catch(() => {});

      return {
        success: true,
        replyText: cleanedReply,
        conversationId: conversation.id,
        isNewConversation: isNew,
        status: ConversationStatus.ESCALATED,
        usage: completion.usage,
        eventsEmitted,
        latencyMs,
        responseDelaySkipped: params.testMode && agent.responseDelaySeconds > 0 ? agent.responseDelaySeconds : undefined,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        turnLog,
      };
    }

    // 11. Store ASSISTANT response + update counters atomically
    const newMessageCount = conversation.messageCount + 2; // USER + ASSISTANT
    const newTotalTokens = conversation.totalTokens + completion.usage.totalTokens;
    const hitTokenLimit = newTotalTokens >= agent.maxTokensPerConversation;
    const finalStatus: ConversationStatus = hitTokenLimit ? ConversationStatus.COMPLETED : ConversationStatus.ACTIVE;
    const tokenResolution: string | null = hitTokenLimit ? deriveResolution(ConversationStatus.COMPLETED, toolsUsed, newMessageCount) : null;

    await withTransaction(async (tx) => {
      await tx.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: replyText,
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          turnLog: turnLog.length > 0 ? (turnLog as unknown as Prisma.InputJsonValue) : undefined,
        },
      });

      const tokenLimitData = hitTokenLimit && tokenResolution ? {
        status: ConversationStatus.COMPLETED,
        endedAt: new Date(),
        metadata: mergeResolutionMetadata(conversation.metadata, tokenResolution),
      } : {};

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          messageCount: newMessageCount,
          totalTokens: newTotalTokens,
          lastMessageAt: new Date(),
          ...tokenLimitData,
        },
      });
    });

    if (hitTokenLimit && tokenResolution) {
      await emitAgentEvent(params.workspaceId, 'conversation_completed', {
        agentId: agent.id,
        conversationId: conversation.id,
        reason: 'token_limit',
        resolution: tokenResolution,
        leadId: params.leadId,
      });
      eventsEmitted.push('conversation_completed');

      notifyResolution({
        workspaceId: params.workspaceId, agentId: agent.id, conversationId: conversation.id,
        contactAddress: params.contactAddress, resolution: tokenResolution, channel: params.channel, channelIntegration: params.channelIntegration,
      }).catch(() => {});

      turnLog.push({ type: 'guardrail', guardrail: 'token_limit', detail: `Reached ${agent.maxTokensPerConversation} token limit`, ts: Date.now() });
      turnLog.push({ type: 'event', event: 'conversation_completed', ts: Date.now() });
    }

    // 13b. AI disclosure — prepend on first message of new conversation
    if (isNew && !agent.guardrails.skipAiDisclosure && replyText) {
      const disclosure = agent.guardrails.aiDisclosureMessage.replace('{agentName}', agent.name);
      replyText = `${disclosure}\n\n${replyText}`;
      turnLog.push({ type: 'guardrail', guardrail: 'ai_disclosure', detail: 'Prepended AI disclosure', ts: Date.now() });
    }

    // 14. Apply response delay then send reply via channel adapter
    const delaySkipped = params.testMode && agent.responseDelaySeconds > 0
      ? agent.responseDelaySeconds
      : undefined;

    if (replyText && !params.testMode) {
      if (shouldApplyDelay(params) && agent.responseDelaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
      }
      await sendReply(
        params.workspaceId,
        agent,
        params.channelAddress,
        params.contactAddress,
        replyText,
        'reactive',
        conversation.id,
        channelCtx,
      );
    }

    // 15. Emit response event
    await emitEvent({
      workspaceId: params.workspaceId,
      system: EventSystem.AGENT,
      eventType: 'agent_response_sent',
      success: true,
      metadata: {
        agentId: agent.id,
        conversationId: conversation.id,
        channel: params.channel,
        channelIntegration: params.channelIntegration,
        provider: agent.aiIntegration,
        correlationId,
        tokensUsed: completion.usage.totalTokens,
      },
    });

    logStructured({
      correlationId,
      event: 'agent_turn_complete',
      workspaceId: params.workspaceId,
      provider: agent.aiIntegration,
      success: true,
      metadata: {
        agentId: agent.id,
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
      latencyMs,
      responseDelaySkipped: delaySkipped,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      turnLog,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown engine error';

    logStructured({
      correlationId,
      event: 'agent_engine_error',
      workspaceId: params.workspaceId,
      provider: 'agent',
      error: msg,
      metadata: { agentId: params.agentId },
    });

    return errorResponse(msg, correlationId);
  }
}

/**
 * Initiate a proactive outreach conversation.
 *
 * Unlike handleInboundMessage (reactive), this starts a conversation
 * without an inbound message. The agent sends its initialMessage (or
 * a workflow-supplied override) to the contact via the configured channel.
 *
 * Contact address is resolved from lead properties using the channel
 * registry's contactField -- fully agnostic, zero hardcoding.
 */
export async function initiateConversation(
  params: InitiateConversationParams
): Promise<AgentResponse> {
  const correlationId = crypto.randomUUID();
  const eventsEmitted: string[] = [];

  try {
    // 1. Load agent
    const agent = await loadAgent(params.workspaceId, params.agentId);
    if (!agent) {
      return errorResponse('Agent not found or inactive', correlationId);
    }

    // 1a. Resolve the requested channel from agent.channels
    const selectedChannel = params.channelType
      ? agent.channels.find((c) => c.channel === params.channelType)
      : agent.channels[0]; // fallback: first configured channel

    const chType = selectedChannel?.channel ?? agent.channelType ?? 'SMS';
    const chIntegration = selectedChannel?.integration ?? agent.channelIntegration;
    const chAddress = selectedChannel?.address ?? agent.channelAddress;

    const channelCtx: SendChannelContext | undefined = chIntegration
      ? { channel: chType, channelIntegration: chIntegration, channelAddress: chAddress || '' }
      : undefined;

    // 1b. Quiet hours check for proactive outreach (before any DB writes)
    if (!params.testMode && shouldEnforceQuietHours(chType)) {
      const gate = checkSendWindow(agent.timezone);
      if (!gate.allowed) {
        logStructured({
          correlationId,
          event: 'agent_send_blocked_quiet_hours',
          workspaceId: params.workspaceId,
          provider: chIntegration || 'agent',
          success: false,
          metadata: {
            agentId: agent.id,
            sendType: 'proactive',
            localHour: gate.localHour,
            localMinute: gate.localMinute,
            timezone: agent.timezone,
            nextWindowAt: gate.nextWindowAt?.toISOString(),
          },
        });
        return {
          success: false,
          replyText: null,
          conversationId: '',
          isNewConversation: false,
          status: ConversationStatus.ACTIVE,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          error: 'outside_send_window',
          eventsEmitted: [],
          blockedByQuietHours: true,
          nextWindowAt: gate.nextWindowAt ?? undefined,
        };
      }
    }

    // 2. Validate channel is configured
    if (!chIntegration || !chAddress) {
      if (params.testMode) {
        // Test mode: skip channel delivery, just store in DB
      } else {
        return errorResponse(
          'Agent has no channel configured. Add a channel in the agent editor before proactive outreach.',
          correlationId
        );
      }
    }

    // 3. Resolve contact address from lead properties via registry
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: { email: true, source: true, stage: true, properties: true },
    });
    if (!lead) {
      return errorResponse('Lead not found', correlationId);
    }

    let contactAddress: string | null = null;

    if (chIntegration) {
      const contactField = getContactFieldForChannel(chIntegration);
      if (!contactField) {
        return errorResponse(
          `No contactField defined for channel: ${chIntegration}`,
          correlationId
        );
      }

      const props = (lead.properties && typeof lead.properties === 'object')
        ? lead.properties as Record<string, unknown>
        : {};
      const rawValue = props[contactField];
      contactAddress = rawValue ? String(rawValue) : null;
    }

    if (!contactAddress && !params.testMode) {
      const fieldName = chIntegration
        ? getContactFieldForChannel(chIntegration) || 'unknown'
        : 'unknown';
      return errorResponse(
        `Lead is missing "${fieldName}" property required for ${chIntegration || 'channel'} outreach`,
        correlationId
      );
    }

    // 4. Check opt-out
    if (contactAddress && !params.testMode) {
      const optOut = await prisma.optOutRecord.findUnique({
        where: {
          workspaceId_contactAddress: {
            workspaceId: params.workspaceId,
            contactAddress,
          },
        },
      });
      if (optOut) {
        return {
          success: false,
          replyText: null,
          conversationId: '',
          isNewConversation: false,
          status: ConversationStatus.COMPLETED,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          error: 'contact_opted_out',
          eventsEmitted: [],
        };
      }
    }

    // 4b. Check consent for proactive outreach
    if (contactAddress && !params.testMode) {
      const consent = await checkConsent(params.workspaceId, contactAddress, chType);
      if (!consent) {
        logStructured({
          correlationId,
          event: 'agent_send_blocked_no_consent',
          workspaceId: params.workspaceId,
          provider: chIntegration || 'agent',
          success: false,
          metadata: {
            agentId: agent.id,
            contactAddress,
            channel: chType,
          },
        });
        return {
          success: false,
          replyText: null,
          conversationId: '',
          isNewConversation: false,
          status: ConversationStatus.ACTIVE,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          error: 'no_consent',
          eventsEmitted: [],
        };
      }
    }

    // 5. Determine outbound text
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { name: true },
    });
    const workspaceName = workspace?.name || '';

    const rawText = params.messageText || agent.initialMessage;
    if (!rawText) {
      return errorResponse(
        'No message to send: agent has no initialMessage and no messageText was provided',
        correlationId
      );
    }

    const outboundText = interpolateLeadVariables(rawText, lead, workspaceName);

    // 6. Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: params.workspaceId,
        agentId: agent.id,
        leadId: params.leadId,
        channel: chType,
        channelIntegration: chIntegration || null,
        contactAddress: contactAddress || `test-${params.leadId}`,
        channelAddress: chAddress || '',
        status: ConversationStatus.ACTIVE,
        isTest: params.testMode ?? false,
      },
      select: { id: true },
    });

    // 7. Store the ASSISTANT message
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: outboundText,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { messageCount: 1, lastMessageAt: new Date() },
    });

    // 8. Send via channel (skip in test mode or when no channel)
    if (!params.testMode && chIntegration && chAddress && contactAddress) {
      if (agent.responseDelaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, agent.responseDelaySeconds * 1000));
      }
      await sendReply(
        params.workspaceId,
        agent,
        chAddress,
        contactAddress,
        outboundText,
        'proactive',
        conversation.id,
        channelCtx,
      );
    }

    // 9. Emit conversation_started
    await emitAgentEvent(params.workspaceId, 'conversation_started', {
      agentId: agent.id,
      conversationId: conversation.id,
      contactAddress: contactAddress || '',
      channel: chType,
      leadId: params.leadId,
    });
    eventsEmitted.push('conversation_started');

    logStructured({
      correlationId,
      event: 'agent_conversation_initiated',
      workspaceId: params.workspaceId,
      provider: agent.channelIntegration || 'test',
      success: true,
      metadata: {
        agentId: agent.id,
        conversationId: conversation.id,
        contactAddress: maskContact(contactAddress || ''),
        mode: 'proactive',
      },
    });

    return {
      success: true,
      replyText: outboundText,
      conversationId: conversation.id,
      isNewConversation: true,
      status: ConversationStatus.ACTIVE,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      eventsEmitted,
      responseDelaySkipped: params.testMode && agent.responseDelaySeconds > 0
        ? agent.responseDelaySeconds
        : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown engine error';
    logStructured({
      correlationId,
      event: 'agent_initiate_error',
      workspaceId: params.workspaceId,
      provider: 'agent',
      error: msg,
      metadata: { agentId: params.agentId },
    });
    return errorResponse(msg, correlationId);
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

const AgentChannelsSchema = z.array(z.object({
  channel: z.string(),
  integration: z.string(),
  address: z.string().optional(),
})).catch([]);

const StringArraySchema = z.array(z.string()).catch([]);

const FollowUpSequenceSchema = z.array(z.object({
  delayMinutes: z.number(),
  message: z.string().optional(),
  variants: z.array(z.string()).optional(),
})).catch([]);

const GuardrailsJsonSchema = z.object({
  emergencyKeywords: z.array(z.string()).optional(),
  prohibitedPhrases: z.array(z.string()).optional(),
  allowedIntents: z.array(z.string()).optional(),
  offTopicRefusal: z.string().optional(),
  maxSmsSegments: z.number().optional(),
  aiDisclosureMessage: z.string().optional(),
  emergencyRefusal: z.string().optional(),
  skipAiDisclosure: z.boolean().optional(),
}).partial().nullable().catch(null);

export async function loadAgent(
  workspaceId: string,
  agentId: string
): Promise<AgentConfig | null> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId, active: true },
    include: { workspace: { select: { timezone: true } } },
  });

  if (!agent) return null;

  const channels = AgentChannelsSchema.parse(agent.channels);
  const allowedEvents = StringArraySchema.parse(agent.allowedEvents);
  const enabledTools = StringArraySchema.parse(agent.enabledTools);
  const followUpSequence = FollowUpSequenceSchema.parse(agent.followUpSequence);
  const guardrailsRaw = GuardrailsJsonSchema.parse(agent.guardrails);

  return {
    id: agent.id,
    name: agent.name,
    channels: channels.map((c) => ({
      channel: c.channel as 'SMS' | 'EMAIL' | 'WEB_CHAT',
      integration: c.integration as 'TWILIO' | 'RESEND' | 'BUILT_IN',
      address: c.address,
    })),
    channelType: agent.channelType,
    channelIntegration: agent.channelIntegration,
    channelAddress: agent.channelAddress,
    aiIntegration: agent.aiIntegration,
    systemPrompt: agent.systemPrompt,
    initialMessage: agent.initialMessage,
    modelOverride: agent.modelOverride,
    temperatureOverride: agent.temperatureOverride,
    maxTokensOverride: agent.maxTokensOverride,
    maxMessagesPerConversation: agent.maxMessagesPerConversation,
    maxTokensPerConversation: agent.maxTokensPerConversation,
    conversationTimeoutMinutes: agent.conversationTimeoutMinutes,
    responseDelaySeconds: agent.responseDelaySeconds,
    autoResumeMinutes: agent.autoResumeMinutes,
    rateLimitPerHour: agent.rateLimitPerHour,
    fallbackMessage: agent.fallbackMessage,
    escalationPattern: agent.escalationPattern,
    faqOverrides: parseFaqOverrides(agent.faqOverrides),
    allowedEvents,
    enabledTools,
    active: agent.active,
    timezone: agent.workspace.timezone,
    allowUnicode: agent.allowUnicode,
    followUpEnabled: agent.followUpEnabled,
    followUpAiGenerated: agent.followUpAiGenerated,
    followUpSequence,
    guardrails: resolveGuardrails(guardrailsRaw),
  };
}

async function findOrCreateConversation(
  params: InboundMessageParams,
  agent: AgentConfig
): Promise<{ conversation: { id: string; status: ConversationStatus; messageCount: number; totalTokens: number; startedAt: Date; lastMessageAt: Date | null; pausedAt: Date | null; metadata: Prisma.JsonValue | null }; isNew: boolean }> {
  const isTest = params.testMode ?? false;
  const selectFields = {
    id: true,
    status: true,
    messageCount: true,
    totalTokens: true,
    startedAt: true,
    lastMessageAt: true,
    pausedAt: true,
    metadata: true,
  } as const;

  if (params.conversationId) {
    const byId = await prisma.conversation.findFirst({
      where: { id: params.conversationId, workspaceId: params.workspaceId, agentId: agent.id },
      select: selectFields,
    });
    if (byId) {
      return { conversation: byId, isNew: false };
    }
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      workspaceId: params.workspaceId,
      agentId: agent.id,
      contactAddress: params.contactAddress,
      channelAddress: params.channelAddress,
      status: { in: [ConversationStatus.ACTIVE, ConversationStatus.PAUSED] },
      isTest,
    },
    select: selectFields,
  });

  if (existing) {
    return { conversation: existing, isNew: false };
  }

  const created = await prisma.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      agentId: agent.id,
      leadId: params.leadId || null,
      channel: params.channel,
      channelIntegration: params.channelIntegration || null,
      contactAddress: params.contactAddress,
      channelAddress: params.channelAddress,
      status: ConversationStatus.ACTIVE,
      isTest,
    },
    select: selectFields,
  });

  return { conversation: created, isNew: true };
}

function deriveResolution(
  status: ConversationStatus,
  toolsUsed: string[],
  messageCount: number,
): string {
  if (status === ConversationStatus.ESCALATED) return 'hard_escalation';
  if (status === ConversationStatus.PAUSED) return 'paused';
  if (toolsUsed.includes('book_appointment')) return 'booked';
  if (status === ConversationStatus.TIMED_OUT && messageCount <= 1) return 'no_response';
  if (status === ConversationStatus.COMPLETED && messageCount > 2) return 'soft_escalation';
  return 'completed';
}

function mergeResolutionMetadata(
  existing: Prisma.JsonValue | null,
  resolution: string,
): Prisma.InputJsonValue {
  const base = (existing && typeof existing === 'object' && !Array.isArray(existing))
    ? existing as Record<string, unknown>
    : {};
  return { ...base, resolution } satisfies Prisma.JsonObject;
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

export async function callAI(
  workspaceId: string,
  agent: AgentConfig,
  messages: ChatMessage[],
  tools?: ToolDefinition[]
): Promise<IntegrationResult<ChatCompletionResult>> {
  const entry = resolveAI(agent.aiIntegration);
  if (!entry) {
    return { success: false, error: `Unsupported AI integration: ${agent.aiIntegration}` };
  }

  const adapter = await entry.forWorkspace(workspaceId);
  if (!adapter) {
    return { success: false, error: `${entry.label} not configured for this workspace` };
  }

  return adapter.chatCompletion({
    messages,
    model: agent.modelOverride || undefined,
    temperature: agent.temperatureOverride ?? undefined,
    maxTokens: agent.maxTokensOverride ?? undefined,
    tools: tools && tools.length > 0 ? tools : undefined,
    toolChoice: tools && tools.length > 0 ? 'auto' : undefined,
  });
}

export async function sendReply(
  workspaceId: string,
  agent: AgentConfig,
  fromAddress: string,
  toAddress: string,
  body: string,
  sendType: SendType = 'reactive',
  conversationId?: string,
  channelCtx?: SendChannelContext,
): Promise<SendReplyResult> {
  const chIntegration = channelCtx?.channelIntegration ?? agent.channelIntegration;
  const chType = channelCtx?.channel ?? agent.channelType;

  if (!chIntegration || chIntegration === 'BUILT_IN') {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_send_skipped',
      workspaceId,
      provider: 'agent',
      success: true,
      metadata: { agentId: agent.id, reason: chIntegration === 'BUILT_IN' ? 'webchat_synchronous' : 'no_channel_configured' },
    });
    return { sent: false };
  }

  // Quiet hours send gate
  if (shouldEnforceQuietHours(chType)) {
    const gate = checkSendWindow(agent.timezone);
    if (!gate.allowed) {
      if (sendType === 'proactive') {
        logStructured({
          correlationId: crypto.randomUUID(),
          event: 'agent_send_blocked_quiet_hours',
          workspaceId,
          provider: chIntegration,
          success: false,
          metadata: {
            agentId: agent.id,
            sendType,
            localHour: gate.localHour,
            localMinute: gate.localMinute,
            timezone: agent.timezone,
            nextWindowAt: gate.nextWindowAt?.toISOString(),
          },
        });
        return { sent: false, blockedByQuietHours: true, nextWindowAt: gate.nextWindowAt ?? undefined };
      }
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'agent_send_outside_window',
        workspaceId,
        provider: chIntegration,
        success: true,
        metadata: {
          agentId: agent.id,
          sendType,
          localHour: gate.localHour,
          localMinute: gate.localMinute,
          timezone: agent.timezone,
        },
      });
    }
  }

  const entry = resolveChannel(chIntegration);
  if (!entry) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_unsupported_channel',
      workspaceId,
      provider: chIntegration,
      error: `Unsupported channel: ${chIntegration}`,
      metadata: { agentId: agent.id },
    });
    return { sent: false };
  }

  const adapter = await entry.forWorkspace(workspaceId);
  if (!adapter) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_channel_not_configured',
      workspaceId,
      provider: chIntegration,
      error: `${entry.label} not configured for this workspace`,
      metadata: { agentId: agent.id },
    });
    return { sent: false };
  }

  let sanitizedBody = body;
  if (shouldSanitizeSms(chType) && !agent.allowUnicode) {
    sanitizedBody = sanitizeForGsm7(body);
  }

  // SMS segment cap enforcement
  if (shouldSanitizeSms(chType)) {
    const preCapSegments = estimateSegments(sanitizedBody);
    if (preCapSegments.segments > agent.guardrails.maxSmsSegments) {
      sanitizedBody = truncateToSegments(sanitizedBody, agent.guardrails.maxSmsSegments);
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'agent_sms_truncated',
        workspaceId,
        provider: chIntegration,
        success: true,
        metadata: {
          agentId: agent.id,
          originalSegments: preCapSegments.segments,
          maxSegments: agent.guardrails.maxSmsSegments,
        },
      });
    }
  }

  const segments = estimateSegments(sanitizedBody);
  logStructured({
    correlationId: crypto.randomUUID(),
    event: 'agent_sms_segments',
    workspaceId,
    provider: chIntegration,
    success: true,
    metadata: {
      agentId: agent.id,
      encoding: segments.encoding,
      segments: segments.segments,
      characters: segments.characters,
      sanitized: sanitizedBody !== body,
    },
  });

  let metadata: ChannelMessageMetadata | undefined;
  if (chType?.toUpperCase() === 'EMAIL' && conversationId) {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true, messageCount: true },
    });
    const convoMeta = (convo?.metadata as Record<string, unknown>) || {};
    const lastMessageId = convoMeta.lastEmailMessageId as string | undefined;
    const emailSubject = (convoMeta.emailSubject as string) || `Message from ${agent.name || 'Agent'}`;

    metadata = {
      subject: lastMessageId ? `Re: ${emailSubject}` : emailSubject,
      inReplyTo: lastMessageId,
      references: lastMessageId || undefined,
    };
  }

  let result: IntegrationResult<unknown>;
  try {
    result = await adapter.sendMessage(fromAddress, toAddress, sanitizedBody, metadata);
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_send_failed',
      workspaceId,
      provider: chIntegration,
      success: false,
      error: err instanceof Error ? err.message : 'Channel adapter threw',
      metadata: { agentId: agent.id },
    });
    return { sent: false };
  }
  if (!result.success) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_send_failed',
      workspaceId,
      provider: chIntegration,
      success: false,
      error: result.error || 'Send failed',
      metadata: { agentId: agent.id },
    });
    return { sent: false };
  }

  if (chType?.toUpperCase() === 'EMAIL' && conversationId && result.data) {
    const sendResult = result.data as { messageId?: string };
    if (sendResult.messageId) {
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { metadata: true },
      });
      const existingMeta = (convo?.metadata as Record<string, unknown>) || {};
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...existingMeta,
            lastEmailMessageId: `<${sendResult.messageId}>`,
            emailSubject: existingMeta.emailSubject || `Message from ${agent.name || 'Agent'}`,
          } satisfies Prisma.JsonObject,
        },
      });
    }
  }

  dispatchPostSendHooks({ workspaceId, agent, contactAddress: toAddress, body: sanitizedBody, channelType: chType ?? undefined }).catch(() => {});

  return { sent: true };
}

async function emitAgentEvent(
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { leadId, ...meta } = payload;
  await emitEvent({
    workspaceId,
    leadId: leadId as string | undefined,
    system: EventSystem.AGENT,
    eventType: `agent_${eventType}`,
    success: true,
    metadata: meta,
  });

  await emitTrigger(
    workspaceId,
    { adapter: 'agent', operation: eventType },
    payload
  );
}

const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'OPT OUT', 'END', 'STOP ALL'];

function isOptOutMessage(text: string): string | false {
  const normalized = text.trim().toUpperCase();
  const matched = OPT_OUT_KEYWORDS.find((kw) => normalized === kw);
  return matched || false;
}

/**
 * Interpolate lead variables in a template string.
 * Supports: {{firstName}}, {{lastName}}, {{email}}, {{phone}}, {{stage}},
 * {{source}}, {{workspaceName}}, and {{properties.KEY}} for custom metadata.
 */
function interpolateLeadVariables(
  template: string,
  lead: { email: string; source: string | null; stage: string; properties: unknown } | null,
  workspaceName: string
): string {
  const props = (lead?.properties && typeof lead.properties === 'object') ? lead.properties as Record<string, unknown> : {};

  const firstName = String(props.firstName || props.first_name || lead?.email?.split('@')[0] || '');
  const lastName = String(props.lastName || props.last_name || '');
  const phone = String(props.phone || props.phoneNumber || props.phone_number || '');

  const vars: Record<string, string> = {
    firstName,
    lastName,
    email: lead?.email || '',
    phone,
    stage: lead?.stage || '',
    source: lead?.source || '',
    workspaceName,
  };

  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    if (key.startsWith('properties.')) {
      const propKey = key.slice('properties.'.length);
      const val = props[propKey];
      return val != null ? String(val) : '';
    }
    return vars[key] ?? '';
  });
}

function errorResponse(error: string, _correlationId: string): AgentResponse {
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

function parseFaqOverrides(
  raw: unknown
): Array<{ patterns: string[]; response: string }> | null {
  if (!raw || !Array.isArray(raw)) return null;
  return raw.filter(
    (item): item is { patterns: string[]; response: string } =>
      item && Array.isArray(item.patterns) && typeof item.response === 'string'
  );
}

function matchFaq(
  message: string,
  faqRules: Array<{ patterns: string[]; response: string }>
): string | null {
  const lower = message.toLowerCase();
  for (const rule of faqRules) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return rule.response;
      }
    }
  }
  return null;
}

async function buildConversationSummary(conversationId: string): Promise<string> {
  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, createdAt: true },
    take: 30,
  });

  if (messages.length === 0) return 'No messages in conversation.';

  return messages
    .map((m) => {
      const time = m.createdAt.toISOString().slice(11, 16);
      const label = m.role === 'USER' ? 'Lead' : 'Bot';
      return `[${time}] ${label}: ${m.content}`;
    })
    .join('\n');
}
