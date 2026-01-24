/**
 * Workflow Templates
 * 
 * Provides default workflow templates that can be created when
 * integrations are configured. Used by seed scripts and UI.
 * 
 * STANDARDS:
 * - Templates are disabled by default (admin should review and enable)
 * - Templates use variable interpolation for params
 * - Each template specifies which integration it requires
 */

import { Prisma, IntegrationType } from '@prisma/client';
import { prisma } from '@/app/_lib/db';

export interface WorkflowTemplate {
  /** Template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what the workflow does */
  description: string;
  /** Trigger adapter (e.g., 'booking', 'calendly') */
  triggerAdapter: string;
  /** Trigger operation (e.g., 'create_booking', 'booking_created') */
  triggerOperation: string;
  /** Optional trigger filter */
  triggerFilter?: Record<string, unknown>;
  /** Actions to execute */
  actions: Array<{
    adapter: string;
    operation: string;
    params: Record<string, unknown>;
  }>;
  /** Required integration for this template */
  requiresIntegration?: IntegrationType;
}

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * ABC Ignite Booking workflow template
 * 
 * Used with sync workflow execution for booking forms.
 * Maps booking request payload to ABC Ignite create_appointment action.
 */
export const ABC_IGNITE_BOOKING_TEMPLATE: WorkflowTemplate = {
  id: 'abc-ignite-booking',
  name: 'ABC Ignite Booking',
  description: 'Creates appointments in ABC Ignite when a booking is requested',
  triggerAdapter: 'booking',
  triggerOperation: 'create_booking',
  actions: [
    {
      adapter: 'abc_ignite',
      operation: 'create_appointment',
      params: {
        employeeId: '{{trigger.payload.employeeId}}',
        eventTypeId: '{{trigger.payload.eventTypeId}}',
        levelId: '{{trigger.payload.levelId}}',
        startTime: '{{trigger.payload.startTime}}',
        memberId: '{{trigger.payload.memberId}}',
      },
    },
  ],
  requiresIntegration: IntegrationType.ABC_IGNITE,
};

/**
 * All available templates
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  ABC_IGNITE_BOOKING_TEMPLATE,
];

// =============================================================================
// TEMPLATE OPERATIONS
// =============================================================================

/**
 * Create a workflow from a template
 * 
 * @param workspaceId - Workspace to create workflow in
 * @param template - Template to create from
 * @param options - Creation options
 * @returns Created workflow or null if already exists
 */
export async function createWorkflowFromTemplate(
  workspaceId: string,
  template: WorkflowTemplate,
  options: {
    /** Override the default name */
    name?: string;
    /** Whether to enable the workflow (default: false) */
    enabled?: boolean;
    /** Skip if workflow with same name exists (default: true) */
    skipIfExists?: boolean;
  } = {}
): Promise<Prisma.WorkflowGetPayload<object> | null> {
  const { name = template.name, enabled = false, skipIfExists = true } = options;

  // Check if workflow already exists
  if (skipIfExists) {
    const existing = await prisma.workflow.findFirst({
      where: {
        workspaceId,
        name,
      },
    });

    if (existing) {
      return null;
    }
  }

  // Create the workflow
  return prisma.workflow.create({
    data: {
      workspaceId,
      name,
      description: template.description,
      enabled,
      triggerAdapter: template.triggerAdapter,
      triggerOperation: template.triggerOperation,
      triggerFilter: template.triggerFilter
        ? (template.triggerFilter as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      actions: template.actions as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get templates available for a workspace based on configured integrations
 * 
 * @param workspaceId - Workspace ID
 * @returns Available templates
 */
export async function getAvailableTemplates(
  workspaceId: string
): Promise<WorkflowTemplate[]> {
  // Get configured integrations
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
    select: { integration: true },
  });

  const configuredTypes = new Set(integrations.map((i) => i.integration));

  // Filter templates by configured integrations
  return WORKFLOW_TEMPLATES.filter((template) => {
    if (!template.requiresIntegration) {
      return true;
    }
    return configuredTypes.has(template.requiresIntegration);
  });
}

/**
 * Create all available templates for a workspace
 * 
 * Useful when onboarding a new workspace or when an integration is first configured.
 * 
 * @param workspaceId - Workspace ID
 * @returns Number of workflows created
 */
export async function createAllAvailableTemplates(
  workspaceId: string
): Promise<number> {
  const templates = await getAvailableTemplates(workspaceId);
  let created = 0;

  for (const template of templates) {
    const result = await createWorkflowFromTemplate(workspaceId, template);
    if (result) {
      created++;
    }
  }

  return created;
}

/**
 * Ensure ABC Ignite booking workflow exists
 * 
 * Call this when ABC Ignite is configured to automatically create
 * the booking workflow if it doesn't exist.
 * 
 * @param workspaceId - Workspace ID
 * @returns Created workflow or null if already exists or ABC not configured
 */
export async function ensureAbcIgniteBookingWorkflow(
  workspaceId: string
): Promise<Prisma.WorkflowGetPayload<object> | null> {
  // Check if ABC Ignite is configured
  const abcIntegration = await prisma.workspaceIntegration.findFirst({
    where: {
      workspaceId,
      integration: IntegrationType.ABC_IGNITE,
    },
  });

  if (!abcIntegration) {
    return null;
  }

  return createWorkflowFromTemplate(workspaceId, ABC_IGNITE_BOOKING_TEMPLATE);
}
