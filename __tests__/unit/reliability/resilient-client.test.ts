/**
 * Resilient Client Tests
 * 
 * Priority: P1 - High
 * If broken: External API calls fail or retry incorrectly
 * 
 * Tests:
 * - Retries on 500 server errors
 * - Retries on 429 rate limits
 * - Does NOT retry on 400 client errors
 * - Does NOT retry on 401/403 auth errors
 * - Timeout triggers retry
 * - Respects Retry-After header
 * - Deadline exceeded throws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resilientFetch, ResilientFetchError } from '@/app/_lib/reliability';

describe('Resilient Client', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('retry behavior', () => {
    it('should retry on 500 server errors', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('Internal Server Error', { status: 500 });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(3);
      expect(result.response.status).toBe(200);
      expect(result.attempts).toBe(3);
    });

    it('should retry on 502 bad gateway', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          return new Response('Bad Gateway', { status: 502 });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });

    it('should retry on 503 service unavailable', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          return new Response('Service Unavailable', { status: 503 });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });

    it('should retry on 429 rate limit', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          return new Response('Too Many Requests', { status: 429 });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });

    it('should retry on 408 request timeout', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          return new Response('Request Timeout', { status: 408 });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });
  });

  describe('no retry on client errors', () => {
    it('should NOT retry on 400 bad request', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('Bad Request', { status: 400 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(1); // No retries
      expect(result.response.status).toBe(400);
    });

    it('should NOT retry on 401 unauthorized', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('Unauthorized', { status: 401 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(1);
      expect(result.response.status).toBe(401);
    });

    it('should NOT retry on 403 forbidden', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('Forbidden', { status: 403 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(1);
      expect(result.response.status).toBe(403);
    });

    it('should NOT retry on 404 not found', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('Not Found', { status: 404 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(1);
      expect(result.response.status).toBe(404);
    });

    it('should NOT retry on 422 unprocessable entity', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('Unprocessable Entity', { status: 422 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(1);
      expect(result.response.status).toBe(422);
    });
  });

  describe('network error handling', () => {
    it('should retry on network errors', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Network error');
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });

    it('should retry on timeout (AbortError)', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          throw error;
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false }
      );

      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
    });

    it('should throw after max retries on persistent network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        resilientFetch(
          'https://api.example.com/test',
          undefined,
          { retries: 2, backoffMs: 10, jitter: false, deadline: 1000 }
        )
      ).rejects.toThrow(ResilientFetchError);
    });
  });

  describe('Retry-After header', () => {
    it('should respect Retry-After header (seconds)', async () => {
      let attempts = 0;
      const startTime = Date.now();
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          // Return 429 with Retry-After: 1 second
          const headers = new Headers();
          headers.set('Retry-After', '1');
          return new Response('Rate Limited', { status: 429, headers });
        }
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3, backoffMs: 10, jitter: false, deadline: 10000 }
      );

      const elapsed = Date.now() - startTime;
      
      expect(attempts).toBe(2);
      expect(result.response.status).toBe(200);
      // Should have waited at least ~1000ms (Retry-After value)
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });
  });

  describe('deadline enforcement', () => {
    it('should throw when deadline is exceeded', async () => {
      // Make fetch take a while
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return new Response('Server Error', { status: 500 });
      });

      await expect(
        resilientFetch(
          'https://api.example.com/test',
          undefined,
          { retries: 10, backoffMs: 100, deadline: 100, timeout: 50 }
        )
      ).rejects.toThrow();
    });
  });

  describe('success cases', () => {
    it('should return immediately on success', async () => {
      let attempts = 0;
      
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 3 }
      );

      expect(attempts).toBe(1);
      expect(result.response.status).toBe(200);
      expect(result.attempts).toBe(1);
    });

    it('should pass through request options', async () => {
      let capturedInit: RequestInit | undefined;
      
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedInit = init;
        return new Response('OK', { status: 200 });
      });

      await resilientFetch(
        'https://api.example.com/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true }),
        },
        { retries: 1 }
      );

      expect(capturedInit?.method).toBe('POST');
      expect(capturedInit?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(capturedInit?.body).toBe('{"test":true}');
    });

    it('should track total time', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return new Response('OK', { status: 200 });
      });

      const result = await resilientFetch(
        'https://api.example.com/test',
        undefined,
        { retries: 1 }
      );

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(50);
    });
  });

  describe('ResilientFetchError', () => {
    it('should include attempt count in error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        await resilientFetch(
          'https://api.example.com/test',
          undefined,
          { retries: 2, backoffMs: 10, jitter: false, deadline: 500 }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ResilientFetchError);
        const fetchError = error as ResilientFetchError;
        expect(fetchError.attempts).toBe(3); // 1 initial + 2 retries
        expect(fetchError.totalTimeMs).toBeGreaterThan(0);
      }
    });
  });
});
