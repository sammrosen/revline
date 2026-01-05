/**
 * RevLine Action Registry
 * 
 * Central definition of all actions that can occur in the system.
 * Integrations can route these actions to their specific handlers.
 * 
 * To add a new action:
 * 1. Add to ACTION_REGISTRY below
 * 2. Call dispatchAction() from wherever the action occurs
 * 3. Integration handlers automatically check routing - no handler changes needed
 * 4. Admin UI automatically shows new action in routing dropdowns
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

