/**
 * Resilient HTTP Client
 * 
 * Provides reliable HTTP requests with timeouts, smart retries, and backoff.
 * 
 * STANDARDS:
 * - Per-request timeout with AbortController
 * - Overall deadline for all retries
 * - Exponential backoff with jitter
 * - Smart retry logic: only retry network errors, 5xx, 408, 429
 * - Respect Retry-After header
 * - Never retry 4xx errors (except 408/429)
 */

import {
  ResilientFetchOptions,
  ResilientFetchResult,
  logStructured,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_OPTIONS: Required<ResilientFetchOptions> = {
  timeout: 10000,      // 10 seconds per request
  deadline: 30000,     // 30 seconds total
  retries: 3,          // 3 retry attempts
  backoffMs: 1000,     // 1 second initial backoff
  jitter: true,        // Add randomness
};

// =============================================================================
// MAIN RESILIENT FETCH
// =============================================================================

/**
 * Fetch with resilience: timeouts, retries, and smart backoff
 * 
 * @param url - URL to fetch
 * @param init - Fetch init options
 * @param options - Resilience options
 * @returns Response with metadata about attempts
 * 
 * @example
 * const { response, attempts } = await resilientFetch(
 *   'https://api.mailerlite.com/api/v2/subscribers',
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ email: 'user@example.com' }),
 *   },
 *   { timeout: 5000, retries: 3 }
 * );
 */
export async function resilientFetch(
  url: string,
  init?: RequestInit,
  options?: ResilientFetchOptions
): Promise<ResilientFetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  const deadlineTime = startTime + opts.deadline;
  
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts < opts.retries + 1) {
    attempts++;
    
    // Check if we've exceeded the deadline
    const now = Date.now();
    if (now >= deadlineTime) {
      throw new ResilientFetchError(
        'Deadline exceeded',
        'DEADLINE_EXCEEDED',
        attempts,
        now - startTime,
        lastError
      );
    }

    // Calculate remaining time for this request
    const remainingTime = deadlineTime - now;
    const requestTimeout = Math.min(opts.timeout, remainingTime);

    try {
      const response = await fetchWithTimeout(url, init, requestTimeout);
      
      // Check if we should retry based on status code
      if (shouldRetry(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        
        // Check for Retry-After header
        const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
        
        if (attempts <= opts.retries) {
          const backoff = retryAfter || calculateBackoff(attempts, opts.backoffMs, opts.jitter);
          
          logStructured({
            correlationId: crypto.randomUUID(),
            event: 'resilient_fetch_retry',
            metadata: {
              url: sanitizeUrl(url),
              status: response.status,
              attempt: attempts,
              backoffMs: backoff,
            },
          });
          
          // Don't wait longer than remaining deadline
          const waitTime = Math.min(backoff, deadlineTime - Date.now());
          if (waitTime > 0) {
            await sleep(waitTime);
          }
          continue;
        }
      }
      
      // Success or non-retryable error - return the response
      return {
        response,
        attempts,
        totalTimeMs: Date.now() - startTime,
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a timeout (AbortError)
      if (lastError.name === 'AbortError') {
        logStructured({
          correlationId: crypto.randomUUID(),
          event: 'resilient_fetch_timeout',
          metadata: {
            url: sanitizeUrl(url),
            attempt: attempts,
            timeoutMs: requestTimeout,
          },
        });
      }
      
      // Network errors are retryable
      if (attempts <= opts.retries) {
        const backoff = calculateBackoff(attempts, opts.backoffMs, opts.jitter);
        
        logStructured({
          correlationId: crypto.randomUUID(),
          event: 'resilient_fetch_error',
          error: lastError.message,
          metadata: {
            url: sanitizeUrl(url),
            attempt: attempts,
            backoffMs: backoff,
          },
        });
        
        const waitTime = Math.min(backoff, deadlineTime - Date.now());
        if (waitTime > 0) {
          await sleep(waitTime);
        }
        continue;
      }
      
      throw new ResilientFetchError(
        lastError.message,
        'NETWORK_ERROR',
        attempts,
        Date.now() - startTime,
        lastError
      );
    }
  }

  // Should not reach here, but handle it
  throw new ResilientFetchError(
    'Max retries exceeded',
    'MAX_RETRIES',
    attempts,
    Date.now() - startTime,
    lastError
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Determine if we should retry based on HTTP status code
 * 
 * Retry: Network errors, 5xx, 408 (Request Timeout), 429 (Too Many Requests)
 * Do NOT retry: Other 4xx (client errors)
 */
function shouldRetry(status: number): boolean {
  // Server errors - always retry
  if (status >= 500) return true;
  
  // Specific retryable 4xx errors
  if (status === 408) return true; // Request Timeout
  if (status === 429) return true; // Too Many Requests (rate limited)
  
  // All other 4xx are client errors - don't retry
  return false;
}

/**
 * Calculate exponential backoff with optional jitter
 */
function calculateBackoff(
  attempt: number,
  baseMs: number,
  jitter: boolean
): number {
  // Exponential: baseMs * 2^(attempt-1)
  const exponential = baseMs * Math.pow(2, attempt - 1);
  
  // Cap at 30 seconds
  const capped = Math.min(exponential, 30000);
  
  // Add jitter: random value between 50% and 100% of calculated backoff
  if (jitter) {
    return Math.floor(capped * (0.5 + Math.random() * 0.5));
  }
  
  return capped;
}

/**
 * Parse Retry-After header
 * Returns milliseconds to wait, or null if not present/invalid
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  
  // Try parsing as seconds (number)
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  
  // Try parsing as HTTP date
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const waitMs = date - Date.now();
    return waitMs > 0 ? waitMs : null;
  }
  
  return null;
}

/**
 * Sanitize URL for logging (remove sensitive params)
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common sensitive params
    ['api_key', 'apikey', 'token', 'secret', 'password'].forEach(param => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class ResilientFetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'DEADLINE_EXCEEDED' | 'NETWORK_ERROR' | 'MAX_RETRIES',
    public readonly attempts: number,
    public readonly totalTimeMs: number,
    public readonly cause?: Error | null
  ) {
    super(message);
    this.name = 'ResilientFetchError';
  }
}

// =============================================================================
// CONVENIENCE WRAPPERS
// =============================================================================

/**
 * Resilient JSON POST request
 */
export async function resilientJsonPost<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: ResilientFetchOptions
): Promise<{ data: T; attempts: number; totalTimeMs: number }> {
  const { response, attempts, totalTimeMs } = await resilientFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    },
    options
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json() as T;
  return { data, attempts, totalTimeMs };
}

/**
 * Resilient JSON GET request
 */
export async function resilientJsonGet<T>(
  url: string,
  headers?: Record<string, string>,
  options?: ResilientFetchOptions
): Promise<{ data: T; attempts: number; totalTimeMs: number }> {
  const { response, attempts, totalTimeMs } = await resilientFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    },
    options
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json() as T;
  return { data, attempts, totalTimeMs };
}
