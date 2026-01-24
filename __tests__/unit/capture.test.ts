/**
 * Capture Service Unit Tests
 * 
 * Tests for form capture validation, payload processing, and security.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CapturePayloadSchema,
  FormSecuritySchema,
  AllowedTargetSchema,
  AllowedTargetsSchema,
  CreateFormSchema,
  isDenylistedTarget,
  hasSensitiveValuePattern,
  LEAD_FIELDS,
  DENYLIST_TARGETS,
} from '@/app/_lib/types/capture';

// =============================================================================
// PAYLOAD VALIDATION TESTS
// =============================================================================

describe('CapturePayloadSchema', () => {
  it('should validate a valid payload with email only', () => {
    const result = CapturePayloadSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should validate a payload with all lead fields', () => {
    const result = CapturePayloadSchema.safeParse({
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-1234',
      source: 'website',
    });
    expect(result.success).toBe(true);
  });

  it('should allow custom fields', () => {
    const result = CapturePayloadSchema.safeParse({
      email: 'test@example.com',
      'custom.barcode': '12345',
      'custom.memberType': 'premium',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = CapturePayloadSchema.safeParse({
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = CapturePayloadSchema.safeParse({
      firstName: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('should reject overly long first name', () => {
    const result = CapturePayloadSchema.safeParse({
      email: 'test@example.com',
      firstName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// TARGET FIELD VALIDATION TESTS
// =============================================================================

describe('AllowedTargetSchema', () => {
  it('should accept known lead fields', () => {
    for (const field of LEAD_FIELDS) {
      const result = AllowedTargetSchema.safeParse(field);
      expect(result.success).toBe(true);
    }
  });

  it('should accept valid custom fields', () => {
    const validCustomFields = [
      'custom.barcode',
      'custom.memberType',
      'custom.someField123',
      'custom.field_with_underscore',
    ];

    for (const field of validCustomFields) {
      const result = AllowedTargetSchema.safeParse(field);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid custom fields', () => {
    const invalidCustomFields = [
      'custom.123invalid', // Starts with number
      'custom.', // Empty key
      'custom.field-with-dash', // Contains dash
      'randomField', // Not a lead field or custom.*
    ];

    for (const field of invalidCustomFields) {
      const result = AllowedTargetSchema.safeParse(field);
      expect(result.success).toBe(false);
    }
  });
});

describe('AllowedTargetsSchema', () => {
  it('should accept array with valid targets', () => {
    const result = AllowedTargetsSchema.safeParse([
      'email',
      'firstName',
      'custom.barcode',
    ]);
    expect(result.success).toBe(true);
  });

  it('should reject empty array', () => {
    const result = AllowedTargetsSchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SECURITY CONFIGURATION TESTS
// =============================================================================

describe('FormSecuritySchema', () => {
  it('should accept valid browser mode config', () => {
    const result = FormSecuritySchema.safeParse({
      mode: 'browser',
      allowedOrigins: ['https://example.com'],
      rateLimitPerIp: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid server mode config', () => {
    const result = FormSecuritySchema.safeParse({
      mode: 'server',
      allowedOrigins: [],
      rateLimitPerIp: 100,
      signingSecret: 'encrypted-secret',
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = FormSecuritySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('browser');
      expect(result.data.allowedOrigins).toEqual([]);
      expect(result.data.rateLimitPerIp).toBe(10);
    }
  });

  it('should reject invalid mode', () => {
    const result = FormSecuritySchema.safeParse({
      mode: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject rate limit out of range', () => {
    const result = FormSecuritySchema.safeParse({
      rateLimitPerIp: 0,
    });
    expect(result.success).toBe(false);

    const result2 = FormSecuritySchema.safeParse({
      rateLimitPerIp: 101,
    });
    expect(result2.success).toBe(false);
  });
});

// =============================================================================
// DENYLIST TESTS
// =============================================================================

describe('isDenylistedTarget', () => {
  it('should denylist password fields', () => {
    const passwordFields = ['password', 'Password', 'PASSWORD', 'user_password', 'userPassword'];
    for (const field of passwordFields) {
      expect(isDenylistedTarget(field)).toBe(true);
    }
  });

  it('should denylist SSN fields', () => {
    const ssnFields = ['ssn', 'SSN', 'social_security', 'socialSecurity'];
    for (const field of ssnFields) {
      expect(isDenylistedTarget(field)).toBe(true);
    }
  });

  it('should denylist credit card fields', () => {
    const ccFields = ['creditCard', 'credit_card', 'cardNumber', 'card_number', 'cvv', 'cvc'];
    for (const field of ccFields) {
      expect(isDenylistedTarget(field)).toBe(true);
    }
  });

  it('should allow normal fields', () => {
    const normalFields = ['email', 'firstName', 'lastName', 'phone', 'barcode', 'memberType'];
    for (const field of normalFields) {
      expect(isDenylistedTarget(field)).toBe(false);
    }
  });
});

describe('hasSensitiveValuePattern', () => {
  it('should detect credit card numbers', () => {
    const ccNumbers = [
      '4111111111111111',
      '5500000000000004',
      '340000000000009',
    ];
    for (const num of ccNumbers) {
      expect(hasSensitiveValuePattern(num)).toBe(true);
    }
  });

  it('should detect SSN format', () => {
    const ssns = ['123-45-6789', '987-65-4321'];
    for (const ssn of ssns) {
      expect(hasSensitiveValuePattern(ssn)).toBe(true);
    }
  });

  it('should detect SSN without dashes', () => {
    const ssns = ['123456789', '987654321'];
    for (const ssn of ssns) {
      expect(hasSensitiveValuePattern(ssn)).toBe(true);
    }
  });

  it('should allow normal values', () => {
    const normalValues = [
      'John',
      'test@example.com',
      '555-1234',
      '12345',
      'ABC123',
    ];
    for (const val of normalValues) {
      expect(hasSensitiveValuePattern(val)).toBe(false);
    }
  });
});

// =============================================================================
// CREATE FORM SCHEMA TESTS
// =============================================================================

describe('CreateFormSchema', () => {
  it('should validate a minimal form creation', () => {
    const result = CreateFormSchema.safeParse({
      name: 'Test Form',
      allowedTargets: ['email'],
    });
    expect(result.success).toBe(true);
  });

  it('should validate a full form creation', () => {
    const result = CreateFormSchema.safeParse({
      name: 'Test Form',
      description: 'A test form for capturing leads',
      enabled: true,
      security: {
        mode: 'browser',
        allowedOrigins: ['https://example.com'],
        rateLimitPerIp: 20,
      },
      allowedTargets: ['email', 'firstName', 'custom.barcode'],
      triggerName: 'test_captured',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = CreateFormSchema.safeParse({
      name: '',
      allowedTargets: ['email'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject name over 128 chars', () => {
    const result = CreateFormSchema.safeParse({
      name: 'a'.repeat(129),
      allowedTargets: ['email'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty allowed targets', () => {
    const result = CreateFormSchema.safeParse({
      name: 'Test Form',
      allowedTargets: [],
    });
    expect(result.success).toBe(false);
  });
});
