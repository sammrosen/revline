/**
 * Email Service
 * 
 * RevLine's email delivery service using Resend.
 * Provider-agnostic - knows nothing about booking providers.
 * 
 * Features:
 * - Transactional email delivery
 * - Workspace-scoped sender addresses
 * - Event logging for debugging
 * 
 * STANDARDS:
 * - Never log email content
 * - Return IntegrationResult for consistency
 * - Emit events for audit trail
 */

import { Resend } from 'resend';
import { IntegrationResult } from '@/app/_lib/types';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { bookingConfirmationTemplate } from './templates/booking-confirm';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/** Default sender for RevLine emails */
const DEFAULT_SENDER = 'RevLine <onboarding@resend.dev>';

/** Environment-based sender (can be overridden per workspace in future) */
const SENDER_ADDRESS = process.env.EMAIL_FROM || DEFAULT_SENDER;

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
   */
  static async send(params: SendEmailParams): Promise<IntegrationResult<SendEmailResult>> {
    const { workspaceId, to, subject, html, text, replyTo } = params;

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, email not sent');
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'email_send_skipped',
        success: false,
        errorMessage: 'RESEND_API_KEY not configured',
      });
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_ADDRESS,
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
   * Check if email service is configured
   */
  static isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }
}

// Export types
export type { IntegrationResult };
