/**
 * Workflow Validation Service
 *
 * Central validation logic that reads declarative requirements from the adapter registry.
 * Validates workflows can be enabled, edited, and checks configuration validity.
 *
 * ARCHITECTURE:
 * - Adapters declare requirements in registry.ts (secrets, metaKeys, paramRequirements)
 * - This service reads those requirements and validates against client config
 * - Optional custom validators can be registered for complex business logic
 */

import { prisma } from '@/app/_lib/db';
import { IntegrationType, HealthStatus } from '@prisma/client';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  WorkflowConfig,
  WorkflowAction,
} from './types';
import { getAdapter, getAction } from './registry';
import { getValidator } from './validators';
import { IntegrationSecret } from '@/app/_lib/types';

// =============================================================================
// HELPER: Create results
// =============================================================================

function success(warnings: ValidationWarning[] = []): ValidationResult {
  return { valid: true, errors: [], warnings };
}

function failure(errors: ValidationError[], warnings: ValidationWarning[] = []): ValidationResult {
  return { valid: false, errors, warnings };
}

function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// MAIN ENTRY POINTS
// =============================================================================

/**
 * Validate that a workflow can be enabled
 * Checks all required integrations are configured and healthy
 *
 * @param workflowId - ID of the workflow to validate
 * @returns Validation result with errors/warnings
 */
export async function validateCanEnable(workflowId: string): Promise<ValidationResult> {
  // Load workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
      clientId: true,
      triggerAdapter: true,
      triggerOperation: true,
      actions: true,
    },
  });

  if (!workflow) {
    return failure([{
      code: 'INVALID_CONFIG',
      message: 'Workflow not found',
    }]);
  }

  // Validate trigger adapter requirements
  const triggerResult = await validateAdapterRequirements(
    workflow.clientId,
    workflow.triggerAdapter,
    'trigger'
  );

  // Validate each action
  const actions = workflow.actions as unknown as WorkflowAction[];
  const actionResults = await Promise.all(
    actions.map((action, index) =>
      validateActionRequirements(workflow.clientId, action, index)
    )
  );

  return mergeResults(triggerResult, ...actionResults);
}

/**
 * Validate that a workflow can be edited
 * Must be disabled first
 *
 * @param workflow - Workflow with enabled status
 * @returns Validation result
 */
export function validateCanEdit(workflow: { enabled: boolean }): ValidationResult {
  if (workflow.enabled) {
    return failure([{
      code: 'WORKFLOW_ACTIVE',
      message: 'Cannot edit active workflow. Disable it first.',
    }]);
  }
  return success();
}

/**
 * Validate workflow configuration before saving
 * Checks integrations exist and params reference valid config
 *
 * @param clientId - Client ID
 * @param config - Workflow configuration to validate
 * @returns Validation result
 */
export async function validateWorkflowConfig(
  clientId: string,
  config: WorkflowConfig
): Promise<ValidationResult> {
  const results: ValidationResult[] = [];

  // Validate trigger adapter
  const triggerResult = await validateAdapterRequirements(
    clientId,
    config.triggerAdapter,
    'trigger'
  );
  results.push(triggerResult);

  // Validate each action
  for (let i = 0; i < config.actions.length; i++) {
    const actionResult = await validateActionRequirements(
      clientId,
      config.actions[i],
      i
    );
    results.push(actionResult);
  }

  return mergeResults(...results);
}

/**
 * Validate that an integration can be deleted
 * Checks no workflows depend on it
 *
 * @param clientId - Client ID
 * @param integrationType - Integration type to delete
 * @returns Validation result with dependent workflow info
 */
export async function validateCanDeleteIntegration(
  clientId: string,
  integrationType: string
): Promise<ValidationResult> {
  const dependentWorkflows = await getWorkflowsUsingIntegration(
    clientId,
    integrationType.toLowerCase()
  );

  if (dependentWorkflows.length > 0) {
    const workflowNames = dependentWorkflows.map(w => w.name).join(', ');
    return failure([{
      code: 'HAS_DEPENDENTS',
      message: `Cannot delete: used by ${dependentWorkflows.length} workflow(s): ${workflowNames}`,
      adapter: integrationType,
    }]);
  }

  return success();
}

// =============================================================================
// ADAPTER REQUIREMENT VALIDATION
// =============================================================================

/**
 * Validate an adapter's requirements are met by client config
 */
async function validateAdapterRequirements(
  clientId: string,
  adapterId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: 'trigger' | 'action' // Reserved for future trigger vs action differentiation
): Promise<ValidationResult> {
  const adapter = getAdapter(adapterId);

  if (!adapter) {
    // Unknown adapter - can't validate, let it pass
    return success([{
      code: 'UNKNOWN_ADAPTER',
      message: `Unknown adapter '${adapterId}' - skipping validation`,
    }]);
  }

  // If adapter doesn't require integration, skip
  if (!adapter.requiresIntegration) {
    return success();
  }

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Map adapter ID to IntegrationType
  const integrationType = adapterIdToIntegrationType(adapterId);
  if (!integrationType) {
    return success([{
      code: 'UNKNOWN_INTEGRATION_TYPE',
      message: `Cannot map adapter '${adapterId}' to integration type`,
    }]);
  }

  // Check if integration exists
  const integration = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration: integrationType,
      },
    },
    select: {
      secrets: true,
      meta: true,
      healthStatus: true,
    },
  });

  if (!integration) {
    errors.push({
      code: 'INTEGRATION_NOT_CONFIGURED',
      message: `${adapter.name} integration is not configured for this client`,
      adapter: adapterId,
    });
    return failure(errors, warnings);
  }

  // Check required secrets
  if (adapter.requirements?.secrets) {
    const secrets = integration.secrets as unknown as IntegrationSecret[] || [];
    const secretNames = new Set(secrets.map(s => s.name));

    for (const requiredSecret of adapter.requirements.secrets) {
      if (!secretNames.has(requiredSecret)) {
        errors.push({
          code: 'SECRET_NOT_CONFIGURED',
          message: `${adapter.name} is missing required secret: ${requiredSecret}`,
          adapter: adapterId,
        });
      }
    }
  }

  // Check required meta keys
  if (adapter.requirements?.metaKeys) {
    const meta = integration.meta as Record<string, unknown> || {};

    for (const requiredKey of adapter.requirements.metaKeys) {
      if (!(requiredKey in meta) || !meta[requiredKey]) {
        errors.push({
          code: 'META_KEY_MISSING',
          message: `${adapter.name} is missing required configuration: ${requiredKey}`,
          adapter: adapterId,
        });
      }
    }
  }

  // Check health status
  const minHealth = adapter.requirements?.minHealthStatus;
  if (minHealth && integration.healthStatus === HealthStatus.RED) {
    errors.push({
      code: 'INTEGRATION_UNHEALTHY',
      message: `${adapter.name} integration is unhealthy (status: RED)`,
      adapter: adapterId,
    });
  } else if (integration.healthStatus === HealthStatus.YELLOW) {
    warnings.push({
      code: 'INTEGRATION_DEGRADED',
      message: `${adapter.name} integration health is degraded (status: YELLOW)`,
      suggestion: 'Check integration configuration and recent events',
    });
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate a single action's requirements
 */
async function validateActionRequirements(
  clientId: string,
  action: WorkflowAction,
  actionIndex: number
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // First validate the adapter requirements
  const adapterResult = await validateAdapterRequirements(
    clientId,
    action.adapter,
    'action'
  );

  if (!adapterResult.valid) {
    return adapterResult;
  }

  // Get the operation definition
  const operation = getAction(action.adapter, action.operation);
  if (!operation) {
    warnings.push({
      code: 'UNKNOWN_OPERATION',
      message: `Unknown operation '${action.operation}' for adapter '${action.adapter}'`,
    });
    return success(warnings);
  }

  // Check param requirements
  if (operation.paramRequirements) {
    const integrationType = adapterIdToIntegrationType(action.adapter);
    if (!integrationType) {
      return success(warnings);
    }

    const integration = await prisma.clientIntegration.findUnique({
      where: {
        clientId_integration: {
          clientId,
          integration: integrationType,
        },
      },
      select: { meta: true },
    });

    const meta = integration?.meta as Record<string, unknown> || {};

    for (const [paramName, configPath] of Object.entries(operation.paramRequirements)) {
      const paramValue = action.params[paramName] as string | undefined;

      if (!paramValue) {
        errors.push({
          code: 'PARAM_NOT_IN_CONFIG',
          message: `Action ${actionIndex + 1}: Missing required param '${paramName}'`,
          adapter: action.adapter,
          operation: action.operation,
          param: paramName,
        });
        continue;
      }

      // Parse config path (e.g., 'meta.groups')
      const configValue = getValueByPath(meta, configPath);

      if (!configValue || typeof configValue !== 'object') {
        errors.push({
          code: 'META_KEY_MISSING',
          message: `Action ${actionIndex + 1}: Config '${configPath}' not found`,
          adapter: action.adapter,
          operation: action.operation,
          param: paramName,
        });
        continue;
      }

      // Check if param value exists in config
      if (!(paramValue in configValue)) {
        errors.push({
          code: 'PARAM_NOT_IN_CONFIG',
          message: `Action ${actionIndex + 1}: '${paramName}' value '${paramValue}' not found in ${configPath}`,
          adapter: action.adapter,
          operation: action.operation,
          param: paramName,
        });
      }
    }
  }

  // Call custom validator if registered
  const customValidator = getValidator(action.adapter);
  if (customValidator) {
    const customResult = await customValidator.validate(
      clientId,
      action.operation,
      action.params
    );
    errors.push(...customResult.errors);
    warnings.push(...customResult.warnings);
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

// =============================================================================
// DEPENDENCY QUERIES
// =============================================================================

/**
 * Get all workflows that use a specific integration
 */
export async function getWorkflowsUsingIntegration(
  clientId: string,
  adapterId: string
): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
  const workflows = await prisma.workflow.findMany({
    where: { clientId },
    select: {
      id: true,
      name: true,
      enabled: true,
      triggerAdapter: true,
      actions: true,
    },
  });

  return workflows.filter(workflow => {
    // Check trigger
    if (workflow.triggerAdapter === adapterId) {
      return true;
    }

    // Check actions
    const actions = workflow.actions as unknown as WorkflowAction[];
    return actions.some(action => action.adapter === adapterId);
  });
}

/**
 * Get all integrations used by a workflow
 */
export function getWorkflowDependencies(workflow: {
  triggerAdapter: string;
  actions: WorkflowAction[];
}): string[] {
  const adapters = new Set<string>();

  // Add trigger adapter
  adapters.add(workflow.triggerAdapter);

  // Add action adapters
  for (const action of workflow.actions) {
    adapters.add(action.adapter);
  }

  return Array.from(adapters);
}

/**
 * Validate all workflows for a client (for dependency graph)
 */
export async function validateAllWorkflows(
  clientId: string
): Promise<Record<string, ValidationResult>> {
  const workflows = await prisma.workflow.findMany({
    where: { clientId },
    select: { id: true },
  });

  const results: Record<string, ValidationResult> = {};

  for (const workflow of workflows) {
    results[workflow.id] = await validateCanEnable(workflow.id);
  }

  return results;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map adapter ID to Prisma IntegrationType enum
 */
function adapterIdToIntegrationType(adapterId: string): IntegrationType | null {
  const mapping: Record<string, IntegrationType> = {
    mailerlite: IntegrationType.MAILERLITE,
    stripe: IntegrationType.STRIPE,
    calendly: IntegrationType.CALENDLY,
    manychat: IntegrationType.MANYCHAT,
  };
  return mapping[adapterId.toLowerCase()] ?? null;
}

/**
 * Get a value from an object by dot-notation path
 * e.g., getValueByPath({ meta: { groups: {} } }, 'meta.groups')
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');

  // Handle 'meta.X' by stripping 'meta.' prefix since we're already starting from meta
  const adjustedParts = parts[0] === 'meta' ? parts.slice(1) : parts;

  let current: unknown = obj;
  for (const part of adjustedParts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Get available integrations for a client
 */
export async function getClientIntegrations(
  clientId: string
): Promise<Array<{
  type: IntegrationType;
  healthStatus: HealthStatus;
  hasSecrets: boolean;
  secretNames: string[];
  metaKeys: string[];
}>> {
  const integrations = await prisma.clientIntegration.findMany({
    where: { clientId },
    select: {
      integration: true,
      healthStatus: true,
      secrets: true,
      meta: true,
    },
  });

  return integrations.map(int => {
    const secrets = int.secrets as unknown as IntegrationSecret[] || [];
    const meta = int.meta as Record<string, unknown> || {};

    return {
      type: int.integration,
      healthStatus: int.healthStatus,
      hasSecrets: secrets.length > 0,
      secretNames: secrets.map(s => s.name),
      metaKeys: Object.keys(meta),
    };
  });
}

/**
 * Check if a specific adapter's requirements are met for a client
 * Useful for UI to show warnings before creating workflows
 */
export async function checkAdapterAvailability(
  clientId: string,
  adapterId: string
): Promise<{
  available: boolean;
  configured: boolean;
  healthy: boolean;
  missingSecrets: string[];
  missingMeta: string[];
}> {
  const adapter = getAdapter(adapterId);

  if (!adapter || !adapter.requiresIntegration) {
    return {
      available: true,
      configured: true,
      healthy: true,
      missingSecrets: [],
      missingMeta: [],
    };
  }

  const integrationType = adapterIdToIntegrationType(adapterId);
  if (!integrationType) {
    return {
      available: false,
      configured: false,
      healthy: false,
      missingSecrets: adapter.requirements?.secrets || [],
      missingMeta: adapter.requirements?.metaKeys || [],
    };
  }

  const integration = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration: integrationType,
      },
    },
    select: {
      secrets: true,
      meta: true,
      healthStatus: true,
    },
  });

  if (!integration) {
    return {
      available: false,
      configured: false,
      healthy: false,
      missingSecrets: adapter.requirements?.secrets || [],
      missingMeta: adapter.requirements?.metaKeys || [],
    };
  }

  const secrets = integration.secrets as unknown as IntegrationSecret[] || [];
  const secretNames = new Set(secrets.map(s => s.name));
  const meta = integration.meta as Record<string, unknown> || {};

  const missingSecrets = (adapter.requirements?.secrets || [])
    .filter(s => !secretNames.has(s));
  const missingMeta = (adapter.requirements?.metaKeys || [])
    .filter(k => !(k in meta) || !meta[k]);

  const configured = missingSecrets.length === 0 && missingMeta.length === 0;
  const healthy = integration.healthStatus !== HealthStatus.RED;

  return {
    available: configured && healthy,
    configured,
    healthy,
    missingSecrets,
    missingMeta,
  };
}

