/**
 * Email Service
 * 
 * RevLine's email delivery service using Resend.
 * Provider-agnostic - knows nothing about booking providers.
 * 
 * Features:
 * - Transactional email delivery
 * - Workspace-scoped sender addresses (via Resend integration)
 * - Fallback to environment variables if no workspace integration
 * - Event logging for debugging
 * 
 * STANDARDS:
 * - Never log email content
 * - Return IntegrationResult for consistency
 * - Emit events for audit trail
 * - Try workspace Resend integration first, then fall back to env vars
 */

import { Resend } from 'resend';
import { IntegrationResult } from '@/app/_lib/types';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { bookingConfirmationTemplate } from './templates/booking-confirm';
import { ResendAdapter } from '@/app/_lib/integrations';

// Lazy-initialize fallback Resend client to avoid build-time errors
// (RESEND_API_KEY may not be available during Next.js static build)
let _fallbackResend: Resend | null = null;
function getFallbackResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!_fallbackResend) {
    _fallbackResend = new Resend(process.env.RESEND_API_KEY);
  }
  return _fallbackResend;
}

/** Default sender for RevLine emails */
const DEFAULT_SENDER = 'RevLine <onboarding@resend.dev>';

/** Environment-based sender (used when no workspace integration) */
const FALLBACK_SENDER = process.env.EMAIL_FROM || DEFAULT_SENDER;

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  messageId: string;
}

/**
 * Parameters for sending a booking confirmation email
 */
export interface BookingConfirmationParams {
  workspaceId: string;
  workspaceName: string;
  to: string;
  confirmUrl: string;
  staffName: string;
  serviceName: string;
  sessionTime: string;
  expiryMinutes?: number;
}

/**
 * Parameters for sending a generic email
 */
export interface SendEmailParams {
  workspaceId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Email Service
 * 
 * Stateless service for sending transactional emails.
 * Uses Resend under the hood with consistent error handling.
 */
export class EmailService {
  /**
   * Send a booking confirmation email with magic link
   */
  static async sendBookingConfirmation(
    params: BookingConfirmationParams
  ): Promise<IntegrationResult<SendEmailResult>> {
    const { 
      workspaceId, 
      workspaceName, 
      to, 
      confirmUrl, 
      staffName, 
      serviceName,
      sessionTime,
      expiryMinutes = 15,
    } = params;

    // Generate email content from template
    const { subject, html, text } = bookingConfirmationTemplate({
      workspaceName,
      staffName,
      serviceName,
      sessionTime,
      confirmUrl,
      expiryMinutes,
    });

    return this.send({
      workspaceId,
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Send a generic email
   * 
   * Priority:
   * 1. Use workspace Resend integration if configured
   * 2. Fall back to RESEND_API_KEY and EMAIL_FROM env vars
   */
  static async send(params: SendEmailParams): Promise<IntegrationResult<SendEmailResult>> {
    const { workspaceId, to, subject, html, text, replyTo } = params;

    // Try workspace-scoped Resend integration first
    const adapter = await ResendAdapter.forWorkspace(workspaceId);
    if (adapter && adapter.isConfigured()) {
      // Use workspace integration
      const result = await adapter.sendEmail({
        to,
        subject,
        html,
        text,
        replyTo,
      });

      // Emit event using RESEND system (adapter already logs internally)
      // We emit an additional backend event for the email service layer
      if (result.success) {
        await emitEvent({
          workspaceId,
          system: EventSystem.BACKEND,
          eventType: 'email_sent',
          success: true,
        });
      }

      return result;
    }

    // Fall back to environment variable configuration
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured and no workspace Resend integration, email not sent');
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'email_send_skipped',
        success: false,
        errorMessage: 'Email service not configured (no RESEND_API_KEY or workspace integration)',
      });
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const resendClient = getFallbackResend();
      if (!resendClient) {
        return { success: false, error: 'Resend client not available' };
      }
      
      const { data, error } = await resendClient.emails.send({
        from: FALLBACK_SENDER,
        to,
        subject,
        html,
        text,
        replyTo,
      });

      if (error) {
        console.error('Resend API error:', {
          workspaceId,
          error: error.message,
        });

        await emitEvent({
          workspaceId,
          system: EventSystem.BACKEND,
          eventType: 'email_send_failed',
          success: false,
          errorMessage: error.message,
        });

        return {
          success: false,
          error: error.message,
        };
      }

      // Log success (no PII - just message ID)
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'email_sent',
        success: true,
      });

      return {
        success: true,
        data: { messageId: data?.id || 'unknown' },
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Email send error:', {
        workspaceId,
        error: message,
      });

      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'email_send_failed',
        success: false,
        errorMessage: message,
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Check if email service is configured for a workspace
   * Returns true if either workspace integration or env var is configured
   */
  static async isConfiguredForWorkspace(workspaceId: string): Promise<boolean> {
    // Check workspace integration first
    const adapter = await ResendAdapter.forWorkspace(workspaceId);
    if (adapter && adapter.isConfigured()) {
      return true;
    }
    // Fall back to env var check
    return !!process.env.RESEND_API_KEY;
  }

  /**
   * Check if email service is configured (env var only)
   * @deprecated Use isConfiguredForWorkspace for workspace-aware check
   */
  static isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }
}

// Export types
export type { IntegrationResult };
