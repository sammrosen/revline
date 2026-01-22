/**
 * Magic Link Service
 * 
 * Handles secure token generation and validation for booking confirmations.
 * Tokens are opaque UUIDs, stored as SHA-256 hashes for security.
 * 
 * Security Model:
 * - Token is UUIDv4 (opaque, no embedded data)
 * - Only SHA-256 hash is stored in database
 * - Single-use enforcement via status check
 * - Configurable expiry (default 15 minutes)
 * 
 * STANDARDS:
 * - Never log raw tokens
 * - Never return hashes to clients
 * - Always verify expiry and status before confirmation
 */

import { createHash, randomUUID } from 'crypto';

/** Default expiry time in minutes */
const DEFAULT_EXPIRY_MINUTES = 15;

/**
 * Result of generating a magic link token
 */
export interface MagicLinkToken {
  /** Raw token to include in email link (never store this) */
  token: string;
  /** SHA-256 hash of token (store this in database) */
  hash: string;
  /** When the token expires */
  expiresAt: Date;
}

/**
 * Generate a new magic link token
 * 
 * Returns both the raw token (for the email) and its hash (for storage).
 * The raw token should NEVER be stored - only send it in the email.
 * 
 * @param expiryMinutes - Minutes until token expires (default 15)
 * @returns Token, hash, and expiry timestamp
 */
export function generateMagicLink(expiryMinutes: number = DEFAULT_EXPIRY_MINUTES): MagicLinkToken {
  const token = randomUUID();
  const hash = hashToken(token);
  const expiresAt = getExpiryTime(expiryMinutes);
  
  return { token, hash, expiresAt };
}

/**
 * Hash a token using SHA-256
 * 
 * Used to convert a raw token from a URL into a hash for database lookup.
 * 
 * @param token - Raw token string (UUIDv4)
 * @returns SHA-256 hash as hex string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate expiry timestamp
 * 
 * @param minutes - Minutes from now until expiry
 * @returns Date object representing expiry time
 */
export function getExpiryTime(minutes: number = DEFAULT_EXPIRY_MINUTES): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Check if a token has expired
 * 
 * @param expiresAt - Expiry timestamp from database
 * @returns True if the token has expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Build the confirmation URL for a magic link
 * 
 * @param baseUrl - Base URL of the application (e.g., https://app.revline.io)
 * @param token - Raw token to include in URL
 * @returns Full confirmation URL
 */
export function buildConfirmationUrl(baseUrl: string, token: string): string {
  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/api/v1/booking/confirm/${token}`;
}
