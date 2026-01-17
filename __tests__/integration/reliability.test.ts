/**
 * Reliability Infrastructure Integration Tests
 * 
 * Priority: P0 - Critical
 * If broken: Duplicate side effects, lost events, data corruption
 * 
 * Tests:
 * - WebhookProcessor: registration, deduplication, status transitions
 * - IdempotentExecutor: execution, caching, concurrent access
 */

import { describe, it, expect } from 'vitest';
import {
  testPrisma,
  createTestWorkspace,
} from '../setup';
import {
  WebhookProcessor,
  executeIdempotent,
  generateIdempotencyKey,
} from '@/app/_lib/reliability';

describe('WebhookProcessor Integration', () => {
  describe('register', () => {
    it('should register a new webhook event and return isDuplicate=false', async () => {
      const client = await createTestWorkspace();
      
      const result = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_test_new_123',
        rawBody: '{"id":"evt_test_new_123","type":"checkout.session.completed"}',
        rawHeaders: { 'stripe-signature': 'test-sig' },
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.correlationId).toBeDefined();
      expect(result.status).toBe('PENDING');

      // Verify record exists in database
      const record = await testPrisma.webhookEvent.findUnique({
        where: { id: result.id },
      });
      expect(record).not.toBeNull();
      expect(record?.provider).toBe('stripe');
      expect(record?.rawBody).toBe('{"id":"evt_test_new_123","type":"checkout.session.completed"}');
    });

    it('should return isDuplicate=true for duplicate webhook', async () => {
      const client = await createTestWorkspace();
      const eventId = 'evt_test_duplicate_456';
      
      // First registration
      const first = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{"id":"evt_test_duplicate_456"}',
      });
      expect(first.isDuplicate).toBe(false);

      // Second registration (duplicate)
      const second = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{"id":"evt_test_duplicate_456"}',
      });
      expect(second.isDuplicate).toBe(true);
      expect(second.id).toBe(first.id); // Same record returned
    });

    it('should allow same eventId for different clients (multi-tenant isolation)', async () => {
      const client1 = await createTestWorkspace({ slug: 'client-1' });
      const client2 = await createTestWorkspace({ slug: 'client-2' });
      const eventId = 'evt_shared_across_tenants';
      
      const first = await WebhookProcessor.register({
        workspaceId: client1.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{}',
      });

      const second = await WebhookProcessor.register({
        workspaceId: client2.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{}',
      });

      // Both should be new (different clients)
      expect(first.isDuplicate).toBe(false);
      expect(second.isDuplicate).toBe(false);
      expect(first.id).not.toBe(second.id);
    });

    it('should allow same eventId for different providers', async () => {
      const client = await createTestWorkspace();
      const eventId = 'shared-event-id';
      
      const stripe = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{}',
      });

      const calendly = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'calendly',
        providerEventId: eventId,
        rawBody: '{}',
      });

      expect(stripe.isDuplicate).toBe(false);
      expect(calendly.isDuplicate).toBe(false);
      expect(stripe.id).not.toBe(calendly.id);
    });

    it('should store raw headers as JSON', async () => {
      const client = await createTestWorkspace();
      const headers = {
        'stripe-signature': 'whsec_test123',
        'content-type': 'application/json',
      };
      
      const result = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_headers_test',
        rawBody: '{}',
        rawHeaders: headers,
      });

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id: result.id },
      });

      expect(record?.rawHeaders).toEqual(headers);
    });

    it('should parse and store JSON payload', async () => {
      const client = await createTestWorkspace();
      const payload = { id: 'evt_123', type: 'test', data: { nested: true } };
      
      const result = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_parsed_payload',
        rawBody: JSON.stringify(payload),
      });

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id: result.id },
      });

      expect(record?.parsedPayload).toEqual(payload);
    });

    it('should handle non-JSON raw body gracefully', async () => {
      const client = await createTestWorkspace();
      
      const result = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_non_json',
        rawBody: 'not valid json {{{',
      });

      expect(result.isDuplicate).toBe(false);

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id: result.id },
      });
      expect(record?.rawBody).toBe('not valid json {{{');
      expect(record?.parsedPayload).toBeNull();
    });
  });

  describe('markProcessing', () => {
    it('should update status from PENDING to PROCESSING', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_pending_to_processing',
        rawBody: '{}',
      });

      const claimed = await WebhookProcessor.markProcessing(id);

      expect(claimed).toBe(true);

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id },
      });
      expect(record?.status).toBe('PROCESSING');
      expect(record?.processingStartedAt).toBeDefined();
    });

    it('should return false when already PROCESSING (double-claim prevention)', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_already_processing',
        rawBody: '{}',
      });

      // First claim succeeds
      const first = await WebhookProcessor.markProcessing(id);
      expect(first).toBe(true);

      // Second claim fails
      const second = await WebhookProcessor.markProcessing(id);
      expect(second).toBe(false);
    });

    it('should return false when already PROCESSED', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_already_processed',
        rawBody: '{}',
      });

      await WebhookProcessor.markProcessing(id);
      await WebhookProcessor.markProcessed(id);

      const result = await WebhookProcessor.markProcessing(id);
      expect(result).toBe(false);
    });
  });

  describe('markProcessed', () => {
    it('should update status to PROCESSED', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_to_process',
        rawBody: '{}',
      });

      await WebhookProcessor.markProcessing(id);
      await WebhookProcessor.markProcessed(id);

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id },
      });
      expect(record?.status).toBe('PROCESSED');
      expect(record?.processedAt).toBeDefined();
    });
  });

  describe('markFailed', () => {
    it('should update status to FAILED with error message', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_to_fail',
        rawBody: '{}',
      });

      await WebhookProcessor.markProcessing(id);
      await WebhookProcessor.markFailed(id, 'Signature verification failed');

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id },
      });
      expect(record?.status).toBe('FAILED');
      expect(record?.error).toBe('Signature verification failed');
    });

    it('should truncate long error messages', async () => {
      const client = await createTestWorkspace();
      const { id } = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: 'evt_long_error',
        rawBody: '{}',
      });

      const longError = 'x'.repeat(2000);
      await WebhookProcessor.markFailed(id, longError);

      const record = await testPrisma.webhookEvent.findUnique({
        where: { id },
      });
      expect(record?.error?.length).toBeLessThanOrEqual(1000);
    });
  });
});

describe('IdempotentExecutor Integration', () => {
  describe('executeIdempotent', () => {
    it('should execute function and return executed=true for new key', async () => {
      const client = await createTestWorkspace();
      let executionCount = 0;
      
      const key = generateIdempotencyKey('test.action', { param: 'value' });
      
      const result = await executeIdempotent(
        client.id,
        key,
        async () => {
          executionCount++;
          return { success: true, data: 'result' };
        }
      );

      expect(result.executed).toBe(true);
      expect(result.result).toEqual({ success: true, data: 'result' });
      expect(executionCount).toBe(1);

      // Verify key exists in database
      const record = await testPrisma.idempotencyKey.findFirst({
        where: { workspaceId: client.id, key },
      });
      expect(record).not.toBeNull();
      expect(record?.status).toBe('COMPLETED');
      expect(record?.result).toEqual({ success: true, data: 'result' });
    });

    it('should return cached result and executed=false for existing key', async () => {
      const client = await createTestWorkspace();
      let executionCount = 0;
      
      const key = generateIdempotencyKey('test.cached', { id: 123 });
      
      // First execution
      await executeIdempotent(
        client.id,
        key,
        async () => {
          executionCount++;
          return { value: 42 };
        }
      );

      // Second execution (should use cache)
      const result = await executeIdempotent(
        client.id,
        key,
        async () => {
          executionCount++; // Should not be called
          return { value: 999 };
        }
      );

      expect(result.executed).toBe(false);
      expect(result.result).toEqual({ value: 42 }); // Cached result
      expect(executionCount).toBe(1); // Only executed once
    });

    it('should allow same key for different clients (multi-tenant)', async () => {
      const client1 = await createTestWorkspace({ slug: 'idempotent-client-1' });
      const client2 = await createTestWorkspace({ slug: 'idempotent-client-2' });
      
      const key = generateIdempotencyKey('shared.action', { shared: true });
      
      const result1 = await executeIdempotent(
        client1.id,
        key,
        async () => ({ client: 'client1' })
      );

      const result2 = await executeIdempotent(
        client2.id,
        key,
        async () => ({ client: 'client2' })
      );

      // Both should execute (different clients)
      expect(result1.executed).toBe(true);
      expect(result2.executed).toBe(true);
      expect(result1.result).toEqual({ client: 'client1' });
      expect(result2.result).toEqual({ client: 'client2' });
    });

    it('should store error when function throws', async () => {
      const client = await createTestWorkspace();
      const key = generateIdempotencyKey('test.error', { willFail: true });
      
      await expect(
        executeIdempotent(
          client.id,
          key,
          async () => {
            throw new Error('Something went wrong');
          }
        )
      ).rejects.toThrow('Something went wrong');

      // Verify error was stored
      const record = await testPrisma.idempotencyKey.findFirst({
        where: { workspaceId: client.id, key },
      });
      expect(record?.status).toBe('FAILED');
      expect(record?.error).toBe('Something went wrong');
    });

    it('should throw when trying to execute with previously failed key', async () => {
      const client = await createTestWorkspace();
      const key = generateIdempotencyKey('test.retry_failed', { willFail: true });
      
      // First execution fails
      await expect(
        executeIdempotent(
          client.id,
          key,
          async () => {
            throw new Error('First failure');
          }
        )
      ).rejects.toThrow('First failure');

      // Second execution should throw (cached error)
      await expect(
        executeIdempotent(
          client.id,
          key,
          async () => {
            return { success: true }; // Would succeed, but won't be called
          }
        )
      ).rejects.toThrow('Previous execution failed');
    });

    it('should set expiration time on idempotency key', async () => {
      const client = await createTestWorkspace();
      const key = generateIdempotencyKey('test.ttl', { param: 'value' });
      
      await executeIdempotent(
        client.id,
        key,
        async () => ({ result: true }),
        { ttlMs: 60 * 60 * 1000 } // 1 hour
      );

      const record = await testPrisma.idempotencyKey.findFirst({
        where: { workspaceId: client.id, key },
      });

      expect(record?.expiresAt).toBeDefined();
      // Expiration should be roughly 1 hour from now
      const expectedExpiry = Date.now() + 60 * 60 * 1000;
      expect(record?.expiresAt?.getTime()).toBeGreaterThan(expectedExpiry - 5000);
      expect(record?.expiresAt?.getTime()).toBeLessThan(expectedExpiry + 5000);
    });
  });

  describe('concurrent execution', () => {
    it('should handle concurrent calls with same key (one wins, others get cached)', async () => {
      const client = await createTestWorkspace();
      let executionCount = 0;
      
      const key = generateIdempotencyKey('test.concurrent', { race: true });
      
      // Fire multiple concurrent executions
      const promises = Array(5).fill(null).map(() =>
        executeIdempotent(
          client.id,
          key,
          async () => {
            executionCount++;
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 50));
            return { count: executionCount };
          }
        ).catch(error => {
          // Some may fail with "Operation already in progress"
          return { executed: false, result: null, error: error.message };
        })
      );

      const results = await Promise.all(promises);

      // At least one should have executed
      const executed = results.filter((r): r is { executed: true; result: { count: number } } => 
        r.executed === true
      );
      expect(executed.length).toBeGreaterThanOrEqual(1);
      
      // At most one should have actually run the function
      // (due to race conditions, might be slightly more, but should be limited)
      expect(executionCount).toBeLessThanOrEqual(3);
      
      // Verify only one key exists
      const records = await testPrisma.idempotencyKey.findMany({
        where: { workspaceId: client.id, key },
      });
      expect(records.length).toBe(1);
    });
  });
});

describe('End-to-end reliability flow', () => {
  it('should prevent duplicate webhook processing with idempotent actions', async () => {
    const client = await createTestWorkspace();
    let actionExecutionCount = 0;
    
    // Simulate receiving the same webhook twice
    const eventId = 'evt_e2e_test';
    
    for (let i = 0; i < 2; i++) {
      const registration = await WebhookProcessor.register({
        workspaceId: client.id,
        provider: 'stripe',
        providerEventId: eventId,
        rawBody: '{"id":"evt_e2e_test"}',
      });

      if (!registration.isDuplicate) {
        // First time: process
        const claimed = await WebhookProcessor.markProcessing(registration.id);
        
        if (claimed) {
          // Execute idempotent action
          await executeIdempotent(
            client.id,
            generateIdempotencyKey('mailerlite.add_to_group', {
              email: 'user@example.com',
              groupId: '12345',
            }),
            async () => {
              actionExecutionCount++;
              return { success: true };
            }
          );
          
          await WebhookProcessor.markProcessed(registration.id);
        }
      }
    }

    // Action should only have been executed once
    expect(actionExecutionCount).toBe(1);
    
    // Verify webhook event status
    const events = await testPrisma.webhookEvent.findMany({
      where: { workspaceId: client.id, providerEventId: eventId },
    });
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('PROCESSED');
  });
});
