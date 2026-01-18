/**
 * Observability Service
 * 
 * Centralized metrics collection and anomaly detection.
 * Routes alerts through the existing AlertService (Pushover).
 * 
 * Usage:
 * ```typescript
 * import { ObservabilityService } from '@/app/_lib/observability';
 * 
 * // Get metrics
 * const metrics = await ObservabilityService.getMetrics();
 * 
 * // Check thresholds and alert
 * const violations = await ObservabilityService.checkAndAlert();
 * ```
 * 
 * STANDARDS:
 * - Abstraction: Route handlers call service, not raw queries
 * - Client-scoped: All metrics can be filtered by clientId
 * - Event-driven: Emits events on alert
 */

import { AlertService } from '@/app/_lib/alerts';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getSystemMetrics, getTableStats } from './metrics';
import { checkThresholds, formatViolationsForAlert, getThresholds } from './thresholds';
import {
  SystemMetrics,
  AlertThresholds,
  ThresholdViolation,
  TableStats,
} from './types';

// Re-export types
export type {
  SystemMetrics,
  AlertThresholds,
  ThresholdViolation,
  TableStats,
  WebhookMetrics,
  EventMetrics,
  WorkflowMetrics,
  ViolationType,
} from './types';

export { DEFAULT_THRESHOLDS } from './types';

// =============================================================================
// OBSERVABILITY SERVICE
// =============================================================================

export const ObservabilityService = {
  /**
   * Get system metrics
   * 
   * @param clientId - Optional client scope (omit for system-wide)
   */
  async getMetrics(clientId?: string): Promise<SystemMetrics> {
    return getSystemMetrics(clientId);
  },

  /**
   * Get current alert thresholds from config
   */
  getThresholds(): AlertThresholds {
    return getThresholds();
  },

  /**
   * Check metrics against thresholds
   * 
   * @param metrics - Metrics to check (will fetch if not provided)
   * @param thresholds - Custom thresholds (uses env config if not provided)
   * @param clientId - Optional client scope
   */
  async checkThresholds(
    metrics?: SystemMetrics,
    thresholds?: Partial<AlertThresholds>,
    clientId?: string
  ): Promise<ThresholdViolation[]> {
    const currentMetrics = metrics ?? await getSystemMetrics(clientId);
    return checkThresholds(currentMetrics, thresholds, clientId);
  },

  /**
   * Check thresholds and send alerts for any violations
   * 
   * @param clientId - Optional client scope
   * @returns Array of violations that were detected
   */
  async checkAndAlert(clientId?: string): Promise<ThresholdViolation[]> {
    const metrics = await getSystemMetrics(clientId);
    const violations = checkThresholds(metrics, undefined, clientId);

    if (violations.length === 0) {
      return [];
    }

    // Determine overall severity
    const hasCritical = violations.some(v => v.severity === 'critical');
    const alertMessage = formatViolationsForAlert(violations);

    // Send alert via Pushover
    if (hasCritical) {
      await AlertService.critical(
        `System Alert: ${violations.length} issue(s)`,
        alertMessage,
        { workspaceId: clientId, source: 'observability' }
      );
    } else {
      await AlertService.warning(
        `System Warning: ${violations.length} issue(s)`,
        alertMessage,
        { workspaceId: clientId, source: 'observability' }
      );
    }

    // Emit event for audit trail
    await emitEvent({
      workspaceId: clientId ?? 'system',
      system: EventSystem.CRON,
      eventType: 'observability_threshold_exceeded',
      success: false,
      errorMessage: violations.map(v => v.type).join(', '),
    });

    return violations;
  },

  /**
   * Get database table stats for retention monitoring
   */
  async getTableStats(): Promise<TableStats> {
    return getTableStats();
  },
};

// Default export for convenience
export default ObservabilityService;
