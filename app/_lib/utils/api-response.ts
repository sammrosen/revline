/**
 * API Response Utilities
 * 
 * Standardized response helpers for all API routes.
 * Use these instead of raw NextResponse.json() for consistency.
 * 
 * STANDARDS:
 * - All public endpoints use these helpers
 * - Errors never expose internal details
 * - Webhooks always return 200 on partial failures
 */

import { NextResponse } from 'next/server';

/**
 * Security headers applied to all responses
 */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

/**
 * Standard API response class
 */
export class ApiResponse {
  /**
   * Success response with data
   */
  static success<T>(data: T, status = 200): NextResponse {
    return NextResponse.json(
      { success: true, data },
      { status, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Error response with message
   * @param message - User-safe error message (no internal details)
   * @param status - HTTP status code
   * @param code - Optional error code for client handling
   */
  static error(message: string, status = 400, code?: string): NextResponse {
    return NextResponse.json(
      { 
        success: false, 
        error: message,
        ...(code && { code }),
      },
      { status, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Webhook acknowledgment (always 200 to prevent retries)
   * Use for external webhooks like Stripe, Calendly
   */
  static webhookAck(options?: {
    processed?: boolean;
    warning?: string;
    leadId?: string;
    duplicate?: boolean;
    correlationId?: string;
    received?: boolean;
  }): NextResponse {
    return NextResponse.json(
      {
        received: options?.received ?? true,
        processed: options?.processed ?? false,
        ...(options?.warning && { warning: options.warning }),
        ...(options?.leadId && { leadId: options.leadId }),
        ...(options?.duplicate && { duplicate: options.duplicate }),
        ...(options?.correlationId && { correlationId: options.correlationId }),
      },
      { status: 200, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Service unavailable (client paused or not found)
   */
  static unavailable(): NextResponse {
    return NextResponse.json(
      { success: false, error: 'Service unavailable' },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Unauthorized (missing or invalid auth)
   */
  static unauthorized(message = 'Unauthorized'): NextResponse {
    return NextResponse.json(
      { success: false, error: message },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Rate limited
   */
  static rateLimited(retryAfter = 60): NextResponse {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', retryAfter },
      { 
        status: 429, 
        headers: {
          ...SECURITY_HEADERS,
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  /**
   * Configuration error (internal, don't expose details)
   */
  static configError(): NextResponse {
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }

  /**
   * Internal error (catch-all, don't expose details)
   */
  static internalError(): NextResponse {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

/**
 * Error codes for client-side handling
 */
export const ErrorCodes = {
  // Validation
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_SOURCE: 'INVALID_SOURCE',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // State
  INVALID_STATE: 'INVALID_STATE',
  
  // Client
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_PAUSED: 'CLIENT_PAUSED',
  
  // General
  NOT_FOUND: 'NOT_FOUND',
  
  // Integration
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  
  // Webhook
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

