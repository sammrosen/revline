/**
 * Workflow Engine
 *
 * Public API for the workflow engine.
 * Import from '@/app/_lib/workflow' in route handlers.
 */

// Core engine
export { emitTrigger } from './engine';

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
} from './types';

// Payload schemas
export {
  CommonPayloadSchema,
  BookingPayloadSchema,
  PaymentPayloadSchema,
  CapturePayloadSchema,
  LeadStageSchema,
} from './types';


