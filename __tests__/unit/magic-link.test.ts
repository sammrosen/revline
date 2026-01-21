/**
 * Magic Link Service Tests
 * 
 * Tests for secure token generation and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMagicLink,
  hashToken,
  getExpiryTime,
  isTokenExpired,
  buildConfirmationUrl,
} from '@/app/_lib/booking/magic-link';

describe('Magic Link Service', () => {
  describe('generateMagicLink', () => {
    it('should generate a valid magic link token', () => {
      const result = generateMagicLink();
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('expiresAt');
    });
    
    it('should generate unique tokens each time', () => {
      const result1 = generateMagicLink();
      const result2 = generateMagicLink();
      
      expect(result1.token).not.toBe(result2.token);
      expect(result1.hash).not.toBe(result2.hash);
    });
    
    it('should generate valid UUID format token', () => {
      const result = generateMagicLink();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.token).toMatch(uuidRegex);
    });
    
    it('should generate SHA-256 hash format', () => {
      const result = generateMagicLink();
      
      // SHA-256 produces 64 hex characters
      expect(result.hash).toHaveLength(64);
      expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    });
    
    it('should set expiry in the future', () => {
      const result = generateMagicLink();
      
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
    
    it('should use default 15 minute expiry', () => {
      const before = Date.now();
      const result = generateMagicLink();
      const after = Date.now();
      
      const expectedExpiry = 15 * 60 * 1000;
      const minExpiry = before + expectedExpiry;
      const maxExpiry = after + expectedExpiry;
      
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiry);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry);
    });
    
    it('should accept custom expiry minutes', () => {
      const before = Date.now();
      const result = generateMagicLink(5); // 5 minutes
      const after = Date.now();
      
      const expectedExpiry = 5 * 60 * 1000;
      const minExpiry = before + expectedExpiry;
      const maxExpiry = after + expectedExpiry;
      
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiry);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry);
    });
  });
  
  describe('hashToken', () => {
    it('should produce consistent hash for same input', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should produce valid SHA-256 hex output', () => {
      const hash = hashToken('any-token');
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
    
    it('should match the hash in generateMagicLink', () => {
      const result = generateMagicLink();
      const recomputedHash = hashToken(result.token);
      
      expect(recomputedHash).toBe(result.hash);
    });
  });
  
  describe('getExpiryTime', () => {
    it('should return a date in the future', () => {
      const expiry = getExpiryTime();
      
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
    
    it('should default to 15 minutes', () => {
      const before = Date.now();
      const expiry = getExpiryTime();
      const after = Date.now();
      
      const expectedMs = 15 * 60 * 1000;
      const minExpiry = before + expectedMs;
      const maxExpiry = after + expectedMs;
      
      expect(expiry.getTime()).toBeGreaterThanOrEqual(minExpiry);
      expect(expiry.getTime()).toBeLessThanOrEqual(maxExpiry);
    });
    
    it('should accept custom minutes', () => {
      const before = Date.now();
      const expiry = getExpiryTime(30);
      const after = Date.now();
      
      const expectedMs = 30 * 60 * 1000;
      const minExpiry = before + expectedMs;
      const maxExpiry = after + expectedMs;
      
      expect(expiry.getTime()).toBeGreaterThanOrEqual(minExpiry);
      expect(expiry.getTime()).toBeLessThanOrEqual(maxExpiry);
    });
  });
  
  describe('isTokenExpired', () => {
    it('should return false for future expiry', () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 min in future
      
      expect(isTokenExpired(futureDate)).toBe(false);
    });
    
    it('should return true for past expiry', () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      
      expect(isTokenExpired(pastDate)).toBe(true);
    });
    
    it('should return true for 1 second ago', () => {
      const oneSecondAgo = new Date(Date.now() - 1000);
      
      // Token that expired 1 second ago should be expired
      expect(isTokenExpired(oneSecondAgo)).toBe(true);
    });
  });
  
  describe('buildConfirmationUrl', () => {
    it('should build correct URL with base and token', () => {
      const url = buildConfirmationUrl('https://app.example.com', 'abc-123');
      
      expect(url).toBe('https://app.example.com/api/v1/booking/confirm/abc-123');
    });
    
    it('should handle base URL with trailing slash', () => {
      const url = buildConfirmationUrl('https://app.example.com/', 'abc-123');
      
      expect(url).toBe('https://app.example.com/api/v1/booking/confirm/abc-123');
    });
    
    it('should handle localhost', () => {
      const url = buildConfirmationUrl('http://localhost:3000', 'test-token');
      
      expect(url).toBe('http://localhost:3000/api/v1/booking/confirm/test-token');
    });
    
    it('should preserve token as-is', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const url = buildConfirmationUrl('https://app.example.com', uuid);
      
      expect(url).toContain(uuid);
    });
  });
});
