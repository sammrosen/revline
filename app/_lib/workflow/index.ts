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

// Types
export type {
  OperationDefinition,
  AdapterDefinition,
  WorkflowAction,
  WorkflowTrigger,
  WorkflowContext,
  ActionResult,
  ActionExecutionResult,
  WorkflowExecutionResult,
  TriggerEmitResult,
  ActionExecutor,
} from './types';

// Payload schemas
export {
  CommonPayloadSchema,
  BookingPayloadSchema,
  PaymentPayloadSchema,
  CapturePayloadSchema,
  LeadStageSchema,
} from './types';

