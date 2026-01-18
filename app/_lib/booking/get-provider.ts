/**
 * Booking Provider Resolver
 * 
 * Determines which booking provider to use for a workspace based on their integrations.
 * Also handles formId-based workspace lookup for bespoke forms.
 */

import { prisma } from '@/app/_lib/db';
import { IntegrationType, Workspace, WorkspaceStatus } from '@prisma/client';
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
 * Get the appropriate booking provider for a workspace
 * Returns null if workspace has no booking-capable integrations
 */
export async function getBookingProvider(
  workspaceId: string
): Promise<BookingProvider | null> {
  // Get workspace's integrations
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
    select: { integration: true },
  });
  
  const integrationTypes = new Set(integrations.map(i => i.integration));
  
  // Find first matching provider in priority order
  for (const type of BOOKING_PROVIDER_PRIORITY) {
    if (integrationTypes.has(type)) {
      return await createProvider(type, workspaceId);
    }
  }
  
  return null;
}

/**
 * Get booking provider by specific type
 */
export async function getBookingProviderByType(
  workspaceId: string,
  type: IntegrationType
): Promise<BookingProvider | null> {
  // Verify workspace has this integration
  const integration = await prisma.workspaceIntegration.findUnique({
    where: {
      workspaceId_integration: {
        workspaceId,
        integration: type,
      },
    },
  });
  
  if (!integration) {
    return null;
  }
  
  return createProvider(type, workspaceId);
}

/**
 * Create a provider instance by type
 */
async function createProvider(
  type: IntegrationType,
  workspaceId: string
): Promise<BookingProvider | null> {
  switch (type) {
    case IntegrationType.ABC_IGNITE:
      return AbcIgniteBookingProvider.forClient(workspaceId);
    
    // Future providers:
    // case IntegrationType.CALENDLY:
    //   return CalendlyBookingProvider.forClient(workspaceId);
    
    default:
      return null;
  }
}

/**
 * Get provider capabilities without loading full provider
 * Useful for UI to know what steps to show before loading data
 */
export async function getBookingCapabilities(
  workspaceId: string
): Promise<BookingProviderCapabilities | null> {
  const provider = await getBookingProvider(workspaceId);
  return provider?.capabilities ?? null;
}

/**
 * Check if a workspace has any booking-capable integrations
 */
export async function hasBookingProvider(workspaceId: string): Promise<boolean> {
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { 
      workspaceId,
      integration: { in: BOOKING_PROVIDER_PRIORITY },
    },
    select: { integration: true },
  });
  
  return integrations.length > 0;
}

// =============================================================================
// FORM ID WORKSPACE LOOKUP
// =============================================================================

/**
 * Find the workspace that has a specific formId enabled in their RevLine config.
 * 
 * This is used by bespoke form pages to find which workspace they belong to.
 * The formId is configured in the workspace's RevLine integration meta.forms.
 * 
 * @param formId - The unique form identifier (e.g., 'sportswest-booking')
 * @returns The workspace if found and active, null if not found
 * @throws Error if multiple workspaces have the same formId enabled (prevents cross-contamination)
 * 
 * @example
 * // In a bespoke form page:
 * const FORM_ID = 'sportswest-booking';
 * const workspace = await getWorkspaceByFormId(FORM_ID);
 * if (!workspace) notFound();
 */
export async function getWorkspaceByFormId(formId: string): Promise<Workspace | null> {
  // Find all RevLine integrations
  const revlineIntegrations = await prisma.workspaceIntegration.findMany({
    where: {
      integration: IntegrationType.REVLINE,
    },
    include: {
      workspace: true,
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
    const workspaceNames = matchingIntegrations.map(i => i.workspace.name).join(', ');
    throw new Error(
      `FormId "${formId}" is enabled for multiple workspaces: ${workspaceNames}. ` +
      `Each formId should only be enabled for one workspace to prevent data cross-contamination.`
    );
  }
  
  // Single match - return the workspace if active
  const workspace = matchingIntegrations[0].workspace;
  
  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return null; // Workspace exists but is paused
  }
  
  return workspace;
}

/**
 * Get the workspace and their booking capabilities by formId.
 * Convenience function that combines getWorkspaceByFormId with getBookingCapabilities.
 * 
 * @param formId - The unique form identifier
 * @returns Object with workspace and capabilities, or null if not found
 */
export async function getWorkspaceAndCapabilitiesByFormId(formId: string): Promise<{
  workspace: Workspace;
  capabilities: BookingProviderCapabilities;
} | null> {
  const workspace = await getWorkspaceByFormId(formId);
  if (!workspace) return null;
  
  const capabilities = await getBookingCapabilities(workspace.id);
  if (!capabilities) return null;
  
  return { workspace, capabilities };
}

// Legacy aliases for backwards compatibility
export const getClientByFormId = getWorkspaceByFormId;
export const getClientAndCapabilitiesByFormId = getWorkspaceAndCapabilitiesByFormId;
