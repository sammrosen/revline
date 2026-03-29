/**
 * Integration Sync Service
 *
 * DB-backed retry queue for failed workflow actions that used continueOnError.
 * All queue operations go through this service — the engine, executors, and
 * cron never touch IntegrationSyncQueue directly.
 *
 * STANDARDS:
 * - Abstraction First: single entry point for queue operations
 * - Fail-Safe Defaults: enqueueFailedAction never throws
 * - Event-Driven Debugging: emits events on enqueue, success, failure
 * - Database Transactions: applyRetryResult is atomic
 * - Workspace Isolation: all operations scoped by workspaceId
 */

import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { withTransaction } from '@/app/_lib/utils/transaction';
import type { LeadPropertyDefinition } from '@/app/_lib/types';
import type { Prisma } from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

const FIRST_RETRY_DELAY_MS = 60_000;

const PIPEDRIVE_PERSON_ID_DEF: LeadPropertyDefinition = {
  key: 'pipedrivePersonId',
  label: 'Pipedrive Person ID',
  type: 'number',
  required: false,
};

// =============================================================================
// TYPES
// =============================================================================

export interface EnqueueOptions {
  workspaceId: string;
  email: string;
  leadId?: string;
  adapter: string;
  operation: string;
  params?: Record<string, unknown>;
}

export interface ApplyResultOptions {
  queueId: string;
  leadId: string;
  workspaceId: string;
  resultData: Record<string, unknown>;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Enqueue a failed action for async retry.
 *
 * Idempotent: skips if a PENDING entry already exists for the same
 * workspaceId + email + adapter + operation. Backfills leadId on
 * existing entries if it was null.
 *
 * Fail-safe: never throws. Logs errors with context.
 */
export async function enqueueFailedAction(opts: EnqueueOptions): Promise<void> {
  try {
    const existing = await prisma.integrationSyncQueue.findFirst({
      where: {
        workspaceId: opts.workspaceId,
        email: opts.email,
        adapter: opts.adapter,
        operation: opts.operation,
        status: 'PENDING',
      },
      select: { id: true, leadId: true },
    });

    if (existing) {
      if (!existing.leadId && opts.leadId) {
        await prisma.integrationSyncQueue.update({
          where: { id: existing.id },
          data: { leadId: opts.leadId },
        });
      }
      return;
    }

    await prisma.integrationSyncQueue.create({
      data: {
        workspaceId: opts.workspaceId,
        email: opts.email,
        leadId: opts.leadId,
        adapter: opts.adapter,
        operation: opts.operation,
        params: (opts.params as Prisma.InputJsonValue) ?? undefined,
        nextRetryAt: new Date(Date.now() + FIRST_RETRY_DELAY_MS),
      },
    });

    await emitEvent({
      workspaceId: opts.workspaceId,
      system: EventSystem.WORKFLOW,
      eventType: 'integration_sync_enqueued',
      success: true,
      metadata: {
        adapter: opts.adapter,
        operation: opts.operation,
        email: opts.email,
      },
    });
  } catch (err) {
    console.error('[IntegrationSync] Failed to enqueue:', {
      workspaceId: opts.workspaceId,
      adapter: opts.adapter,
      operation: opts.operation,
      email: opts.email,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

/**
 * Apply a successful retry result.
 *
 * Atomically: marks queue entry COMPLETED, merges resultData into
 * lead.properties. If resultData contains pipedrivePersonId, ensures
 * the workspace schema includes the property definition.
 */
export async function applyRetryResult(opts: ApplyResultOptions): Promise<void> {
  try {
    await withTransaction(async (tx) => {
      await tx.integrationSyncQueue.update({
        where: { id: opts.queueId },
        data: {
          status: 'COMPLETED',
          resultData: opts.resultData as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      const lead = await tx.lead.findUnique({
        where: { id: opts.leadId },
        select: { properties: true },
      });

      const existingProps = (lead?.properties as Record<string, unknown>) ?? {};
      const merged = { ...existingProps, ...opts.resultData };

      await tx.lead.update({
        where: { id: opts.leadId },
        data: {
          properties: merged as Prisma.InputJsonValue,
          lastEventAt: new Date(),
        },
      });
    });

    if (opts.resultData.pipedrivePersonId != null) {
      try {
        await ensurePipedrivePropertyInSchema(opts.workspaceId);
      } catch (schemaErr) {
        console.error('[IntegrationSync] Schema update failed after successful queue completion:', {
          workspaceId: opts.workspaceId,
          queueId: opts.queueId,
          error: schemaErr instanceof Error ? schemaErr.message : 'Unknown',
        });
      }
    }

    await emitEvent({
      workspaceId: opts.workspaceId,
      system: EventSystem.WORKFLOW,
      eventType: 'integration_sync_success',
      success: true,
      metadata: { queueId: opts.queueId, resultData: opts.resultData },
    });
  } catch (err) {
    console.error('[IntegrationSync] applyRetryResult failed:', {
      workspaceId: opts.workspaceId,
      queueId: opts.queueId,
      leadId: opts.leadId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    throw err;
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function ensurePipedrivePropertyInSchema(workspaceId: string): Promise<void> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { leadPropertySchema: true },
    });
    const schema = (workspace?.leadPropertySchema as LeadPropertyDefinition[] | null) ?? [];

    if (schema.some((p) => p.key === 'pipedrivePersonId')) return;

    const updated = [...schema, PIPEDRIVE_PERSON_ID_DEF];
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { leadPropertySchema: updated as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    console.error('[IntegrationSync] Failed to auto-provision pipedrivePersonId schema:', {
      workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}
