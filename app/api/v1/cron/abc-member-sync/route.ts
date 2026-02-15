/**
 * ABC Member Sync Cron
 *
 * Hourly sync that polls ABC Ignite for new members (direct signups
 * and prospect-to-member conversions) and emits workflow triggers.
 *
 * Detection strategy:
 * 1. New direct signups — joinStatus=member + createdTimestampRange
 * 2. Converted prospects — joinStatus=member + lastModifiedTimestampRange
 *    filtered locally by agreement.convertedDate in the window
 *
 * State management:
 * - Watermark-based: stores lastSyncTimestamp in integration meta
 * - Falls back to now - 75min on first run or missing watermark
 * - Sync-level dedup via recentMemberIds in integration meta (capped)
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

/** Default fallback window in minutes when no watermark exists */
const DEFAULT_WINDOW_MINUTES = 75;

/** Overlap buffer added to watermark (minutes) to prevent edge-case gaps */
const OVERLAP_BUFFER_MINUTES = 15;

/** Maximum number of recent member IDs to store for dedup */
const RECENT_MEMBER_IDS_CAP = 500;

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
// WATERMARK HELPERS
// =============================================================================

/**
 * Compute the sync window start from the watermark or default fallback.
 * Adds an overlap buffer to the watermark to prevent edge-case gaps.
 */
function getSyncWindowStart(meta: AbcIgniteMeta | null): Date {
  const lastSync = meta?.memberSync?.lastSyncTimestamp;

  if (lastSync) {
    const watermark = new Date(lastSync);
    if (!isNaN(watermark.getTime())) {
      // Subtract overlap buffer from watermark
      return new Date(watermark.getTime() - OVERLAP_BUFFER_MINUTES * 60 * 1000);
    }
  }

  // No watermark — fall back to default window
  return new Date(Date.now() - DEFAULT_WINDOW_MINUTES * 60 * 1000);
}

/**
 * Persist the watermark and recent member IDs to integration meta.
 * Uses a partial merge so we don't overwrite other meta fields.
 */
async function persistSyncState(
  integrationId: string,
  currentMeta: AbcIgniteMeta | null,
  newTimestamp: string,
  newMemberIds: string[]
): Promise<void> {
  const existingRecentIds = currentMeta?.memberSync?.recentMemberIds || [];

  // Merge new IDs with existing, then trim to cap
  const mergedIds = [...new Set([...newMemberIds, ...existingRecentIds])];
  const cappedIds = mergedIds.slice(0, RECENT_MEMBER_IDS_CAP);

  const updatedMeta = {
    ...currentMeta,
    memberSync: {
      ...currentMeta?.memberSync,
      enabled: currentMeta?.memberSync?.enabled ?? true,
      lastSyncTimestamp: newTimestamp,
      recentMemberIds: cappedIds,
    },
  };

  await prisma.workspaceIntegration.update({
    where: { id: integrationId },
    data: { meta: updatedMeta },
  });
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
  const now = new Date();
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
    membersSkippedMemberType: number;
    membersSkippedDedup: number;
    membersSkippedNoEmail: number;
    triggersEmitted: number;
    detectionBreakdown: { newDirect: number; converted: number };
    error?: string;
  }> = [];

  for (const integration of syncEnabled) {
    const workspaceId = integration.workspace.id;
    const workspaceName = integration.workspace.name;
    const meta = integration.meta as AbcIgniteMeta | null;

    try {
      // Load adapter for this workspace
      const adapter = await AbcIgniteAdapter.forClient(workspaceId);
      if (!adapter) {
        results.push({
          workspace: workspaceName,
          membersFound: 0,
          membersSkippedMemberType: 0,
          membersSkippedDedup: 0,
          membersSkippedNoEmail: 0,
          triggersEmitted: 0,
          detectionBreakdown: { newDirect: 0, converted: 0 },
          error: 'Failed to load adapter',
        });
        continue;
      }

      // Compute sync window from watermark
      const since = getSyncWindowStart(meta);
      log('Sync window computed', {
        workspaceId,
        since: since.toISOString(),
        until: now.toISOString(),
        hasWatermark: !!meta?.memberSync?.lastSyncTimestamp,
      });

      // Run new detection: direct signups + converted prospects
      const membersResult = await adapter.getNewAndConvertedMembers(since, now);
      if (!membersResult.success) {
        results.push({
          workspace: workspaceName,
          membersFound: 0,
          membersSkippedMemberType: 0,
          membersSkippedDedup: 0,
          membersSkippedNoEmail: 0,
          triggersEmitted: 0,
          detectionBreakdown: { newDirect: 0, converted: 0 },
          error: membersResult.error || 'API call failed',
        });
        continue;
      }

      const allDetected = membersResult.data || [];

      // Member type filtering: exclude configured membership types (e.g., "Kids Club")
      const excludedTypes = meta?.memberSync?.excludedMemberTypes || [];
      const excludedSet = new Set(excludedTypes.map(t => t.toLowerCase()));
      const members = excludedSet.size > 0
        ? allDetected.filter(m => {
            const memberType = m.agreement?.membershipType?.toLowerCase();
            return !memberType || !excludedSet.has(memberType);
          })
        : allDetected;
      const skippedMemberType = allDetected.length - members.length;

      const recentIds = new Set(meta?.memberSync?.recentMemberIds || []);
      let triggersEmitted = 0;
      let skippedDedup = 0;
      let skippedNoEmail = 0;
      let newDirect = 0;
      let converted = 0;
      const newlyProcessedIds: string[] = [];

      // Emit trigger for each member
      for (const member of members) {
        // Sync-level dedup: skip if already processed in recent runs
        if (recentIds.has(member.memberId)) {
          skippedDedup++;
          continue;
        }

        const payload = normalizeMemberPayload(member);

        if (!payload.email) {
          skippedNoEmail++;
          continue;
        }

        // Track detection breakdown
        if (member._detectionReason === 'new_direct_signup') {
          newDirect++;
        } else {
          converted++;
        }

        try {
          await emitTrigger(workspaceId, {
            adapter: 'abc_ignite',
            operation: 'new_member',
          }, payload);
          triggersEmitted++;
          newlyProcessedIds.push(member.memberId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown';
          log('Trigger emission failed', { workspaceId, email: '[redacted]', error: msg });
        }
      }

      // Persist watermark + newly processed IDs
      try {
        await persistSyncState(
          integration.id,
          meta,
          now.toISOString(),
          newlyProcessedIds
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        log('Failed to persist sync state', { workspaceId, error: msg });
        // Non-fatal: sync still succeeded, just watermark not updated
      }

      // Emit summary event for audit trail
      await emitEvent({
        workspaceId,
        system: EventSystem.ABC_IGNITE,
        eventType: 'member_sync_completed',
        success: true,
        errorMessage: `Found ${allDetected.length} members (${newDirect} direct, ${converted} converted), emitted ${triggersEmitted} triggers, skipped ${skippedMemberType} member-type / ${skippedDedup} dedup / ${skippedNoEmail} no-email`,
      });

      results.push({
        workspace: workspaceName,
        membersFound: allDetected.length,
        membersSkippedMemberType: skippedMemberType,
        membersSkippedDedup: skippedDedup,
        membersSkippedNoEmail: skippedNoEmail,
        triggersEmitted,
        detectionBreakdown: { newDirect, converted },
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
        membersSkippedMemberType: 0,
        membersSkippedDedup: 0,
        membersSkippedNoEmail: 0,
        triggersEmitted: 0,
        detectionBreakdown: { newDirect: 0, converted: 0 },
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
