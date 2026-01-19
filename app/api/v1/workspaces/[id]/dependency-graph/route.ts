/**
 * Dependency Graph API
 *
 * GET /api/v1/workspaces/[id]/dependency-graph
 *
 * Returns the full dependency graph for a workspace showing:
 * - Which integrations are configured and their status
 * - Which workflows depend on which integrations
 * - Validation status for each workflow
 * - Warnings for misconfigured or unhealthy integrations
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { IntegrationType, HealthStatus } from '@prisma/client';
import {
  validateAllWorkflows,
  getWorkflowDependencies,
  getAdapter,
  WorkflowAction,
} from '@/app/_lib/workflow';
import { IntegrationSecret } from '@/app/_lib/types';

// =============================================================================
// TYPES
// =============================================================================

interface IntegrationNode {
  type: string;
  configured: boolean;
  healthy: boolean;
  healthStatus: HealthStatus | null;
  secretNames: string[];
  metaKeys: string[];
  usedBy: Array<{
    workflowId: string;
    workflowName: string;
    workflowEnabled: boolean;
    asTrigger: boolean;
    asAction: boolean;
    operations: string[];
  }>;
}

interface WorkflowNode {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  canEnable: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  trigger: {
    adapter: string;
    adapterName: string;
    operation: string;
  };
  actions: Array<{
    adapter: string;
    adapterName: string;
    operation: string;
    params: Record<string, unknown>;
  }>;
  dependencies: {
    integrations: string[];
    metaReferences: Array<{
      adapter: string;
      path: string;
      param: string;
      value: string;
    }>;
  };
}

interface DependencyGraph {
  integrations: Record<string, IntegrationNode>;
  workflows: WorkflowNode[];
  warnings: string[];
  stats: {
    totalWorkflows: number;
    enabledWorkflows: number;
    validWorkflows: number;
    configuredIntegrations: number;
    healthyIntegrations: number;
  };
}

// =============================================================================
// GET - Build dependency graph
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id: workspaceId } = await params;

  // Verify user has access to this workspace
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
  }

  try {
    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get all integrations for workspace
    const integrations = await prisma.workspaceIntegration.findMany({
      where: { workspaceId },
      select: {
        integration: true,
        healthStatus: true,
        secrets: true,
        meta: true,
      },
    });

    // Get all workflows for workspace
    const workflows = await prisma.workflow.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        triggerAdapter: true,
        triggerOperation: true,
        actions: true,
      },
    });

    // Validate all workflows
    const validationResults = await validateAllWorkflows(workspaceId);

    // Build integration nodes
    const integrationNodes: Record<string, IntegrationNode> = {};

    // Initialize all known integration types
    for (const type of Object.values(IntegrationType)) {
      const configured = integrations.find((i) => i.integration === type);
      const secrets = configured?.secrets as unknown as IntegrationSecret[] || [];
      const meta = configured?.meta as Record<string, unknown> || {};

      integrationNodes[type.toLowerCase()] = {
        type,
        configured: !!configured,
        healthy: configured ? configured.healthStatus !== HealthStatus.RED : false,
        healthStatus: configured?.healthStatus ?? null,
        secretNames: secrets.map((s) => s.name),
        metaKeys: Object.keys(meta),
        usedBy: [],
      };
    }

    // Build workflow nodes and populate integration usage
    const workflowNodes: WorkflowNode[] = [];
    const warnings: string[] = [];

    for (const workflow of workflows) {
      const actions = workflow.actions as unknown as WorkflowAction[];
      const validation = validationResults[workflow.id];

      // Get adapter names
      const triggerAdapter = getAdapter(workflow.triggerAdapter);

      // Build action info
      const actionInfo = actions.map((action) => {
        const adapter = getAdapter(action.adapter);
        return {
          adapter: action.adapter,
          adapterName: adapter?.name || action.adapter,
          operation: action.operation,
          params: action.params,
        };
      });

      // Extract meta references from actions
      const metaReferences: WorkflowNode['dependencies']['metaReferences'] = [];
      for (const action of actions) {
        const adapter = getAdapter(action.adapter);
        const operation = adapter?.actions[action.operation];

        if (operation?.paramRequirements) {
          for (const [paramName, configPath] of Object.entries(operation.paramRequirements)) {
            const paramValue = action.params[paramName] as string | undefined;
            if (paramValue) {
              metaReferences.push({
                adapter: action.adapter,
                path: configPath,
                param: paramName,
                value: paramValue,
              });
            }
          }
        }
      }

      // Get all dependencies
      const deps = getWorkflowDependencies({
        triggerAdapter: workflow.triggerAdapter,
        actions,
      });

      const workflowNode: WorkflowNode = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        enabled: workflow.enabled,
        canEnable: validation?.valid ?? false,
        validationErrors: validation?.errors.map((e) => e.message) ?? [],
        validationWarnings: validation?.warnings.map((w) => w.message) ?? [],
        trigger: {
          adapter: workflow.triggerAdapter,
          adapterName: triggerAdapter?.name || workflow.triggerAdapter,
          operation: workflow.triggerOperation,
        },
        actions: actionInfo,
        dependencies: {
          integrations: deps,
          metaReferences,
        },
      };

      workflowNodes.push(workflowNode);

      // Update integration usage
      // Trigger
      const triggerIntKey = workflow.triggerAdapter.toLowerCase();
      if (integrationNodes[triggerIntKey]) {
        const existing = integrationNodes[triggerIntKey].usedBy.find(
          (u) => u.workflowId === workflow.id
        );
        if (existing) {
          existing.asTrigger = true;
          if (!existing.operations.includes(workflow.triggerOperation)) {
            existing.operations.push(workflow.triggerOperation);
          }
        } else {
          integrationNodes[triggerIntKey].usedBy.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            workflowEnabled: workflow.enabled,
            asTrigger: true,
            asAction: false,
            operations: [workflow.triggerOperation],
          });
        }
      }

      // Actions
      for (const action of actions) {
        const actionIntKey = action.adapter.toLowerCase();
        if (integrationNodes[actionIntKey]) {
          const existing = integrationNodes[actionIntKey].usedBy.find(
            (u) => u.workflowId === workflow.id
          );
          if (existing) {
            existing.asAction = true;
            if (!existing.operations.includes(action.operation)) {
              existing.operations.push(action.operation);
            }
          } else {
            integrationNodes[actionIntKey].usedBy.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              workflowEnabled: workflow.enabled,
              asTrigger: false,
              asAction: true,
              operations: [action.operation],
            });
          }
        }
      }

      // Add warnings for enabled workflows with validation errors
      if (workflow.enabled && validation && !validation.valid) {
        warnings.push(
          `Workflow "${workflow.name}" is enabled but has validation errors: ${validation.errors[0]?.message}`
        );
      }
    }

    // Add warnings for unhealthy integrations that are in use
    for (const [, node] of Object.entries(integrationNodes)) {
      if (node.configured && !node.healthy && node.usedBy.length > 0) {
        const workflowNames = node.usedBy.map((u) => u.workflowName).join(', ');
        warnings.push(
          `Integration ${node.type} is unhealthy (${node.healthStatus}) and used by: ${workflowNames}`
        );
      }
    }

    // Calculate stats
    const configuredIntegrations = Object.values(integrationNodes).filter(
      (n) => n.configured
    ).length;
    const healthyIntegrations = Object.values(integrationNodes).filter(
      (n) => n.configured && n.healthy
    ).length;
    const validWorkflows = workflowNodes.filter((w) => w.canEnable).length;
    const enabledWorkflows = workflowNodes.filter((w) => w.enabled).length;

    const graph: DependencyGraph = {
      integrations: integrationNodes,
      workflows: workflowNodes,
      warnings,
      stats: {
        totalWorkflows: workflowNodes.length,
        enabledWorkflows,
        validWorkflows,
        configuredIntegrations,
        healthyIntegrations,
      },
    };

    return ApiResponse.success({ graph });
  } catch (error) {
    console.error('Error building dependency graph:', error);
    return ApiResponse.internalError();
  }
}

