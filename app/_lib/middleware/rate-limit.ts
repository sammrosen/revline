/**
 * Rate Limiting Middleware
 * 
 * Simple in-memory rate limiter for API routes.
 * For production with multiple instances, use Redis-backed rate limiting.
 * 
 * STANDARDS:
 * - All public endpoints must implement rate limiting
 * - Rate limits defined in app/_lib/types/index.ts
 * - Returns 429 with Retry-After header when exceeded
 */

import { RATE_LIMITS } from '@/app/_lib/types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on server restart)
// For production multi-instance, replace with Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60_000; // 1 minute

let lastCleanup = Date.now();

function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a key
 * @param key - Unique identifier (e.g., IP address, client ID)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Entry exists - check count
  if (entry.count >= config.requests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(
  ip: string | null,
  config: RateLimitConfig = RATE_LIMITS.SUBSCRIBE
): RateLimitResult {
  const key = `ip:${ip || 'unknown'}`;
  return checkRateLimit(key, config);
}

/**
 * Rate limit by client slug (for webhooks)
 */
export function rateLimitByClient(
  clientSlug: string,
  config: RateLimitConfig = RATE_LIMITS.WEBHOOK
): RateLimitResult {
  const key = `client:${clientSlug}`;
  return checkRateLimit(key, config);
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIP(headers: Headers): string | null {
  // Railway and most proxies
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Can be comma-separated list, take first
    return forwarded.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnecting = headers.get('cf-connecting-ip');
  if (cfConnecting) {
    return cfConnecting;
  }

  // Direct connection
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return null;
}

/**
 * Rate limit headers to include in response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

