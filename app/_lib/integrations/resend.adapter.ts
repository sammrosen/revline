/**
 * Resend Integration Adapter
 * 
 * Handles Resend API operations for a specific workspace.
 * Configuration includes sender settings and template references stored in integration meta.
 * 
 * Secret names:
 * - "API Key" - Required for all operations
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes API key outside this module
 */

import { IntegrationType } from '@prisma/client';
import { Resend } from 'resend';
import { Webhook } from 'svix';
import { BaseIntegrationAdapter } from './base';
import { ResendMeta, ResendTemplate, IntegrationResult, WebhookVerification } from '@/app/_lib/types';

/** Default secret name for Resend API key */
export const RESEND_API_KEY_SECRET = 'API Key';
/** Secret name for Resend webhook signing secret */
export const RESEND_WEBHOOK_SECRET = 'Webhook Secret';

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  messageId: string;
}

/**
 * Parameters for sending an email (inline HTML mode)
 */
export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Override from email (uses config default if not provided) */
  fromEmail?: string;
  /** Override from name (uses config default if not provided) */
  fromName?: string;
}

/**
 * Parameters for sending an email using a Resend template
 */
export interface SendTemplateParams {
  to: string | string[];
  /** Resend template ID (UUID) */
  templateId: string;
  /** Template variables as key-value pairs */
  variables?: Record<string, string | number>;
  /** Optional subject override (takes precedence over template default) */
  subject?: string;
  /** Optional reply-to override */
  replyTo?: string;
}

/**
 * A remote template fetched from the Resend API
 */
export interface RemoteResendTemplate {
  id: string;
  name: string;
  variables?: Array<{ key: string; type: string; fallbackValue?: string | number }>;
}

/**
 * Resend adapter for workspace-scoped operations
 * 
 * @example
 * const adapter = await ResendAdapter.forWorkspace(workspaceId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const result = await adapter.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Confirm your booking',
 *   html: '<p>Click to confirm...</p>',
 * });
 */
export class ResendAdapter extends BaseIntegrationAdapter<ResendMeta> {
  readonly type = IntegrationType.RESEND;

  /** Cached Resend client instance */
  private resendClient: Resend | null = null;

  /**
   * Load Resend adapter for a workspace
   */
  static async forWorkspace(workspaceId: string): Promise<ResendAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<ResendMeta>(
      workspaceId,
      IntegrationType.RESEND
    );
    
    if (!data) {
      return null;
    }

    // Ensure API key secret exists
    if (data.secrets.length === 0) {
      console.warn('Resend integration has no secrets configured:', { workspaceId });
      return null;
    }
    
    return new ResendAdapter(workspaceId, data.secrets, data.meta);
  }

  /**
   * Alias for forWorkspace for consistency with other adapters
   */
  static async forClient(clientId: string): Promise<ResendAdapter | null> {
    return ResendAdapter.forWorkspace(clientId);
  }

  /**
   * Get the API key for Resend operations
   */
  private getApiKey(): string {
    const apiKey = this.getSecret(RESEND_API_KEY_SECRET) || this.getPrimarySecret();
    return apiKey;
  }

  /**
   * Get or create the Resend client instance
   */
  private getClient(): Resend {
    if (!this.resendClient) {
      this.resendClient = new Resend(this.getApiKey());
    }
    return this.resendClient;
  }

  /**
   * Get the configured from email address
   */
  getFromEmail(): string | null {
    return this.meta?.fromEmail || null;
  }

  /**
   * Get the configured from name
   */
  getFromName(): string | null {
    return this.meta?.fromName || null;
  }

  /**
   * Get the configured reply-to address
   */
  getReplyTo(): string | null {
    return this.meta?.replyTo || null;
  }

  /**
   * Build the full "from" address with name
   * @returns Format: "Name <email@domain.com>" or just "email@domain.com"
   */
  buildFromAddress(overrideEmail?: string, overrideName?: string): string {
    const email = overrideEmail || this.getFromEmail();
    const name = overrideName || this.getFromName();

    if (!email) {
      throw new Error('fromEmail is not configured in Resend integration');
    }

    if (name) {
      return `${name} <${email}>`;
    }
    return email;
  }

  /**
   * Send an email via Resend
   */
  async sendEmail(params: SendEmailParams): Promise<IntegrationResult<SendEmailResult>> {
    const { to, subject, html, text, replyTo, fromEmail, fromName } = params;

    try {
      // Build from address
      const from = this.buildFromAddress(fromEmail, fromName);

      // Use override reply-to or fall back to config
      const effectiveReplyTo = replyTo || this.getReplyTo() || undefined;

      const client = this.getClient();
      const { data, error } = await client.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        replyTo: effectiveReplyTo,
      });

      if (error) {
        console.error('Resend API error:', {
          workspaceId: this.workspaceId,
          error: error.message,
        });
        await this.markUnhealthy();
        return this.error(error.message, false);
      }

      await this.touch();
      return this.success({
        messageId: data?.id || 'unknown',
      });

    } catch (error) {
      console.error('Resend sendEmail error:', {
        workspaceId: this.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      await this.markUnhealthy();
      return this.error(
        error instanceof Error ? error.message : 'Network error or API unavailable',
        true
      );
    }
  }

  // ===========================================================================
  // TEMPLATE OPERATIONS
  // ===========================================================================

  /**
   * Get the configured templates from meta
   * Mirrors MailerLiteAdapter.getConfiguredGroups()
   */
  getConfiguredTemplates(): Record<string, ResendTemplate> {
    return this.meta?.templates ?? {};
  }

  /**
   * Get a specific template by key
   * Mirrors MailerLiteAdapter.getGroup()
   */
  getTemplate(key: string): ResendTemplate | null {
    return this.meta?.templates?.[key] ?? null;
  }

  /**
   * Check if the integration has templates configured
   * Mirrors MailerLiteAdapter.hasGroups()
   */
  hasTemplates(): boolean {
    const templates = this.meta?.templates;
    return !!templates && Object.keys(templates).length > 0;
  }

  /**
   * Send an email using a Resend template with variables
   * Uses Resend's native template system (template.id + template.variables)
   */
  async sendTemplate(params: SendTemplateParams): Promise<IntegrationResult<SendEmailResult>> {
    const { to, templateId, variables, subject, replyTo } = params;

    try {
      // Build from address
      const from = this.buildFromAddress();

      // Use override reply-to or fall back to config
      const effectiveReplyTo = replyTo || this.getReplyTo() || undefined;

      const client = this.getClient();

      // Build the send payload with Resend's native template support
      // When template is provided, html/text/react must NOT be included
      const sendPayload: Parameters<typeof client.emails.send>[0] = {
        from,
        to: Array.isArray(to) ? to : [to],
        template: {
          id: templateId,
          ...(variables && Object.keys(variables).length > 0 ? { variables } : {}),
        },
      };

      // Subject override takes precedence over template default
      if (subject) {
        sendPayload.subject = subject;
      }

      if (effectiveReplyTo) {
        sendPayload.replyTo = effectiveReplyTo;
      }

      const { data, error } = await client.emails.send(sendPayload);

      if (error) {
        console.error('Resend template API error:', {
          workspaceId: this.workspaceId,
          templateId,
          error: error.message,
        });
        await this.markUnhealthy();
        return this.error(error.message, false);
      }

      await this.touch();
      return this.success({
        messageId: data?.id || 'unknown',
      });

    } catch (error) {
      console.error('Resend sendTemplate error:', {
        workspaceId: this.workspaceId,
        templateId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      await this.markUnhealthy();
      return this.error(
        error instanceof Error ? error.message : 'Network error or API unavailable',
        true
      );
    }
  }

  /**
   * List templates from the Resend account
   * Used by the config editor to fetch available templates for selection
   */
  async listRemoteTemplates(): Promise<IntegrationResult<RemoteResendTemplate[]>> {
    try {
      const client = this.getClient();
      const { data, error } = await client.templates.list();

      if (error) {
        console.error('Resend list templates error:', {
          workspaceId: this.workspaceId,
          error: error.message,
        });
        return this.error(error.message, false);
      }

      // Map to our simplified shape
      const templates: RemoteResendTemplate[] = (data?.data || []).map((t) => ({
        id: t.id,
        name: t.name,
        // Variables may not be in the list response; they come from individual template fetch
      }));

      await this.touch();
      return this.success(templates);

    } catch (error) {
      console.error('Resend listRemoteTemplates error:', {
        workspaceId: this.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error(
        error instanceof Error ? error.message : 'Network error or API unavailable',
        true
      );
    }
  }

  /**
   * Fetch a single template's details including variables
   * Used to populate variable definitions when adding a template to config
   */
  async getRemoteTemplate(templateId: string): Promise<IntegrationResult<RemoteResendTemplate>> {
    try {
      const client = this.getClient();
      const { data, error } = await client.templates.get(templateId);

      if (error) {
        console.error('Resend get template error:', {
          workspaceId: this.workspaceId,
          templateId,
          error: error.message,
        });
        return this.error(error.message, false);
      }

      if (!data) {
        return this.error('Template not found', false);
      }

      const template: RemoteResendTemplate = {
        id: data.id,
        name: data.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: (data as any).variables,
      };

      await this.touch();
      return this.success(template);

    } catch (error) {
      console.error('Resend getRemoteTemplate error:', {
        workspaceId: this.workspaceId,
        templateId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error(
        error instanceof Error ? error.message : 'Network error or API unavailable',
        true
      );
    }
  }

  // ===========================================================================
  // WEBHOOK VERIFICATION
  // ===========================================================================

  /**
   * Get the configured webhook signing secret from secrets store
   */
  getWebhookSecret(): string | null {
    return this.getSecret(RESEND_WEBHOOK_SECRET) || null;
  }

  /**
   * Verify and parse a Resend webhook payload using Svix signature verification.
   * 
   * @param rawBody - The raw request body string (must NOT be parsed/stringified)
   * @param headers - The svix headers from the request
   * @returns Verified payload or error
   */
  verifyWebhook(
    rawBody: string,
    headers: { svixId: string; svixTimestamp: string; svixSignature: string }
  ): WebhookVerification {
    const secret = this.getWebhookSecret();
    if (!secret) {
      return { valid: false, error: 'Webhook secret not configured in Resend integration meta' };
    }

    try {
      const wh = new Webhook(secret);
      const payload = wh.verify(rawBody, {
        'svix-id': headers.svixId,
        'svix-timestamp': headers.svixTimestamp,
        'svix-signature': headers.svixSignature,
      });
      return { valid: true, payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signature verification failed';
      return { valid: false, error: msg };
    }
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Check if the integration is properly configured
   */
  isConfigured(): boolean {
    return !!this.getFromEmail();
  }

  /**
   * Check if webhook verification is configured
   */
  isWebhookConfigured(): boolean {
    return !!this.getWebhookSecret();
  }

  /**
   * Validate the meta configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.meta?.fromEmail) {
      errors.push('fromEmail is required');
    }

    // Basic email format validation
    if (this.meta?.fromEmail && !this.meta.fromEmail.includes('@')) {
      errors.push('fromEmail must be a valid email address');
    }

    if (this.meta?.replyTo && !this.meta.replyTo.includes('@')) {
      errors.push('replyTo must be a valid email address');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// =============================================================================
// RESEND WEBHOOK EVENT TYPES
// =============================================================================

/**
 * Resend webhook event payload structure.
 * Matches the JSON body Resend POSTs to webhook endpoints.
 */
export interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.complained' 
    | 'email.delivery_delayed' | 'email.failed' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    /** Present on bounce events */
    bounce?: {
      message: string;
      type: string;    // "Permanent" | "Temporary"
      subType: string; // "Suppressed" | "MessageRejected" etc.
    };
    /** Tags set when the email was sent */
    tags?: Record<string, string>;
    template_id?: string;
    broadcast_id?: string;
  };
}

/**
 * Map Resend event type to our provider-prefixed errorState value.
 * Returns null for event types that don't set an error state.
 */
export function resendEventToErrorState(eventType: string): string | null {
  switch (eventType) {
    case 'email.bounced':
      return 'resend.email_bounced';
    case 'email.complained':
      return 'resend.email_complained';
    case 'email.failed':
      return 'resend.email_failed';
    case 'email.delivery_delayed':
      return 'resend.delivery_delayed';
    default:
      return null;
  }
}

/** Error states that are transient and can be auto-cleared on delivery */
export const TRANSIENT_ERROR_STATES = new Set(['resend.delivery_delayed']);
