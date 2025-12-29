import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the master encryption key from environment
 * Key must be 32 bytes (256 bits) hex-encoded = 64 hex characters
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.SRB_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('SRB_ENCRYPTION_KEY environment variable is not set');
  }
  if (keyHex.length !== 64) {
    throw new Error('SRB_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext secret using AES-256-GCM
 * Returns base64 string: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV + ciphertext + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  
  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext using AES-256-GCM
 * Input is base64 string: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');
  
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
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
 * Generate a new random encryption key (for initial setup)
 * Returns 64-character hex string suitable for SRB_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}



