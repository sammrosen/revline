/**
 * Twilio Integration Adapter
 * 
 * Handles Twilio SMS operations for a specific workspace.
 * Configuration includes phone numbers stored in integration meta.
 * 
 * Secret names:
 * - "Account SID" - Required for API calls and webhook verification
 * - "Auth Token" - Required for API calls and webhook verification
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 * - Uses official Twilio SDK for signature validation (parameters evolve without notice)
 */

import { IntegrationType } from '@prisma/client';
import twilio from 'twilio';
import { BaseIntegrationAdapter } from './base';
import { TwilioMeta, IntegrationResult, WebhookVerification } from '@/app/_lib/types';

export const TWILIO_ACCOUNT_SID_SECRET = 'Account SID';
export const TWILIO_AUTH_TOKEN_SECRET = 'Auth Token';

export interface SendSmsResult {
  messageSid: string;
  segmentCount: number;
}

export interface SendSmsParams {
  to: string;
  body: string;
  /** Key from TwilioMeta.phoneNumbers to use as sender (uses default if not provided) */
  from?: string;
}

/**
 * Parsed fields from a Twilio inbound SMS webhook
 */
export interface TwilioWebhookPayload {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numSegments: number;
  optOutType?: string;
}

/**
 * Twilio adapter for workspace-scoped SMS operations
 * 
 * @example
 * const adapter = await TwilioAdapter.forWorkspace(workspaceId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const result = await adapter.sendSms({
 *   to: '+15551234567',
 *   body: 'Hello from RevLine!',
 * });
 */
export class TwilioAdapter extends BaseIntegrationAdapter<TwilioMeta> {
  readonly type = IntegrationType.TWILIO;

  private twilioClient: twilio.Twilio | null = null;

  /**
   * Load Twilio adapter for a workspace
   */
  static async forWorkspace(workspaceId: string): Promise<TwilioAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<TwilioMeta>(
      workspaceId,
      IntegrationType.TWILIO
    );

    if (!data) {
      return null;
    }

    if (data.secrets.length < 2) {
      console.warn('Twilio integration requires Account SID and Auth Token:', { workspaceId });
      return null;
    }

    return new TwilioAdapter(workspaceId, data.secrets, data.meta);
  }

  private getAccountSid(): string {
    return this.getSecret(TWILIO_ACCOUNT_SID_SECRET) || this.getPrimarySecret();
  }

  private getAuthToken(): string {
    const token = this.getSecret(TWILIO_AUTH_TOKEN_SECRET);
    if (!token) {
      throw new Error('Auth Token not configured for Twilio integration');
    }
    return token;
  }

  private getClient(): twilio.Twilio {
    if (!this.twilioClient) {
      this.twilioClient = twilio(this.getAccountSid(), this.getAuthToken());
    }
    return this.twilioClient;
  }

  // ===========================================================================
  // PHONE NUMBER RESOLUTION
  // ===========================================================================

  /**
   * Get a phone number by key from meta, or the default phone number
   */
  getPhoneNumber(key?: string): string | null {
    if (!this.meta?.phoneNumbers) return null;

    const resolvedKey = key || this.meta.defaultPhoneNumber;
    if (!resolvedKey) {
      const keys = Object.keys(this.meta.phoneNumbers);
      if (keys.length === 0) return null;
      return this.meta.phoneNumbers[keys[0]].number;
    }

    return this.meta.phoneNumbers[resolvedKey]?.number || null;
  }

  getDefaultPhoneNumber(): string | null {
    return this.getPhoneNumber();
  }

  // ===========================================================================
  // SMS OPERATIONS
  // ===========================================================================

  /**
   * Send an SMS message via Twilio
   */
  async sendSms(params: SendSmsParams): Promise<IntegrationResult<SendSmsResult>> {
    const { to, body, from } = params;

    try {
      const fromNumber = this.getPhoneNumber(from);
      if (!fromNumber) {
        return this.error('No phone number configured in Twilio integration meta');
      }

      const client = this.getClient();
      const message = await client.messages.create({
        to,
        from: fromNumber,
        body,
      });

      await this.touch();
      return this.success({
        messageSid: message.sid,
        segmentCount: parseInt(message.numSegments || '1', 10),
      });

    } catch (error) {
      console.error('Twilio sendSms error:', {
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
  // WEBHOOK VERIFICATION
  // ===========================================================================

  /**
   * Verify a Twilio webhook request using the official SDK.
   * 
   * Twilio signs requests with HMAC-SHA1 using the Auth Token. The SDK's
   * validateRequest() is the recommended approach since Twilio may add
   * parameters to webhooks without notice.
   * 
   * @param url - The exact webhook URL Twilio sent the request to
   * @param params - All POST parameters from the request body
   * @param signature - The X-Twilio-Signature header value
   */
  verifyWebhook(
    url: string,
    params: Record<string, string>,
    signature: string
  ): WebhookVerification {
    try {
      const authToken = this.getAuthToken();
      const isValid = twilio.validateRequest(authToken, signature, url, params);

      if (!isValid) {
        return { valid: false, error: 'Twilio signature verification failed' };
      }

      return { valid: true, payload: params };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signature verification error';
      return { valid: false, error: msg };
    }
  }

  /**
   * Parse inbound SMS fields from Twilio webhook POST parameters
   */
  static parseWebhookPayload(params: Record<string, string>): TwilioWebhookPayload {
    return {
      messageSid: params.MessageSid || params.SmsSid || '',
      from: params.From || '',
      to: params.To || '',
      body: params.Body || '',
      numSegments: parseInt(params.NumSegments || '1', 10),
      optOutType: params.OptOutType || undefined,
    };
  }

  // ===========================================================================
  // CONFIGURATION VALIDATION
  // ===========================================================================

  isConfigured(): boolean {
    return !!this.getDefaultPhoneNumber();
  }

  isWebhookConfigured(): boolean {
    return this.hasSecret(TWILIO_AUTH_TOKEN_SECRET);
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.meta?.phoneNumbers || Object.keys(this.meta.phoneNumbers).length === 0) {
      errors.push('At least one phone number must be configured');
    }

    if (this.meta?.phoneNumbers) {
      for (const [key, phone] of Object.entries(this.meta.phoneNumbers)) {
        if (!phone.number || !phone.number.startsWith('+')) {
          errors.push(`Phone number "${key}" must be in E.164 format (e.g., +15551234567)`);
        }
      }
    }

    if (this.meta?.defaultPhoneNumber && this.meta.phoneNumbers) {
      if (!this.meta.phoneNumbers[this.meta.defaultPhoneNumber]) {
        errors.push(`Default phone number key "${this.meta.defaultPhoneNumber}" not found in phoneNumbers`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
