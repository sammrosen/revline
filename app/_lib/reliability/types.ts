/**
 * Reliability Infrastructure Types
 * 
 * Shared types for webhook processing, idempotency, and resilient HTTP clients.
 */

// =============================================================================
// WEBHOOK PROCESSOR TYPES
// =============================================================================

export type WebhookProvider = 'stripe' | 'calendly' | 'revline';

export type WebhookEventStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface WebhookRegistration {
  clientId: string;
  provider: WebhookProvider;
  providerEventId: string;
  rawBody: string;
  rawHeaders?: Record<string, string>;
}

export interface WebhookRegistrationResult {
  id: string;
  correlationId: string;
  isDuplicate: boolean;
  status: WebhookEventStatus;
}

export interface WebhookProcessingResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// IDEMPOTENCY TYPES
// =============================================================================

export type IdempotencyKeyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyResult<T> {
  executed: boolean;  // true if function was executed, false if cached result returned
  result: T;
}

export interface IdempotencyOptions {
  /** Time-to-live in milliseconds (default: 24 hours) */
  ttlMs?: number;
  /** Whether to throw on failed cached result (default: true) */
  throwOnCachedError?: boolean;
}

// =============================================================================
// RESILIENT CLIENT TYPES
// =============================================================================

export interface ResilientFetchOptions {
  /** Per-request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Total deadline for all retries in milliseconds (default: 30000) */
  deadline?: number;
  /** Maximum retry attempts (default: 3) */
  retries?: number;
  /** Initial backoff in milliseconds (default: 1000) */
  backoffMs?: number;
  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
}

export interface ResilientFetchResult {
  response: Response;
  attempts: number;
  totalTimeMs: number;
}

// =============================================================================
// CORRELATION & OBSERVABILITY
// =============================================================================

export interface CorrelationContext {
  correlationId: string;
  clientId: string;
  provider?: WebhookProvider;
}

export interface StructuredLogEntry {
  correlationId: string;
  event: string;
  clientId?: string;
  provider?: string;
  success?: boolean;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a structured event for observability
 */
export function logStructured(entry: StructuredLogEntry): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  }));
}
