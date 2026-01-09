/**
 * Integration Configuration - Single Source of Truth
 * 
 * This file defines all available integrations and their metadata.
 * Import from '@/app/_lib/integrations/config' in both frontend and backend.
 * 
 * STANDARDS:
 * - Add new integrations here ONLY
 * - Frontend forms read from this config
 * - Backend validation uses this config
 * - Never hardcode integration types elsewhere
 */

/**
 * Integration type identifiers
 * Must match Prisma IntegrationType enum exactly
 */
export const INTEGRATION_TYPES = [
  'MAILERLITE',
  'STRIPE', 
  'CALENDLY',
  'MANYCHAT',
  'ABC_IGNITE',
] as const;

export type IntegrationTypeId = typeof INTEGRATION_TYPES[number];

/**
 * Secret configuration for each integration
 */
export interface SecretConfig {
  name: string;
  placeholder: string;
  description: string;
  required?: boolean;
}

/**
 * Meta field configuration
 */
export interface MetaFieldConfig {
  key: string;
  description: string;
  required?: boolean;
}

/**
 * Full integration configuration
 */
export interface IntegrationConfig {
  id: IntegrationTypeId;
  name: string;
  displayName: string;
  color: string;
  secrets: SecretConfig[];
  metaTemplate: Record<string, unknown>;
  metaDescription: string;
  metaFields: MetaFieldConfig[];
  tips: string[];
  warnings?: string[];
  hasStructuredEditor?: boolean;
}

/**
 * All integration configurations
 */
export const INTEGRATIONS: Record<IntegrationTypeId, IntegrationConfig> = {
  MAILERLITE: {
    id: 'MAILERLITE',
    name: 'mailerlite',
    displayName: 'MailerLite',
    color: 'text-green-400',
    secrets: [
      {
        name: 'API Key',
        placeholder: 'mlsk_xxxxxxxxxxxxx',
        description: 'Get from MailerLite → Settings → API',
        required: true,
      },
    ],
    hasStructuredEditor: true,
    metaTemplate: {
      groups: {
        welcome: { id: '123456', name: 'Welcome List' },
        customers: { id: '789012', name: 'Paying Customers' },
      },
    },
    metaDescription: 'Configure named groups and route actions to them',
    metaFields: [
      { key: 'groups.*', description: 'Named groups with MailerLite ID and display name', required: true },
    ],
    tips: [
      'Use the structured editor for easier configuration',
      'Get group IDs from MailerLite URL: /groups/123456 → ID is 123456',
    ],
    warnings: [
      'Never put API keys in meta - they go in the Secret field',
    ],
  },

  STRIPE: {
    id: 'STRIPE',
    name: 'stripe',
    displayName: 'Stripe',
    color: 'text-purple-400',
    secrets: [
      {
        name: 'Webhook Secret',
        placeholder: 'whsec_xxxxxxxxxxxxx',
        description: 'From Developers → Webhooks → Your endpoint → Signing secret',
        required: true,
      },
      {
        name: 'API Key',
        placeholder: 'sk_live_xxxxxxxxxxxxx',
        description: 'Optional: Stripe API key (uses env default if not set)',
        required: false,
      },
    ],
    metaTemplate: {
      products: {},
    },
    metaDescription: 'Usually empty - Stripe payment routing is handled via MailerLite config',
    metaFields: [
      { key: 'productMap', description: 'Optional: Map price IDs to program names' },
    ],
    tips: [
      'Webhook URL: /api/stripe-webhook?source=client_slug',
      'Event to subscribe: checkout.session.completed',
    ],
    warnings: [
      'Webhook secret is shown only once - save it!',
    ],
  },

  CALENDLY: {
    id: 'CALENDLY',
    name: 'calendly',
    displayName: 'Calendly',
    color: 'text-cyan-400',
    secrets: [
      {
        name: 'Webhook Secret',
        placeholder: 'your_signing_key_from_calendly',
        description: 'From Integrations → Webhooks → Your endpoint',
        required: true,
      },
    ],
    metaTemplate: {
      schedulingUrls: {
        discovery: 'https://calendly.com/yourname/30min',
      },
    },
    metaDescription: 'Store scheduling URLs and configuration flags',
    metaFields: [
      { key: 'schedulingUrls.*', description: 'Named URLs for different call types' },
    ],
    tips: [
      'Webhook URL: /api/calendly-webhook',
      'Subscribe to: invitee.created, invitee.canceled',
      'Calendly links should include utm_source=client_slug',
    ],
  },

  MANYCHAT: {
    id: 'MANYCHAT',
    name: 'manychat',
    displayName: 'ManyChat',
    color: 'text-blue-400',
    secrets: [
      {
        name: 'API Key',
        placeholder: 'your_manychat_api_token',
        description: 'From ManyChat → Settings → API',
        required: true,
      },
    ],
    metaTemplate: {
      flowIds: {
        welcome: 'flow_123456',
      },
    },
    metaDescription: 'Store flow IDs and tag mappings for automation',
    metaFields: [
      { key: 'flowIds.*', description: 'Named flow IDs for different automations' },
    ],
    tips: [
      'ManyChat is primarily a traffic driver to landing pages',
      'Use UTM parameters to track ManyChat traffic sources',
    ],
  },

  ABC_IGNITE: {
    id: 'ABC_IGNITE',
    name: 'abc_ignite',
    displayName: 'ABC Ignite',
    color: 'text-orange-400',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'App ID',
        placeholder: 'your_app_id',
        description: 'app_id from ABC Ignite API credentials',
        required: true,
      },
      {
        name: 'App Key',
        placeholder: 'your_app_key',
        description: 'app_key from ABC Ignite API credentials',
        required: true,
      },
    ],
    metaTemplate: {
      clubNumber: '',
      defaultEventTypeId: '',
    },
    metaDescription: 'Configure club number and default event settings',
    metaFields: [
      { key: 'clubNumber', description: 'ABC Ignite club/location number', required: true },
      { key: 'defaultEventTypeId', description: 'Default event type for bookings (optional)' },
      { key: 'eventTypes.*', description: 'Named event types for workflow actions' },
    ],
    tips: [
      'Get clubNumber from your ABC Ignite admin dashboard',
      'app_id and app_key are sent as headers on every request',
      'Event types can be fetched via the API once configured',
    ],
    warnings: [
      'Club number is required for all API calls',
    ],
  },
};

/**
 * Get integration config by ID
 */
export function getIntegrationConfig(id: IntegrationTypeId): IntegrationConfig | undefined {
  return INTEGRATIONS[id];
}

/**
 * Get all integration IDs
 */
export function getIntegrationIds(): IntegrationTypeId[] {
  return [...INTEGRATION_TYPES];
}

/**
 * Get secret names for an integration
 */
export function getSecretNames(id: IntegrationTypeId): string[] {
  const config = INTEGRATIONS[id];
  return config?.secrets.map(s => s.name) ?? [];
}

/**
 * Get default meta template for an integration
 */
export function getDefaultMeta(id: IntegrationTypeId): string {
  const config = INTEGRATIONS[id];
  return config ? JSON.stringify(config.metaTemplate, null, 2) : '{}';
}

/**
 * Check if integration type is valid
 */
export function isValidIntegrationType(type: string): type is IntegrationTypeId {
  return INTEGRATION_TYPES.includes(type as IntegrationTypeId);
}
