/**
 * Validation Module Tests
 * 
 * Priority: P1 - High
 * If broken: Bad data enters system, XSS vulnerabilities
 * 
 * Tests:
 * - Valid email passes
 * - Invalid email formats rejected
 * - XSS attempts sanitized
 * - Edge cases (empty, null, very long)
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateSlug,
  validateName,
  validateCaptureInput,
  validateUUID,
  validateJSON,
  sanitizeString,
  isNonEmptyString,
} from '@/app/_lib/utils/validation';

describe('Validation Module', () => {
  
  describe('validateEmail', () => {
    it('should pass valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co',
        'user+tag@example.org',
        'firstname.lastname@company.co.uk',
        'email@subdomain.example.com',
      ];

      for (const email of validEmails) {
        const result = validateEmail(email);
        expect(result.success, `Expected ${email} to be valid`).toBe(true);
        expect(result.data).toBe(email.toLowerCase().trim());
      }
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'invalid',
        '@nodomain.com',
        'no@domain',
        'spaces in@email.com',
        'missing@.com',
        '@',
        'a@b',
      ];

      for (const email of invalidEmails) {
        const result = validateEmail(email);
        expect(result.success, `Expected ${email} to be invalid`).toBe(false);
        expect(result.error).toBe('Invalid email format');
      }
    });

    it('should normalize email to lowercase', () => {
      const result = validateEmail('TEST@EXAMPLE.COM');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const result = validateEmail('  test@example.com  ');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test@example.com');
    });

    it('should reject empty string', () => {
      const result = validateEmail('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject null/undefined', () => {
      expect(validateEmail(null).success).toBe(false);
      expect(validateEmail(undefined).success).toBe(false);
      expect(validateEmail(null).error).toBe('Email is required');
    });

    it('should reject non-string types', () => {
      expect(validateEmail(123).success).toBe(false);
      expect(validateEmail({ email: 'test@example.com' }).success).toBe(false);
      expect(validateEmail(['test@example.com']).success).toBe(false);
    });

    it('should reject emails over 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@x.co';
      const result = validateEmail(longEmail);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email is too long');
    });
  });

  describe('validateSlug', () => {
    it('should pass valid slugs', () => {
      const validSlugs = [
        'test',
        'client_name',
        'client123',
        'test_slug_123',
        'a',
      ];

      for (const slug of validSlugs) {
        const result = validateSlug(slug);
        expect(result.success, `Expected ${slug} to be valid`).toBe(true);
      }
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        '123starts-with-number',
        '_starts_with_underscore',
        'has-dashes',
        'has spaces',
        'HAS_UPPERCASE', // This should pass after normalization
        'special!chars',
      ];

      // Filter out the one that should pass
      const shouldFail = invalidSlugs.filter(s => s !== 'HAS_UPPERCASE');

      for (const slug of shouldFail) {
        const result = validateSlug(slug);
        expect(result.success, `Expected ${slug} to be invalid`).toBe(false);
      }
    });

    it('should normalize to lowercase', () => {
      const result = validateSlug('TEST_SLUG');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test_slug');
    });

    it('should reject slugs over 50 characters', () => {
      const longSlug = 'a' + '_test'.repeat(20);
      const result = validateSlug(longSlug);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Source is too long');
    });

    it('should reject empty values', () => {
      expect(validateSlug('').success).toBe(false);
      expect(validateSlug(null).success).toBe(false);
      expect(validateSlug(undefined).success).toBe(false);
    });
  });

  describe('validateName', () => {
    it('should pass valid names', () => {
      const validNames = [
        'John',
        'John Doe',
        'José García',
        'Mary-Jane',
        "O'Connor",
      ];

      for (const name of validNames) {
        const result = validateName(name);
        expect(result.success).toBe(true);
      }
    });

    it('should allow empty/undefined names (optional field)', () => {
      expect(validateName('').success).toBe(true);
      expect(validateName(undefined).success).toBe(true);
      expect(validateName(null).success).toBe(true);
      
      // And data should be undefined
      expect(validateName('').data).toBeUndefined();
      expect(validateName(undefined).data).toBeUndefined();
    });

    it('should strip dangerous characters', () => {
      const result = validateName('<script>alert("xss")</script>');
      expect(result.success).toBe(true);
      expect(result.data).not.toContain('<');
      expect(result.data).not.toContain('>');
    });

    it('should reject names over 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateName(longName);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Name is too long');
    });

    it('should reject non-string types', () => {
      expect(validateName(123).success).toBe(false);
      expect(validateName({ name: 'test' }).success).toBe(false);
    });
  });

  describe('validateCaptureInput', () => {
    it('should pass valid capture input', () => {
      const result = validateCaptureInput({
        email: 'test@example.com',
        name: 'John Doe',
        source: 'landing',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        email: 'test@example.com',
        name: 'John Doe',
        source: 'landing',
      });
    });

    it('should use default source if not provided', () => {
      const result = validateCaptureInput({
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.source).toBe('default');
    });

    it('should handle optional name', () => {
      const result = validateCaptureInput({
        email: 'test@example.com',
        source: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBeUndefined();
    });

    it('should reject invalid body types', () => {
      expect(validateCaptureInput(null).success).toBe(false);
      expect(validateCaptureInput(undefined).success).toBe(false);
      expect(validateCaptureInput('string').success).toBe(false);
      expect(validateCaptureInput(123).success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = validateCaptureInput({
        email: 'invalid',
        source: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.field).toBe('email');
    });

    it('should reject invalid source', () => {
      const result = validateCaptureInput({
        email: 'test@example.com',
        source: '123invalid',
      });

      expect(result.success).toBe(false);
      expect(result.field).toBe('source');
    });
  });

  describe('validateUUID', () => {
    it('should pass valid UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
        '00000000-0000-0000-0000-000000000000',
      ];

      for (const uuid of validUUIDs) {
        const result = validateUUID(uuid);
        expect(result.success).toBe(true);
        expect(result.data).toBe(uuid.toLowerCase());
      }
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456-42661417400', // too short
        '123e4567-e89b-12d3-a456-4266141740000', // too long
        '123e4567e89b12d3a456426614174000', // no dashes
        '',
        null,
        undefined,
      ];

      for (const uuid of invalidUUIDs) {
        const result = validateUUID(uuid);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('validateJSON', () => {
    it('should pass valid JSON objects', () => {
      const result = validateJSON({ key: 'value', nested: { a: 1 } });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value', nested: { a: 1 } });
    });

    it('should parse JSON strings', () => {
      const result = validateJSON('{"key": "value"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should return empty object for null/undefined', () => {
      expect(validateJSON(null).data).toEqual({});
      expect(validateJSON(undefined).data).toEqual({});
    });

    it('should reject arrays', () => {
      const result = validateJSON([1, 2, 3]);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Must be a JSON object');
    });

    it('should reject JSON array strings', () => {
      const result = validateJSON('[1, 2, 3]');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Must be a JSON object');
    });

    it('should reject invalid JSON strings', () => {
      const result = validateJSON('not json');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should reject primitive types', () => {
      expect(validateJSON(123).success).toBe(false);
      expect(validateJSON(true).success).toBe(false);
      expect(validateJSON('string').success).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape ampersands', () => {
      const result = sanitizeString('a & b');
      expect(result).toBe('a &amp; b');
    });

    it('should escape quotes', () => {
      const result = sanitizeString('say "hello"');
      expect(result).toContain('&quot;');
    });

    it('should escape single quotes', () => {
      const result = sanitizeString("it's");
      expect(result).toContain('&#x27;');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should preserve safe characters', () => {
      const safe = 'Hello World 123!@#$%^*()';
      const result = sanitizeString(safe);
      expect(result).toContain('Hello World 123');
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
      expect(isNonEmptyString('  spaces  ')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString('\t\n')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
      expect(isNonEmptyString([])).toBe(false);
    });
  });
});

