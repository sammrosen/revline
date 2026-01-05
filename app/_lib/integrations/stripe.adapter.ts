/**
 * Stripe Integration Adapter
 * 
 * Handles Stripe webhook verification and event parsing for a specific client.
 * The webhook signing secret is stored encrypted per-client.
 * 
 * Secret names:
 * - "Webhook Secret" - Required for webhook verification (whsec_...)
 * - "API Key" - Optional, for API calls (uses env STRIPE_API_KEY if not set)
 * 
 * STANDARDS:
 * - Always verify webhook signatures before processing
 * - Never expose webhook secrets in logs or responses
 * - Return structured results for all operations
 */

import Stripe from 'stripe';
import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { StripeMeta, IntegrationResult } from '@/app/_lib/types';

/** Default secret names for Stripe */
export const STRIPE_WEBHOOK_SECRET = 'Webhook Secret';
export const STRIPE_API_KEY_SECRET = 'API Key';

/**
 * Extracted checkout session data
 */
export interface CheckoutData {
  email: string;
  name?: string;
  program?: string;
  sessionId: string;
  customerId?: string;
  amountTotal?: number;
  currency?: string;
}

/**
 * Stripe webhook event wrapper
 */
export interface VerifiedWebhookEvent {
  event: Stripe.Event;
  type: string;
  isCheckoutCompleted: boolean;
}

/**
 * Stripe adapter for client-scoped webhook operations
 * 
 * @example
 * const adapter = await StripeAdapter.forClient(clientId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const verification = await adapter.verifyWebhook(payload, signature);
 * if (!verification.success) {
 *   return ApiResponse.error('Invalid signature', 400);
 * }
 */
export class StripeAdapter extends BaseIntegrationAdapter<StripeMeta> {
  readonly type = IntegrationType.STRIPE;

  private _stripe: Stripe | null = null;

  /**
   * Load Stripe adapter for a client
   */
  static async forClient(clientId: string): Promise<StripeAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<StripeMeta>(
      clientId,
      IntegrationType.STRIPE
    );
    
    if (!data) {
      return null;
    }

    // Ensure at least one secret exists (webhook secret)
    if (data.secrets.length === 0) {
      console.warn('Stripe integration has no secrets configured:', { clientId });
      return null;
    }
    
    return new StripeAdapter(clientId, data.secrets, data.meta);
  }

  /**
   * Get the webhook signing secret
   */
  private getWebhookSecret(): string {
    const secret = this.getSecret(STRIPE_WEBHOOK_SECRET) || this.getPrimarySecret();
    return secret;
  }

  /**
   * Get or create Stripe client instance
   * Uses API key from secrets, meta, or environment
   */
  private getStripeClient(): Stripe {
    if (this._stripe) {
      return this._stripe;
    }

    // Priority: secrets -> meta -> env
    const apiKey = this.getSecret(STRIPE_API_KEY_SECRET) 
      || this.meta?.apiKey 
      || process.env.STRIPE_API_KEY;
      
    if (!apiKey) {
      throw new Error('Stripe API key not configured');
    }

    this._stripe = new Stripe(apiKey);
    return this._stripe;
  }

  /**
   * Verify a webhook signature and parse the event
   * 
   * @param payload - Raw request body as string
   * @param signature - stripe-signature header value
   */
  async verifyWebhook(
    payload: string,
    signature: string
  ): Promise<IntegrationResult<VerifiedWebhookEvent>> {
    try {
      const stripe = this.getStripeClient();
      
      // Use the webhook signing secret
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.getWebhookSecret()
      );

      await this.touch();

      return this.success({
        event,
        type: event.type,
        isCheckoutCompleted: event.type === 'checkout.session.completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't log the actual signature or secret
      console.error('Stripe webhook verification failed:', {
        clientId: this.clientId,
        error: message,
      });

      return this.error(`Webhook signature verification failed: ${message}`);
    }
  }

  /**
   * Extract customer data from a checkout.session.completed event
   * 
   * @param event - Verified Stripe event
   */
  extractCheckoutData(event: Stripe.Event): IntegrationResult<CheckoutData> {
    if (event.type !== 'checkout.session.completed') {
      return this.error(`Expected checkout.session.completed, got ${event.type}`);
    }

    const session = event.data.object as Stripe.Checkout.Session;
    
    // Get email from customer_details or customer_email
    const email = session.customer_details?.email || session.customer_email;
    if (!email) {
      return this.error('No customer email found in checkout session');
    }

    return this.success({
      email,
      name: session.customer_details?.name || undefined,
      program: session.metadata?.program || undefined,
      sessionId: session.id,
      customerId: typeof session.customer === 'string' 
        ? session.customer 
        : session.customer?.id,
      amountTotal: session.amount_total || undefined,
      currency: session.currency || undefined,
    });
  }

  /**
   * Convenience method to verify and extract checkout data in one call
   */
  async processCheckoutWebhook(
    payload: string,
    signature: string
  ): Promise<IntegrationResult<CheckoutData | null>> {
    // Verify signature
    const verification = await this.verifyWebhook(payload, signature);
    if (!verification.success || !verification.data) {
      return this.error(verification.error || 'Verification failed');
    }

    // Check if it's a checkout event
    if (!verification.data.isCheckoutCompleted) {
      // Not a checkout event - return null data but success
      return this.success(null);
    }

    // Extract checkout data
    return this.extractCheckoutData(verification.data.event);
  }

  /**
   * Check if Stripe API key is configured
   */
  hasApiKey(): boolean {
    return !!(
      this.hasSecret(STRIPE_API_KEY_SECRET) || 
      this.meta?.apiKey || 
      process.env.STRIPE_API_KEY
    );
  }

  /**
   * Check if the integration is properly configured
   */
  isConfigured(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.hasApiKey()) {
      missing.push('Stripe API key');
    }
    // Webhook secret is required and checked in forClient

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
