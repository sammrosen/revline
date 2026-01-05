/**
 * Integration Action Handlers
 * 
 * Each handler defines how an integration responds to RevLine actions.
 * 
 * To add a new integration:
 * 1. Create handler file: handlers/newintegration.ts
 * 2. Export handler function
 * 3. Register in INTEGRATION_HANDLERS below
 */

import { IntegrationType } from '@prisma/client';
import { RevLineAction, ActionPayload, ActionResult } from '../index';
import { handleMailerLiteAction } from './mailerlite';

/**
 * Handler function signature for all integrations
 */
export type IntegrationHandler = (
  clientId: string,
  integrationMeta: unknown,
  action: RevLineAction,
  payload: ActionPayload
) => Promise<ActionResult>;

/**
 * Registry of all integration handlers
 * Add new handlers here as integrations are built
 */
export const INTEGRATION_HANDLERS: Partial<Record<IntegrationType, IntegrationHandler>> = {
  MAILERLITE: handleMailerLiteAction,
  // Future integrations:
  // SLACK: handleSlackAction,
  // PUSHOVER: handlePushoverAction,
};

