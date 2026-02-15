import { prisma } from './db';
import { EventSystem, Prisma } from '@prisma/client';

export { EventSystem };

interface EmitEventParams {
  workspaceId: string;
  leadId?: string;
  system: EventSystem;
  eventType: string;
  success: boolean;
  errorMessage?: string;
  tx?: Prisma.TransactionClient; // Optional transaction client
}

/**
 * Emit an event to the event ledger
 * This is the primary debugging surface - log state transitions and outcomes only
 * 
 * DO log:
 * - email_captured, mailerlite_subscribe_success/failed
 * - stripe_payment_succeeded/failed
 * - execution_blocked, health_status_changed
 * 
 * DO NOT log:
 * - HTTP request/response details
 * - Full payloads
 * - Debug-level information
 */
export async function emitEvent({
  workspaceId,
  leadId,
  system,
  eventType,
  success,
  errorMessage,
  tx,
}: EmitEventParams): Promise<void> {
  const db = tx || prisma;
  try {
    await db.event.create({
      data: {
        workspaceId,
        leadId,
        system,
        eventType,
        success,
        errorMessage: errorMessage?.slice(0, 500), // Truncate long error messages
      },
    });
  } catch (error) {
    // Log but don't throw - event logging should never break the main flow
    console.error('Failed to emit event:', {
      eventType,
      system,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update a lead's lastEventAt timestamp
 * Call this after any lead-related event
 */
export async function touchLead(leadId: string): Promise<void> {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastEventAt: new Date() },
    });
  } catch {
    // Ignore - lead might not exist yet
  }
}

/**
 * Create or update a lead record
 * Returns the lead ID for event correlation
 * 
 * Uses unique constraint on (workspaceId, email) to prevent duplicates.
 * When properties are provided:
 * - On create: sets properties directly
 * - On update: shallow-merges incoming properties with existing (incoming wins)
 */
export async function upsertLead({
  workspaceId,
  email,
  source,
  properties,
  tx,
}: {
  workspaceId: string;
  email: string;
  source?: string;
  properties?: Record<string, unknown>;
  tx?: Prisma.TransactionClient;
}): Promise<string> {
  const db = tx || prisma;
  const hasProperties = properties && Object.keys(properties).length > 0;

  // If properties provided, we need to handle merge on update
  if (hasProperties) {
    const existing = await db.lead.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
      select: { id: true, properties: true },
    });

    if (existing) {
      // Merge: existing properties + incoming (incoming wins)
      const existingProps = (existing.properties as Record<string, unknown>) ?? {};
      const merged = { ...existingProps, ...properties };

      await db.lead.update({
        where: { id: existing.id },
        data: {
          lastEventAt: new Date(),
          properties: merged as Prisma.InputJsonValue,
        },
      });

      return existing.id;
    }

    // Lead doesn't exist -- create with properties
    const lead = await db.lead.create({
      data: {
        workspaceId,
        email,
        source,
        properties: properties as Prisma.InputJsonValue,
      },
    });

    return lead.id;
  }

  // No properties -- use simple upsert (backward compatible)
  const lead = await db.lead.upsert({
    where: {
      workspaceId_email: {
        workspaceId,
        email,
      },
    },
    update: {
      lastEventAt: new Date(),
    },
    create: {
      workspaceId,
      email,
      source,
    },
  });

  return lead.id;
}

/**
 * Update a lead's errorState field.
 * Used by webhook handlers to flag delivery issues (bounced, complained, etc.).
 * 
 * Non-destructive: only sets errorState, does not change stage or properties.
 * 
 * @param onlyIfCurrent - If set, only updates if the current errorState matches this value.
 *   Used for safe transient-state clearing (e.g., only clear "resend.delivery_delayed",
 *   don't accidentally clear "resend.email_bounced" when a delivery event arrives).
 * @returns Lead ID if updated, null if lead not found or condition not met
 */
export async function updateLeadErrorState({
  workspaceId,
  email,
  errorState,
  onlyIfCurrent,
  tx,
}: {
  workspaceId: string;
  email: string;
  /** The error state to set (e.g., "resend.email_bounced") or null to clear */
  errorState: string | null;
  /** Only update if current errorState matches this value */
  onlyIfCurrent?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<string | null> {
  const db = tx || prisma;

  try {
    // Find lead by unique (workspaceId, email) index
    const lead = await db.lead.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
      select: { id: true, errorState: true },
    });

    if (!lead) {
      // No lead for this email — not an error, just means we got a webhook
      // for someone not in our system (e.g., email sent outside RevLine)
      return null;
    }

    // If onlyIfCurrent is specified, check the condition
    if (onlyIfCurrent !== undefined && lead.errorState !== onlyIfCurrent) {
      return null;
    }

    await db.lead.update({
      where: { id: lead.id },
      data: {
        errorState,
        lastEventAt: new Date(),
      },
    });

    return lead.id;
  } catch (error) {
    console.error('Failed to update lead error state:', {
      workspaceId,
      email: '[redacted]',
      errorState,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Update lead stage
 */
export async function updateLeadStage(
  leadId: string,
  stage: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx || prisma;
  await db.lead.update({
    where: { id: leadId },
    data: {
      stage,
      lastEventAt: new Date(),
    },
  });
}
