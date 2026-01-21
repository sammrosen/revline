/**
 * Data Cleanup Cron
 * 
 * Daily data retention enforcement.
 * Runs via Railway cron or external scheduler (recommended: daily at 3 AM).
 * 
 * Retention policies:
 * - Events: 90 days (configurable via RETENTION_EVENTS_DAYS)
 * - WebhookEvents: 30 days (configurable via RETENTION_WEBHOOK_EVENTS_DAYS)
 * - WorkflowExecutions: 90 days (configurable via RETENTION_WORKFLOW_EXECUTIONS_DAYS)
 * - IdempotencyKeys: Use their own TTL (24h)
 * 
 * Alerts completion via Pushover through AlertService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/app/_lib/alerts';
import { RetentionService } from '@/app/_lib/retention';

// =============================================================================
// AUTHENTICATION
// =============================================================================

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  // Route protection - hard-fail without secret
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for dry-run query param
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  try {
    // Get table stats before cleanup
    const statsBefore = await RetentionService.getTableStats();

    // Run cleanup
    const result = await RetentionService.cleanup({ dryRun });

    // Get table stats after cleanup (if not dry-run)
    const statsAfter = dryRun ? statsBefore : await RetentionService.getTableStats();

    // Send low-priority notification (info level = no push notification sound)
    const totalDeleted = 
      result.eventsDeleted + 
      result.webhookEventsDeleted + 
      result.workflowExecutionsDeleted + 
      result.idempotencyKeysDeleted +
      result.pendingBookingsDeleted;
    
    const totalProcessed = totalDeleted + result.pendingBookingsExpired;

    if (totalProcessed > 0 || dryRun) {
      AlertService.info(
        dryRun ? 'Cleanup Preview' : 'Daily Cleanup Complete',
        RetentionService.formatResult(result),
        { source: 'data_cleanup_cron' }
      );
    }

    return NextResponse.json({
      success: true,
      dryRun,
      result,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    });
  } catch (error) {
    console.error('Data cleanup error:', error);
    
    // Alert on failure
    try {
      await AlertService.critical(
        'Data Cleanup Failed',
        error instanceof Error ? error.message : 'Unknown error',
        { source: 'data_cleanup_cron' }
      );
    } catch {
      console.error('Failed to send cleanup failure alert');
    }

    return NextResponse.json(
      { error: 'Data cleanup failed' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
