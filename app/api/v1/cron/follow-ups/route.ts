/**
 * Follow-Up Cron
 *
 * Runs every 2-5 minutes. Two phases:
 * 1. Detect idle conversations and schedule first follow-up
 * 2. Process due follow-ups (send messages, schedule next steps)
 *
 * Uses DB polling -- fine for launch volume. Can migrate to a queue later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus, FollowUpStatus } from '@prisma/client';
import { logStructured } from '@/app/_lib/reliability';
import { loadAgent } from '@/app/_lib/agent/engine';
import { scheduleFollowUp, processFollowUp } from '@/app/_lib/agent/follow-up';
import type { FollowUpRecord } from '@/app/_lib/agent/follow-up';
import type { AgentConfig } from '@/app/_lib/agent/types';

const BATCH_SIZE = 50;

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// ---------------------------------------------------------------------------
// Phase 1: Detect idle conversations and schedule first follow-up
// ---------------------------------------------------------------------------

async function detectIdleConversations(): Promise<number> {
  let scheduled = 0;

  const agents = await prisma.agent.findMany({
    where: {
      active: true,
      followUpEnabled: true,
    },
    select: {
      id: true,
      workspaceId: true,
      followUpSequence: true,
    },
  });

  for (const agent of agents) {
    const raw = agent.followUpSequence;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const sequence = raw as Array<{ delayMinutes: number; message?: string }>;

    const first = sequence[0];
    if (typeof first?.delayMinutes !== 'number') continue;

    const firstDelayMs = first.delayMinutes * 60 * 1000;
    const idleThreshold = new Date(Date.now() - firstDelayMs);

    const idleConversations = await prisma.conversation.findMany({
      where: {
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        status: ConversationStatus.ACTIVE,
        lastMessageAt: { lt: idleThreshold },
        followUps: {
          none: { status: { in: [FollowUpStatus.PENDING, FollowUpStatus.SENT] } },
        },
      },
      select: {
        id: true,
        contactAddress: true,
        channelAddress: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { role: true },
        },
      },
    });

    for (const convo of idleConversations) {
      if (convo.messages.length === 0 || convo.messages[0].role !== 'ASSISTANT') continue;

      await scheduleFollowUp(
        convo.id,
        agent.workspaceId,
        agent.id,
        convo.contactAddress,
        convo.channelAddress,
        0,
        0
      );
      scheduled++;
    }
  }

  return scheduled;
}

// ---------------------------------------------------------------------------
// Phase 2: Process due follow-ups
// ---------------------------------------------------------------------------

async function processDueFollowUps(): Promise<{ sent: number; skipped: number; rescheduled: number; cancelled: number }> {
  const stats = { sent: 0, skipped: 0, rescheduled: 0, cancelled: 0 };

  const dueFollowUps = await prisma.followUp.findMany({
    where: {
      status: FollowUpStatus.PENDING,
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (dueFollowUps.length === 0) return stats;

  const agentCache = new Map<string, AgentConfig | null>();

  for (const followUp of dueFollowUps) {
    const cacheKey = `${followUp.workspaceId}:${followUp.agentId}`;
    let agent = agentCache.get(cacheKey);
    if (agent === undefined) {
      agent = await loadAgent(followUp.workspaceId, followUp.agentId);
      agentCache.set(cacheKey, agent);
    }

    if (!agent || !agent.followUpEnabled) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: FollowUpStatus.SKIPPED, skipReason: 'agent_inactive_or_disabled' },
      });
      stats.skipped++;
      continue;
    }

    try {
      const record: FollowUpRecord = {
        id: followUp.id,
        workspaceId: followUp.workspaceId,
        conversationId: followUp.conversationId,
        agentId: followUp.agentId,
        contactAddress: followUp.contactAddress,
        channelAddress: followUp.channelAddress,
        stepIndex: followUp.stepIndex,
        scheduledAt: followUp.scheduledAt,
        status: followUp.status,
        createdAt: followUp.createdAt,
      };

      const result = await processFollowUp(record, agent);
      stats[result.action]++;
    } catch (err) {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'follow_up_processing_error',
        workspaceId: followUp.workspaceId,
        provider: 'agent',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown',
        metadata: { followUpId: followUp.id, conversationId: followUp.conversationId },
      });
      stats.skipped++;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronCorrelationId = crypto.randomUUID();
  const startTime = Date.now();

  logStructured({
    correlationId: cronCorrelationId,
    event: 'follow_up_cron_started',
    workspaceId: '',
    provider: 'cron',
    success: true,
  });

  let scheduled = 0;
  let phase2Stats = { sent: 0, skipped: 0, rescheduled: 0, cancelled: 0 };

  try {
    scheduled = await detectIdleConversations();
  } catch (err) {
    logStructured({
      correlationId: cronCorrelationId,
      event: 'follow_up_cron_phase1_failed',
      workspaceId: '',
      provider: 'cron',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  try {
    phase2Stats = await processDueFollowUps();
  } catch (err) {
    logStructured({
      correlationId: cronCorrelationId,
      event: 'follow_up_cron_phase2_failed',
      workspaceId: '',
      provider: 'cron',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  const durationMs = Date.now() - startTime;

  logStructured({
    correlationId: cronCorrelationId,
    event: 'follow_up_cron_completed',
    workspaceId: '',
    provider: 'cron',
    success: true,
    metadata: { scheduled, ...phase2Stats, durationMs },
  });

  return NextResponse.json({
    success: true,
    scheduled,
    ...phase2Stats,
    durationMs,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
