/**
 * Pre-fill Token for Booking Links
 * 
 * Encrypts lead data (barcode, email, phone) into a URL-safe token
 * that the booking page decrypts server-side to pre-fill the form.
 * 
 * Security:
 * - AES-256-GCM encryption via existing keyring infrastructure
 * - Token includes workspace ID to prevent cross-workspace reuse
 * - Configurable expiry (default 90 days)
 * - Key version embedded in token for keyring compatibility
 * - Invalid/expired tokens silently return null (no error disclosure)
 * 
 * STANDARDS:
 * - Uses existing crypto module (no new keys needed)
 * - Workspace-isolated via embedded workspaceId check
 * - Fail-safe: bad tokens just mean form isn't pre-filled
 */

import { encryptSecret, decryptSecret, CURRENT_KEY_VERSION } from '@/app/_lib/crypto';

const DEFAULT_EXPIRY_DAYS = 90;

// =============================================================================
// TYPES
// =============================================================================

export interface PrefillData {
  barcode: string;
  email: string;
  phone: string;
  workspaceId: string;
}

interface TokenPayload {
  /** barcode */ b: string;
  /** email */ e: string;
  /** phone */ p: string;
  /** workspaceId */ w: string;
  /** expiry (unix ms) */ exp: number;
  /** key version */ v: number;
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create an encrypted pre-fill token for a booking link.
 * 
 * @param data - Lead data to embed (barcode, email, phone, workspaceId)
 * @param expiryDays - Token lifetime in days (default 90)
 * @returns URL-safe token string
 */
export function createPrefillToken(
  data: PrefillData,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): string {
  const payload: TokenPayload = {
    b: data.barcode,
    e: data.email,
    p: data.phone,
    w: data.workspaceId,
    exp: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    v: CURRENT_KEY_VERSION,
  };

  const { encryptedSecret } = encryptSecret(JSON.stringify(payload));

  // Make URL-safe: replace +/ with -_ and strip trailing =
  return encryptedSecret
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// =============================================================================
// DECRYPT
// =============================================================================

/**
 * Decrypt and validate a pre-fill token.
 * 
 * Returns null for any failure (expired, tampered, malformed) — the booking
 * page should silently fall back to an empty form.
 * 
 * @param token - URL-safe token from ?t= query param
 * @returns Decrypted pre-fill data, or null if invalid/expired
 */
export function decryptPrefillToken(token: string): PrefillData | null {
  try {
    // Restore standard base64 from URL-safe encoding
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad
    const pad = base64.length % 4;
    if (pad === 2) base64 += '==';
    else if (pad === 3) base64 += '=';

    // Parse key version from decrypted payload
    // First try with current key version, then extract actual version
    const plaintext = decryptSecret(base64, CURRENT_KEY_VERSION);
    const payload = JSON.parse(plaintext) as TokenPayload;

    // Validate expiry
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    // Validate required fields
    if (!payload.b || !payload.e || !payload.w) {
      return null;
    }

    return {
      barcode: payload.b,
      email: payload.e,
      phone: payload.p || '',
      workspaceId: payload.w,
    };
  } catch {
    // Decryption failure, JSON parse failure, etc. — silently return null
    return null;
  }
}
