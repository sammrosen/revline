/**
 * Workflow Engine
 *
 * Public API for the workflow engine.
 * Import from '@/app/_lib/workflow' in route handlers.
 */

import { emitTrigger as _emitTrigger } from './engine';
import { isValidFormTrigger, getFormTriggers } from '@/app/_lib/forms/registry';
import type { TriggerEmitResult } from './types';

// Core engine
export { emitTrigger, executeWorkflowSync } from './engine';

/**
 * @deprecated Use submitCaptureTrigger() from capture.service.ts instead.
 * 
 * This function uses the legacy FORM_REGISTRY and emits 'revline' triggers.
 * The new capture system uses WorkspaceForm table and emits 'capture' triggers.
 * 
 * Migration:
 * ```typescript
 * // OLD (deprecated)
 * await emitFormTrigger(workspaceId, 'sportswest-booking', 'booking-confirmed', payload);
 * 
 * // NEW
 * import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';
 * await submitCaptureTrigger(workspaceId, 'booking-confirmed', payload);
 * ```
 * 
 * @param workspaceId - Workspace ID (scopes the trigger)
 * @param formId - Form ID from registry (e.g., 'sportswest-booking')
 * @param triggerId - Trigger ID declared in form's triggers array (e.g., 'booking-confirmed')
 * @param payload - Event payload
 * @throws Error if trigger is not declared for this form
 */
export async function emitFormTrigger(
  workspaceId: string,
  formId: string,
  triggerId: string,
  payload: Record<string, unknown>
): Promise<TriggerEmitResult> {
  // Validate trigger is declared for this form
  if (!isValidFormTrigger(formId, triggerId)) {
    const declared = getFormTriggers(formId).map(t => t.id).join(', ');
    throw new Error(
      `Trigger '${triggerId}' is not declared for form '${formId}'. ` +
      `Declared triggers: [${declared || 'none'}]`
    );
  }

  // Emit with validation passed - include formId and triggerId in payload
  return _emitTrigger(
    workspaceId,
    { adapter: 'revline', operation: triggerId },
    { ...payload, formId, triggerId }
  );
}

// Registry
export {
  getAdapter,
  getTrigger,
  getAction,
  getAllTriggers,
  getAllActions,
  getTriggersForUI,
  getActionsForUI,
  ADAPTER_REGISTRY,
  CALENDLY_ADAPTER,
  STRIPE_ADAPTER,
  MAILERLITE_ADAPTER,
  REVLINE_ADAPTER,
  MANYCHAT_ADAPTER,
  CAPTURE_ADAPTER,
  BOOKING_ADAPTER,
} from './registry';

// Executors
export { getActionExecutor, hasActionExecutor } from './executors';

// Validation
export {
  validateCanEnable,
  validateCanEdit,
  validateWorkflowConfig,
  validateCanDeleteIntegration,
  getWorkflowsUsingIntegration,
  getWorkflowDependencies,
  validateAllWorkflows,
  getClientIntegrations,
  checkAdapterAvailability,
} from './validation';

// Custom validators
export {
  registerValidator,
  getValidator,
  hasValidator,
  validationSuccess,
  validationFailure,
  validationWarning,
} from './validators';

// Types
export type {
  OperationDefinition,
  AdapterDefinition,
  AdapterRequirements,
  WorkflowAction,
  WorkflowTrigger,
  WorkflowContext,
  ActionResult,
  ActionExecutionResult,
  WorkflowExecutionResult,
  TriggerEmitResult,
  ActionExecutor,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationErrorCode,
  AdapterValidator,
  WorkflowConfig,
  SyncWorkflowResult,
  SyncWorkflowOptions,
} from './types';

// Payload schemas
export {
  CommonPayloadSchema,
  BookingPayloadSchema,
  PaymentPayloadSchema,
  CapturePayloadSchema,
  LeadStageSchema,
} from './types';

// Templates
export {
  ABC_IGNITE_BOOKING_TEMPLATE,
  WORKFLOW_TEMPLATES,
  createWorkflowFromTemplate,
  getAvailableTemplates,
  createAllAvailableTemplates,
  ensureAbcIgniteBookingWorkflow,
} from './templates';
export type { WorkflowTemplate } from './templates';


