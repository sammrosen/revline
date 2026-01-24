/**
 * Workflow Registry API
 *
 * GET /api/v1/workflow-registry - Get available adapters, triggers, and actions
 * 
 * Query params:
 * - workspaceId: Optional. When provided, returns workspace-specific triggers:
 *   - Capture triggers from WorkspaceForm table (primary)
 *   - RevLine triggers from enabled forms (legacy, for backward compatibility)
 * 
 * STANDARDS:
 * - Client Isolation: Triggers are workspace-scoped, not global
 * - Abstraction First: Uses WorkspaceForm table for capture triggers
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
import { prisma } from '@/app/_lib/db';

/**
 * Default test fields for capture triggers
 * Email is optional since capture is observational
 */
const DEFAULT_CAPTURE_TEST_FIELDS: TestField[] = [
  { name: 'email', label: 'Email', type: 'email', required: false },
  { name: 'firstName', label: 'First Name', type: 'text', required: false },
  { name: 'lastName', label: 'Last Name', type: 'text', required: false },
];

/**
 * Default test fields for RevLine triggers (legacy forms)
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
      // Capture and RevLine have dynamic triggers
      hasTriggers: Object.keys(adapter.triggers).length > 0 || 
                   adapter.id === 'revline' || 
                   adapter.id === 'capture',
      hasActions: Object.keys(adapter.actions).length > 0,
    }));

    // Get triggers grouped by adapter (for UI dropdowns)
    // Start with static triggers from registry
    const staticTriggers = getTriggersForUI();
    
    // Build final triggers list with workspace-specific dynamic triggers
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
 * Build triggers list with dynamic triggers based on workspace config
 * 
 * For Capture (primary):
 * - Builds triggers from WorkspaceForm table
 * - Each enabled WorkspaceForm becomes a trigger (using triggerName)
 * 
 * For RevLine (legacy, backward compatibility):
 * - Builds triggers from WorkspaceIntegration.meta.forms
 * - Will be deprecated once all forms migrate to Capture
 * 
 * This ensures complete workspace isolation - no workspace can see another's forms.
 */
async function buildTriggersWithDynamic(
  staticTriggers: Array<{
    adapterId: string;
    adapterName: string;
    triggers: Array<{ name: string; label: string; description?: string; testFields?: TestField[] }>;
  }>,
  workspaceId: string | null
): Promise<typeof staticTriggers> {
  // Filter out dynamic adapters from static triggers - we'll add them back with dynamic data
  const nonDynamicTriggers = staticTriggers.filter(
    t => t.adapterId !== 'revline' && t.adapterId !== 'capture'
  );
  
  // Build dynamic Capture triggers from WorkspaceForm table
  let captureTriggers: Array<{ name: string; label: string; description?: string; testFields: TestField[] }> = [];
  
  if (workspaceId) {
    // Query WorkspaceForm table for enabled forms
    const workspaceForms = await prisma.workspaceForm.findMany({
      where: {
        workspaceId,
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        triggerName: true,
      },
    });
    
    // Each form becomes a trigger
    captureTriggers = workspaceForms.map(form => ({
      name: form.triggerName,
      label: form.name,
      description: form.description || `Fires when "${form.name}" captures data`,
      testFields: DEFAULT_CAPTURE_TEST_FIELDS,
    }));
  }
  
  // Build dynamic RevLine triggers (legacy - for backward compatibility)
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
          testFields: DEFAULT_REVLINE_TEST_FIELDS,
        }));
      });
    }
  }
  
  // Return all triggers with dynamic ones added
  return [
    ...nonDynamicTriggers,
    {
      adapterId: 'capture',
      adapterName: 'Form Capture',
      triggers: captureTriggers,
    },
    {
      adapterId: 'revline',
      adapterName: 'RevLine',
      triggers: revlineTriggers,
    },
  ];
}

