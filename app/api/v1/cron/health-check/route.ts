/**
 * Health Check Cron
 *
 * Scheduled health check for all workspaces and system metrics.
 * Runs every 15 minutes via Railway cron or external scheduler.
 *
 * Architecture: Three isolated check functions, each with its own try/catch.
 * One check failing does not affect the others.
 *
 * Checks:
 * 1. Integration health — silence detection (4+ hours) and consecutive failures (3+)
 * 2. Stuck leads — leads in CAPTURED stage for 24+ hours
 * 3. System metrics — webhook backlog, error rate, workflow failures
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
// CONSTANTS
// =============================================================================

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// TYPES
// =============================================================================

/** Uniform contract for every check section */
interface CheckResult {
  name: string;
  issues: string[];
  error?: string; // set if the check itself threw
}

// =============================================================================
// DIAGNOSTIC LOGGING
// =============================================================================

function log(message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    source: 'health_check_cron',
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

function elapsed(startTime: number): number {
  return Date.now() - startTime;
}

// =============================================================================
// INTEGRATION → EVENTSYSTEM MAPPING
// =============================================================================

const INTEGRATION_EVENT_SYSTEM_MAP: Record<string, EventSystem> = {
  mailerlite: EventSystem.MAILERLITE,
  stripe: EventSystem.STRIPE,
  calendly: EventSystem.CALENDLY,
  manychat: EventSystem.MANYCHAT,
  abc_ignite: EventSystem.ABC_IGNITE,
};

function getEventSystemForIntegration(integrationName: string): EventSystem | null {
  return INTEGRATION_EVENT_SYSTEM_MAP[integrationName.toLowerCase()] ?? null;
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
// CHECK 1: INTEGRATION HEALTH
// =============================================================================

/**
 * For each active workspace, check every integration for:
 * - Silence: lastSeenAt older than 4 hours → YELLOW
 * - Consecutive failures: last 3 events all failed → RED
 *
 * Updates healthStatus in the database when it changes.
 * Per-workspace try/catch so one bad workspace doesn't kill the whole check.
 */
async function checkIntegrationHealth(): Promise<CheckResult> {
  const issues: string[] = [];
  const start = Date.now();

  try {
    // One query: all active workspaces with their integrations
    const workspaces = await prisma.workspace.findMany({
      where: { status: WorkspaceStatus.ACTIVE },
      include: { integrations: true },
    });

    if (workspaces.length === 0) {
      log('checkIntegrationHealth: no active workspaces');
      return { name: 'integration_health', issues };
    }

    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - FOUR_HOURS_MS);

    // Collect all integrations that need failure checks
    type IntegrationRef = {
      workspaceName: string;
      workspaceId: string;
      integrationId: string;
      integrationName: string;
      previousStatus: HealthStatus;
      eventSystem: EventSystem | null;
    };
    const refs: IntegrationRef[] = [];

    for (const workspace of workspaces) {
      for (const integration of workspace.integrations) {
        refs.push({
          workspaceName: workspace.name,
          workspaceId: workspace.id,
          integrationId: integration.id,
          integrationName: integration.integration,
          previousStatus: integration.healthStatus,
          eventSystem: getEventSystemForIntegration(integration.integration),
        });
      }
    }

    // Batch: get last 3 events per (workspace, system) in one query
    // Only query for integrations that have a mapped event system
    const systemRefs = refs.filter(r => r.eventSystem !== null);
    const failureMap = new Map<string, boolean>(); // "workspaceId:system" → has3ConsecutiveFailures

    if (systemRefs.length > 0) {
      // Single query: get recent failure events for all integrations at once
      const recentEvents = await prisma.event.findMany({
        where: {
          OR: systemRefs.map(r => ({
            workspaceId: r.workspaceId,
            system: r.eventSystem!,
          })),
        },
        orderBy: { createdAt: 'desc' },
        select: { workspaceId: true, system: true, success: true, createdAt: true },
        // Generous limit: 3 per integration, capped at reasonable total
        take: systemRefs.length * 3,
      });

      // Group by workspace+system and check for 3 consecutive failures
      const grouped = new Map<string, boolean[]>();
      for (const evt of recentEvents) {
        const key = `${evt.workspaceId}:${evt.system}`;
        const arr = grouped.get(key) ?? [];
        if (arr.length < 3) {
          arr.push(evt.success);
          grouped.set(key, arr);
        }
      }

      for (const [key, successes] of grouped) {
        failureMap.set(key, successes.length >= 3 && successes.every(s => !s));
      }
    }

    // Now evaluate each integration using pre-fetched data
    for (const ref of refs) {
      try {
        let newStatus: HealthStatus = HealthStatus.GREEN;
        let issue: string | undefined;

        // Silence check — uses the integration row's lastSeenAt (already loaded)
        const integration = workspaces
          .find(w => w.id === ref.workspaceId)!
          .integrations.find(i => i.id === ref.integrationId)!;

        if (integration.lastSeenAt && integration.lastSeenAt < fourHoursAgo) {
          newStatus = HealthStatus.YELLOW;
          issue = `${ref.workspaceName}: ${ref.integrationName} silent for 4+ hours`;
        }

        // Consecutive failure check — from batch query results
        if (ref.eventSystem) {
          const key = `${ref.workspaceId}:${ref.eventSystem}`;
          if (failureMap.get(key)) {
            newStatus = HealthStatus.RED;
            issue = `${ref.workspaceName}: ${ref.integrationName} has 3+ consecutive failures`;
          }
        }

        // Update DB if status changed
        if (newStatus !== ref.previousStatus) {
          await prisma.workspaceIntegration.update({
            where: { id: ref.integrationId },
            data: { healthStatus: newStatus },
          });

          await emitEvent({
            workspaceId: ref.workspaceId,
            system: EventSystem.CRON,
            eventType: 'health_status_changed',
            success: true,
            errorMessage: `${ref.integrationName}: ${ref.previousStatus} → ${newStatus}`,
          });
        }

        if (issue) {
          issues.push(issue);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        log('checkIntegrationHealth: integration error', { integrationId: ref.integrationId, error: msg });
        issues.push(`${ref.workspaceName}: ${ref.integrationName} check failed — ${msg}`);
      }
    }

    log('checkIntegrationHealth completed', {
      workspaces: workspaces.length,
      issues: issues.length,
      durationMs: elapsed(start),
    });

    return { name: 'integration_health', issues };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log('checkIntegrationHealth FAILED', { error: msg, durationMs: elapsed(start) });
    return { name: 'integration_health', issues, error: msg };
  }
}

// =============================================================================
// CHECK 2: STUCK LEADS
// =============================================================================

/**
 * Find leads stuck in CAPTURED for 24+ hours, grouped by workspace.
 * Single lightweight groupBy query.
 */
async function checkStuckLeads(): Promise<CheckResult> {
  const issues: string[] = [];
  const start = Date.now();

  try {
    const twentyFourHoursAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

    const stuckCounts = await prisma.lead.groupBy({
      by: ['workspaceId'],
      where: {
        stage: 'CAPTURED',
        lastEventAt: { lt: twentyFourHoursAgo },
      },
      _count: true,
    });

    if (stuckCounts.length > 0) {
      // Fetch workspace names for the report
      const workspaceIds = stuckCounts.map(s => s.workspaceId);
      const workspaces = await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(workspaces.map(w => [w.id, w.name]));

      for (const item of stuckCounts) {
        const name = nameMap.get(item.workspaceId) ?? item.workspaceId;
        issues.push(`${name}: ${item._count} leads stuck in CAPTURED for 24+ hours`);
      }
    }

    log('checkStuckLeads completed', { groups: stuckCounts.length, durationMs: elapsed(start) });
    return { name: 'stuck_leads', issues };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log('checkStuckLeads FAILED', { error: msg, durationMs: elapsed(start) });
    return { name: 'stuck_leads', issues, error: msg };
  }
}

// =============================================================================
// CHECK 3: SYSTEM METRICS
// =============================================================================

/**
 * Check system-wide metrics via ObservabilityService:
 * - Webhook backlog
 * - Stuck webhooks
 * - Error rate
 * - Workflow failures
 *
 * Uses the existing ObservabilityService which runs 8 parallel count queries.
 */
async function checkSystemMetrics(): Promise<CheckResult> {
  const issues: string[] = [];
  const start = Date.now();

  try {
    const metrics = await ObservabilityService.getMetrics();
    const thresholds = ObservabilityService.getThresholds();

    // Webhook backlog
    const totalBacklog = metrics.webhooks.pending + metrics.webhooks.processing;
    if (totalBacklog > thresholds.webhookBacklogMax) {
      issues.push(
        `System: ${totalBacklog} webhooks in backlog (threshold: ${thresholds.webhookBacklogMax})`
      );
    }

    // Stuck webhooks
    if (
      metrics.webhooks.oldestPendingMinutes !== null &&
      metrics.webhooks.oldestPendingMinutes > thresholds.stuckProcessingMinutes
    ) {
      issues.push(
        `System: Webhooks stuck for ${metrics.webhooks.oldestPendingMinutes} minutes`
      );
    }

    // Error rate (only meaningful with sufficient volume)
    if (
      metrics.events.totalLastHour > 10 &&
      metrics.events.errorRatePercent > thresholds.errorRatePercent
    ) {
      issues.push(
        `System: ${metrics.events.errorRatePercent.toFixed(1)}% error rate in last hour (${metrics.events.failedLastHour}/${metrics.events.totalLastHour})`
      );
    }

    // Workflow failures
    if (metrics.workflows.failedLastHour > thresholds.failedWorkflowsPerHour) {
      issues.push(
        `System: ${metrics.workflows.failedLastHour} workflow failures in last hour (threshold: ${thresholds.failedWorkflowsPerHour})`
      );
    }

    log('checkSystemMetrics completed', {
      backlog: totalBacklog,
      errorRate: metrics.events.errorRatePercent,
      workflowFailures: metrics.workflows.failedLastHour,
      durationMs: elapsed(start),
    });

    return { name: 'system_metrics', issues };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    log('checkSystemMetrics FAILED', { error: msg, durationMs: elapsed(start) });
    return { name: 'system_metrics', issues, error: msg };
  }
}

// =============================================================================
// ALERTING
// =============================================================================

async function sendAlerts(issues: string[]): Promise<void> {
  if (issues.length === 0) return;

  const message = issues.map((i) => `\u2022 ${i}`).join('\n');

  const hasCritical = issues.some(
    (i) =>
      i.includes('consecutive failures') ||
      i.includes('stuck') ||
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

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth — hard-fail without secret
  if (!validateAuth(request)) {
    log('Unauthorized request rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const memBefore = process.memoryUsage();
  log('Health check starting', {
    memoryMB: {
      rss: Math.round(memBefore.rss / 1024 / 1024),
      heapUsed: Math.round(memBefore.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memBefore.heapTotal / 1024 / 1024),
    },
  });

  // Run each check sequentially — each is isolated with its own try/catch
  const results: CheckResult[] = [];
  results.push(await checkIntegrationHealth());
  results.push(await checkStuckLeads());
  results.push(await checkSystemMetrics());

  // Collect all issues across checks
  const allIssues = results.flatMap((r) => r.issues);
  const failedChecks = results.filter((r) => r.error);

  // Single combined alert if any issues found
  if (allIssues.length > 0) {
    try {
      await sendAlerts(allIssues);
      log('Alerts sent', { issuesCount: allIssues.length });
    } catch (err) {
      log('Failed to send alerts', {
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  const totalDuration = elapsed(startTime);
  const memAfter = process.memoryUsage();
  log('Health check completed', {
    success: failedChecks.length === 0,
    checks: results.length,
    failedChecks: failedChecks.length,
    totalIssues: allIssues.length,
    durationMs: totalDuration,
    memoryMB: {
      rss: Math.round(memAfter.rss / 1024 / 1024),
      heapUsed: Math.round(memAfter.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memAfter.heapTotal / 1024 / 1024),
      delta: Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024),
    },
  });

  return NextResponse.json({
    success: failedChecks.length === 0,
    checks: results.map((r) => ({
      name: r.name,
      issues: r.issues.length,
      error: r.error ?? null,
    })),
    totalIssues: allIssues.length,
    issues: allIssues.length > 0 ? allIssues : undefined,
    durationMs: totalDuration,
  });
}

// Also support POST for manual triggering
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
