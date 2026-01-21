/**
 * Health Check Cron
 * 
 * Scheduled health check for all clients and system metrics.
 * Runs every 15 minutes via Railway cron or external scheduler.
 * 
 * Checks:
 * - Integration silence (4+ hours no activity)
 * - Consecutive failures (3+ failures = RED)
 * - Stuck leads (24+ hours in CAPTURED)
 * - Webhook backlog (pending/processing > threshold)
 * - Error rate spike (>10% failure rate)
 * - Workflow failures spike (>5/hour)
 * 
 * Alerts via Pushover through AlertService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { HealthStatus, WorkspaceStatus } from '@prisma/client';
import { AlertService } from '@/app/_lib/alerts';
import { ObservabilityService } from '@/app/_lib/observability';

// =============================================================================
// INTEGRATION TO EVENTSYSTEM MAPPING
// =============================================================================

/**
 * Map integration name to EventSystem enum
 * Returns null for integrations without a matching EventSystem (e.g., revline)
 */
function getEventSystemForIntegration(integrationName: string): EventSystem | null {
  const mapping: Record<string, EventSystem> = {
    mailerlite: EventSystem.MAILERLITE,
    stripe: EventSystem.STRIPE,
    calendly: EventSystem.CALENDLY,
    manychat: EventSystem.MANYCHAT,
    abc_ignite: EventSystem.ABC_IGNITE,
  };
  return mapping[integrationName] ?? null;
}

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

  const issues: string[] = [];
  const startTime = Date.now();

  try {
    // =========================================================================
    // CLIENT-SPECIFIC CHECKS
    // =========================================================================
    
    const clients = await prisma.workspace.findMany({
      where: { status: WorkspaceStatus.ACTIVE },
      include: {
        integrations: true,
      },
    });

    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const client of clients) {
      for (const integration of client.integrations) {
        const previousStatus = integration.healthStatus;
        let newStatus: HealthStatus = HealthStatus.GREEN;

        // Check 1: Integration silence (no events in 4+ hours)
        if (integration.lastSeenAt && integration.lastSeenAt < fourHoursAgo) {
          newStatus = HealthStatus.YELLOW;
          issues.push(
            `${client.name}: ${integration.integration} silent for 4+ hours`
          );
        }

        // Check 2: Consecutive failures (only if we can map to EventSystem)
        const eventSystem = getEventSystemForIntegration(integration.integration);
        if (eventSystem) {
          const recentEvents = await prisma.event.findMany({
            where: {
              workspaceId: client.id,
              system: eventSystem,
              createdAt: { gte: fourHoursAgo },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

          const consecutiveFailures = recentEvents
            .slice(0, 3)
            .filter((e) => !e.success).length;

          if (consecutiveFailures >= 3) {
            newStatus = HealthStatus.RED;
            issues.push(
              `${client.name}: ${integration.integration} has 3+ consecutive failures`
            );
          }
        }

        // Update health status if changed
        if (newStatus !== previousStatus) {
          await prisma.workspaceIntegration.update({
            where: { id: integration.id },
            data: { healthStatus: newStatus },
          });

          await emitEvent({
            workspaceId: client.id,
            system: EventSystem.CRON,
            eventType: 'health_status_changed',
            success: true,
            errorMessage: `${integration.integration}: ${previousStatus} → ${newStatus}`,
          });
        }
      }

      // Check 3: Stuck leads (captured but no progress in 24h)
      const stuckLeads = await prisma.lead.count({
        where: {
          workspaceId: client.id,
          stage: 'CAPTURED',
          lastEventAt: { lt: twentyFourHoursAgo },
        },
      });

      if (stuckLeads > 0) {
        issues.push(`${client.name}: ${stuckLeads} leads stuck for 24+ hours`);
      }
    }

    // =========================================================================
    // SYSTEM-WIDE CHECKS (NEW)
    // =========================================================================
    
    const metrics = await ObservabilityService.getMetrics();
    const thresholds = ObservabilityService.getThresholds();

    // Check 4: Webhook backlog
    const totalBacklog = metrics.webhooks.pending + metrics.webhooks.processing;
    if (totalBacklog > thresholds.webhookBacklogMax) {
      issues.push(
        `System: ${totalBacklog} webhooks in backlog (threshold: ${thresholds.webhookBacklogMax})`
      );
    }

    // Check 5: Stuck webhooks
    if (
      metrics.webhooks.oldestPendingMinutes !== null &&
      metrics.webhooks.oldestPendingMinutes > thresholds.stuckProcessingMinutes
    ) {
      issues.push(
        `System: Webhooks stuck for ${metrics.webhooks.oldestPendingMinutes} minutes`
      );
    }

    // Check 6: Error rate spike
    if (
      metrics.events.totalLastHour > 10 && // Only alert if there's meaningful traffic
      metrics.events.errorRatePercent > thresholds.errorRatePercent
    ) {
      issues.push(
        `System: ${metrics.events.errorRatePercent.toFixed(1)}% error rate in last hour (${metrics.events.failedLastHour}/${metrics.events.totalLastHour})`
      );
    }

    // Check 7: Workflow failures spike
    if (metrics.workflows.failedLastHour > thresholds.failedWorkflowsPerHour) {
      issues.push(
        `System: ${metrics.workflows.failedLastHour} workflow failures in last hour (threshold: ${thresholds.failedWorkflowsPerHour})`
      );
    }

    // =========================================================================
    // ALERTING (via Pushover)
    // =========================================================================
    
    if (issues.length > 0) {
      await sendAlerts(issues);
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      clientsChecked: clients.length,
      issuesFound: issues.length,
      issues: issues.length > 0 ? issues : undefined,
      metrics: {
        webhookBacklog: totalBacklog,
        errorRatePercent: metrics.events.errorRatePercent,
        workflowFailures: metrics.workflows.failedLastHour,
      },
      durationMs,
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    // Try to alert on failure
    try {
      await AlertService.critical(
        'Health Check Failed',
        error instanceof Error ? error.message : 'Unknown error',
        { source: 'health_check_cron' }
      );
    } catch {
      // Alert failed too - just log
      console.error('Failed to send health check failure alert');
    }

    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ALERTING
// =============================================================================

/**
 * Send alerts via Pushover through AlertService
 * Replaces the old Resend email alerting
 */
async function sendAlerts(issues: string[]): Promise<void> {
  if (issues.length === 0) return;

  const message = issues.map((i) => `• ${i}`).join('\n');
  
  // Determine severity based on issue types
  const hasCritical = issues.some(
    (i) => i.includes('consecutive failures') || 
           i.includes('stuck for') ||
           i.includes('error rate')
  );

  if (hasCritical) {
    await AlertService.critical(
      `Health Check: ${issues.length} issue(s)`,
      message,
      { source: 'health_check_cron' }
    );
  } else {
    await AlertService.warning(
      `Health Check: ${issues.length} issue(s)`,
      message,
      { source: 'health_check_cron' }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
