/**
 * Conversation Summary Builder
 *
 * Builds rich notification data for completed/escalated agent conversations.
 * Optionally uses AI to generate a human-friendly summary.
 *
 * STANDARDS:
 * - Workspace-scoped: all queries include workspaceId
 * - AI failure never breaks the flow: try/catch with basic fallback
 * - No PII in logs
 */

import { prisma } from '@/app/_lib/db';
import { resolveAI } from './adapter-registry';

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationSummaryResult {
  summary: string;
  outcome: 'qualified' | 'booked' | 'escalated' | 'timed_out' | 'completed' | 'opted_out';
  lead?: { email: string; name?: string; phone?: string; stage?: string };
  details: { messageCount: number; duration: string; channel: string; agentName: string };
  transcript: string;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Build a notification-ready summary for a conversation.
 *
 * 1. Loads conversation + messages + agent + lead (workspace-scoped)
 * 2. Builds transcript from messages
 * 3. Classifies outcome from conversation status
 * 4. Calculates duration
 * 5. Tries AI summary (falls back to basic text)
 * 6. Returns ConversationSummaryResult
 */
export async function buildConversationNotification(
  conversationId: string,
  workspaceId: string
): Promise<ConversationSummaryResult> {
  // 1. Load conversation with related data — scoped to workspaceId
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    include: {
      agent: { select: { id: true, name: true, aiIntegration: true } },
      lead: { select: { email: true, stage: true, properties: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conversation) {
    return {
      summary: 'Conversation not found.',
      outcome: 'completed',
      details: { messageCount: 0, duration: '0m', channel: 'unknown', agentName: 'unknown' },
      transcript: '',
    };
  }

  // 2. Build transcript
  const transcript = conversation.messages
    .map((m) => {
      const time = m.createdAt.toISOString().slice(11, 16);
      const label = m.role === 'USER' ? 'Lead' : 'Bot';
      return `[${time}] ${label}: ${m.content}`;
    })
    .join('\n');

  // 3. Classify outcome from status
  const outcome = classifyOutcome(conversation.status);

  // 4. Calculate duration
  const firstMsg = conversation.messages[0];
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const duration = firstMsg && lastMsg
    ? formatDuration(firstMsg.createdAt, lastMsg.createdAt)
    : '0m';

  // 5. Extract lead info
  const leadProps = (conversation.lead?.properties && typeof conversation.lead.properties === 'object')
    ? conversation.lead.properties as Record<string, unknown>
    : {};

  const lead = conversation.lead
    ? {
        email: conversation.lead.email,
        name: extractString(leadProps.firstName, leadProps.first_name, leadProps.name) || undefined,
        phone: extractString(leadProps.phone, leadProps.phoneNumber, leadProps.phone_number) || undefined,
        stage: conversation.lead.stage || undefined,
      }
    : undefined;

  // 6. Try AI summary
  const summary = await generateAISummary(
    transcript,
    outcome,
    conversation.agent.aiIntegration,
    workspaceId
  );

  return {
    summary,
    outcome,
    lead,
    details: {
      messageCount: conversation.messages.length,
      duration,
      channel: conversation.channel,
      agentName: conversation.agent.name,
    },
    transcript,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function classifyOutcome(status: string): ConversationSummaryResult['outcome'] {
  switch (status) {
    case 'ESCALATED':
      return 'escalated';
    case 'TIMED_OUT':
      return 'timed_out';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'completed';
  }
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function extractString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

/**
 * Try to generate an AI summary. On any failure, fall back to basic text.
 * Never throws — notification must still go out even if AI is down.
 */
async function generateAISummary(
  transcript: string,
  outcome: string,
  aiIntegration: string,
  workspaceId: string
): Promise<string> {
  try {
    const aiEntry = resolveAI(aiIntegration);
    if (!aiEntry) {
      return buildBasicSummary(outcome, transcript);
    }

    const ai = await aiEntry.forWorkspace(workspaceId);
    if (!ai) {
      return buildBasicSummary(outcome, transcript);
    }

    const result = await ai.chatCompletion({
      messages: [
        {
          role: 'developer',
          content:
            'Summarize this agent conversation in 2-3 sentences for the business owner. ' +
            'Focus on: what the lead wanted, what happened, and the outcome. Be concise and professional.',
        },
        {
          role: 'user',
          content: `Outcome: ${outcome}\n\nTranscript:\n${transcript.slice(0, 3000)}`,
        },
      ],
      maxTokens: 200,
      temperature: 0.3,
    });

    if (result.success && result.data?.content) {
      return result.data.content;
    }

    return buildBasicSummary(outcome, transcript);
  } catch {
    return buildBasicSummary(outcome, transcript);
  }
}

function buildBasicSummary(outcome: string, transcript: string): string {
  const lineCount = transcript.split('\n').length;
  return `Conversation ${outcome} after ${lineCount} message${lineCount === 1 ? '' : 's'}.`;
}
