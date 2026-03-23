/**
 * Follow-Up Scheduler
 *
 * DB-backed follow-up system that re-engages silent leads at configurable
 * intervals. Supports both AI-generated and template-based messages.
 *
 * All outbound delivery goes through the engine's `sendReply()` pipeline,
 * so quiet hours, SMS sanitization, and retry apply automatically.
 *
 * STANDARDS:
 * - Workspace-isolated: every query scoped to workspaceId
 * - Fail-safe: AI failures fall back to agent.fallbackMessage or skip
 * - Event-driven: emits follow_up_sent, follow_up_skipped, follow_up_cancelled
 */

import { prisma } from '@/app/_lib/db';
import { ConversationStatus, FollowUpStatus } from '@prisma/client';
import { logStructured } from '@/app/_lib/reliability';
import type { AgentConfig } from './types';
import type { ChatMessage } from '@/app/_lib/integrations';
import { retryWithBackoff } from './retry';
import { sendReply, callAI } from './engine';
import { withTransaction } from '@/app/_lib/utils/transaction';

export interface FollowUpRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  agentId: string;
  contactAddress: string;
  channelAddress: string;
  stepIndex: number;
  scheduledAt: Date;
  status: FollowUpStatus;
  createdAt: Date;
}

export interface ProcessResult {
  action: 'sent' | 'skipped' | 'rescheduled' | 'cancelled';
  reason?: string;
  messageText?: string;
}

/**
 * Schedule follow-up rows for a conversation. Called by the cron job when
 * it detects an idle conversation that qualifies for follow-ups.
 *
 * Only creates the first step; subsequent steps are scheduled after each
 * follow-up is sent.
 */
export async function scheduleFollowUp(
  conversationId: string,
  workspaceId: string,
  agentId: string,
  contactAddress: string,
  channelAddress: string,
  stepIndex: number,
  delayMinutes: number
): Promise<void> {
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  await prisma.followUp.create({
    data: {
      workspaceId,
      conversationId,
      agentId,
      contactAddress,
      channelAddress,
      stepIndex,
      scheduledAt,
      status: FollowUpStatus.PENDING,
    },
  });

  logStructured({
    correlationId: crypto.randomUUID(),
    event: 'follow_up_scheduled',
    workspaceId,
    provider: 'agent',
    success: true,
    metadata: { conversationId, agentId, stepIndex, scheduledAt: scheduledAt.toISOString() },
  });
}

/**
 * Cancel all PENDING follow-ups for a conversation.
 * Called when: lead responds, lead opts out, conversation ends/escalates.
 */
export async function cancelPendingFollowUps(
  conversationId: string,
  reason: string = 'lead_responded',
  workspaceId?: string
): Promise<number> {
  const where: { conversationId: string; status: FollowUpStatus; workspaceId?: string } = {
    conversationId,
    status: FollowUpStatus.PENDING,
  };
  if (workspaceId) where.workspaceId = workspaceId;

  const result = await prisma.followUp.updateMany({
    where,
    data: { status: FollowUpStatus.CANCELLED, skipReason: reason },
  });

  if (result.count > 0) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'follow_up_cancelled',
      workspaceId: workspaceId || '',
      provider: 'agent',
      success: true,
      metadata: { conversationId, cancelledCount: result.count, reason },
    });
  }

  return result.count;
}

/**
 * Process a single due follow-up. Runs pre-send checks, generates the
 * message (AI or template), sends via channel, and schedules the next step.
 */
export async function processFollowUp(
  followUp: FollowUpRecord,
  agent: AgentConfig
): Promise<ProcessResult> {
  const correlationId = crypto.randomUUID();

  // Pre-send check 1: conversation still ACTIVE?
  const conversation = await prisma.conversation.findUnique({
    where: { id: followUp.conversationId },
    select: { status: true, lastMessageAt: true },
  });

  if (!conversation || conversation.status !== ConversationStatus.ACTIVE) {
    await markSkipped(followUp.id, 'conversation_ended');
    return { action: 'skipped', reason: 'conversation_ended' };
  }

  // Pre-send check 2: lead responded since this follow-up was created?
  if (conversation.lastMessageAt && conversation.lastMessageAt > followUp.createdAt) {
    const lastMessage = await prisma.conversationMessage.findFirst({
      where: { conversationId: followUp.conversationId, role: 'USER', createdAt: { gt: followUp.createdAt } },
      select: { id: true },
    });
    if (lastMessage) {
      await cancelPendingFollowUps(followUp.conversationId, 'lead_responded', followUp.workspaceId);
      return { action: 'cancelled', reason: 'lead_responded' };
    }
  }

  // Pre-send check 3: opted out?
  const optOut = await prisma.optOutRecord.findUnique({
    where: {
      workspaceId_contactAddress: {
        workspaceId: followUp.workspaceId,
        contactAddress: followUp.contactAddress,
      },
    },
  });
  if (optOut) {
    await cancelPendingFollowUps(followUp.conversationId, 'opted_out', followUp.workspaceId);
    return { action: 'cancelled', reason: 'opted_out' };
  }

  // Generate message
  let messageText: string | null = null;

  if (agent.followUpAiGenerated) {
    messageText = await generateFollowUpMessage(followUp.workspaceId, agent, followUp.conversationId);
  } else {
    const step = agent.followUpSequence[followUp.stepIndex];
    if (step?.variants && step.variants.length > 0) {
      const picked = await selectVariant(step.variants, followUp.conversationId, followUp.stepIndex);
      if (picked) {
        messageText = await interpolateFollowUpTemplate(picked, followUp);
      }
    }
    if (!messageText && step?.message) {
      messageText = await interpolateFollowUpTemplate(step.message, followUp);
    }
  }

  if (!messageText) {
    messageText = agent.fallbackMessage;
  }

  if (!messageText) {
    await markSkipped(followUp.id, 'no_message_generated');
    logStructured({
      correlationId,
      event: 'follow_up_skipped',
      workspaceId: followUp.workspaceId,
      provider: 'agent',
      success: false,
      metadata: { followUpId: followUp.id, reason: 'no_message_generated' },
    });
    return { action: 'skipped', reason: 'no_message_generated' };
  }

  // Send via engine's sendReply (handles quiet hours, SMS sanitization, retry)
  const sendResult = await sendReply(
    followUp.workspaceId,
    agent,
    followUp.channelAddress,
    followUp.contactAddress,
    messageText,
    'proactive'
  );

  if (!sendResult.sent) {
    if (sendResult.blockedByQuietHours) {
      const nextWindowAt = sendResult.nextWindowAt ?? new Date(Date.now() + 60 * 60 * 1000);
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { scheduledAt: nextWindowAt },
      });
      logStructured({
        correlationId,
        event: 'follow_up_rescheduled',
        workspaceId: followUp.workspaceId,
        provider: 'agent',
        success: true,
        metadata: {
          followUpId: followUp.id,
          reason: 'quiet_hours',
          rescheduledTo: nextWindowAt.toISOString(),
        },
      });
      return { action: 'rescheduled', reason: 'quiet_hours' };
    }
    await markSkipped(followUp.id, 'send_failed');
    return { action: 'skipped', reason: 'send_failed' };
  }

  // Store message + update counters + mark sent atomically
  await withTransaction(async (tx) => {
    await tx.conversationMessage.create({
      data: {
        conversationId: followUp.conversationId,
        role: 'ASSISTANT',
        content: messageText,
      },
    });

    await tx.conversation.update({
      where: { id: followUp.conversationId },
      data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
    });

    await tx.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.SENT, sentAt: new Date(), messageText },
    });
  });

  logStructured({
    correlationId,
    event: 'follow_up_sent',
    workspaceId: followUp.workspaceId,
    provider: 'agent',
    success: true,
    metadata: {
      followUpId: followUp.id,
      conversationId: followUp.conversationId,
      stepIndex: followUp.stepIndex,
      aiGenerated: agent.followUpAiGenerated,
    },
  });

  // Schedule next step if there are more
  const nextStepIndex = followUp.stepIndex + 1;
  if (nextStepIndex < agent.followUpSequence.length) {
    const nextStep = agent.followUpSequence[nextStepIndex];
    await scheduleFollowUp(
      followUp.conversationId,
      followUp.workspaceId,
      followUp.agentId,
      followUp.contactAddress,
      followUp.channelAddress,
      nextStepIndex,
      nextStep.delayMinutes
    );
  }

  return { action: 'sent', messageText };
}

/**
 * Generate an AI follow-up message based on conversation history.
 * Returns null on failure (caller should fall back to fallbackMessage).
 */
export async function generateFollowUpMessage(
  workspaceId: string,
  agent: AgentConfig,
  conversationId: string
): Promise<string | null> {
  try {
    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { role: true, content: true },
      take: 10,
    });

    if (messages.length === 0) return null;

    const history: ChatMessage[] = messages.reverse().map((m) => ({
      role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

    const followUpPrompt = [
      agent.systemPrompt,
      '\n\n--- Follow-Up Instruction ---',
      'Generate a brief, natural follow-up message to re-engage this lead.',
      'The lead has gone silent. Be warm, concise, and conversational.',
      'Keep it under 160 characters for SMS. Do not repeat previous messages.',
      'Do not introduce yourself again. Reference the conversation context naturally.',
    ].join('\n');

    const aiMessages: ChatMessage[] = [
      { role: 'developer', content: followUpPrompt },
      ...history,
      { role: 'user', content: '[SYSTEM: The lead has not responded. Generate a follow-up message.]' },
    ];

    const result = await retryWithBackoff(
      () => callAI(workspaceId, agent, aiMessages),
      {
        shouldRetry: (r) => !r.success && r.retryable === true,
        getRetryAfterMs: (r) => r.retryAfterMs,
      },
    );

    if (!result.success || !result.data?.content) return null;

    return result.data.content.trim();
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'follow_up_ai_generation_failed',
      workspaceId,
      provider: agent.aiIntegration,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { conversationId, agentId: agent.id },
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function markSkipped(followUpId: string, reason: string): Promise<void> {
  await prisma.followUp.update({
    where: { id: followUpId },
    data: { status: FollowUpStatus.SKIPPED, skipReason: reason },
  });
}

async function interpolateFollowUpTemplate(
  template: string,
  followUp: FollowUpRecord
): Promise<string> {
  const lead = await prisma.lead.findFirst({
    where: {
      conversations: { some: { id: followUp.conversationId } },
    },
    select: { email: true, properties: true },
  });

  const props = (lead?.properties && typeof lead.properties === 'object')
    ? lead.properties as Record<string, unknown>
    : {};

  const firstName = String(props.firstName || props.first_name || lead?.email?.split('@')[0] || '');

  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    if (key === 'firstName') return firstName;
    if (key.startsWith('properties.')) {
      const propKey = key.slice('properties.'.length);
      const val = props[propKey];
      return val != null ? String(val) : '';
    }
    return '';
  });
}

/**
 * Pick a variant for a follow-up step, avoiding repeats within the same
 * conversation. Falls back to null if all variants have been used.
 */
async function selectVariant(
  variants: string[],
  conversationId: string,
  stepIndex: number
): Promise<string | null> {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  const sent = await prisma.followUp.findMany({
    where: { conversationId, stepIndex, status: FollowUpStatus.SENT },
    select: { messageText: true },
  });
  const usedTexts = new Set(sent.map((s) => s.messageText));

  const available = variants.filter((v) => !usedTexts.has(v));
  if (available.length === 0) return null;

  // Deterministic pick: hash conversationId + stepIndex + attempt count
  let hash = 0;
  const seed = `${conversationId}:${stepIndex}:${sent.length}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return available[Math.abs(hash) % available.length];
}
