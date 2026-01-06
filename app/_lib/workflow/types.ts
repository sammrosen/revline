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

  /** Client ID this workflow is running for */
  clientId: string;

  /** Lead ID if a lead was created/found */
  leadId?: string;

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

/** Lead stage values */
export const LeadStageSchema = z.enum(['CAPTURED', 'BOOKED', 'PAID', 'DEAD']);


