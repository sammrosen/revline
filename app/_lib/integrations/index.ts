/**
 * Integration Adapters
 * 
 * Import from '@/app/_lib/integrations'
 * 
 * PREFERRED: Use adapter classes for all integration operations
 * 
 * @example
 * import { MailerLiteAdapter, StripeAdapter } from '@/app/_lib/integrations';
 * 
 * const ml = await MailerLiteAdapter.forClient(clientId);
 * const stripe = await StripeAdapter.forClient(clientId);
 */

// Adapter classes (preferred)
export { BaseIntegrationAdapter } from './base';
export type { AdapterConstructor } from './base';

export { MailerLiteAdapter } from './mailerlite.adapter';
export type { AddSubscriberResult } from './mailerlite.adapter';

export { StripeAdapter } from './stripe.adapter';
export type { CheckoutData, VerifiedWebhookEvent } from './stripe.adapter';

export { AbcIgniteAdapter } from './abc-ignite.adapter';
export type { 
  AbcIgniteEvent, 
  AbcIgniteEventType, 
  EnrollmentResult, 
  WaitlistResult,
} from './abc-ignite.adapter';

export { RevlineAdapter } from './revline.adapter';
export type { FormConfig } from './revline.adapter';

// Integration config - single source of truth
export {
  INTEGRATION_TYPES,
  INTEGRATIONS,
  getIntegrationConfig,
  getIntegrationIds,
  getSecretNames,
  getDefaultMeta,
  isValidIntegrationType,
} from './config';
export type { IntegrationTypeId, IntegrationConfig, SecretConfig, MetaFieldConfig } from './config';

// Legacy exports for backward compatibility
// These are deprecated - use adapters instead
export {
  getClientSecret,
  getClientIntegration,
  touchIntegration,
  markIntegrationUnhealthy,
} from '../integrations-core';

