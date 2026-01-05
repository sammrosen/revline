/**
 * Crypto Module - AES-256-GCM Encryption with Keyring Support
 * 
 * Security Model:
 * - All secrets encrypted at rest with AES-256-GCM
 * - 12-byte random IV per encryption
 * - Auth tag appended for integrity verification
 * - Keyring supports multiple key versions for rotation
 * 
 * Key Versions:
 * - Version 0: Legacy key (SRB_ENCRYPTION_KEY) - for existing secrets
 * - Version 1+: Versioned keys (REVLINE_ENCRYPTION_KEY_V1, V2, etc.)
 * 
 * Rotation:
 * - New encryptions always use CURRENT_KEY_VERSION
 * - Decryption looks up key by version from keyring
 * - Migration re-encrypts from old version to current
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Current key version for new encryptions
 * Increment this when rotating to a new key
 */
export const CURRENT_KEY_VERSION = 1;

/**
 * Result of encrypting a secret
 */
export interface EncryptResult {
  encryptedSecret: string;
  keyVersion: number;
}

/**
 * Keyring type: maps version numbers to encryption keys
 */
type Keyring = Map<number, Buffer>;

/**
 * Parse a hex-encoded key, validating length
 */
function parseHexKey(keyHex: string, keyName: string): Buffer {
  if (keyHex.length !== 64) {
    throw new Error(`${keyName} must be 64 hex characters (32 bytes), got ${keyHex.length}`);
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Build the keyring from environment variables
 * 
 * Loaded keys:
 * - Version 0: SRB_ENCRYPTION_KEY (legacy)
 * - Version 1: REVLINE_ENCRYPTION_KEY_V1
 * - Version 2: REVLINE_ENCRYPTION_KEY_V2
 * - etc.
 * 
 * Keys are optional - only loaded if present in env
 */
function buildKeyring(): Keyring {
  const keyring: Keyring = new Map();
  
  // Version 0: Legacy key (SRB_ENCRYPTION_KEY)
  const legacyKey = process.env.SRB_ENCRYPTION_KEY;
  if (legacyKey) {
    keyring.set(0, parseHexKey(legacyKey, 'SRB_ENCRYPTION_KEY'));
  }
  
  // Version 1+: Versioned keys (REVLINE_ENCRYPTION_KEY_V1, V2, ...)
  // Also check REVLINE_ENCRYPTION_KEY as alias for V1 (backward compat)
  const v1Key = process.env.REVLINE_ENCRYPTION_KEY_V1 || process.env.REVLINE_ENCRYPTION_KEY;
  if (v1Key) {
    keyring.set(1, parseHexKey(v1Key, 'REVLINE_ENCRYPTION_KEY_V1'));
  }
  
  // Check for V2 through V10 (can extend if needed)
  for (let version = 2; version <= 10; version++) {
    const envVar = `REVLINE_ENCRYPTION_KEY_V${version}`;
    const keyHex = process.env[envVar];
    if (keyHex) {
      keyring.set(version, parseHexKey(keyHex, envVar));
    }
  }
  
  return keyring;
}

// Lazy-loaded keyring (rebuilt when needed for testing)
let _keyring: Keyring | null = null;

/**
 * Get the keyring, building it if necessary
 * Exposed for testing - call resetKeyring() to force rebuild
 */
export function getKeyring(): Keyring {
  if (!_keyring) {
    _keyring = buildKeyring();
  }
  return _keyring;
}

/**
 * Reset the keyring (force rebuild on next access)
 * Used for testing when env vars change
 */
export function resetKeyring(): void {
  _keyring = null;
}

/**
 * Get a specific key from the keyring
 * Throws if key version is not found
 */
function getKey(version: number): Buffer {
  const keyring = getKeyring();
  const key = keyring.get(version);
  
  if (!key) {
    const availableVersions = Array.from(keyring.keys()).join(', ');
    throw new Error(
      `Encryption key version ${version} not found in keyring. ` +
      `Available versions: [${availableVersions || 'none'}]. ` +
      `Set the appropriate environment variable.`
    );
  }
  
  return key;
}

/**
 * Get the current encryption key (for new encryptions)
 */
function getCurrentKey(): Buffer {
  return getKey(CURRENT_KEY_VERSION);
}

/**
 * Encrypt a plaintext secret using AES-256-GCM
 * 
 * Uses CURRENT_KEY_VERSION for encryption.
 * Returns both the encrypted secret and the key version used.
 * 
 * @param plaintext - The secret to encrypt
 * @returns Object with encryptedSecret (base64) and keyVersion
 */
export function encryptSecret(plaintext: string): EncryptResult {
  const key = getCurrentKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV + ciphertext + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  
  return {
    encryptedSecret: combined.toString('base64'),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Decrypt a ciphertext using AES-256-GCM
 * 
 * Looks up the encryption key by version from the keyring.
 * Throws if key version is not found or decryption fails.
 * 
 * @param ciphertext - Base64 encoded ciphertext (IV + encrypted + auth tag)
 * @param keyVersion - The key version used to encrypt (from database)
 * @returns Decrypted plaintext
 */
export function decryptSecret(ciphertext: string, keyVersion: number): string {
  const key = getKey(keyVersion);
  const combined = Buffer.from(ciphertext, 'base64');
  
  // Minimum length is IV (12) + auth tag (16) = 28 bytes
  // Empty plaintext produces 0 bytes of ciphertext, which is valid
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a new random encryption key (for initial setup or rotation)
 * Returns 64-character hex string suitable for REVLINE_ENCRYPTION_KEY_V*
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Check if a key version exists in the keyring
 * Useful for validation before attempting decryption
 */
export function hasKeyVersion(version: number): boolean {
  return getKeyring().has(version);
}

/**
 * Get all available key versions in the keyring
 * Useful for debugging and migration scripts
 */
export function getAvailableKeyVersions(): number[] {
  return Array.from(getKeyring().keys()).sort((a, b) => a - b);
}
