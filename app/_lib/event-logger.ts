import { prisma } from './db';
import { EventSystem } from '@prisma/client';

export { EventSystem };

interface EmitEventParams {
  clientId: string;
  leadId?: string;
  system: EventSystem;
  eventType: string;
  success: boolean;
  errorMessage?: string;
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
}: EmitEventParams): Promise<void> {
  try {
    await prisma.event.create({
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
 */
export async function upsertLead({
  clientId,
  email,
  source,
}: {
  clientId: string;
  email: string;
  source?: string;
}): Promise<string> {
  const lead = await prisma.lead.upsert({
    where: {
      // Need a unique constraint on clientId + email for upsert
      // For now, we'll just create and handle duplicates
      id: 'temp', // This will fail, so we catch and find
    },
    update: {
      lastEventAt: new Date(),
    },
    create: {
      clientId,
      email,
      source,
    },
  }).catch(async () => {
    // Find existing or create new
    const existing = await prisma.lead.findFirst({
      where: { clientId, email },
    });
    if (existing) {
      return prisma.lead.update({
        where: { id: existing.id },
        data: { lastEventAt: new Date() },
      });
    }
    return prisma.lead.create({
      data: { clientId, email, source },
    });
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

