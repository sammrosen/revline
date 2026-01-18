/**
 * Webhook Processor
 * 
 * Handles webhook event deduplication and raw payload storage.
 * Uses race-safe INSERT ON CONFLICT pattern for concurrent webhook retries.
 * 
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Store raw body as TEXT for signature verification
 * - Multi-tenant safe with clientId scoping
 * - All operations are idempotent
 */

import { prisma } from '@/app/_lib/db';
import { Prisma } from '@prisma/client';
import {
  WebhookProvider,
  WebhookRegistration,
  WebhookRegistrationResult,
  logStructured,
} from './types';
import { AlertService } from '@/app/_lib/alerts';

// =============================================================================
// MAIN WEBHOOK PROCESSOR CLASS
// =============================================================================

export class WebhookProcessor {
  /**
   * Register a webhook event with race-safe deduplication
   * 
   * Uses Prisma's upsert-like pattern with unique constraint handling.
   * Returns isDuplicate: true if this event was already registered.
   * 
   * @param registration - Webhook registration data
   * @returns Registration result with isDuplicate flag
   */
  static async register(
    registration: WebhookRegistration
  ): Promise<WebhookRegistrationResult> {
    const correlationId = crypto.randomUUID();
    const { workspaceId, provider, providerEventId, rawBody, rawHeaders } = registration;

    // Parse payload for convenience querying (but keep raw for verification)
    let parsedPayload: Prisma.InputJsonValue | null = null;
    try {
      parsedPayload = JSON.parse(rawBody) as Prisma.InputJsonValue;
    } catch {
      // Not valid JSON - that's fine, we still store the raw body
    }

    try {
      // Attempt to create the webhook event
      const record = await prisma.webhookEvent.create({
        data: {
          workspaceId,
          correlationId,
          provider,
          providerEventId,
          rawBody,
          rawHeaders: rawHeaders as Prisma.InputJsonValue,
          parsedPayload: parsedPayload ?? Prisma.JsonNull,
          status: 'PENDING',
        },
      });

      logStructured({
        correlationId: record.correlationId,
        event: 'webhook_received',
        workspaceId,
        provider,
        metadata: { providerEventId },
      });

      return {
        id: record.id,
        correlationId: record.correlationId,
        isDuplicate: false,
        status: record.status as WebhookRegistrationResult['status'],
      };
    } catch (error) {
      // Check for unique constraint violation (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Duplicate - fetch the existing record
        const existing = await prisma.webhookEvent.findFirst({
          where: {
            workspaceId,
            provider,
            providerEventId,
          },
        });

        if (!existing) {
          // This shouldn't happen, but handle it gracefully
          throw new Error('Failed to find existing webhook event after conflict');
        }

        logStructured({
          correlationId: existing.correlationId,
          event: 'webhook_duplicate',
          workspaceId,
          provider,
          metadata: { providerEventId },
        });

        return {
          id: existing.id,
          correlationId: existing.correlationId,
          isDuplicate: true,
          status: existing.status as WebhookRegistrationResult['status'],
        };
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Claim a webhook event for processing
   * 
   * Sets status to PROCESSING to prevent double-execution.
   * Returns false if the event is already being processed or was already processed.
   */
  static async markProcessing(id: string): Promise<boolean> {
    const result = await prisma.webhookEvent.updateMany({
      where: {
        id,
        status: 'PENDING',
      },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Mark a webhook event as successfully processed
   */
  static async markProcessed(id: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Mark a webhook event as failed and send alert
   */
  static async markFailed(id: string, error: string): Promise<void> {
    const event = await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: error.slice(0, 1000), // Truncate long errors
        processedAt: new Date(),
      },
    });

    // Send critical alert for webhook failure
    await AlertService.critical(
      'Webhook Failed',
      error.slice(0, 500),
      {
        provider: event.provider,
        workspaceId: event.workspaceId,
        eventId: event.providerEventId,
        correlationId: event.correlationId,
      }
    );
  }

  /**
   * Get a webhook event by ID
   */
  static async getById(id: string) {
    return prisma.webhookEvent.findUnique({
      where: { id },
    });
  }

  /**
   * Get pending webhook events for background processing
   * Uses FOR UPDATE SKIP LOCKED to prevent double-processing
   * 
   * Note: This is the upgrade path for async processing.
   * Currently not used (synchronous processing), but ready when needed.
   */
  static async getPendingForProcessing(limit: number = 10) {
    // Use raw query for FOR UPDATE SKIP LOCKED
    return prisma.$queryRaw<Array<{
      id: string;
      client_id: string;
      correlation_id: string;
      provider: string;
      provider_event_id: string;
      raw_body: string;
      raw_headers: Prisma.JsonValue;
      parsed_payload: Prisma.JsonValue;
    }>>`
      SELECT id, client_id, correlation_id, provider, provider_event_id, 
             raw_body, raw_headers, parsed_payload
      FROM webhook_events
      WHERE status = 'PENDING'
      ORDER BY received_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract event ID from raw body for different providers
 * Used to get the provider event ID before full parsing
 */
export function extractProviderEventId(
  provider: WebhookProvider,
  rawBody: string
): string | null {
  try {
    const payload = JSON.parse(rawBody);
    
    switch (provider) {
      case 'stripe':
        // Stripe events have an 'id' field
        return payload.id || null;
      
      case 'calendly':
        // Calendly uses event URI as unique identifier
        return payload.payload?.event || payload.payload?.uri || null;
      
      case 'revline':
        // Internal events - generate a unique ID based on content
        // For email capture, use email + timestamp
        if (payload.email) {
          return `${payload.email}-${Date.now()}`;
        }
        return `internal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Check if we should skip processing for a duplicate webhook
 * Some duplicates should be processed if they're in a retryable state
 */
export function shouldSkipDuplicate(
  status: string,
  receivedAt: Date
): boolean {
  // Always skip if already processed successfully
  if (status === 'PROCESSED') return true;
  
  // If currently processing, skip (another worker is handling it)
  if (status === 'PROCESSING') return true;
  
  // If failed, allow retry if it's been at least 5 minutes
  if (status === 'FAILED') {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return receivedAt > fiveMinutesAgo;
  }
  
  // Pending - should process
  return false;
}
