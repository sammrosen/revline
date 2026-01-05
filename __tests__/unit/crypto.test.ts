/**
 * Crypto Module Tests
 * 
 * Priority: P0 - Critical
 * If broken: ALL integrations fail (secrets can't be decrypted)
 * 
 * Tests:
 * - Encrypt/decrypt roundtrip
 * - Different IVs produce different ciphertexts
 * - Invalid ciphertext handling
 * - Missing encryption key handling
 * - Wrong key fails decryption
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Crypto Module', () => {
  const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const DIFFERENT_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  
  let originalEnv: string | undefined;
  
  beforeEach(() => {
    // Store original env
    originalEnv = process.env.REVLINE_ENCRYPTION_KEY;
    // Set valid key for most tests
    process.env.REVLINE_ENCRYPTION_KEY = VALID_KEY;
    // Clear module cache to pick up new env
    vi.resetModules();
  });
  
  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.REVLINE_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.REVLINE_ENCRYPTION_KEY;
    }
    vi.resetModules();
  });

  describe('encryptSecret + decryptSecret roundtrip', () => {
    it('should encrypt and decrypt back to original plaintext', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = '';
      const encrypted = encryptSecret(plaintext);
      
      // Empty strings produce valid encrypted output (IV + 0 bytes + auth tag)
      // The base64 output should be at least 28 bytes decoded (12 + 16)
      expect(encrypted.length).toBeGreaterThan(0);
      
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'secret-with-émojis-🔐-and-中文';
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'x'.repeat(10000);
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('IV uniqueness (different ciphertexts)', () => {
    it('should produce different ciphertexts for same plaintext', async () => {
      const { encryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'same-secret';
      const encrypted1 = encryptSecret(plaintext);
      const encrypted2 = encryptSecret(plaintext);
      
      // Different IV = different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should decrypt both different ciphertexts to same plaintext', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'same-secret';
      const encrypted1 = encryptSecret(plaintext);
      const encrypted2 = encryptSecret(plaintext);
      
      expect(decryptSecret(encrypted1)).toBe(plaintext);
      expect(decryptSecret(encrypted2)).toBe(plaintext);
    });
  });

  describe('invalid ciphertext handling', () => {
    it('should throw on empty string', async () => {
      const { decryptSecret } = await import('@/app/_lib/crypto');
      
      expect(() => decryptSecret('')).toThrow('Invalid ciphertext: too short');
    });

    it('should throw on ciphertext that is too short', async () => {
      const { decryptSecret } = await import('@/app/_lib/crypto');
      
      // Less than IV (12) + auth tag (16) + 1 byte
      const shortCiphertext = Buffer.from('short').toString('base64');
      
      expect(() => decryptSecret(shortCiphertext)).toThrow('Invalid ciphertext: too short');
    });

    it('should throw on tampered ciphertext', async () => {
      const { encryptSecret, decryptSecret } = await import('@/app/_lib/crypto');
      
      const plaintext = 'secret';
      const encrypted = encryptSecret(plaintext);
      
      // Tamper with a byte in the middle
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[Math.floor(buffer.length / 2)] ^= 0xFF;
      const tampered = buffer.toString('base64');
      
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it('should throw on invalid base64', async () => {
      const { decryptSecret } = await import('@/app/_lib/crypto');
      
      // Invalid base64 (but long enough to pass length check)
      const invalidBase64 = '!!!invalid-base64-but-long-enough-to-pass!!!';
      
      expect(() => decryptSecret(invalidBase64)).toThrow();
    });
  });

  describe('missing encryption key', () => {
    it('should throw descriptive error when key is missing', async () => {
      delete process.env.REVLINE_ENCRYPTION_KEY;
      delete process.env.SRB_ENCRYPTION_KEY;
      vi.resetModules();
      
      const { encryptSecret } = await import('@/app/_lib/crypto');
      
      expect(() => encryptSecret('test')).toThrow(
        'REVLINE_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw on invalid key length (too short)', async () => {
      process.env.REVLINE_ENCRYPTION_KEY = '0123456789abcdef'; // Only 16 chars
      vi.resetModules();
      
      const { encryptSecret } = await import('@/app/_lib/crypto');
      
      expect(() => encryptSecret('test')).toThrow(
        'REVLINE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
      );
    });

    it('should throw on invalid key length (too long)', async () => {
      process.env.REVLINE_ENCRYPTION_KEY = VALID_KEY + 'extra';
      vi.resetModules();
      
      const { encryptSecret } = await import('@/app/_lib/crypto');
      
      expect(() => encryptSecret('test')).toThrow(
        'REVLINE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
      );
    });
  });

  describe('wrong key fails decryption', () => {
    it('should fail to decrypt with different key', async () => {
      // Encrypt with first key
      process.env.REVLINE_ENCRYPTION_KEY = VALID_KEY;
      vi.resetModules();
      const { encryptSecret } = await import('@/app/_lib/crypto');
      const encrypted = encryptSecret('secret');
      
      // Try to decrypt with different key
      process.env.REVLINE_ENCRYPTION_KEY = DIFFERENT_KEY;
      vi.resetModules();
      const { decryptSecret } = await import('@/app/_lib/crypto');
      
      expect(() => decryptSecret(encrypted)).toThrow();
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 64-character hex key', async () => {
      const { generateEncryptionKey } = await import('@/app/_lib/crypto');
      
      const key = generateEncryptionKey();
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should generate unique keys each time', async () => {
      const { generateEncryptionKey } = await import('@/app/_lib/crypto');
      
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(generateEncryptionKey());
      }
      
      expect(keys.size).toBe(100);
    });

    it('generated key should work for encryption', async () => {
      const { generateEncryptionKey } = await import('@/app/_lib/crypto');
      
      const newKey = generateEncryptionKey();
      process.env.REVLINE_ENCRYPTION_KEY = newKey;
      vi.resetModules();
      
      const { encryptSecret: encrypt, decryptSecret: decrypt } = await import('@/app/_lib/crypto');
      
      const plaintext = 'test-with-generated-key';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});

