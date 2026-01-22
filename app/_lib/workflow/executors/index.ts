/**
 * Action Executor Registry
 *
 * Central registry for all action executors.
 * Maps adapter.operation to executor implementations.
 */

import { ActionExecutor } from '../types';
import { mailerliteExecutors } from './mailerlite';
import { revlineExecutors } from './revline';
import { abcIgniteExecutors } from './abc-ignite';
import { resendExecutors } from './resend';

// =============================================================================
// EXECUTOR REGISTRY
// =============================================================================

/**
 * All registered executors by adapter
 */
const EXECUTORS: Record<string, Record<string, ActionExecutor>> = {
  mailerlite: mailerliteExecutors,
  revline: revlineExecutors,
  abc_ignite: abcIgniteExecutors,
  resend: resendExecutors,
  // Future: Add more adapters here
  // manychat: manychatExecutors,
};

// =============================================================================
// REGISTRY FUNCTIONS
// =============================================================================

/**
 * Get an executor for a specific action
 *
 * @param adapter - Adapter ID (e.g., 'mailerlite')
 * @param operation - Operation name (e.g., 'add_to_group')
 * @returns The action executor
 * @throws Error if no executor is found
 */
export function getActionExecutor(
  adapter: string,
  operation: string
): ActionExecutor {
  const adapterExecutors = EXECUTORS[adapter];
  if (!adapterExecutors) {
    throw new Error(`No executors registered for adapter: ${adapter}`);
  }

  const executor = adapterExecutors[operation];
  if (!executor) {
    throw new Error(`No executor for operation: ${adapter}.${operation}`);
  }

  return executor;
}

/**
 * Check if an executor exists for a specific action
 */
export function hasActionExecutor(adapter: string, operation: string): boolean {
  const adapterExecutors = EXECUTORS[adapter];
  if (!adapterExecutors) return false;
  return operation in adapterExecutors;
}

/**
 * Get all registered executor operations for an adapter
 */
export function getAdapterOperations(adapter: string): string[] {
  const adapterExecutors = EXECUTORS[adapter];
  if (!adapterExecutors) return [];
  return Object.keys(adapterExecutors);
}


