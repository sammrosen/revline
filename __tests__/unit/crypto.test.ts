/**
 * Crypto Module Tests
 * 
 * Priority: P0 - Critical
 * If broken: ALL integrations fail (secrets can't be decrypted)
 * 
 * Tests:
 * - Encrypt/decrypt roundtrip with key versioning
 * - Keyring with multiple keys
 * - Cross-key decryption (encrypt with v1, decrypt with v2 keyring present)
 * - Different IVs produce different ciphertexts
 * - Invalid ciphertext handling
 * - Missing encryption key handling
 * - Wrong key fails decryption
 * - Missing key version in keyring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Crypto Module', () => {
  // Test keys (valid 64-char hex = 32 bytes)
  const KEY_V0_LEGACY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const KEY_V1 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const KEY_V2 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  
  // Store original env to restore later
  let originalEnv: Record<string, string | undefined> = {};
  
  beforeEach(() => {
    // Store original env
    originalEnv = {
      SRB_ENCRYPTION_KEY: process.env.SRB_ENCRYPTION_KEY,
      REVLINE_ENCRYPTION_KEY_V1: process.env.REVLINE_ENCRYPTION_KEY_V1,
      REVLINE_ENCRYPTION_KEY_V2: process.env.REVLINE_ENCRYPTION_KEY_V2,
    };
    // Clear all encryption keys
    delete process.env.SRB_ENCRYPTION_KEY;
    delete process.env.REVLINE_ENCRYPTION_KEY_V1;
    delete process.env.REVLINE_ENCRYPTION_KEY_V2;
    // Clear module cache to pick up new env
    vi.resetModules();
  });
  
  afterEach(() => {
    // Restore original env
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
    vi.resetModules();
  });

  describe('encryptSecret + decryptSecret roundtrip', () => {
    it('should encrypt and decrypt back to original plaintext', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'my-secret-api-key-12345';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      
      expect(decrypted).toBe(plaintext);
      expect(keyVersion).toBe(1); // CURRENT_KEY_VERSION
    });

    it('should handle empty strings', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = '';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      
      // Empty strings produce valid encrypted output (IV + 0 bytes + auth tag)
      expect(encryptedSecret.length).toBeGreaterThan(0);
      
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'secret-with-émojis-🔐-and-中文';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'x'.repeat(10000);
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('keyring with multiple keys', () => {
    it('should build keyring with legacy key (version 0)', async () => {
      process.env.SRB_ENCRYPTION_KEY = KEY_V0_LEGACY;
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { getKeyring, hasKeyVersion, getAvailableKeyVersions, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      expect(hasKeyVersion(0)).toBe(true);
      expect(hasKeyVersion(1)).toBe(true);
      expect(hasKeyVersion(2)).toBe(false);
      expect(getAvailableKeyVersions()).toEqual([0, 1]);
    });

    it('should decrypt legacy secrets (version 0) with SRB_ENCRYPTION_KEY', async () => {
      // First, encrypt with legacy key
      process.env.SRB_ENCRYPTION_KEY = KEY_V0_LEGACY;
      delete process.env.REVLINE_ENCRYPTION_KEY_V1;
      vi.resetModules();
      
      // Manually create a legacy encrypted secret using the same crypto primitives
      const crypto = await import('crypto');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEY_V0_LEGACY, 'hex'), iv);
      const encrypted = Buffer.concat([cipher.update('legacy-secret', 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const legacyCiphertext = Buffer.concat([iv, encrypted, authTag]).toString('base64');
      
      // Now set up keyring with both keys and decrypt
      process.env.SRB_ENCRYPTION_KEY = KEY_V0_LEGACY;
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      vi.resetModules();
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      // Decrypt with version 0 (legacy key)
      const decrypted = decryptSecret(legacyCiphertext, 0);
      expect(decrypted).toBe('legacy-secret');
    });

    it('should encrypt with current key version (1)', async () => {
      process.env.SRB_ENCRYPTION_KEY = KEY_V0_LEGACY;
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, CURRENT_KEY_VERSION, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const { keyVersion } = encryptSecret('new-secret');
      
      expect(keyVersion).toBe(CURRENT_KEY_VERSION);
      expect(keyVersion).toBe(1);
    });

    it('should support multiple versioned keys (V1, V2)', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      process.env.REVLINE_ENCRYPTION_KEY_V2 = KEY_V2;
      const { getAvailableKeyVersions, hasKeyVersion, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      expect(hasKeyVersion(1)).toBe(true);
      expect(hasKeyVersion(2)).toBe(true);
      expect(getAvailableKeyVersions()).toEqual([1, 2]);
    });
  });

  describe('cross-version decryption', () => {
    it('should decrypt v1 secrets even when v2 is available', async () => {
      // Set up V1 only, encrypt
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      vi.resetModules();
      const { encryptSecret: encrypt1, resetKeyring: reset1 } = await import('@/app/_lib/crypto');
      reset1();
      const { encryptedSecret } = encrypt1('secret-v1');
      
      // Add V2 to keyring, decrypt with V1
      process.env.REVLINE_ENCRYPTION_KEY_V2 = KEY_V2;
      vi.resetModules();
      const { decryptSecret, resetKeyring: reset2 } = await import('@/app/_lib/crypto');
      reset2();
      
      const decrypted = decryptSecret(encryptedSecret, 1);
      expect(decrypted).toBe('secret-v1');
    });
  });

  describe('IV uniqueness (different ciphertexts)', () => {
    it('should produce different ciphertexts for same plaintext', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'same-secret';
      const { encryptedSecret: encrypted1 } = encryptSecret(plaintext);
      const { encryptedSecret: encrypted2 } = encryptSecret(plaintext);
      
      // Different IV = different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should decrypt both different ciphertexts to same plaintext', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'same-secret';
      const { encryptedSecret: encrypted1, keyVersion: v1 } = encryptSecret(plaintext);
      const { encryptedSecret: encrypted2, keyVersion: v2 } = encryptSecret(plaintext);
      
      expect(decryptSecret(encrypted1, v1)).toBe(plaintext);
      expect(decryptSecret(encrypted2, v2)).toBe(plaintext);
    });
  });

  describe('invalid ciphertext handling', () => {
    it('should throw on empty string', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      expect(() => decryptSecret('', 1)).toThrow('Invalid ciphertext: too short');
    });

    it('should throw on ciphertext that is too short', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      // Less than IV (12) + auth tag (16) + 1 byte
      const shortCiphertext = Buffer.from('short').toString('base64');
      
      expect(() => decryptSecret(shortCiphertext, 1)).toThrow('Invalid ciphertext: too short');
    });

    it('should throw on tampered ciphertext', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'secret';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      
      // Tamper with a byte in the middle
      const buffer = Buffer.from(encryptedSecret, 'base64');
      buffer[Math.floor(buffer.length / 2)] ^= 0xFF;
      const tampered = buffer.toString('base64');
      
      expect(() => decryptSecret(tampered, keyVersion)).toThrow();
    });

    it('should throw on invalid base64', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      // Invalid base64 (but long enough to pass length check)
      const invalidBase64 = '!!!invalid-base64-but-long-enough-to-pass!!!';
      
      expect(() => decryptSecret(invalidBase64, 1)).toThrow();
    });
  });

  describe('missing encryption key', () => {
    it('should throw descriptive error when no keys are available', async () => {
      // No keys set
      const { encryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      expect(() => encryptSecret('test')).toThrow(
        /Encryption key version 1 not found in keyring/
      );
    });

    it('should throw on invalid key length (too short)', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = '0123456789abcdef'; // Only 16 chars
      
      const { resetKeyring, getKeyring } = await import('@/app/_lib/crypto');
      
      expect(() => {
        resetKeyring();
        getKeyring();
      }).toThrow('must be 64 hex characters');
    });

    it('should throw on invalid key length (too long)', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1 + 'extra';
      
      const { resetKeyring, getKeyring } = await import('@/app/_lib/crypto');
      
      expect(() => {
        resetKeyring();
        getKeyring();
      }).toThrow('must be 64 hex characters');
    });
  });

  describe('missing key version in keyring', () => {
    it('should throw clear error when key version not found', async () => {
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      // Try to decrypt with version 2 which doesn't exist
      expect(() => decryptSecret('some-ciphertext', 2)).toThrow(
        /Encryption key version 2 not found in keyring/
      );
    });

    it('should include available versions in error message', async () => {
      process.env.SRB_ENCRYPTION_KEY = KEY_V0_LEGACY;
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      const { decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      try {
        decryptSecret('some-ciphertext', 5);
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toMatch(/Available versions: \[0, 1\]/);
      }
    });
  });

  describe('wrong key fails decryption', () => {
    it('should fail to decrypt with different key version', async () => {
      // Encrypt with V1
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      vi.resetModules();
      const { encryptSecret: encrypt1, resetKeyring: reset1 } = await import('@/app/_lib/crypto');
      reset1();
      const { encryptedSecret } = encrypt1('secret');
      
      // Try to decrypt with V2 (different key)
      process.env.REVLINE_ENCRYPTION_KEY_V1 = KEY_V1;
      process.env.REVLINE_ENCRYPTION_KEY_V2 = KEY_V2;
      vi.resetModules();
      const { decryptSecret, resetKeyring: reset2 } = await import('@/app/_lib/crypto');
      reset2();
      
      // Should fail because V2 is a different key
      expect(() => decryptSecret(encryptedSecret, 2)).toThrow();
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
      process.env.REVLINE_ENCRYPTION_KEY_V1 = newKey;
      vi.resetModules();
      
      const { encryptSecret, decryptSecret, resetKeyring } = await import('@/app/_lib/crypto');
      resetKeyring();
      
      const plaintext = 'test-with-generated-key';
      const { encryptedSecret, keyVersion } = encryptSecret(plaintext);
      const decrypted = decryptSecret(encryptedSecret, keyVersion);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('CURRENT_KEY_VERSION constant', () => {
    it('should be exported and equal to 1', async () => {
      const { CURRENT_KEY_VERSION } = await import('@/app/_lib/crypto');
      expect(CURRENT_KEY_VERSION).toBe(1);
    });
  });
});
