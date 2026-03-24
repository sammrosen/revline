/**
 * Workspace Readiness API
 *
 * GET /api/v1/workspaces/[id]/readiness
 *
 * Lightweight endpoint that returns go-live readiness status for a workspace.
 * Aggregates integration configuration status and workflow enablement blockers.
 * Uses existing checkAdapterAvailability and validateCanEnable — no new validation logic.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import {
  checkAdapterAvailability,
  validateCanEnable,
  getWorkflowsUsingIntegration,
  getAdapter,
  WorkflowAction,
} from '@/app/_lib/workflow';

interface IntegrationReadiness {
  type: string;
  configured: boolean;
  healthy: boolean;
  missingSecrets: string[];
  missingMeta: string[];
  usedByWorkflows: string[];
}

interface WorkflowReadiness {
  id: string;
  name: string;
  enabled: boolean;
  canEnable: boolean;
  blockers: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id: workspaceId } = await params;

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
  }

  try {
    const [integrations, workflows] = await Promise.all([
      prisma.workspaceIntegration.findMany({
        where: { workspaceId },
        select: { integration: true },
      }),
      prisma.workflow.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          enabled: true,
          triggerAdapter: true,
          actions: true,
        },
      }),
    ]);

    // Check each configured integration's readiness
    const integrationResults: IntegrationReadiness[] = await Promise.all(
      integrations.map(async (int) => {
        const adapterId = int.integration.toLowerCase();
        const availability = await checkAdapterAvailability(workspaceId, adapterId);

        // Find workflows that reference this integration
        const dependentWorkflows = await getWorkflowsUsingIntegration(
          workspaceId,
          adapterId,
        );

        return {
          type: int.integration,
          configured: availability.configured,
          healthy: availability.healthy,
          missingSecrets: availability.missingSecrets,
          missingMeta: availability.missingMeta,
          usedByWorkflows: dependentWorkflows.map(w => w.name),
        };
      })
    );

    // Check each workflow's enablement status
    const workflowResults: WorkflowReadiness[] = await Promise.all(
      workflows.map(async (wf) => {
        const validation = await validateCanEnable(wf.id);

        // Build human-readable blockers from validation errors
        const blockers = validation.errors.map(e => {
          const adapter = getAdapter(e.adapter || '');
          const adapterName = adapter?.name || e.adapter || 'Unknown';

          switch (e.code) {
            case 'INTEGRATION_NOT_CONFIGURED':
              return `${adapterName} integration is not configured`;
            case 'SECRET_NOT_CONFIGURED':
              return `${adapterName} is missing credentials`;
            case 'META_KEY_MISSING':
              return `${adapterName} is missing required configuration`;
            case 'INTEGRATION_UNHEALTHY':
              return `${adapterName} integration is unhealthy`;
            default:
              return e.message;
          }
        });

        return {
          id: wf.id,
          name: wf.name,
          enabled: wf.enabled,
          canEnable: validation.valid,
          blockers,
        };
      })
    );

    const allIntegrationsReady = integrationResults.every(i => i.configured && i.healthy);
    const allWorkflowsCanEnable = workflowResults.every(w => w.canEnable);

    return ApiResponse.success({
      ready: allIntegrationsReady && allWorkflowsCanEnable,
      integrations: integrationResults,
      workflows: workflowResults,
    });
  } catch (error) {
    console.error('Error checking workspace readiness:', error);
    return ApiResponse.internalError();
  }
}
