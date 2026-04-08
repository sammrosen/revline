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

import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { withTransaction } from '@/app/_lib/utils/transaction';
import { PipedriveAdapter } from '@/app/_lib/integrations/pipedrive.adapter';
import { logStructured } from '@/app/_lib/reliability';
import type { LeadPropertyDefinition } from '@/app/_lib/types';
import type { Prisma } from '@prisma/client';

const JsonRecord = z.record(z.string(), z.unknown()).catch({});
const LeadPropertySchemaArray = z.array(z.object({
  key: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
}).passthrough()).catch([]);

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

const PIPEDRIVE_DEAL_ID_DEF: LeadPropertyDefinition = {
  key: 'pipedriveDealId',
  label: 'Pipedrive Deal ID',
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

export interface SyncInboundFieldsOptions {
  workspaceId: string;
  pipedrivePersonId: number;
  pipedriveData: Record<string, unknown>;
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
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'integration_sync_enqueue_error',
      workspaceId: opts.workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { adapter: opts.adapter, operation: opts.operation, email: opts.email },
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

      const existingProps = JsonRecord.parse(lead?.properties);
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
        logStructured({
          correlationId: crypto.randomUUID(),
          event: 'integration_sync_schema_update_error',
          workspaceId: opts.workspaceId,
          error: schemaErr instanceof Error ? schemaErr.message : 'Unknown',
          metadata: { queueId: opts.queueId },
        });
      }
    }

    if (opts.resultData.pipedriveDealId != null) {
      try {
        await ensurePipedriveDealPropertyInSchema(opts.workspaceId);
      } catch (schemaErr) {
        logStructured({
          correlationId: crypto.randomUUID(),
          event: 'integration_sync_schema_update_error',
          workspaceId: opts.workspaceId,
          error: schemaErr instanceof Error ? schemaErr.message : 'Unknown',
          metadata: { queueId: opts.queueId, property: 'pipedriveDealId' },
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
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'integration_sync_apply_result_error',
      workspaceId: opts.workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { queueId: opts.queueId, leadId: opts.leadId },
    });
    throw err;
  }
}

/**
 * Sync inbound field values from Pipedrive to the RevLine lead.
 *
 * Called from the Pipedrive webhook route on updated.person events.
 * Inverts the workspace's fieldMap (RevLine key -> Pipedrive key becomes
 * Pipedrive key -> RevLine key) and merges changed values into lead.properties.
 *
 * Fail-safe: never throws to the caller. Logs and emits events on failure.
 */
export async function syncInboundFields(opts: SyncInboundFieldsOptions): Promise<void> {
  try {
    const adapter = await PipedriveAdapter.forWorkspace(opts.workspaceId);
    if (!adapter) return;

    const fieldMap = adapter.getFieldMap();
    if (Object.keys(fieldMap).length === 0) return;

    // Invert: { revlineKey: pipedriveKey } -> { pipedriveKey: revlineKey }
    const invertedMap: Record<string, string> = {};
    for (const [revlineKey, pipedriveKey] of Object.entries(fieldMap)) {
      invertedMap[pipedriveKey] = revlineKey;
    }

    // F1: Filter by pipedrivePersonId via Prisma JSON path (not arbitrary findFirst)
    // F2: Wrap read+write in withTransaction to prevent TOCTOU
    let updatedFields: string[] = [];
    let leadId: string | undefined;

    await withTransaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          workspaceId: opts.workspaceId,
          properties: {
            path: ['pipedrivePersonId'],
            equals: opts.pipedrivePersonId,
          },
        },
        select: { id: true, properties: true },
      });

      if (!lead) return;
      leadId = lead.id;

      const props = JsonRecord.parse(lead.properties);

      const updates: Record<string, unknown> = {};
      for (const [pdKey, revKey] of Object.entries(invertedMap)) {
        const value = opts.pipedriveData[pdKey];
        if (value !== undefined && value !== props[revKey]) {
          updates[revKey] = value;
        }
      }

      if (Object.keys(updates).length === 0) return;
      updatedFields = Object.keys(updates);

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          properties: { ...props, ...updates } as Prisma.InputJsonValue,
          lastEventAt: new Date(),
        },
      });
    });

    if (updatedFields.length === 0) return;

    await emitEvent({
      workspaceId: opts.workspaceId,
      system: EventSystem.PIPEDRIVE,
      eventType: 'pipedrive_fields_synced_inbound',
      success: true,
      metadata: {
        leadId,
        pipedrivePersonId: opts.pipedrivePersonId,
        fieldsUpdated: updatedFields,
      },
    });

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'pipedrive_inbound_field_sync',
      workspaceId: opts.workspaceId,
      provider: 'pipedrive',
      success: true,
      metadata: { leadId, fieldsUpdated: updatedFields },
    });
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'pipedrive_inbound_field_sync_error',
      workspaceId: opts.workspaceId,
      provider: 'pipedrive',
      error: err instanceof Error ? err.message : 'Unknown sync error',
    });
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function ensurePipedrivePropertyInSchema(workspaceId: string): Promise<void> {
  try {
    let provisioned = false;
    await withTransaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { leadPropertySchema: true },
      });
      const schema = LeadPropertySchemaArray.parse(workspace?.leadPropertySchema) as LeadPropertyDefinition[];

      if (schema.some((p) => p.key === 'pipedrivePersonId')) return;

      const updated = [...schema, PIPEDRIVE_PERSON_ID_DEF];
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { leadPropertySchema: updated as unknown as Prisma.InputJsonValue },
      });
      provisioned = true;
    });

    if (provisioned) {
      await emitEvent({
        workspaceId,
        system: EventSystem.WORKFLOW,
        eventType: 'workspace_schema_auto_provisioned',
        success: true,
        metadata: { property: 'pipedrivePersonId' },
      });
    }
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'integration_sync_schema_provision_error',
      workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}

async function ensurePipedriveDealPropertyInSchema(workspaceId: string): Promise<void> {
  try {
    let provisioned = false;
    await withTransaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { leadPropertySchema: true },
      });
      const schema = LeadPropertySchemaArray.parse(workspace?.leadPropertySchema) as LeadPropertyDefinition[];

      if (schema.some((p) => p.key === 'pipedriveDealId')) return;

      const updated = [...schema, PIPEDRIVE_DEAL_ID_DEF];
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { leadPropertySchema: updated as unknown as Prisma.InputJsonValue },
      });
      provisioned = true;
    });

    if (provisioned) {
      await emitEvent({
        workspaceId,
        system: EventSystem.WORKFLOW,
        eventType: 'workspace_schema_auto_provisioned',
        success: true,
        metadata: { property: 'pipedriveDealId' },
      });
    }
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'integration_sync_schema_provision_error',
      workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { property: 'pipedriveDealId' },
    });
  }
}
