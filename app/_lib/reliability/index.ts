/**
 * Reliability Infrastructure
 * 
 * Core reliability patterns for production-grade webhook handling,
 * idempotent execution, and resilient external API calls.
 * 
 * ## Components
 * 
 * - **WebhookProcessor**: Event deduplication and raw payload storage
 * - **IdempotentExecutor**: Ensures actions execute exactly once
 * - **ResilientClient**: HTTP client with timeouts, retries, backoff
 * 
 * ## Usage
 * 
 * ```typescript
 * import {
 *   WebhookProcessor,
 *   executeIdempotent,
 *   generateIdempotencyKey,
 *   resilientFetch,
 * } from '@/app/_lib/reliability';
 * ```
 */

// Webhook Processor
export {
  WebhookProcessor,
  extractProviderEventId,
  shouldSkipDuplicate,
} from './webhook-processor';

// Idempotent Executor
export {
  executeIdempotent,
  generateIdempotencyKey,
  generateWorkflowIdempotencyKey,
  cleanupExpiredKeys,
} from './idempotent-executor';

// Resilient Client
export {
  resilientFetch,
  resilientJsonPost,
  resilientJsonGet,
  ResilientFetchError,
} from './resilient-client';

// Types
export type {
  WebhookProvider,
  WebhookEventStatus,
  WebhookRegistration,
  WebhookRegistrationResult,
  WebhookProcessingResult,
  IdempotencyResult,
  IdempotencyOptions,
  ResilientFetchOptions,
  ResilientFetchResult,
  CorrelationContext,
  StructuredLogEntry,
} from './types';

export { logStructured } from './types';
