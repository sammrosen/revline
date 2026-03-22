/**
 * Retry with Exponential Backoff
 *
 * Generic retry utility for transient failures. Provider-agnostic —
 * operates on a caller-supplied `shouldRetry` predicate rather than
 * inspecting error types or status codes.
 *
 * Used by the agent engine to wrap AI adapter calls. Honors
 * server-provided Retry-After delays via `getRetryAfterMs`.
 *
 * STANDARDS:
 * - Abstraction First: standalone module, engine calls retryWithBackoff()
 * - Fail-Safe: after max attempts, returns the last result unchanged
 * - Never throws: if the wrapped function throws, the error propagates
 *   (retry only handles result-based failures, not uncaught exceptions)
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

export interface RetryOptions<T> {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Return true if the result should trigger a retry */
  shouldRetry: (result: T) => boolean;
  /** Extract a server-requested delay (e.g., from Retry-After header) */
  getRetryAfterMs?: (result: T) => number | undefined;
  /** Called before each retry sleep — use for logging */
  onRetry?: (attempt: number, result: T, delayMs: number) => void;
}

function computeDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = initialDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = Math.random() * capped * 0.1;
  return Math.round(capped + jitter);
}

/**
 * Retry a function with exponential backoff and optional jitter.
 *
 * @param fn - The async function to call (and potentially retry)
 * @param options - Retry configuration and callbacks
 * @returns The first successful result, or the last failed result after exhausting attempts
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T>
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastResult = await fn();

  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    if (!options.shouldRetry(lastResult)) {
      return lastResult;
    }

    let delayMs = computeDelay(attempt - 1, initialDelayMs, maxDelayMs);

    const serverDelay = options.getRetryAfterMs?.(lastResult);
    if (serverDelay !== undefined && serverDelay > delayMs) {
      delayMs = Math.min(serverDelay, maxDelayMs);
    }

    options.onRetry?.(attempt, lastResult, delayMs);

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    lastResult = await fn();
  }

  return lastResult;
}
