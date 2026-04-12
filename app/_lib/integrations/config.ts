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
  'REVLINE',
  'RESEND',
  'TWILIO',
  'OPENAI',
  'ANTHROPIC',
  'PIPEDRIVE',
  'ACTIONFLOW',
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
    },
    metaDescription: 'Configure club number, then sync event types from ABC Ignite',
    metaFields: [
      { key: 'clubNumber', description: 'ABC Ignite club/location number', required: true },
      { key: 'eventTypes.*', description: 'Synced event types with category (use Sync button after saving)' },
      { key: 'defaultEventTypeId', description: 'Default event type key for workflows' },
      { key: 'memberSync.enabled', description: 'Enable hourly new member sync' },
    ],
    tips: [
      'Add your App ID and App Key, then use "Sync from ABC Ignite" to fetch event types',
      'Event types include their category (appointment vs event) from the sync',
      'Set a default event type for workflows that don\'t specify one',
      'Enable Member Sync to auto-detect new ABC members hourly — pair with a "New Member Detected" workflow',
    ],
    warnings: [
      'Club number is required for all API calls',
    ],
  },

  REVLINE: {
    id: 'REVLINE',
    name: 'revline',
    displayName: 'RevLine',
    color: 'text-amber-400',
    hasStructuredEditor: true,
    secrets: [], // No external secrets - internal system
    metaTemplate: {
      forms: {},
      settings: {
        defaultSource: '',
      },
    },
    metaDescription: 'Configure forms and RevLine settings for this client',
    metaFields: [
      { key: 'forms.*', description: 'Enabled forms with their trigger operations' },
      { key: 'settings.defaultSource', description: 'Default source identifier' },
    ],
    tips: [
      'Enable forms by adding them to the forms object',
      'Each form can specify its own trigger operation for workflow routing',
    ],
  },

  RESEND: {
    id: 'RESEND',
    name: 'resend',
    displayName: 'Resend',
    color: 'text-indigo-400',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'API Key',
        placeholder: 're_xxxxxxxxxxxxx',
        description: 'Get from Resend dashboard → API Keys',
        required: true,
      },
      {
        name: 'Webhook Secret - Delivery',
        placeholder: 'whsec_xxxxxxxxxxxxx',
        description: 'Signing secret for the delivery/event webhook endpoint (bounces, opens, clicks)',
        required: false,
      },
      {
        name: 'Webhook Secret - Inbound',
        placeholder: 'whsec_xxxxxxxxxxxxx',
        description: 'Signing secret for the inbound email webhook endpoint',
        required: false,
      },
    ],
    metaTemplate: {
      fromEmail: '',
      fromName: '',
      replyTo: '',
      templates: {},
    },
    metaDescription: 'Configure sender settings and email templates for transactional emails',
    metaFields: [
      { key: 'fromEmail', description: 'Verified sender email address', required: true },
      { key: 'fromName', description: 'Sender display name (e.g., "Sports West")' },
      { key: 'replyTo', description: 'Default reply-to address' },
      { key: 'templates.*', description: 'Named templates with Resend template ID, name, and variable definitions' },
    ],
    tips: [
      'Verify your sending domain in Resend before configuring',
      'Use fromName for branded emails: e.g., "Sports West <bookings@gym.com>"',
      'The from address must use a verified domain',
      'Create email templates in the Resend dashboard, then fetch and configure them here',
    ],
    warnings: [
      'Emails will fail if the domain is not verified in Resend',
    ],
  },

  TWILIO: {
    id: 'TWILIO',
    name: 'twilio',
    displayName: 'Twilio',
    color: 'text-red-400',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'Account SID',
        placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'From Twilio Console dashboard',
        required: true,
      },
      {
        name: 'Auth Token',
        placeholder: 'your_auth_token',
        description: 'From Twilio Console dashboard (also used for webhook signature verification)',
        required: true,
      },
    ],
    metaTemplate: {
      phoneNumbers: {},
    },
    metaDescription: 'Configure phone numbers for SMS messaging',
    metaFields: [
      { key: 'phoneNumbers.*', description: 'Named phone numbers in E.164 format with display label', required: true },
    ],
    tips: [
      'Add your Account SID and Auth Token, then use "Fetch Phone Numbers" to pull numbers from your Twilio account',
      'Webhook URL: /api/v1/twilio-webhook?source=workspace_slug',
      'Configure this webhook URL in Twilio Console → Phone Numbers → Your Number → Messaging',
    ],
    warnings: [
      'Auth Token is used for webhook signature verification — keep it secure',
    ],
  },

  OPENAI: {
    id: 'OPENAI',
    name: 'openai',
    displayName: 'OpenAI',
    color: 'text-zinc-300',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'API Key',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'From OpenAI dashboard → API Keys',
        required: true,
      },
    ],
    metaTemplate: {
      model: 'gpt-4.1-mini',
    },
    metaDescription: 'Configure model and generation settings for AI completions',
    metaFields: [
      { key: 'model', description: 'Model ID (e.g., "gpt-4.1-mini", "gpt-4o")', required: true },
      { key: 'temperature', description: 'Sampling temperature 0-2 (lower = more deterministic)' },
      { key: 'maxTokens', description: 'Maximum tokens in the completion response' },
      { key: 'organizationId', description: 'OpenAI organization ID for org-scoped API keys' },
    ],
    tips: [
      'Add your API Key, then use "Fetch Models" to see available models in your account',
      'gpt-4.1-mini is recommended for most agent use cases (fast, cheap, capable)',
      'gpt-4.1 is the flagship model for complex reasoning tasks',
      'gpt-4.1-nano is the fastest and cheapest option for simple tasks',
    ],
    warnings: [
      'API usage is billed by OpenAI based on token consumption',
    ],
  },

  ANTHROPIC: {
    id: 'ANTHROPIC',
    name: 'anthropic',
    displayName: 'Anthropic',
    color: 'text-amber-300',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'API Key',
        placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'From Anthropic Console → API Keys',
        required: true,
      },
    ],
    metaTemplate: {
      model: 'claude-sonnet-4-6',
      maxTokens: 1024,
    },
    metaDescription: 'Configure model and generation settings for Anthropic Claude completions',
    metaFields: [
      { key: 'model', description: 'Model ID (e.g., "claude-sonnet-4-6", "claude-haiku-4-5-20251001")', required: true },
      { key: 'maxTokens', description: 'Maximum tokens in the response (required by Anthropic)', required: true },
      { key: 'temperature', description: 'Sampling temperature 0-1 (lower = more deterministic)' },
    ],
    tips: [
      'Add your API Key, then use "Fetch Models" to see available models in your account',
      'claude-sonnet-4-6 is recommended for most agent use cases (balanced speed & quality)',
      'claude-opus-4-6 is the most capable model for complex reasoning',
      'claude-haiku-4-5-20251001 is the fastest and cheapest option for simple tasks',
      'max_tokens is required on every Anthropic API call — set a sensible default here',
    ],
    warnings: [
      'API usage is billed by Anthropic based on token consumption',
      'max_tokens is required — the API will reject calls without it',
    ],
  },

  PIPEDRIVE: {
    id: 'PIPEDRIVE',
    name: 'pipedrive',
    displayName: 'Pipedrive',
    color: 'text-green-500',
    hasStructuredEditor: true,
    secrets: [
      {
        name: 'API Token',
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'API token from Pipedrive Settings > Personal Preferences > API',
        required: true,
      },
    ],
    metaTemplate: {
      fieldMap: {},
      defaultPipelineId: null,
      stageMap: {},
    },
    metaDescription: 'Configure field mappings between RevLine and Pipedrive, pipeline stages, and sync behavior',
    metaFields: [
      { key: 'fieldMap.*', description: 'Map RevLine lead properties to Pipedrive person field keys' },
      { key: 'defaultPipelineId', description: 'Default pipeline ID for new deals' },
      { key: 'stageMap.*', description: 'Map RevLine lead stages to Pipedrive pipeline stage IDs' },
    ],
    tips: [
      'Find your API Token: Pipedrive Settings > Personal Preferences > API',
      'Field mappings: left = RevLine lead property key, right = Pipedrive person field key',
      'Custom Pipedrive fields use hash keys (e.g., "abc123def456") — use "Fetch Fields" to populate',
      'Pipeline stages are numeric IDs — use "Fetch Pipelines" to populate stage mappings',
    ],
    warnings: [
      'API tokens have full access to your Pipedrive account — treat like a password',
      'Rate limit: ~80 requests per 2 seconds (Professional plan)',
    ],
  },

  ACTIONFLOW: {
    id: 'ACTIONFLOW',
    name: 'actionflow',
    displayName: 'ActionFlow',
    color: 'text-sky-400',
    hasStructuredEditor: false,
    secrets: [
      {
        name: 'Client ID',
        placeholder: 'your_client_id',
        description: 'OAuth2 client_id from ActionFlow support',
        required: true,
      },
      {
        name: 'Client Secret',
        placeholder: 'your_client_secret',
        description: 'OAuth2 client_secret from ActionFlow support',
        required: true,
      },
      {
        name: 'Username',
        placeholder: 'your_username',
        description: 'ActionFlow API username',
        required: true,
      },
      {
        name: 'Password',
        placeholder: '********',
        description: 'ActionFlow API password',
        required: true,
      },
    ],
    metaTemplate: {
      enterpriseId: '',
      fieldMap: {},
    },
    metaDescription: 'Configure ActionFlow EnterpriseID and optional field mappings',
    metaFields: [
      { key: 'enterpriseId', description: 'ActionFlow EnterpriseID (required for all API calls)', required: true },
      { key: 'fieldMap.*', description: 'Map RevLine lead properties to ActionFlow customer fields' },
    ],
    tips: [
      'Contact ActionFlow support to get your Client ID, Client Secret, and EnterpriseID',
      'Token management is automatic — credentials are exchanged for a Bearer token on each session',
      'EnterpriseID is sent as a header on every API call and is required',
    ],
    warnings: [
      'All four credentials (Client ID, Client Secret, Username, Password) are required',
      'Credentials are encrypted at rest and never exposed to the client',
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
