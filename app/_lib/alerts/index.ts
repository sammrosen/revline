/**
 * Alert Service
 * 
 * Centralized alerting for critical system failures.
 * Wraps Pushover with rate limiting to prevent alert spam during outages.
 * 
 * Usage:
 * ```typescript
 * import { AlertService } from '@/app/_lib/alerts';
 * 
 * await AlertService.critical('Webhook Failed', 'Stripe signature invalid', {
 *   provider: 'stripe',
 *   clientId: 'abc123',
 * });
 * ```
 */

import { sendPushoverNotification, isPushoverConfigured } from '@/app/_lib/pushover';

// =============================================================================
// TYPES
// =============================================================================

export type AlertPriority = 'critical' | 'warning' | 'info';

export interface AlertMetadata {
  clientId?: string;
  provider?: string;
  workflowId?: string;
  workflowName?: string;
  eventId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

interface RateLimitState {
  count: number;
  windowStart: number;
  suppressed: number;
}

// =============================================================================
// RATE LIMITING
// =============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 alerts per minute

// In-memory rate limit state (resets on server restart, which is fine)
const rateLimitState: RateLimitState = {
  count: 0,
  windowStart: Date.now(),
  suppressed: 0,
};

function checkRateLimit(): { allowed: boolean; suppressed: number } {
  const now = Date.now();
  
  // Reset window if expired
  if (now - rateLimitState.windowStart > RATE_LIMIT_WINDOW_MS) {
    const suppressed = rateLimitState.suppressed;
    rateLimitState.count = 0;
    rateLimitState.windowStart = now;
    rateLimitState.suppressed = 0;
    return { allowed: true, suppressed };
  }
  
  // Check if under limit
  if (rateLimitState.count < RATE_LIMIT_MAX) {
    rateLimitState.count++;
    return { allowed: true, suppressed: 0 };
  }
  
  // Over limit - suppress
  rateLimitState.suppressed++;
  return { allowed: false, suppressed: 0 };
}

// =============================================================================
// STRUCTURED LOGGING
// =============================================================================

function logAlert(
  priority: AlertPriority,
  title: string,
  message: string,
  metadata: AlertMetadata,
  sent: boolean,
  suppressed: boolean
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'alert',
    priority,
    title,
    message: message.slice(0, 200), // Truncate for logs
    sent,
    suppressed,
    ...metadata,
  }));
}

// =============================================================================
// ALERT SERVICE
// =============================================================================

export const AlertService = {
  /**
   * Send a critical alert (high priority, immediate notification)
   * 
   * Use for: webhook failures, workflow failures, integration errors
   */
  async critical(
    title: string,
    message: string,
    metadata: AlertMetadata = {}
  ): Promise<{ sent: boolean; error?: string }> {
    return sendAlert('critical', title, message, metadata, 1);
  },

  /**
   * Send a warning alert (normal priority)
   * 
   * Use for: rate limiting warnings, degraded performance
   */
  async warning(
    title: string,
    message: string,
    metadata: AlertMetadata = {}
  ): Promise<{ sent: boolean; error?: string }> {
    return sendAlert('warning', title, message, metadata, 0);
  },

  /**
   * Log an info-level alert (no notification, log only)
   * 
   * Use for: non-critical events you want to track
   */
  info(
    title: string,
    message: string,
    metadata: AlertMetadata = {}
  ): void {
    logAlert('info', title, message, metadata, false, false);
  },

  /**
   * Check if alerting is configured and working
   */
  isConfigured(): boolean {
    return isPushoverConfigured();
  },

  /**
   * Get current rate limit status (for debugging)
   */
  getRateLimitStatus(): { remaining: number; suppressed: number } {
    const now = Date.now();
    if (now - rateLimitState.windowStart > RATE_LIMIT_WINDOW_MS) {
      return { remaining: RATE_LIMIT_MAX, suppressed: 0 };
    }
    return {
      remaining: Math.max(0, RATE_LIMIT_MAX - rateLimitState.count),
      suppressed: rateLimitState.suppressed,
    };
  },
};

// =============================================================================
// INTERNAL
// =============================================================================

async function sendAlert(
  priority: AlertPriority,
  title: string,
  message: string,
  metadata: AlertMetadata,
  pushoverPriority: -2 | -1 | 0 | 1 | 2
): Promise<{ sent: boolean; error?: string }> {
  // Check rate limit
  const { allowed, suppressed } = checkRateLimit();
  
  if (!allowed) {
    logAlert(priority, title, message, metadata, false, true);
    return { sent: false, error: 'Rate limited' };
  }
  
  // Build message with metadata
  const fullMessage = buildMessage(message, metadata, suppressed);
  
  // Check if Pushover is configured
  if (!isPushoverConfigured()) {
    logAlert(priority, title, message, metadata, false, false);
    return { sent: false, error: 'Pushover not configured' };
  }
  
  // Send via Pushover
  try {
    const result = await sendPushoverNotification({
      title: `🚨 ${title}`,
      message: fullMessage,
      priority: pushoverPriority,
      sound: priority === 'critical' ? 'siren' : undefined,
    });
    
    logAlert(priority, title, message, metadata, result.success, false);
    
    if (!result.success) {
      return { sent: false, error: result.error };
    }
    
    return { sent: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logAlert(priority, title, message, { ...metadata, alertError: errorMessage }, false, false);
    return { sent: false, error: errorMessage };
  }
}

function buildMessage(message: string, metadata: AlertMetadata, suppressedCount: number): string {
  const parts: string[] = [message];
  
  // Add key metadata
  if (metadata.clientId) {
    parts.push(`Client: ${metadata.clientId}`);
  }
  if (metadata.provider) {
    parts.push(`Provider: ${metadata.provider}`);
  }
  if (metadata.workflowName) {
    parts.push(`Workflow: ${metadata.workflowName}`);
  }
  if (metadata.correlationId) {
    parts.push(`Correlation: ${metadata.correlationId.slice(0, 8)}`);
  }
  
  // Add suppression notice if applicable
  if (suppressedCount > 0) {
    parts.push(`⚠️ ${suppressedCount} alerts were suppressed (rate limit)`);
  }
  
  return parts.join('\n');
}

export default AlertService;
