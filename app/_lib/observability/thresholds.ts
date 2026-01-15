/**
 * Threshold Checking
 * 
 * Compares metrics against configured thresholds and generates violations.
 * 
 * STANDARDS:
 * - Configurable via environment variables
 * - Returns structured violations for alerting
 */

import {
  AlertThresholds,
  DEFAULT_THRESHOLDS,
  SystemMetrics,
  ThresholdViolation,
  ViolationType,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Load thresholds from environment with defaults
 */
export function getThresholds(): AlertThresholds {
  return {
    webhookBacklogMax: parseInt(
      process.env.ALERT_WEBHOOK_BACKLOG_MAX || String(DEFAULT_THRESHOLDS.webhookBacklogMax)
    ),
    stuckProcessingMinutes: parseInt(
      process.env.ALERT_STUCK_PROCESSING_MINUTES || String(DEFAULT_THRESHOLDS.stuckProcessingMinutes)
    ),
    errorRatePercent: parseInt(
      process.env.ALERT_ERROR_RATE_THRESHOLD || String(DEFAULT_THRESHOLDS.errorRatePercent)
    ),
    failedWorkflowsPerHour: parseInt(
      process.env.ALERT_FAILED_WORKFLOWS_PER_HOUR || String(DEFAULT_THRESHOLDS.failedWorkflowsPerHour)
    ),
  };
}

// =============================================================================
// THRESHOLD CHECKING
// =============================================================================

/**
 * Check metrics against thresholds and return violations
 * 
 * @param metrics - Current system metrics
 * @param thresholds - Thresholds to check against (uses env defaults if not provided)
 * @param clientId - Optional client scope for violation context
 */
export function checkThresholds(
  metrics: SystemMetrics,
  thresholds?: Partial<AlertThresholds>,
  clientId?: string
): ThresholdViolation[] {
  const config = { ...getThresholds(), ...thresholds };
  const violations: ThresholdViolation[] = [];

  // Check webhook backlog
  const totalBacklog = metrics.webhooks.pending + metrics.webhooks.processing;
  if (totalBacklog > config.webhookBacklogMax) {
    violations.push({
      type: 'webhook_backlog',
      message: `Webhook backlog: ${totalBacklog} pending/processing (threshold: ${config.webhookBacklogMax})`,
      currentValue: totalBacklog,
      threshold: config.webhookBacklogMax,
      severity: totalBacklog > config.webhookBacklogMax * 2 ? 'critical' : 'warning',
      clientId,
    });
  }

  // Check stuck processing
  if (
    metrics.webhooks.oldestPendingMinutes !== null &&
    metrics.webhooks.oldestPendingMinutes > config.stuckProcessingMinutes
  ) {
    violations.push({
      type: 'stuck_processing',
      message: `Webhooks stuck: oldest pending for ${metrics.webhooks.oldestPendingMinutes} minutes (threshold: ${config.stuckProcessingMinutes})`,
      currentValue: metrics.webhooks.oldestPendingMinutes,
      threshold: config.stuckProcessingMinutes,
      severity: metrics.webhooks.oldestPendingMinutes > config.stuckProcessingMinutes * 2 ? 'critical' : 'warning',
      clientId,
    });
  }

  // Check error rate
  if (
    metrics.events.totalLastHour > 0 &&
    metrics.events.errorRatePercent > config.errorRatePercent
  ) {
    violations.push({
      type: 'error_rate',
      message: `High error rate: ${metrics.events.errorRatePercent.toFixed(1)}% (threshold: ${config.errorRatePercent}%)`,
      currentValue: metrics.events.errorRatePercent,
      threshold: config.errorRatePercent,
      severity: metrics.events.errorRatePercent > config.errorRatePercent * 2 ? 'critical' : 'warning',
      clientId,
    });
  }

  // Check workflow failures
  if (metrics.workflows.failedLastHour > config.failedWorkflowsPerHour) {
    violations.push({
      type: 'workflow_failures',
      message: `Workflow failures: ${metrics.workflows.failedLastHour} in last hour (threshold: ${config.failedWorkflowsPerHour})`,
      currentValue: metrics.workflows.failedLastHour,
      threshold: config.failedWorkflowsPerHour,
      severity: metrics.workflows.failedLastHour > config.failedWorkflowsPerHour * 2 ? 'critical' : 'warning',
      clientId,
    });
  }

  return violations;
}

/**
 * Get a human-readable summary of violations for alerting
 */
export function formatViolationsForAlert(violations: ThresholdViolation[]): string {
  if (violations.length === 0) return '';
  
  return violations
    .map(v => `• ${v.message}`)
    .join('\n');
}
