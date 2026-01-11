/**
 * Booking Provider Resolver
 * 
 * Determines which booking provider to use for a client based on their integrations.
 * Also handles formId-based client lookup for bespoke forms.
 */

import { prisma } from '@/app/_lib/db';
import { IntegrationType, Client, ClientStatus } from '@prisma/client';
import { BookingProvider, BookingProviderCapabilities } from './types';
import { AbcIgniteBookingProvider } from './providers';
import { RevlineMeta } from '@/app/_lib/types';

/**
 * Priority order for booking providers
 * First matching integration wins
 */
const BOOKING_PROVIDER_PRIORITY: IntegrationType[] = [
  IntegrationType.ABC_IGNITE,
  // Future: IntegrationType.CALENDLY,
];

/**
 * Get the appropriate booking provider for a client
 * Returns null if client has no booking-capable integrations
 */
export async function getBookingProvider(
  clientId: string
): Promise<BookingProvider | null> {
  // Get client's integrations
  const integrations = await prisma.clientIntegration.findMany({
    where: { clientId },
    select: { integration: true },
  });
  
  const integrationTypes = new Set(integrations.map(i => i.integration));
  
  // Find first matching provider in priority order
  for (const type of BOOKING_PROVIDER_PRIORITY) {
    if (integrationTypes.has(type)) {
      return await createProvider(type, clientId);
    }
  }
  
  return null;
}

/**
 * Get booking provider by specific type
 */
export async function getBookingProviderByType(
  clientId: string,
  type: IntegrationType
): Promise<BookingProvider | null> {
  // Verify client has this integration
  const integration = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration: type,
      },
    },
  });
  
  if (!integration) {
    return null;
  }
  
  return createProvider(type, clientId);
}

/**
 * Create a provider instance by type
 */
async function createProvider(
  type: IntegrationType,
  clientId: string
): Promise<BookingProvider | null> {
  switch (type) {
    case IntegrationType.ABC_IGNITE:
      return AbcIgniteBookingProvider.forClient(clientId);
    
    // Future providers:
    // case IntegrationType.CALENDLY:
    //   return CalendlyBookingProvider.forClient(clientId);
    
    default:
      return null;
  }
}

/**
 * Get provider capabilities without loading full provider
 * Useful for UI to know what steps to show before loading data
 */
export async function getBookingCapabilities(
  clientId: string
): Promise<BookingProviderCapabilities | null> {
  const provider = await getBookingProvider(clientId);
  return provider?.capabilities ?? null;
}

/**
 * Check if a client has any booking-capable integrations
 */
export async function hasBookingProvider(clientId: string): Promise<boolean> {
  const integrations = await prisma.clientIntegration.findMany({
    where: { 
      clientId,
      integration: { in: BOOKING_PROVIDER_PRIORITY },
    },
    select: { integration: true },
  });
  
  return integrations.length > 0;
}

// =============================================================================
// FORM ID CLIENT LOOKUP
// =============================================================================

/**
 * Find the client that has a specific formId enabled in their RevLine config.
 * 
 * This is used by bespoke form pages to find which client they belong to.
 * The formId is configured in the client's RevLine integration meta.forms.
 * 
 * @param formId - The unique form identifier (e.g., 'sportswest-booking')
 * @returns The client if found and active, null if not found
 * @throws Error if multiple clients have the same formId enabled (prevents cross-contamination)
 * 
 * @example
 * // In a bespoke form page:
 * const FORM_ID = 'sportswest-booking';
 * const client = await getClientByFormId(FORM_ID);
 * if (!client) notFound();
 */
export async function getClientByFormId(formId: string): Promise<Client | null> {
  // Find all RevLine integrations
  const revlineIntegrations = await prisma.clientIntegration.findMany({
    where: {
      integration: IntegrationType.REVLINE,
    },
    include: {
      client: true,
    },
  });
  
  // Filter to those that have this formId enabled
  const matchingIntegrations = revlineIntegrations.filter(integration => {
    const meta = integration.meta as RevlineMeta | null;
    if (!meta?.forms) return false;
    
    const formConfig = meta.forms[formId];
    return formConfig?.enabled === true;
  });
  
  // No matches
  if (matchingIntegrations.length === 0) {
    return null;
  }
  
  // Multiple matches - this is a configuration error
  if (matchingIntegrations.length > 1) {
    const clientNames = matchingIntegrations.map(i => i.client.name).join(', ');
    throw new Error(
      `FormId "${formId}" is enabled for multiple clients: ${clientNames}. ` +
      `Each formId should only be enabled for one client to prevent data cross-contamination.`
    );
  }
  
  // Single match - return the client if active
  const client = matchingIntegrations[0].client;
  
  if (client.status !== ClientStatus.ACTIVE) {
    return null; // Client exists but is paused
  }
  
  return client;
}

/**
 * Get the client and their booking capabilities by formId.
 * Convenience function that combines getClientByFormId with getBookingCapabilities.
 * 
 * @param formId - The unique form identifier
 * @returns Object with client and capabilities, or null if not found
 */
export async function getClientAndCapabilitiesByFormId(formId: string): Promise<{
  client: Client;
  capabilities: BookingProviderCapabilities;
} | null> {
  const client = await getClientByFormId(formId);
  if (!client) return null;
  
  const capabilities = await getBookingCapabilities(client.id);
  if (!capabilities) return null;
  
  return { client, capabilities };
}
