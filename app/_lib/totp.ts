/**
 * TOTP Two-Factor Authentication Utilities
 *
 * Uses otpauth library (RFC 6238/4226 compliant) for Google Authenticator compatibility.
 * All secrets are encrypted before storage using existing AES-256-GCM encryption.
 *
 * Security best practices:
 * - TOTP secrets: 20 bytes (160 bits) of cryptographically secure randomness
 * - Recovery codes: 8 alphanumeric chars, hashed individually with Argon2id
 * - Timing-safe comparison for all secret verification
 * - One-time use recovery codes marked immediately upon consumption
 */

import * as OTPAuth from 'otpauth';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { encryptSecret, decryptSecret } from './crypto';

// TOTP Configuration (Google Authenticator compatible)
const TOTP_CONFIG = {
  issuer: 'RevLine Admin',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  // Window of 1 means we accept codes from 1 period before/after current
  // This handles clock drift (total window = 90 seconds)
  window: 1,
};

// Recovery code configuration
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8; // 8 alphanumeric chars (e.g., K7M2X9P4)
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing chars (0, O, 1, I)

export interface RecoveryCode {
  hash: string;
  used: boolean;
}

/**
 * Generate a new TOTP secret
 * Returns a 20-byte (160-bit) cryptographically secure random secret
 */
export function generateTOTPSecret(): string {
  // Generate 20 bytes of random data for the secret
  const secretBytes = crypto.randomBytes(20);
  // Return as base32 encoded string (standard for TOTP)
  return base32Encode(secretBytes);
}

/**
 * Generate the otpauth:// URI for QR code generation
 * This URI can be used directly with QR code libraries or displayed for manual entry
 */
export function generateTOTPUri(secret: string, accountName: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_CONFIG.issuer,
    label: accountName,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString();
}

/**
 * Verify a TOTP code against the secret
 * Uses timing-safe comparison and allows for clock drift (+/- 1 period)
 */
export function verifyTOTP(secret: string, code: string): boolean {
  // Validate code format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const totp = new OTPAuth.TOTP({
    issuer: TOTP_CONFIG.issuer,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // validate() returns the time step difference or null if invalid
  // window: 1 means we accept current, previous, and next time steps
  const delta = totp.validate({ token: code, window: TOTP_CONFIG.window });

  return delta !== null;
}

/**
 * Encrypt a TOTP secret for storage
 * Uses the same AES-256-GCM encryption as integration secrets
 * Returns both the encrypted secret and key version (for storage in Admin.totpKeyVersion)
 */
export function encryptTOTPSecret(secret: string): { encryptedSecret: string; keyVersion: number } {
  return encryptSecret(secret);
}

/**
 * Decrypt a stored TOTP secret
 * @param encryptedSecret - The encrypted TOTP secret
 * @param keyVersion - The key version used to encrypt (from Admin.totpKeyVersion)
 */
export function decryptTOTPSecret(encryptedSecret: string, keyVersion: number): string {
  return decryptSecret(encryptedSecret, keyVersion);
}

/**
 * Generate a set of recovery codes
 * Returns the plaintext codes (to show to user) and the hashed codes (to store)
 */
export async function generateRecoveryCodes(): Promise<{
  plaintextCodes: string[];
  hashedCodes: RecoveryCode[];
}> {
  const plaintextCodes: string[] = [];
  const hashedCodes: RecoveryCode[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateSingleRecoveryCode();
    plaintextCodes.push(code);

    // Hash each code with Argon2id for secure storage
    const hash = await hashRecoveryCode(code);
    hashedCodes.push({ hash, used: false });
  }

  return { plaintextCodes, hashedCodes };
}

/**
 * Generate a single recovery code
 * 8 alphanumeric characters from a safe alphabet (no confusing chars)
 */
function generateSingleRecoveryCode(): string {
  const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);
  let code = '';

  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    const index = bytes[i] % RECOVERY_CODE_ALPHABET.length;
    code += RECOVERY_CODE_ALPHABET[index];
  }

  return code;
}

/**
 * Hash a recovery code with Argon2id
 * Uses same strong parameters as password hashing
 */
async function hashRecoveryCode(code: string): Promise<string> {
  return argon2.hash(code.toUpperCase(), {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a recovery code against stored hashes
 * Returns the index of the matching code if found, or -1 if not found
 * This allows the caller to mark the code as used
 */
export async function verifyRecoveryCode(
  inputCode: string,
  storedCodes: RecoveryCode[]
): Promise<number> {
  const normalizedInput = inputCode.toUpperCase().replace(/[-\s]/g, '');

  // Check against each unused code
  for (let i = 0; i < storedCodes.length; i++) {
    const storedCode = storedCodes[i];

    // Skip already used codes
    if (storedCode.used) {
      continue;
    }

    try {
      const isValid = await argon2.verify(storedCode.hash, normalizedInput);
      if (isValid) {
        return i; // Return index so caller can mark as used
      }
    } catch {
      // Continue checking other codes if verification throws
      continue;
    }
  }

  return -1; // No matching code found
}

/**
 * Format recovery codes for display (add hyphen in middle)
 * e.g., "K7M2X9P4" -> "K7M2-X9P4"
 */
export function formatRecoveryCode(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Count unused recovery codes
 */
export function countUnusedRecoveryCodes(codes: RecoveryCode[]): number {
  return codes.filter((c) => !c.used).length;
}

/**
 * Base32 encoding (RFC 4648)
 * Used for TOTP secrets as per standard
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Generate a temporary token for 2FA verification step
 * Used to tie password verification to TOTP verification
 * 
 * Returns: { token, expiresAt }
 */
export function generateTempToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  return { token, expiresAt };
}

/**
 * Validate password complexity requirements
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordComplexity(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

