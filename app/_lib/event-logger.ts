import { prisma } from './db';
import { EventSystem, Prisma } from '@prisma/client';

export { EventSystem };

interface EmitEventParams {
  clientId: string;
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
  clientId,
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
        clientId,
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
 * Uses unique constraint on (clientId, email) to prevent duplicates
 */
export async function upsertLead({
  clientId,
  email,
  source,
  tx,
}: {
  clientId: string;
  email: string;
  source?: string;
  tx?: Prisma.TransactionClient;
}): Promise<string> {
  const db = tx || prisma;
  const lead = await db.lead.upsert({
    where: {
      clientId_email: {
        clientId,
        email,
      },
    },
    update: {
      lastEventAt: new Date(),
    },
    create: {
      clientId,
      email,
      source,
    },
  });

  return lead.id;
}

/**
 * Update lead stage
 */
export async function updateLeadStage(
  leadId: string,
  stage: 'CAPTURED' | 'BOOKED' | 'PAID' | 'DEAD'
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      lastEventAt: new Date(),
    },
  });
}




