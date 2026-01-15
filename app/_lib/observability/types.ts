/**
 * Observability Types
 * 
 * Type definitions for system metrics and alert thresholds.
 */

// =============================================================================
// METRICS
// =============================================================================

/**
 * Webhook queue metrics
 */
export interface WebhookMetrics {
  /** Number of webhooks waiting to be processed */
  pending: number;
  /** Number of webhooks currently being processed */
  processing: number;
  /** Number of failed webhooks (not yet retried) */
  failed: number;
  /** Age of oldest pending webhook in minutes (null if none) */
  oldestPendingMinutes: number | null;
}

/**
 * Event metrics for error rate tracking
 */
export interface EventMetrics {
  /** Total events in the time window */
  totalLastHour: number;
  /** Failed events in the time window */
  failedLastHour: number;
  /** Calculated error rate as percentage */
  errorRatePercent: number;
}

/**
 * Workflow execution metrics
 */
export interface WorkflowMetrics {
  /** Number of workflow failures in the time window */
  failedLastHour: number;
  /** Number of workflows currently running */
  runningNow: number;
}

/**
 * Aggregated system metrics
 */
export interface SystemMetrics {
  webhooks: WebhookMetrics;
  events: EventMetrics;
  workflows: WorkflowMetrics;
  /** When metrics were collected */
  collectedAt: Date;
}

// =============================================================================
// THRESHOLDS
// =============================================================================

/**
 * Configurable alert thresholds
 */
export interface AlertThresholds {
  /** Maximum pending webhooks before alerting (default: 50) */
  webhookBacklogMax: number;
  /** Minutes before a pending webhook is considered stuck (default: 15) */
  stuckProcessingMinutes: number;
  /** Error rate percentage threshold (default: 10) */
  errorRatePercent: number;
  /** Failed workflows per hour threshold (default: 5) */
  failedWorkflowsPerHour: number;
}

/**
 * Default threshold values
 */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  webhookBacklogMax: 50,
  stuckProcessingMinutes: 15,
  errorRatePercent: 10,
  failedWorkflowsPerHour: 5,
};

// =============================================================================
// VIOLATIONS
// =============================================================================

/**
 * Type of threshold violation
 */
export type ViolationType = 
  | 'webhook_backlog'
  | 'stuck_processing'
  | 'error_rate'
  | 'workflow_failures';

/**
 * A detected threshold violation
 */
export interface ThresholdViolation {
  type: ViolationType;
  message: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  /** Optional client scope (null = system-wide) */
  clientId?: string;
}

// =============================================================================
// TABLE STATS
// =============================================================================

/**
 * Database table row counts
 */
export interface TableStats {
  events: number;
  webhookEvents: number;
  workflowExecutions: number;
  idempotencyKeys: number;
  leads: number;
}
