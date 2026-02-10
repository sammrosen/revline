/**
 * ABC Member Sync Cron
 *
 * Hourly sync that polls ABC Ignite for new members and emits
 * workflow triggers for each one. Stateless — each run queries
 * a 75-minute window (60 + 15 overlap buffer). Duplicate members
 * across runs are handled by the lead upsert's unique constraint.
 *
 * Requires:
 * - CRON_SECRET environment variable
 * - ABC_IGNITE integration with memberSync.enabled = true
 *
 * STANDARDS:
 * - Workspace-isolated: each workspace queried independently
 * - Per-workspace try/catch: one failure doesn't block others
 * - Memory-aware: logs heap usage before and after
 * - Fail-safe: returns 200 even on partial failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationType, WorkspaceStatus } from '@prisma/client';
import { AbcIgniteAdapter, normalizeMemberPayload } from '@/app/_lib/integrations/abc-ignite.adapter';
import { emitTrigger } from '@/app/_lib/workflow';
import type { AbcIgniteMeta } from '@/app/_lib/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minutes to look back for new members (75 = 60 + 15 overlap buffer) */
const SYNC_WINDOW_MINUTES = 75;

// =============================================================================
// LOGGING
// =============================================================================

function log(message: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    source: 'abc_member_sync_cron',
    message,
    ...data,
  }));
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateAuth(request)) {
    log('Unauthorized request rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const memBefore = process.memoryUsage();
  log('ABC member sync starting', {
    memoryMB: {
      rss: Math.round(memBefore.rss / 1024 / 1024),
      heapUsed: Math.round(memBefore.heapUsed / 1024 / 1024),
    },
  });

  // Find all active workspaces with ABC_IGNITE where memberSync is enabled
  const integrations = await prisma.workspaceIntegration.findMany({
    where: {
      integration: IntegrationType.ABC_IGNITE,
      workspace: { status: WorkspaceStatus.ACTIVE },
    },
    include: {
      workspace: { select: { id: true, name: true } },
    },
  });

  // Filter to those with memberSync.enabled in meta
  const syncEnabled = integrations.filter(i => {
    const meta = i.meta as AbcIgniteMeta | null;
    return meta?.memberSync?.enabled === true;
  });

  if (syncEnabled.length === 0) {
    log('No workspaces with member sync enabled');
    return NextResponse.json({
      success: true,
      workspacesChecked: 0,
      totalMembers: 0,
      totalTriggers: 0,
      durationMs: Date.now() - startTime,
    });
  }

  // Process each workspace independently
  const results: Array<{
    workspace: string;
    membersFound: number;
    triggersEmitted: number;
    error?: string;
  }> = [];

  for (const integration of syncEnabled) {
    const workspaceId = integration.workspace.id;
    const workspaceName = integration.workspace.name;

    try {
      // Load adapter for this workspace
      const adapter = await AbcIgniteAdapter.forClient(workspaceId);
      if (!adapter) {
        results.push({
          workspace: workspaceName,
          membersFound: 0,
          triggersEmitted: 0,
          error: 'Failed to load adapter',
        });
        continue;
      }

      // Query for new members
      const membersResult = await adapter.getNewMembers(SYNC_WINDOW_MINUTES);
      if (!membersResult.success) {
        results.push({
          workspace: workspaceName,
          membersFound: 0,
          triggersEmitted: 0,
          error: membersResult.error || 'API call failed',
        });
        continue;
      }

      const members = membersResult.data || [];
      let triggersEmitted = 0;

      // Emit trigger for each member with a valid email
      for (const member of members) {
        const payload = normalizeMemberPayload(member);

        if (!payload.email) {
          // Skip members without email — can't create a lead
          continue;
        }

        try {
          await emitTrigger(workspaceId, {
            adapter: 'abc_ignite',
            operation: 'new_member',
          }, payload);
          triggersEmitted++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown';
          log('Trigger emission failed', { workspaceId, email: '[redacted]', error: msg });
        }
      }

      // Emit summary event for audit trail
      await emitEvent({
        workspaceId,
        system: EventSystem.ABC_IGNITE,
        eventType: 'member_sync_completed',
        success: true,
        errorMessage: `Found ${members.length} new members, emitted ${triggersEmitted} triggers`,
      });

      results.push({
        workspace: workspaceName,
        membersFound: members.length,
        triggersEmitted,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      log('Workspace sync failed', { workspaceId, error: msg });

      // Emit failure event
      try {
        await emitEvent({
          workspaceId,
          system: EventSystem.ABC_IGNITE,
          eventType: 'member_sync_failed',
          success: false,
          errorMessage: msg,
        });
      } catch {
        // Don't let event emission failure mask the original error
      }

      results.push({
        workspace: workspaceName,
        membersFound: 0,
        triggersEmitted: 0,
        error: msg,
      });
    }
  }

  const totalMembers = results.reduce((sum, r) => sum + r.membersFound, 0);
  const totalTriggers = results.reduce((sum, r) => sum + r.triggersEmitted, 0);
  const totalErrors = results.filter(r => r.error).length;
  const durationMs = Date.now() - startTime;

  const memAfter = process.memoryUsage();
  log('ABC member sync completed', {
    workspacesChecked: syncEnabled.length,
    totalMembers,
    totalTriggers,
    totalErrors,
    durationMs,
    memoryMB: {
      rss: Math.round(memAfter.rss / 1024 / 1024),
      heapUsed: Math.round(memAfter.heapUsed / 1024 / 1024),
      delta: Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024),
    },
  });

  return NextResponse.json({
    success: totalErrors === 0,
    workspacesChecked: syncEnabled.length,
    totalMembers,
    totalTriggers,
    results,
    durationMs,
  });
}

// Also support POST for manual triggering
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
