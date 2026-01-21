/**
 * Retention Service Tests
 * 
 * Tests for data cleanup and retention policies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, createTestWorkspace } from '../setup';

// Import service after mocks are set up
const { RetentionService } = await import('@/app/_lib/retention');

describe('RetentionService', () => {
  let workspaceId: string;

  beforeEach(async () => {
    // afterEach in setup.ts handles cleanup, but we need a fresh client each test
    const client = await createTestWorkspace();
    workspaceId = client.id;
  });

  describe('cleanup', () => {
    it('deletes nothing when no old data exists', async () => {
      const result = await RetentionService.cleanup();

      expect(result.eventsDeleted).toBe(0);
      expect(result.webhookEventsDeleted).toBe(0);
      expect(result.workflowExecutionsDeleted).toBe(0);
      expect(result.idempotencyKeysDeleted).toBe(0);
      expect(result.dryRun).toBe(false);
    });

    it('deletes events older than retention period', async () => {
      // Create an old event (100 days ago, older than 90-day default)
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      await testPrisma.event.create({
        data: {
          workspaceId,
          system: 'BACKEND',
          eventType: 'old_event',
          success: true,
          createdAt: oldDate,
        },
      });

      // Create a recent event (should not be deleted)
      await testPrisma.event.create({
        data: {
          workspaceId,
          system: 'BACKEND',
          eventType: 'recent_event',
          success: true,
        },
      });

      const result = await RetentionService.cleanup();

      expect(result.eventsDeleted).toBe(1);

      // Verify recent event still exists
      const remainingEvents = await testPrisma.event.count({ where: { workspaceId } });
      expect(remainingEvents).toBe(1);
    });

    it('deletes webhook events older than retention period', async () => {
      // Create an old webhook event (40 days ago, older than 30-day default)
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await testPrisma.webhookEvent.create({
        data: {
          workspaceId,
          correlationId: crypto.randomUUID(),
          provider: 'stripe',
          providerEventId: 'evt_old',
          rawBody: '{}',
          status: 'PROCESSED',
          receivedAt: oldDate,
        },
      });

      // Create a recent webhook event (should not be deleted)
      await testPrisma.webhookEvent.create({
        data: {
          workspaceId,
          correlationId: crypto.randomUUID(),
          provider: 'stripe',
          providerEventId: 'evt_recent',
          rawBody: '{}',
          status: 'PROCESSED',
        },
      });

      const result = await RetentionService.cleanup();

      expect(result.webhookEventsDeleted).toBe(1);

      // Verify recent webhook still exists
      const remaining = await testPrisma.webhookEvent.count({ where: { workspaceId } });
      expect(remaining).toBe(1);
    });

    it('deletes expired idempotency keys', async () => {
      // Create an expired key
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
      await testPrisma.idempotencyKey.create({
        data: {
          workspaceId,
          key: 'expired_key',
          status: 'COMPLETED',
          expiresAt: expiredDate,
        },
      });

      // Create a non-expired key
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now
      await testPrisma.idempotencyKey.create({
        data: {
          workspaceId,
          key: 'active_key',
          status: 'COMPLETED',
          expiresAt: futureDate,
        },
      });

      const result = await RetentionService.cleanup();

      expect(result.idempotencyKeysDeleted).toBe(1);

      // Verify active key still exists
      const remaining = await testPrisma.idempotencyKey.count({ where: { workspaceId } });
      expect(remaining).toBe(1);
    });

    it('dry run mode counts but does not delete', async () => {
      // Create an old event
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      await testPrisma.event.create({
        data: {
          workspaceId,
          system: 'BACKEND',
          eventType: 'old_event',
          success: true,
          createdAt: oldDate,
        },
      });

      const result = await RetentionService.cleanup({ dryRun: true });

      expect(result.eventsDeleted).toBe(1);
      expect(result.dryRun).toBe(true);

      // Verify event was NOT deleted
      const remaining = await testPrisma.event.count({ where: { workspaceId } });
      expect(remaining).toBe(1);
    });

    it('respects custom retention config', async () => {
      // Create an event 50 days ago
      const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);
      await testPrisma.event.create({
        data: {
          workspaceId,
          system: 'BACKEND',
          eventType: 'medium_old_event',
          success: true,
          createdAt: fiftyDaysAgo,
        },
      });

      // With default 90-day retention, should NOT delete
      const result1 = await RetentionService.cleanup({ dryRun: true });
      expect(result1.eventsDeleted).toBe(0);

      // With 30-day retention, SHOULD delete
      const result2 = await RetentionService.cleanup({
        dryRun: true,
        config: { eventDays: 30 },
      });
      expect(result2.eventsDeleted).toBe(1);
    });
  });

  describe('getConfig', () => {
    it('returns default config', () => {
      const config = RetentionService.getConfig();

      expect(config.eventDays).toBe(90);
      expect(config.webhookEventDays).toBe(30);
      expect(config.workflowExecutionDays).toBe(90);
    });
  });

  describe('formatResult', () => {
    it('formats cleanup result correctly', () => {
      const result = {
        eventsDeleted: 100,
        webhookEventsDeleted: 50,
        workflowExecutionsDeleted: 25,
        idempotencyKeysDeleted: 10,
        pendingBookingsExpired: 5,
        pendingBookingsDeleted: 3,
        durationMs: 1234,
        dryRun: false,
      };

      const formatted = RetentionService.formatResult(result);
      
      expect(formatted).toContain('Processed:');
      expect(formatted).toContain('Events: 100');
      expect(formatted).toContain('Webhooks: 50');
      expect(formatted).toContain('Executions: 25');
      expect(formatted).toContain('Keys: 10');
      expect(formatted).toContain('PendingBookings:');
      expect(formatted).toContain('1234ms');
    });

    it('indicates dry run in formatted output', () => {
      const result = {
        eventsDeleted: 100,
        webhookEventsDeleted: 0,
        workflowExecutionsDeleted: 0,
        idempotencyKeysDeleted: 0,
        pendingBookingsExpired: 0,
        pendingBookingsDeleted: 0,
        durationMs: 500,
        dryRun: true,
      };

      const formatted = RetentionService.formatResult(result);
      
      expect(formatted).toContain('[DRY RUN]');
      expect(formatted).toContain('Would process');
    });
  });

  describe('getTableStats', () => {
    it('returns current table counts', async () => {
      // Create some data
      await testPrisma.event.createMany({
        data: [
          { workspaceId, system: 'BACKEND', eventType: 'test1', success: true },
          { workspaceId, system: 'BACKEND', eventType: 'test2', success: true },
        ],
      });

      const stats = await RetentionService.getTableStats();

      expect(stats.events).toBeGreaterThanOrEqual(2);
      expect(typeof stats.webhookEvents).toBe('number');
      expect(typeof stats.workflowExecutions).toBe('number');
    });
  });
});
