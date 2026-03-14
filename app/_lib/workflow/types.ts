/**
 * Workflow Engine Type Definitions
 *
 * Core types for the decoupled workflow engine.
 * Defines adapters, operations, workflows, and execution context.
 */

import { z } from 'zod';

// =============================================================================
// OPERATION & ADAPTER DEFINITIONS
// =============================================================================

/**
 * Definition of a single operation (trigger or action)
 */
export interface OperationDefinition {
  /** Internal name (e.g., 'booking_created') */
  name: string;
  /** Display label (e.g., 'Booking Created') */
  label: string;
  /** Description for UI */
  description?: string;
  /** Schema for the payload this operation receives (triggers) or requires (actions) */
  payloadSchema: z.ZodSchema;
  /** Schema for configuration params (actions only, e.g., which group to add to) */
  paramsSchema?: z.ZodSchema;
  /**
   * Param-to-config mapping for validation
   * Maps param name to config path where value must exist
   * e.g., { group: 'meta.groups' } means params.group must be a key in integration.meta.groups
   */
  paramRequirements?: Record<string, string>;
  /**
   * Test field definitions for the test suite
   * Defines what fields to render when testing this trigger
   */
  testFields?: TestField[];
}

/**
 * Declarative requirements for an adapter
 * Used by the central validator to check if client has proper config
 */
export interface AdapterRequirements {
  /** Secret names that must exist in client_integrations.secrets */
  secrets?: string[];
  /** Meta keys that must exist (e.g., 'groups' for MailerLite) */
  metaKeys?: string[];
  /** Minimum health status required (default: any non-RED) */
  minHealthStatus?: 'GREEN' | 'YELLOW';
}

/**
 * Definition of an adapter (integration)
 */
export interface AdapterDefinition {
  /** Internal ID (e.g., 'mailerlite') */
  id: string;
  /** Display name (e.g., 'MailerLite') */
  name: string;
  /** Whether client needs this integration configured to use it */
  requiresIntegration: boolean;
  /** Declarative validation requirements */
  requirements?: AdapterRequirements;
  /** Events this adapter can emit */
  triggers: Record<string, OperationDefinition>;
  /** Operations this adapter can execute */
  actions: Record<string, OperationDefinition>;
}

// =============================================================================
// WORKFLOW CONFIGURATION
// =============================================================================

/**
 * A single action in a workflow
 */
export interface WorkflowAction {
  /** Adapter ID (e.g., 'mailerlite') */
  adapter: string;
  /** Operation name (e.g., 'add_to_group') */
  operation: string;
  /** Configuration params (e.g., { group: 'customers' }) */
  params: Record<string, unknown>;
  /** Reserved for future: conditions to check before executing */
  conditions?: Record<string, unknown>;
}

/**
 * Trigger definition for a workflow
 */
export interface WorkflowTrigger {
  /** Adapter ID (e.g., 'calendly') */
  adapter: string;
  /** Operation name (e.g., 'booking_created') */
  operation: string;
}

// =============================================================================
// RUNTIME CONTEXT
// =============================================================================

/**
 * Runtime context passed through workflow execution
 */
export interface WorkflowContext {
  /** Trigger information */
  trigger: {
    adapter: string;
    operation: string;
    payload: Record<string, unknown>;
  };

  /** Normalized email (always available) */
  email: string;

  /** Normalized name (optional) */
  name?: string;

  /** Workspace ID this workflow is running for */
  workspaceId: string;

  /** @deprecated Use workspaceId instead */
  clientId: string;

  /** Lead ID if a lead was created/found */
  leadId?: string;

  /** Whether this execution is a test (skips channel delivery, marks conversations as test) */
  isTest?: boolean;

  /** Data accumulated from previous action executions */
  actionData: Record<string, unknown>;
}

// =============================================================================
// EXECUTION RESULTS
// =============================================================================

/**
 * Result from a single action execution
 */
export interface ActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Data returned by the action */
  data?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

/**
 * Result from a single action in a workflow execution
 */
export interface ActionExecutionResult {
  /** The action that was executed */
  action: WorkflowAction;
  /** Result of the execution */
  result: ActionResult;
}

/**
 * Result from executing a complete workflow
 */
export interface WorkflowExecutionResult {
  /** Workflow ID */
  workflowId: string;
  /** Workflow name */
  workflowName: string;
  /** Final status */
  status: 'completed' | 'failed';
  /** Number of actions executed */
  actionsExecuted: number;
  /** Total actions in workflow */
  actionsTotal: number;
  /** Individual action results */
  results: ActionExecutionResult[];
  /** Error message if failed */
  error?: string;
}

/**
 * Result from emitting a trigger (may run multiple workflows)
 */
export interface TriggerEmitResult {
  /** How many workflows were found */
  workflowsFound: number;
  /** How many workflows were executed (after filter matching) */
  workflowsExecuted: number;
  /** Results from each workflow execution */
  executions: WorkflowExecutionResult[];
}

// =============================================================================
// ACTION EXECUTOR INTERFACE
// =============================================================================

/**
 * Interface for action executors
 */
export interface ActionExecutor {
  /**
   * Execute the action
   * @param ctx - Workflow context
   * @param params - Action configuration params
   * @returns Action result
   */
  execute(ctx: WorkflowContext, params: Record<string, unknown>): Promise<ActionResult>;
}

// =============================================================================
// PAYLOAD SCHEMAS (Reusable)
// =============================================================================

/** Common payload fields for most triggers/actions */
export const CommonPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

/** Booking payload from Calendly */
export const BookingPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  eventType: z.string().optional(),
  eventUri: z.string().optional(),
  scheduledAt: z.string().optional(),
});

/** Payment payload from Stripe */
export const PaymentPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  amount: z.number(),
  currency: z.string(),
  product: z.string().optional(),
  priceId: z.string().optional(),
});

/** Email capture payload */
export const CapturePayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  source: z.string(),
});

/** Lead stage values — validated at runtime against workspace config */
export const LeadStageSchema = z.string().min(1);

// =============================================================================
// TEST FIELD DEFINITIONS
// =============================================================================

/**
 * Definition for a test field in the test suite
 * These are defined per-trigger and rendered dynamically
 */
export interface TestField {
  /** Field name in the payload (e.g., 'email', 'amount') */
  name: string;
  /** Display label for the field */
  label: string;
  /** Field input type */
  type: 'email' | 'text' | 'number' | 'select' | 'datetime';
  /** Whether the field is required */
  required: boolean;
  /** Default value for the field */
  default?: string | number;
  /** Placeholder text */
  placeholder?: string;
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Validation error codes
 */
export type ValidationErrorCode =
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'SECRET_NOT_CONFIGURED'
  | 'META_KEY_MISSING'
  | 'INTEGRATION_UNHEALTHY'
  | 'PARAM_NOT_IN_CONFIG'
  | 'WORKFLOW_ACTIVE'
  | 'HAS_DEPENDENTS'
  | 'INVALID_CONFIG';

/**
 * A single validation error
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
  /** Which adapter caused the error */
  adapter?: string;
  /** Which operation caused the error */
  operation?: string;
  /** Which param caused the error */
  param?: string;
}

/**
 * A single validation warning (non-blocking)
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Optional suggestion for resolution */
  suggestion?: string;
}

/**
 * Result of a validation check
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  valid: boolean;
  /** List of blocking errors */
  errors: ValidationError[];
  /** List of non-blocking warnings */
  warnings: ValidationWarning[];
}

/**
 * Interface for optional custom validators per adapter
 * Use when declarative validation isn't sufficient
 */
export interface AdapterValidator {
  /**
   * Validate adapter-specific requirements
   * @param clientId - Client ID to validate for
   * @param operation - Operation name being validated
   * @param params - Operation params
   * @returns Validation result
   */
  validate(
    clientId: string,
    operation: string,
    params: Record<string, unknown>
  ): Promise<ValidationResult>;
}

/**
 * Workflow configuration for validation
 */
export interface WorkflowConfig {
  name: string;
  triggerAdapter: string;
  triggerOperation: string;
  triggerFilter?: Record<string, unknown> | null;
  actions: WorkflowAction[];
  enabled?: boolean;
}


