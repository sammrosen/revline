/**
 * Retry with Backoff Tests
 *
 * Priority: P1 - High
 * If broken: AI calls not retried on transient failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff } from '@/app/_lib/agent/retry';

type MockResult = {
  success: boolean;
  value?: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns immediately on first success (fn called once)', async () => {
    const fn = vi.fn(async (): Promise<MockResult> => ({
      success: true,
      value: 'ok',
    }));

    const promise = retryWithBackoff(fn, {
      shouldRetry: (r) => r.retryable === true,
    });

    await expect(promise).resolves.toEqual({ success: true, value: 'ok' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts on persistent failure (fn called 3 times by default)', async () => {
    const fail: MockResult = { success: false, retryable: true };
    const fn = vi.fn(async (): Promise<MockResult> => fail);

    const promise = retryWithBackoff(fn, {
      shouldRetry: (r) => r.retryable === true,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual(fail);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying once shouldRetry returns false', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ success: false, retryable: true } as MockResult)
      .mockResolvedValueOnce({ success: true, value: 'recovered' } as MockResult);

    const promise = retryWithBackoff<MockResult>(fn, {
      shouldRetry: (r) => r.retryable === true,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({
      success: true,
      value: 'recovered',
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry before each retry with correct attempt number', async () => {
    const fail: MockResult = { success: false, retryable: true };
    const fn = vi.fn(async (): Promise<MockResult> => fail);
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, {
      shouldRetry: (r) => r.retryable === true,
      onRetry,
    });

    // First fn() resolves on a microtask; then onRetry(1) runs before the first sleep.
    await Promise.resolve();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, fail, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, fail, 2000);

    await vi.advanceTimersByTimeAsync(2000);
    await promise;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects getRetryAfterMs when server delay > computed delay', async () => {
    const fail: MockResult = {
      success: false,
      retryable: true,
      retryAfterMs: 5000,
    };
    const fn = vi.fn(async (): Promise<MockResult> => fail);
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, {
      shouldRetry: (r) => r.retryable === true,
      getRetryAfterMs: (r) => r.retryAfterMs,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(onRetry).toHaveBeenNthCalledWith(1, 1, fail, 5000);

    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('caps delay at maxDelayMs', async () => {
    const fail: MockResult = {
      success: false,
      retryable: true,
      retryAfterMs: 100_000,
    };
    const fn = vi.fn(async (): Promise<MockResult> => fail);
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, {
      shouldRetry: (r) => r.retryable === true,
      getRetryAfterMs: (r) => r.retryAfterMs,
      maxDelayMs: 10_000,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, fail, 10_000);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, fail, 10_000);

    await promise;
  });

  it('returns last failed result after exhausting all retries', async () => {
    const last: MockResult = { success: false, value: 'final', retryable: true };
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ success: false, retryable: true } as MockResult)
      .mockResolvedValueOnce({ success: false, retryable: true } as MockResult)
      .mockResolvedValue(last);

    const promise = retryWithBackoff<MockResult>(fn, {
      maxAttempts: 3,
      shouldRetry: (r) => r.retryable === true,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual(last);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('works with custom maxAttempts (e.g., maxAttempts: 5)', async () => {
    const fail: MockResult = { success: false, retryable: true };
    const fn = vi.fn(async (): Promise<MockResult> => fail);

    const promise = retryWithBackoff(fn, {
      maxAttempts: 5,
      shouldRetry: (r) => r.retryable === true,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(8000);

    await expect(promise).resolves.toEqual(fail);
    expect(fn).toHaveBeenCalledTimes(5);
  });
});
