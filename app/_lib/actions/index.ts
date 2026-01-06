/**
 * RevLine Action Registry
 * 
 * @deprecated This module is deprecated in favor of the workflow engine.
 * Use the workflow registry from '@/app/_lib/workflow' instead.
 * 
 * The action types and registry are kept for backwards compatibility with
 * existing code that references them. New code should use workflows.
 * 
 * Migration guide:
 * - dispatchAction() → emitTrigger() from '@/app/_lib/workflow'
 * - ACTION_REGISTRY → ADAPTER_REGISTRY from '@/app/_lib/workflow'
 */

/**
 * All registered actions in the RevLine system
 */
export const ACTION_REGISTRY = {
  'lead.captured': {
    name: 'Lead Captured',
    description: 'Email submitted on landing page',
  },
  'lead.booked': {
    name: 'Lead Booked',
    description: 'Calendly booking created',
  },
  'lead.canceled': {
    name: 'Booking Canceled',
    description: 'Calendly booking canceled',
  },
  'lead.paid': {
    name: 'Lead Paid',
    description: 'Stripe payment completed',
  },
} as const;

/**
 * Base action types from the registry
 */
export type BaseRevLineAction = keyof typeof ACTION_REGISTRY;

/**
 * All possible action types including parameterized ones
 * e.g., 'lead.paid:fit1' for program-specific payments
 */
export type RevLineAction = BaseRevLineAction | `lead.paid:${string}`;

/**
 * Check if an action is a base action (in the registry)
 */
export function isBaseAction(action: RevLineAction): action is BaseRevLineAction {
  return action in ACTION_REGISTRY;
}

/**
 * Get the base action from a parameterized action
 * e.g., 'lead.paid:fit1' -> 'lead.paid'
 */
export function getBaseAction(action: RevLineAction): BaseRevLineAction {
  if (isBaseAction(action)) return action;
  
  // Handle parameterized actions like 'lead.paid:fit1'
  const [base] = action.split(':');
  if (base in ACTION_REGISTRY) {
    return base as BaseRevLineAction;
  }
  
  throw new Error(`Unknown action: ${action}`);
}

/**
 * Get the parameter from a parameterized action
 * e.g., 'lead.paid:fit1' -> 'fit1'
 */
export function getActionParameter(action: RevLineAction): string | null {
  if (isBaseAction(action)) return null;
  const parts = action.split(':');
  return parts[1] || null;
}

/**
 * Payload data for action dispatch
 */
export interface ActionPayload {
  email: string;
  name?: string;
  source?: string;
  program?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result from an action handler
 */
export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Get all registered actions for UI display
 */
export function getRegisteredActions(): Array<{
  action: BaseRevLineAction;
  name: string;
  description: string;
}> {
  return Object.entries(ACTION_REGISTRY).map(([action, info]) => ({
    action: action as BaseRevLineAction,
    name: info.name,
    description: info.description,
  }));
}

