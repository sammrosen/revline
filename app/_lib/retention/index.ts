/**
 * Retention Service
 * 
 * Data lifecycle management with configurable retention periods.
 * 
 * Usage:
 * ```typescript
 * import { RetentionService } from '@/app/_lib/retention';
 * 
 * // Run cleanup (production)
 * const result = await RetentionService.cleanup();
 * 
 * // Dry-run first
 * const preview = await RetentionService.cleanup({ dryRun: true });
 * ```
 * 
 * STANDARDS:
 * - Batch deletes to prevent lock contention
 * - Dry-run mode for safety
 * - Configurable via environment variables
 */

import { runCleanup, getRetentionConfig } from './cleanup';
import { ObservabilityService, TableStats } from '@/app/_lib/observability';
import {
  RetentionConfig,
  CleanupResult,
  CleanupOptions,
} from './types';

// Re-export types
export type {
  RetentionConfig,
  CleanupResult,
  CleanupOptions,
} from './types';

export { DEFAULT_RETENTION, DEFAULT_BATCH_SIZE } from './types';

// Re-export TableStats from observability
export type { TableStats } from '@/app/_lib/observability';

// =============================================================================
// RETENTION SERVICE
// =============================================================================

export const RetentionService = {
  /**
   * Run cleanup with retention policies
   * 
   * @param options - Cleanup options (dry-run, batch size, custom config)
   * @returns Cleanup result with counts and duration
   * 
   * @example
   * // Dry-run first
   * const preview = await RetentionService.cleanup({ dryRun: true });
   * console.log(`Would delete ${preview.eventsDeleted} events`);
   * 
   * // Then run for real
   * const result = await RetentionService.cleanup();
   */
  async cleanup(options?: CleanupOptions): Promise<CleanupResult> {
    return runCleanup(options);
  },

  /**
   * Get current retention configuration
   */
  getConfig(): RetentionConfig {
    return getRetentionConfig();
  },

  /**
   * Get current table row counts
   * Useful for monitoring database growth
   */
  async getTableStats(): Promise<TableStats> {
    return ObservabilityService.getTableStats();
  },

  /**
   * Format cleanup result for display/alerting
   */
  formatResult(result: CleanupResult): string {
    const parts = [
      `Events: ${result.eventsDeleted.toLocaleString()}`,
      `Webhooks: ${result.webhookEventsDeleted.toLocaleString()}`,
      `Executions: ${result.workflowExecutionsDeleted.toLocaleString()}`,
      `Keys: ${result.idempotencyKeysDeleted.toLocaleString()}`,
    ];
    
    const prefix = result.dryRun ? '[DRY RUN] Would delete' : 'Deleted';
    return `${prefix}: ${parts.join(', ')} (${result.durationMs}ms)`;
  },
};

// Default export for convenience
export default RetentionService;
