import { prisma } from './db';
import { emitEvent, EventSystem } from './event-logger';
import { Client, ClientStatus } from '@prisma/client';

export type { Client };
export { ClientStatus };

/**
 * Get a client by their slug (the ?source= parameter)
 * Returns null if client doesn't exist
 */
export async function getClientBySlug(slug: string): Promise<Client | null> {
  return prisma.client.findUnique({
    where: { slug: slug.toLowerCase() },
  });
}

/**
 * Check if a client is active
 * Returns true only if client exists AND status is ACTIVE
 */
export async function checkClientActive(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { status: true },
  });
  return client?.status === ClientStatus.ACTIVE;
}

/**
 * Get an active client by slug, or null if not found or paused
 * This is the main entry point for route handlers
 * 
 * If client is paused, emits execution_blocked event and returns null
 */
export async function getActiveClient(slug: string): Promise<Client | null> {
  const client = await getClientBySlug(slug);

  if (!client) {
    return null;
  }

  if (client.status !== ClientStatus.ACTIVE) {
    // Client exists but is paused - emit blocked event
    await emitEvent({
      clientId: client.id,
      system: EventSystem.BACKEND,
      eventType: 'execution_blocked',
      success: false,
      errorMessage: `Client ${slug} is paused`,
    });
    return null;
  }

  return client;
}

/**
 * Pause a client - blocks all automation execution
 */
export async function pauseClient(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: { status: ClientStatus.PAUSED },
  });

  await emitEvent({
    clientId,
    system: EventSystem.BACKEND,
    eventType: 'client_paused',
    success: true,
  });
}

/**
 * Unpause a client - resumes automation execution
 */
export async function unpauseClient(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: { status: ClientStatus.ACTIVE },
  });

  await emitEvent({
    clientId,
    system: EventSystem.BACKEND,
    eventType: 'client_unpaused',
    success: true,
  });
}





