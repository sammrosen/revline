/**
 * Integration Sync Cron
 *
 * Polls the IntegrationSyncQueue for PENDING tasks and re-executes them
 * through the existing executor registry. Follows the FollowUp cron pattern.
 *
 * Schedule: every 15 minutes
 *
 * STANDARDS:
 * - Abstraction First: dispatches through getActionExecutor() — no adapter-specific code
 * - Fail-Safe Defaults: per-task try/catch — one failure doesn't block others
 * - Event-Driven Debugging: emits per-task + cron-level events
 * - Error Handling: structured error logging with context
 * - Database: uses composite index [status, nextRetryAt], batch size capped
 */

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getActionExecutor } from '@/app/_lib/workflow/executors';
import { applyRetryResult } from '@/app/_lib/services/integration-sync.service';
import { logStructured } from '@/app/_lib/reliability';
import type { WorkflowContext } from '@/app/_lib/workflow/types';
import type { Prisma } from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

const BATCH_SIZE = 50;
const MAX_BACKOFF_MS = 4 * 3_600_000; // 4 hours

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

function calculateBackoff(retries: number): number {
  return Math.min(Math.pow(2, retries) * 60_000, MAX_BACKOFF_MS);
}

// =============================================================================
// CORE PROCESSING
// =============================================================================

interface CronStats {
  processed: number;
  succeeded: number;
  failed: number;
  permanentlyFailed: number;
}

async function processSyncQueue(): Promise<CronStats> {
  const stats: CronStats = { processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 };

  const tasks = await prisma.integrationSyncQueue.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (tasks.length === 0) return stats;

  const grouped = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = `${task.workspaceId}:${task.adapter}`;
    const group = grouped.get(key) ?? [];
    group.push(task);
    grouped.set(key, group);
  }

  for (const [groupKey, groupTasks] of grouped) {
    const [, adapter] = groupKey.split(':');

    for (const task of groupTasks) {
      stats.processed++;
      let executor;
      try {
        executor = getActionExecutor(adapter, task.operation);
      } catch {
        console.error('[IntegrationSync] Executor not found, marking FAILED:', {
          adapter,
          operation: task.operation,
          queueId: task.id,
        });
        await prisma.integrationSyncQueue.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            lastError: `Executor not found: ${adapter}.${task.operation}`,
          },
        });
        stats.permanentlyFailed++;
        continue;
      }

      try {
        const ctx: WorkflowContext = {
          trigger: { adapter: task.adapter, operation: task.operation, payload: {} },
          email: task.email,
          workspaceId: task.workspaceId,
          clientId: task.workspaceId,
          leadId: task.leadId ?? undefined,
          actionData: {},
        };

        const params = (task.params as Record<string, unknown>) ?? {};
        const result = await executor.execute(ctx, params);

        if (result.success) {
          if (task.leadId && result.data) {
            await applyRetryResult({
              queueId: task.id,
              leadId: task.leadId,
              workspaceId: task.workspaceId,
              resultData: result.data as Record<string, unknown>,
            });
          } else {
            await prisma.integrationSyncQueue.update({
              where: { id: task.id },
              data: {
                status: 'COMPLETED',
                resultData: result.data ? (result.data as unknown as Prisma.InputJsonValue) : undefined,
                completedAt: new Date(),
              },
            });
          }

          await emitEvent({
            workspaceId: task.workspaceId,
            system: EventSystem.WORKFLOW,
            eventType: 'integration_sync_success',
            success: true,
            metadata: {
              adapter: task.adapter,
              operation: task.operation,
              email: task.email,
              retries: task.retries,
              queueId: task.id,
            },
          });

          stats.succeeded++;
        } else {
          await handleRetryOrFail(task, result.error ?? 'Unknown error', stats);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await handleRetryOrFail(task, errMsg, stats);
      }
    }
  }

  return stats;
}

async function handleRetryOrFail(
  task: { id: string; retries: number; maxRetries: number; workspaceId: string; adapter: string; operation: string; email: string },
  error: string,
  stats: CronStats,
): Promise<void> {
  const nextRetries = task.retries + 1;

  if (nextRetries >= task.maxRetries) {
    await prisma.integrationSyncQueue.update({
      where: { id: task.id },
      data: {
        status: 'FAILED',
        retries: nextRetries,
        lastError: error.slice(0, 2000),
      },
    });

    await emitEvent({
      workspaceId: task.workspaceId,
      system: EventSystem.WORKFLOW,
      eventType: 'integration_sync_failed',
      success: false,
      errorMessage: error.slice(0, 2000),
      metadata: {
        adapter: task.adapter,
        operation: task.operation,
        email: task.email,
        retries: nextRetries,
        queueId: task.id,
        permanent: true,
      },
    });

    stats.permanentlyFailed++;
  } else {
    const backoffMs = calculateBackoff(nextRetries);

    await prisma.integrationSyncQueue.update({
      where: { id: task.id },
      data: {
        retries: nextRetries,
        nextRetryAt: new Date(Date.now() + backoffMs),
        lastError: error.slice(0, 2000),
      },
    });

    stats.failed++;
  }
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronCorrelationId = crypto.randomUUID();
  const startTime = Date.now();

  logStructured({
    correlationId: cronCorrelationId,
    event: 'integration_sync_cron_started',
    workspaceId: '',
    provider: 'cron',
    success: true,
  });

  let stats: CronStats = { processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 };

  try {
    stats = await processSyncQueue();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown';
    logStructured({
      correlationId: cronCorrelationId,
      event: 'integration_sync_cron_error',
      workspaceId: '',
      provider: 'cron',
      success: false,
      error: errMsg,
    });

    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }

  const durationMs = Date.now() - startTime;

  logStructured({
    correlationId: cronCorrelationId,
    event: 'integration_sync_cron_completed',
    workspaceId: '',
    provider: 'cron',
    success: true,
    metadata: { ...stats, durationMs },
  });

  return NextResponse.json({
    success: true,
    ...stats,
    durationMs,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
