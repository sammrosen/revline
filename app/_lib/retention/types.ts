/**
 * Retention Types
 * 
 * Type definitions for data retention and cleanup.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Retention configuration for each table
 * Values are in days
 */
export interface RetentionConfig {
  /** Days to keep Event records (default: 90) */
  eventDays: number;
  /** Days to keep WebhookEvent records (default: 30) */
  webhookEventDays: number;
  /** Days to keep WorkflowExecution records (default: 90) */
  workflowExecutionDays: number;
  /** Days to keep PendingBooking records (default: 30) */
  pendingBookingDays: number;
  /** IdempotencyKeys use their own TTL (24h), cleaned separately */
}

/**
 * Default retention periods
 */
export const DEFAULT_RETENTION: RetentionConfig = {
  eventDays: 90,
  webhookEventDays: 30,
  workflowExecutionDays: 90,
  pendingBookingDays: 30,
};

// =============================================================================
// CLEANUP RESULTS
// =============================================================================

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of Event records deleted */
  eventsDeleted: number;
  /** Number of WebhookEvent records deleted */
  webhookEventsDeleted: number;
  /** Number of WorkflowExecution records deleted */
  workflowExecutionsDeleted: number;
  /** Number of IdempotencyKey records deleted */
  idempotencyKeysDeleted: number;
  /** Number of PendingBooking records marked as expired */
  pendingBookingsExpired: number;
  /** Number of old PendingBooking records deleted */
  pendingBookingsDeleted: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
  /** If true, only count what would be deleted without deleting */
  dryRun?: boolean;
  /** Batch size for deletes (default: 1000) */
  batchSize?: number;
  /** Custom retention config (uses env/defaults if not provided) */
  config?: Partial<RetentionConfig>;
}

/**
 * Default batch size for deletes
 * Prevents long-running transactions and lock contention
 */
export const DEFAULT_BATCH_SIZE = 1000;
