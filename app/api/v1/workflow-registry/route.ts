/**
 * Workflow Registry API
 *
 * GET /api/v1/workflow-registry - Get available adapters, triggers, and actions
 * 
 * Query params:
 * - workspaceId: Optional. When provided, returns workspace-specific triggers for RevLine
 *   (dynamic triggers based on enabled forms). This ensures workspace isolation.
 * 
 * STANDARDS:
 * - Client Isolation: RevLine triggers are workspace-scoped, not global
 * - Abstraction First: Uses RevlineAdapter for config lookup
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import {
  ADAPTER_REGISTRY,
  getTriggersForUI,
  getActionsForUI,
} from '@/app/_lib/workflow';
import { TestField } from '@/app/_lib/workflow/types';
import { RevlineAdapter } from '@/app/_lib/integrations/revline.adapter';
import { getFormById, getFormTriggers } from '@/app/_lib/forms/registry';

/**
 * Default test fields for RevLine triggers (forms)
 * These are used when a form doesn't specify custom test fields
 */
const DEFAULT_REVLINE_TEST_FIELDS: TestField[] = [
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'name', label: 'Name', type: 'text', required: false },
];

/**
 * Format a formId into a display label
 * Uses FORM_REGISTRY if available, otherwise formats the ID
 */
function getFormLabel(formId: string): string {
  const registeredForm = getFormById(formId);
  if (registeredForm) {
    return registeredForm.name;
  }
  // Fallback: Convert kebab-case to Title Case
  return formId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET(request: NextRequest) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  try {
    // Get optional workspaceId for workspace-scoped triggers
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    // Get all adapters with their capabilities
    const adapters = Object.values(ADAPTER_REGISTRY).map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      requiresIntegration: adapter.requiresIntegration,
      hasTriggers: Object.keys(adapter.triggers).length > 0 || adapter.id === 'revline',
      hasActions: Object.keys(adapter.actions).length > 0,
    }));

    // Get triggers grouped by adapter (for UI dropdowns)
    // Start with static triggers from registry
    const staticTriggers = getTriggersForUI();
    
    // Build final triggers list with workspace-specific RevLine triggers
    const triggers = await buildTriggersWithDynamic(staticTriggers, workspaceId);

    // Get actions grouped by adapter (for UI dropdowns)
    const actions = getActionsForUI();

    return ApiResponse.success({
      adapters,
      triggers,
      actions,
    });
  } catch (error) {
    console.error('Error fetching workflow registry:', error);
    return ApiResponse.internalError();
  }
}

/**
 * Build triggers list with dynamic RevLine triggers based on workspace config
 * 
 * For RevLine:
 * - If workspaceId provided: Return all declared triggers for enabled forms
 * - If no workspaceId: Return empty triggers (must specify workspace)
 * 
 * This ensures complete workspace isolation - no workspace can see another's forms.
 * Each enabled form can declare multiple triggers (e.g., booking-confirmed, booking-waitlisted).
 */
async function buildTriggersWithDynamic(
  staticTriggers: Array<{
    adapterId: string;
    adapterName: string;
    triggers: Array<{ name: string; label: string; description?: string; testFields?: TestField[] }>;
  }>,
  workspaceId: string | null
): Promise<typeof staticTriggers> {
  // Filter out RevLine from static triggers - we'll add dynamic ones
  const nonRevlineTriggers = staticTriggers.filter(t => t.adapterId !== 'revline');
  
  // Build dynamic RevLine triggers based on workspace config
  let revlineTriggers: Array<{ name: string; label: string; description?: string; testFields: TestField[] }> = [];
  
  if (workspaceId) {
    const revlineAdapter = await RevlineAdapter.forClient(workspaceId);
    if (revlineAdapter) {
      const enabledForms = revlineAdapter.getEnabledForms();
      
      // For each enabled form, get all its declared triggers
      revlineTriggers = enabledForms.flatMap(formId => {
        const triggers = getFormTriggers(formId);
        const formLabel = getFormLabel(formId);
        
        return triggers.map(t => ({
          name: t.id, // Trigger ID is the workflow operation
          label: t.label,
          description: t.description || `Fires from ${formLabel}`,
          testFields: DEFAULT_REVLINE_TEST_FIELDS, // Default fields for all RevLine triggers
        }));
      });
    }
  }
  
  // Add RevLine with dynamic triggers (may be empty if no workspace or no forms)
  return [
    ...nonRevlineTriggers,
    {
      adapterId: 'revline',
      adapterName: 'RevLine',
      triggers: revlineTriggers,
    },
  ];
}

