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
 * 
 * OPTIMIZED: Uses parallel queries and timeout protection to complete reliably.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { HealthStatus, WorkspaceStatus, WorkspaceIntegration, Workspace } from '@prisma/client';
import { AlertService } from '@/app/_lib/alerts';
import { ObservabilityService } from '@/app/_lib/observability';

// =============================================================================
// CONSTANTS
// =============================================================================

const TIMEOUT_MS = 12000; // 12 seconds (Railway limit is ~15s)
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = '[health-check]';

// =============================================================================
// DIAGNOSTIC LOGGING
// =============================================================================

function log(message: string, data?: Record<string, unknown>) {
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
// TYPES
// =============================================================================

type WorkspaceWithIntegrations = Workspace & {
  integrations: WorkspaceIntegration[];
};

interface HealthCheckResult {
  success: boolean;
  partial?: boolean;
  clientsChecked: number;
  issuesFound: number;
  issues?: string[];
  metrics?: {
    webhookBacklog: number;
    errorRatePercent: number;
    workflowFailures: number;
  };
  durationMs: number;
  error?: string;
}

interface IntegrationCheckResult {
  integrationId: string;
  workspaceName: string;
  integrationName: string;
  previousStatus: HealthStatus;
  newStatus: HealthStatus;
  issue?: string;
}

// =============================================================================
// INTEGRATION TO EVENTSYSTEM MAPPING
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
// TIMEOUT WRAPPER
// =============================================================================

/**
 * Race a promise against a timeout.
 * Returns { result, timedOut } so caller can handle partial results.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<{ result: T | null; timedOut: boolean }> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<{ result: null; timedOut: true }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ result: null, timedOut: true });
    }, timeoutMs);
  });

  const resultPromise = promise.then((result) => {
    clearTimeout(timeoutId);
    return { result, timedOut: false as const };
  });

  return Promise.race([resultPromise, timeoutPromise]);
}

// =============================================================================
// BATCHED DATA FETCHING
// =============================================================================

/**
 * Fetch all data needed for health checks in parallel batched queries.
 * This replaces the N+1 query pattern with 3 parallel queries.
 */
async function fetchHealthCheckData(workspaceIds: string[], fourHoursAgo: Date, twentyFourHoursAgo: Date) {
  const queryStart = Date.now();
  
  const [recentEvents, stuckLeadsCounts] = await Promise.all([
    // Batch query: Get recent events for all workspaces (for failure detection)
    prisma.event.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        createdAt: { gte: fourHoursAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        workspaceId: true,
        system: true,
        success: true,
        createdAt: true,
      },
      take: 5000, // Safety limit to prevent memory issues
    }),
    // Batch query: Get stuck leads counts for all workspaces
    prisma.lead.groupBy({
      by: ['workspaceId'],
      where: {
        workspaceId: { in: workspaceIds },
        stage: 'CAPTURED',
        lastEventAt: { lt: twentyFourHoursAgo },
      },
      _count: true,
    }),
  ]);

  log('Fetched batch data', {
    eventsCount: recentEvents.length,
    stuckLeadsGroups: stuckLeadsCounts.length,
    durationMs: elapsed(queryStart),
  });

  // Group events by workspaceId and system for efficient lookup
  const eventsByWorkspaceAndSystem = new Map<string, typeof recentEvents>();
  for (const event of recentEvents) {
    const key = `${event.workspaceId}:${event.system}`;
    const existing = eventsByWorkspaceAndSystem.get(key) || [];
    existing.push(event);
    eventsByWorkspaceAndSystem.set(key, existing);
  }

  // Convert stuck leads to a map for O(1) lookup
  const stuckLeadsByWorkspace = new Map<string, number>();
  for (const item of stuckLeadsCounts) {
    stuckLeadsByWorkspace.set(item.workspaceId, item._count);
  }

  return { eventsByWorkspaceAndSystem, stuckLeadsByWorkspace, eventsCount: recentEvents.length };
}

// =============================================================================
// WORKSPACE HEALTH CHECK (Single Workspace)
// =============================================================================

/**
 * Check health of a single workspace's integrations.
 * Uses pre-fetched batched data instead of making individual queries.
 */
function checkWorkspaceHealth(
  workspace: WorkspaceWithIntegrations,
  eventsByWorkspaceAndSystem: Map<string, { workspaceId: string; system: EventSystem; success: boolean; createdAt: Date }[]>,
  stuckLeadsByWorkspace: Map<string, number>,
  fourHoursAgo: Date
): { integrationResults: IntegrationCheckResult[]; stuckLeadsIssue?: string } {
  const integrationResults: IntegrationCheckResult[] = [];

  for (const integration of workspace.integrations) {
    const previousStatus = integration.healthStatus;
    let newStatus: HealthStatus = HealthStatus.GREEN;
    let issue: string | undefined;

    // Check 1: Integration silence (no events in 4+ hours)
    if (integration.lastSeenAt && integration.lastSeenAt < fourHoursAgo) {
      newStatus = HealthStatus.YELLOW;
      issue = `${workspace.name}: ${integration.integration} silent for 4+ hours`;
    }

    // Check 2: Consecutive failures (only if we can map to EventSystem)
    const eventSystem = getEventSystemForIntegration(integration.integration);
    if (eventSystem) {
      const key = `${workspace.id}:${eventSystem}`;
      const events = eventsByWorkspaceAndSystem.get(key) || [];
      
      // Get the 3 most recent events and check for consecutive failures
      const recentThree = events.slice(0, 3);
      const consecutiveFailures = recentThree.filter((e) => !e.success).length;

      if (consecutiveFailures >= 3) {
        newStatus = HealthStatus.RED;
        issue = `${workspace.name}: ${integration.integration} has 3+ consecutive failures`;
      }
    }

    integrationResults.push({
      integrationId: integration.id,
      workspaceName: workspace.name,
      integrationName: integration.integration,
      previousStatus,
      newStatus,
      issue,
    });
  }

  // Check 3: Stuck leads
  const stuckLeads = stuckLeadsByWorkspace.get(workspace.id) || 0;
  const stuckLeadsIssue = stuckLeads > 0
    ? `${workspace.name}: ${stuckLeads} leads stuck for 24+ hours`
    : undefined;

  return { integrationResults, stuckLeadsIssue };
}

// =============================================================================
// BATCH STATUS UPDATES
// =============================================================================

/**
 * Update integration statuses that changed and emit events.
 * Runs in parallel for efficiency.
 */
async function applyStatusUpdates(results: IntegrationCheckResult[]): Promise<number> {
  const updates = results.filter((r) => r.newStatus !== r.previousStatus);
  
  if (updates.length === 0) return 0;

  const updateStart = Date.now();

  // Run all updates in parallel
  await Promise.all(
    updates.map(async (update) => {
      // Update the integration status
      await prisma.workspaceIntegration.update({
        where: { id: update.integrationId },
        data: { healthStatus: update.newStatus },
      });

      // Get workspaceId from integration for the event
      const integration = await prisma.workspaceIntegration.findUnique({
        where: { id: update.integrationId },
        select: { workspaceId: true },
      });

      if (integration) {
        await emitEvent({
          workspaceId: integration.workspaceId,
          system: EventSystem.CRON,
          eventType: 'health_status_changed',
          success: true,
          errorMessage: `${update.integrationName}: ${update.previousStatus} → ${update.newStatus}`,
        });
      }
    })
  );

  log('Applied status updates', {
    updatesCount: updates.length,
    durationMs: elapsed(updateStart),
  });

  return updates.length;
}

// =============================================================================
// MAIN HEALTH CHECK LOGIC
// =============================================================================

async function runHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  log('Starting health check');

  // Fetch all active workspaces with integrations
  const workspaceStart = Date.now();
  const workspaces = await prisma.workspace.findMany({
    where: { status: WorkspaceStatus.ACTIVE },
    include: { integrations: true },
  });

  const totalIntegrations = workspaces.reduce((sum, w) => sum + w.integrations.length, 0);
  log('Fetched workspaces', {
    workspacesCount: workspaces.length,
    integrationsCount: totalIntegrations,
    durationMs: elapsed(workspaceStart),
  });

  if (workspaces.length === 0) {
    log('No active workspaces, completing early');
    return {
      success: true,
      clientsChecked: 0,
      issuesFound: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - FOUR_HOURS_MS);
  const twentyFourHoursAgo = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
  const workspaceIds = workspaces.map((w) => w.id);

  // Fetch all data in parallel batched queries
  const { eventsByWorkspaceAndSystem, stuckLeadsByWorkspace, eventsCount } = await fetchHealthCheckData(
    workspaceIds,
    fourHoursAgo,
    twentyFourHoursAgo
  );

  // Process all workspaces (CPU-bound, no I/O)
  const processStart = Date.now();
  const allIntegrationResults: IntegrationCheckResult[] = [];
  
  for (const workspace of workspaces) {
    const { integrationResults, stuckLeadsIssue } = checkWorkspaceHealth(
      workspace,
      eventsByWorkspaceAndSystem,
      stuckLeadsByWorkspace,
      fourHoursAgo
    );
    
    allIntegrationResults.push(...integrationResults);
    
    // Collect issues
    for (const result of integrationResults) {
      if (result.issue) {
        issues.push(result.issue);
      }
    }
    if (stuckLeadsIssue) {
      issues.push(stuckLeadsIssue);
    }
  }

  log('Processed workspaces', {
    issuesFound: issues.length,
    durationMs: elapsed(processStart),
  });

  // Apply status updates in parallel
  await applyStatusUpdates(allIntegrationResults);

  // Get system-wide metrics (already parallelized internally)
  const metricsStart = Date.now();
  const metrics = await ObservabilityService.getMetrics();
  const thresholds = ObservabilityService.getThresholds();

  log('Fetched system metrics', {
    durationMs: elapsed(metricsStart),
  });

  // Check system-wide metrics
  const totalBacklog = metrics.webhooks.pending + metrics.webhooks.processing;
  
  if (totalBacklog > thresholds.webhookBacklogMax) {
    issues.push(
      `System: ${totalBacklog} webhooks in backlog (threshold: ${thresholds.webhookBacklogMax})`
    );
  }

  if (
    metrics.webhooks.oldestPendingMinutes !== null &&
    metrics.webhooks.oldestPendingMinutes > thresholds.stuckProcessingMinutes
  ) {
    issues.push(
      `System: Webhooks stuck for ${metrics.webhooks.oldestPendingMinutes} minutes`
    );
  }

  if (
    metrics.events.totalLastHour > 10 &&
    metrics.events.errorRatePercent > thresholds.errorRatePercent
  ) {
    issues.push(
      `System: ${metrics.events.errorRatePercent.toFixed(1)}% error rate in last hour (${metrics.events.failedLastHour}/${metrics.events.totalLastHour})`
    );
  }

  if (metrics.workflows.failedLastHour > thresholds.failedWorkflowsPerHour) {
    issues.push(
      `System: ${metrics.workflows.failedLastHour} workflow failures in last hour (threshold: ${thresholds.failedWorkflowsPerHour})`
    );
  }

  // Send alerts if there are issues
  if (issues.length > 0) {
    const alertStart = Date.now();
    await sendAlerts(issues);
    log('Sent alerts', {
      issuesCount: issues.length,
      durationMs: elapsed(alertStart),
    });
  }

  const totalDuration = elapsed(startTime);
  log('Health check completed', {
    success: true,
    workspacesChecked: workspaces.length,
    integrationsChecked: totalIntegrations,
    eventsProcessed: eventsCount,
    issuesFound: issues.length,
    totalDurationMs: totalDuration,
  });

  return {
    success: true,
    clientsChecked: workspaces.length,
    issuesFound: issues.length,
    issues: issues.length > 0 ? issues : undefined,
    metrics: {
      webhookBacklog: totalBacklog,
      errorRatePercent: metrics.events.errorRatePercent,
      workflowFailures: metrics.workflows.failedLastHour,
    },
    durationMs: totalDuration,
  };
}

// =============================================================================
// ALERTING
// =============================================================================

async function sendAlerts(issues: string[]): Promise<void> {
  if (issues.length === 0) return;

  const message = issues.map((i) => `• ${i}`).join('\n');
  
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

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  // Route protection - hard-fail without secret
  if (!validateAuth(request)) {
    log('Unauthorized request rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  log('Request received, starting with timeout protection', { timeoutMs: TIMEOUT_MS });

  try {
    // Run health check with timeout protection
    const { result, timedOut } = await withTimeout(runHealthCheck(), TIMEOUT_MS);

    if (timedOut) {
      // Timeout occurred - return partial response
      log('TIMEOUT - health check exceeded limit', {
        timeoutMs: TIMEOUT_MS,
        elapsedMs: elapsed(startTime),
      });
      
      // Try to alert about the timeout
      try {
        await AlertService.warning(
          'Health Check Timeout',
          `Health check exceeded ${TIMEOUT_MS}ms timeout. Partial results may be missing.`,
          { source: 'health_check_cron' }
        );
      } catch {
        log('Failed to send timeout alert');
      }

      return NextResponse.json({
        success: false,
        partial: true,
        error: `Health check timed out after ${TIMEOUT_MS}ms`,
        durationMs: Date.now() - startTime,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('ERROR - health check failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: elapsed(startTime),
    });
    
    // Try to alert on failure
    try {
      await AlertService.critical(
        'Health Check Failed',
        errorMessage,
        { source: 'health_check_cron' }
      );
    } catch {
      log('Failed to send error alert');
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Health check failed',
        message: errorMessage,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
