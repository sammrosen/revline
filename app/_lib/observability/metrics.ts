/**
 * Metrics Collection
 * 
 * Database queries for collecting system metrics.
 * All queries are client-scoped when clientId is provided.
 * 
 * STANDARDS:
 * - Client isolation: All queries can be scoped to a client
 * - No raw SQL: Uses Prisma for type safety
 * - Efficient: Parallel queries where possible
 */

import { prisma } from '@/app/_lib/db';
import {
  WebhookMetrics,
  EventMetrics,
  WorkflowMetrics,
  SystemMetrics,
  TableStats,
} from './types';

// =============================================================================
// WEBHOOK METRICS
// =============================================================================

/**
 * Get webhook queue metrics
 */
export async function getWebhookMetrics(clientId?: string): Promise<WebhookMetrics> {
  const whereClause = clientId ? { workspaceId: clientId } : {};

  const [pending, processing, failed, oldestPending] = await Promise.all([
    prisma.webhookEvent.count({
      where: { ...whereClause, status: 'PENDING' },
    }),
    prisma.webhookEvent.count({
      where: { ...whereClause, status: 'PROCESSING' },
    }),
    prisma.webhookEvent.count({
      where: { ...whereClause, status: 'FAILED' },
    }),
    prisma.webhookEvent.findFirst({
      where: { ...whereClause, status: 'PENDING' },
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    }),
  ]);

  let oldestPendingMinutes: number | null = null;
  if (oldestPending) {
    const ageMs = Date.now() - oldestPending.receivedAt.getTime();
    oldestPendingMinutes = Math.floor(ageMs / (60 * 1000));
  }

  return {
    pending,
    processing,
    failed,
    oldestPendingMinutes,
  };
}

// =============================================================================
// EVENT METRICS
// =============================================================================

/**
 * Get event metrics for error rate calculation
 */
export async function getEventMetrics(clientId?: string): Promise<EventMetrics> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const whereClause = clientId ? { workspaceId: clientId } : {};

  const [totalLastHour, failedLastHour] = await Promise.all([
    prisma.event.count({
      where: {
        ...whereClause,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.event.count({
      where: {
        ...whereClause,
        createdAt: { gte: oneHourAgo },
        success: false,
      },
    }),
  ]);

  const errorRatePercent = totalLastHour > 0
    ? (failedLastHour / totalLastHour) * 100
    : 0;

  return {
    totalLastHour,
    failedLastHour,
    errorRatePercent,
  };
}

// =============================================================================
// WORKFLOW METRICS
// =============================================================================

/**
 * Get workflow execution metrics
 */
export async function getWorkflowMetrics(clientId?: string): Promise<WorkflowMetrics> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const whereClause = clientId ? { workspaceId: clientId } : {};

  const [failedLastHour, runningNow] = await Promise.all([
    prisma.workflowExecution.count({
      where: {
        ...whereClause,
        status: 'FAILED',
        startedAt: { gte: oneHourAgo },
      },
    }),
    prisma.workflowExecution.count({
      where: {
        ...whereClause,
        status: 'RUNNING',
      },
    }),
  ]);

  return {
    failedLastHour,
    runningNow,
  };
}

// =============================================================================
// AGGREGATED METRICS
// =============================================================================

/**
 * Get all system metrics
 * 
 * @param clientId - Optional client scope (omit for system-wide)
 */
export async function getSystemMetrics(clientId?: string): Promise<SystemMetrics> {
  const [webhooks, events, workflows] = await Promise.all([
    getWebhookMetrics(clientId),
    getEventMetrics(clientId),
    getWorkflowMetrics(clientId),
  ]);

  return {
    webhooks,
    events,
    workflows,
    collectedAt: new Date(),
  };
}

// =============================================================================
// TABLE STATS
// =============================================================================

/**
 * Get row counts for all tracked tables
 * Used for retention monitoring and cleanup reporting
 */
export async function getTableStats(): Promise<TableStats> {
  const [events, webhookEvents, workflowExecutions, idempotencyKeys, leads] = 
    await Promise.all([
      prisma.event.count(),
      prisma.webhookEvent.count(),
      prisma.workflowExecution.count(),
      prisma.idempotencyKey.count(),
      prisma.lead.count(),
    ]);

  return {
    events,
    webhookEvents,
    workflowExecutions,
    idempotencyKeys,
    leads,
  };
}
