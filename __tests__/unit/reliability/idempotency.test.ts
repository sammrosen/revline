/**
 * Idempotency Key Generation Tests
 * 
 * Priority: P1 - High
 * If broken: Duplicate side effects (emails, charges, etc.)
 * 
 * Tests:
 * - Same inputs produce same key (deterministic)
 * - Different inputs produce different keys (no collisions)
 * - Parameter order doesn't affect key (stable hashing)
 * - Workflow-scoped keys include execution ID
 */

import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  generateWorkflowIdempotencyKey,
} from '@/app/_lib/reliability';

describe('Idempotency Key Generation', () => {
  describe('generateIdempotencyKey', () => {
    it('should produce same key for same inputs (deterministic)', () => {
      const key1 = generateIdempotencyKey('mailerlite.add_to_group', {
        email: 'user@example.com',
        groupId: '12345',
      });
      
      const key2 = generateIdempotencyKey('mailerlite.add_to_group', {
        email: 'user@example.com',
        groupId: '12345',
      });
      
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different actions', () => {
      const key1 = generateIdempotencyKey('mailerlite.add_to_group', {
        email: 'user@example.com',
        groupId: '12345',
      });
      
      const key2 = generateIdempotencyKey('mailerlite.remove_from_group', {
        email: 'user@example.com',
        groupId: '12345',
      });
      
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different params', () => {
      const key1 = generateIdempotencyKey('mailerlite.add_to_group', {
        email: 'user@example.com',
        groupId: '12345',
      });
      
      const key2 = generateIdempotencyKey('mailerlite.add_to_group', {
        email: 'other@example.com',
        groupId: '12345',
      });
      
      expect(key1).not.toBe(key2);
    });

    it('should produce same key regardless of parameter order', () => {
      const key1 = generateIdempotencyKey('action', {
        a: 1,
        b: 2,
        c: 3,
      });
      
      const key2 = generateIdempotencyKey('action', {
        c: 3,
        a: 1,
        b: 2,
      });
      
      const key3 = generateIdempotencyKey('action', {
        b: 2,
        c: 3,
        a: 1,
      });
      
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('should produce valid SHA256 hash (64 hex characters)', () => {
      const key = generateIdempotencyKey('test.action', { param: 'value' });
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should handle empty params', () => {
      const key = generateIdempotencyKey('action.without.params', {});
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should handle nested objects', () => {
      const key1 = generateIdempotencyKey('action', {
        nested: { a: 1, b: 2 },
        top: 'value',
      });
      
      const key2 = generateIdempotencyKey('action', {
        nested: { a: 1, b: 2 },
        top: 'value',
      });
      
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different nested values', () => {
      const key1 = generateIdempotencyKey('action', {
        nested: { a: 1, b: 2 },
      });
      
      const key2 = generateIdempotencyKey('action', {
        nested: { a: 1, b: 3 }, // b is different
      });
      
      expect(key1).not.toBe(key2);
    });

    it('should handle special characters in values', () => {
      const key = generateIdempotencyKey('action', {
        email: 'user+tag@example.com',
        message: 'Hello, "World"! 中文',
      });
      
      expect(key).toHaveLength(64);
    });

    it('should handle arrays in params', () => {
      const key1 = generateIdempotencyKey('action', {
        ids: [1, 2, 3],
      });
      
      const key2 = generateIdempotencyKey('action', {
        ids: [1, 2, 3],
      });
      
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different array contents', () => {
      const key1 = generateIdempotencyKey('action', {
        ids: [1, 2, 3],
      });
      
      const key2 = generateIdempotencyKey('action', {
        ids: [1, 2, 4],
      });
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateWorkflowIdempotencyKey', () => {
    it('should include workflow execution ID in key', () => {
      const key1 = generateWorkflowIdempotencyKey(
        'exec-123',
        0,
        'mailerlite.add_to_group',
        { email: 'user@example.com' }
      );
      
      const key2 = generateWorkflowIdempotencyKey(
        'exec-456', // Different execution ID
        0,
        'mailerlite.add_to_group',
        { email: 'user@example.com' }
      );
      
      expect(key1).not.toBe(key2);
    });

    it('should include action index in key', () => {
      const key1 = generateWorkflowIdempotencyKey(
        'exec-123',
        0, // Action index 0
        'mailerlite.add_to_group',
        { email: 'user@example.com' }
      );
      
      const key2 = generateWorkflowIdempotencyKey(
        'exec-123',
        1, // Action index 1
        'mailerlite.add_to_group',
        { email: 'user@example.com' }
      );
      
      expect(key1).not.toBe(key2);
    });

    it('should produce same key for same workflow+action+params', () => {
      const key1 = generateWorkflowIdempotencyKey(
        'exec-123',
        0,
        'mailerlite.add_to_group',
        { email: 'user@example.com', groupId: '12345' }
      );
      
      const key2 = generateWorkflowIdempotencyKey(
        'exec-123',
        0,
        'mailerlite.add_to_group',
        { email: 'user@example.com', groupId: '12345' }
      );
      
      expect(key1).toBe(key2);
    });

    it('should produce valid SHA256 hash', () => {
      const key = generateWorkflowIdempotencyKey(
        'exec-123',
        0,
        'action',
        { param: 'value' }
      );
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });
  });
});
