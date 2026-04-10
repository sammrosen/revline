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

export { AbcIgniteAdapter, normalizeMemberPayload, formatAbcTimestamp, isDateInWindow, titleCase } from './abc-ignite.adapter';
export type { 
  AbcIgniteEvent, 
  AbcIgniteEventType,
  AbcIgniteEmployee,
  AbcIgniteEmployeePersonal,
  AbcIgniteEmployeeEmployment,
  AbcIgniteEmployeeRole,
  AbcIgniteMember,
  AbcIgniteMemberPersonal,
  AbcIgniteMemberAgreement,
  DetectedMember,
  EnrollmentResult, 
  WaitlistResult,
} from './abc-ignite.adapter';

export { RevlineAdapter } from './revline.adapter';
export type { FormConfig } from './revline.adapter';

export { ResendAdapter, resendEventToErrorState, TRANSIENT_ERROR_STATES } from './resend.adapter';
export type { SendEmailResult, SendEmailParams, SendTemplateParams, RemoteResendTemplate, ResendWebhookEvent } from './resend.adapter';

export { TwilioAdapter } from './twilio.adapter';
export type { SendSmsResult, SendSmsParams, TwilioWebhookPayload } from './twilio.adapter';

export { EMPTY_TWIML, twimlResponse, escapeXml, voiceTwimlResponse, parseFormBody, getWebhookUrl } from './twilio-utils';

export { OpenAIAdapter } from './openai.adapter';
export type { ChatCompletionParams, ChatCompletionResult, ChatMessage, ToolDefinition, ToolCall, OpenAIModel } from './openai.adapter';

export { AnthropicAdapter } from './anthropic.adapter';
export type { AnthropicModel } from './anthropic.adapter';

export { PipedriveAdapter } from './pipedrive.adapter';
export type { PipedrivePersonResult, PipedrivePerson, PipedriveField } from './pipedrive.adapter';

export { ActionFlowAdapter } from './actionflow.adapter';
export type { ActionFlowCustomerResult, ActionFlowJob, ActionFlowCalc, CreateCustomerOptions } from './actionflow.adapter';

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

