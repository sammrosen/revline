/**
 * Action Dispatcher
 * 
 * Central dispatch point for all RevLine actions.
 * Routes actions to all configured integrations for a client.
 * 
 * Usage:
 *   await dispatchAction(clientId, 'lead.captured', { email, name, source });
 */

import { prisma } from '@/app/_lib/db';
import { RevLineAction, ActionPayload, ActionResult } from './index';
import { INTEGRATION_HANDLERS } from './handlers';

/**
 * Dispatch result for a single integration
 */
interface IntegrationDispatchResult {
  integration: string;
  result: ActionResult;
}

/**
 * Full dispatch result
 */
export interface DispatchResult {
  action: RevLineAction;
  results: IntegrationDispatchResult[];
  allSucceeded: boolean;
}

/**
 * Dispatch an action to all configured integrations for a client
 * 
 * @param clientId - The client ID
 * @param action - The action that occurred (e.g., 'lead.captured')
 * @param payload - Action payload (email, name, etc.)
 * @returns Results from all integration handlers
 * 
 * @example
 * // In capture.service.ts
 * await dispatchAction(clientId, 'lead.captured', { email, name, source });
 * 
 * // In webhook.service.ts
 * await dispatchAction(clientId, 'lead.paid', { email, name, program: 'fit1' });
 */
export async function dispatchAction(
  clientId: string,
  action: RevLineAction,
  payload: ActionPayload
): Promise<DispatchResult> {
  // Get all integrations for this client
  const integrations = await prisma.clientIntegration.findMany({
    where: { clientId },
    select: { 
      integration: true, 
      meta: true,
    },
  });

  const results: IntegrationDispatchResult[] = [];

  // Dispatch to each integration that has a handler
  for (const integration of integrations) {
    const handler = INTEGRATION_HANDLERS[integration.integration];
    
    if (!handler) {
      // No handler for this integration type, skip
      continue;
    }

    try {
      const result = await handler(clientId, integration.meta, action, payload);
      results.push({
        integration: integration.integration,
        result,
      });
    } catch (error) {
      // Handler threw an unexpected error
      console.error(`Action handler error for ${integration.integration}:`, error);
      results.push({
        integration: integration.integration,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return {
    action,
    results,
    allSucceeded: results.every(r => r.result.success),
  };
}

/**
 * Dispatch an action and throw if any integration fails
 * Use this when you want to fail fast on any error
 */
export async function dispatchActionOrThrow(
  clientId: string,
  action: RevLineAction,
  payload: ActionPayload
): Promise<DispatchResult> {
  const result = await dispatchAction(clientId, action, payload);
  
  if (!result.allSucceeded) {
    const failedIntegrations = result.results
      .filter(r => !r.result.success)
      .map(r => `${r.integration}: ${r.result.error}`)
      .join('; ');
    
    throw new Error(`Action '${action}' failed for: ${failedIntegrations}`);
  }
  
  return result;
}

