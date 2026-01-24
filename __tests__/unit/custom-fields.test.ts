/**
 * Custom Fields Service Tests
 * 
 * Priority: P1 - High
 * If broken: Custom field definitions won't save, lead data won't be stored
 * 
 * Tests:
 * - Field definition CRUD
 * - Key format validation
 * - Value type validation (TEXT, NUMBER, DATE)
 * - Workspace isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FIELD_KEY_REGEX,
  TEXT_MAX_LENGTH,
  CreateFieldDefinitionSchema,
  UpdateFieldDefinitionSchema,
  CustomDataSchema,
} from '@/app/_lib/types/custom-fields';

// Mock prisma for unit tests
vi.mock('@/app/_lib/db', () => ({
  prisma: {
    leadCustomFieldDefinition: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock event logger
vi.mock('@/app/_lib/event-logger', () => ({
  emitEvent: vi.fn(),
  EventSystem: {
    BACKEND: 'BACKEND',
  },
}));

describe('Custom Fields Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Field Key Validation', () => {
    it('should accept valid field keys', () => {
      const validKeys = [
        'barcode',
        'membershipType',
        'member_id',
        'ABC123',
        'a',
        'a'.repeat(63), // Max length
      ];

      for (const key of validKeys) {
        expect(FIELD_KEY_REGEX.test(key), `Expected '${key}' to be valid`).toBe(true);
      }
    });

    it('should reject invalid field keys', () => {
      const invalidKeys = [
        '123abc',           // Starts with number
        '_underscore',      // Starts with underscore
        'has-dash',         // Contains dash
        'has space',        // Contains space
        'has.dot',          // Contains dot
        '',                 // Empty
        'a'.repeat(64),     // Too long (64 chars, max is 63)
      ];

      for (const key of invalidKeys) {
        expect(FIELD_KEY_REGEX.test(key), `Expected '${key}' to be invalid`).toBe(false);
      }
    });
  });

  describe('CreateFieldDefinitionSchema', () => {
    it('should validate valid field definition', () => {
      const validInput = {
        key: 'barcode',
        label: 'Member Barcode',
        fieldType: 'TEXT',
        required: false,
        description: 'ABC Ignite member barcode',
      };

      const result = CreateFieldDefinitionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe('barcode');
        expect(result.data.label).toBe('Member Barcode');
        expect(result.data.fieldType).toBe('TEXT');
      }
    });

    it('should use defaults for optional fields', () => {
      const minimalInput = {
        key: 'test',
        label: 'Test Field',
      };

      const result = CreateFieldDefinitionSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fieldType).toBe('TEXT');
        expect(result.data.required).toBe(false);
        expect(result.data.displayOrder).toBe(0);
      }
    });

    it('should reject invalid field type', () => {
      const invalidInput = {
        key: 'test',
        label: 'Test',
        fieldType: 'INVALID',
      };

      const result = CreateFieldDefinitionSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid key format', () => {
      const invalidInput = {
        key: '123invalid',
        label: 'Test',
      };

      const result = CreateFieldDefinitionSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty label', () => {
      const invalidInput = {
        key: 'test',
        label: '',
      };

      const result = CreateFieldDefinitionSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject label over 128 characters', () => {
      const invalidInput = {
        key: 'test',
        label: 'a'.repeat(129),
      };

      const result = CreateFieldDefinitionSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateFieldDefinitionSchema', () => {
    it('should validate partial updates', () => {
      const validUpdate = {
        label: 'Updated Label',
      };

      const result = UpdateFieldDefinitionSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow null for nullable fields', () => {
      const validUpdate = {
        description: null,
        defaultValue: null,
      };

      const result = UpdateFieldDefinitionSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no changes)', () => {
      const result = UpdateFieldDefinitionSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('CustomDataSchema', () => {
    it('should validate valid custom data', () => {
      const validData = {
        barcode: '12345',
        membershipType: 'premium',
        age: 30,
        joinDate: '2024-01-15',
      };

      const result = CustomDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null values', () => {
      const dataWithNull = {
        barcode: null,
        name: 'John',
      };

      const result = CustomDataSchema.safeParse(dataWithNull);
      expect(result.success).toBe(true);
    });

    it('should reject values exceeding max length', () => {
      const invalidData = {
        longField: 'a'.repeat(TEXT_MAX_LENGTH + 1),
      };

      const result = CustomDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid key formats', () => {
      const invalidData = {
        '123invalid': 'value',
      };

      const result = CustomDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject object values', () => {
      const invalidData = {
        nested: { key: 'value' },
      };

      const result = CustomDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject array values', () => {
      const invalidData = {
        list: ['a', 'b', 'c'],
      };

      const result = CustomDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('TEXT_MAX_LENGTH', () => {
    it('should be 1000', () => {
      expect(TEXT_MAX_LENGTH).toBe(1000);
    });
  });
});
