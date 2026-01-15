/**
 * Cleanup Logic
 * 
 * Batch delete operations for data retention.
 * 
 * STANDARDS:
 * - Batch deletes to prevent lock contention
 * - Dry-run mode for safety
 * - Logging for audit trail
 */

import { prisma } from '@/app/_lib/db';
import { logStructured } from '@/app/_lib/reliability';
import {
  RetentionConfig,
  DEFAULT_RETENTION,
  CleanupResult,
  CleanupOptions,
  DEFAULT_BATCH_SIZE,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Load retention config from environment with defaults
 */
export function getRetentionConfig(): RetentionConfig {
  return {
    eventDays: parseInt(
      process.env.RETENTION_EVENTS_DAYS || String(DEFAULT_RETENTION.eventDays)
    ),
    webhookEventDays: parseInt(
      process.env.RETENTION_WEBHOOK_EVENTS_DAYS || String(DEFAULT_RETENTION.webhookEventDays)
    ),
    workflowExecutionDays: parseInt(
      process.env.RETENTION_WORKFLOW_EXECUTIONS_DAYS || String(DEFAULT_RETENTION.workflowExecutionDays)
    ),
  };
}

// =============================================================================
// BATCH DELETE HELPERS
// =============================================================================

/**
 * Delete records in batches to prevent long transactions
 * Returns total count of deleted records
 */
async function batchDelete(
  tableName: 'event' | 'webhookEvent' | 'workflowExecution' | 'idempotencyKey',
  whereClause: object,
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  if (dryRun) {
    // In dry-run mode, just count what would be deleted
    const count = await (prisma[tableName] as { count: (args: { where: object }) => Promise<number> }).count({
      where: whereClause,
    });
    return count;
  }

  let totalDeleted = 0;
  let deletedInBatch: number;

  do {
    // Find IDs to delete in this batch
    const records = await (prisma[tableName] as { 
      findMany: (args: { where: object; take: number; select: { id: true } }) => Promise<Array<{ id: string }>> 
    }).findMany({
      where: whereClause,
      take: batchSize,
      select: { id: true },
    });

    if (records.length === 0) break;

    const ids = records.map(r => r.id);

    // Delete this batch
    const result = await (prisma[tableName] as {
      deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }>
    }).deleteMany({
      where: { id: { in: ids } },
    });

    deletedInBatch = result.count;
    totalDeleted += deletedInBatch;

    // Log progress for long-running cleanups
    if (totalDeleted % 10000 === 0) {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'retention_cleanup_progress',
        metadata: { table: tableName, deleted: totalDeleted },
      });
    }
  } while (deletedInBatch === batchSize);

  return totalDeleted;
}

// =============================================================================
// CLEANUP OPERATIONS
// =============================================================================

/**
 * Clean up old Event records
 */
export async function cleanupEvents(
  retentionDays: number,
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  return batchDelete(
    'event',
    { createdAt: { lt: cutoffDate } },
    batchSize,
    dryRun
  );
}

/**
 * Clean up old WebhookEvent records
 */
export async function cleanupWebhookEvents(
  retentionDays: number,
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  return batchDelete(
    'webhookEvent',
    { receivedAt: { lt: cutoffDate } },
    batchSize,
    dryRun
  );
}

/**
 * Clean up old WorkflowExecution records
 */
export async function cleanupWorkflowExecutions(
  retentionDays: number,
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  return batchDelete(
    'workflowExecution',
    { startedAt: { lt: cutoffDate } },
    batchSize,
    dryRun
  );
}

/**
 * Clean up expired IdempotencyKey records
 * These have their own TTL (expiresAt field)
 */
export async function cleanupIdempotencyKeys(
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  return batchDelete(
    'idempotencyKey',
    { expiresAt: { lt: new Date() } },
    batchSize,
    dryRun
  );
}

// =============================================================================
// MAIN CLEANUP FUNCTION
// =============================================================================

/**
 * Run full cleanup with all retention policies
 */
export async function runCleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
  const startTime = Date.now();
  const {
    dryRun = false,
    batchSize = DEFAULT_BATCH_SIZE,
    config: customConfig,
  } = options;

  const config = { ...getRetentionConfig(), ...customConfig };

  const correlationId = crypto.randomUUID();
  logStructured({
    correlationId,
    event: 'retention_cleanup_started',
    metadata: { dryRun, config },
  });

  // Run all cleanups (can be parallelized, but sequential is safer for DB load)
  const eventsDeleted = await cleanupEvents(config.eventDays, batchSize, dryRun);
  const webhookEventsDeleted = await cleanupWebhookEvents(config.webhookEventDays, batchSize, dryRun);
  const workflowExecutionsDeleted = await cleanupWorkflowExecutions(config.workflowExecutionDays, batchSize, dryRun);
  const idempotencyKeysDeleted = await cleanupIdempotencyKeys(batchSize, dryRun);

  const durationMs = Date.now() - startTime;

  const result: CleanupResult = {
    eventsDeleted,
    webhookEventsDeleted,
    workflowExecutionsDeleted,
    idempotencyKeysDeleted,
    durationMs,
    dryRun,
  };

  logStructured({
    correlationId,
    event: 'retention_cleanup_completed',
    success: true,
    durationMs,
    metadata: {
      dryRun,
      eventsDeleted,
      webhookEventsDeleted,
      workflowExecutionsDeleted,
      idempotencyKeysDeleted,
    },
  });

  return result;
}
