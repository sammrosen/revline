/**
 * Observability Service Tests
 * 
 * Tests for metrics collection and threshold checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testPrisma, createTestWorkspace } from '../setup';

// Import service after mocks are set up
const { ObservabilityService } = await import('@/app/_lib/observability');

describe('ObservabilityService', () => {
  let workspaceId: string;

  beforeEach(async () => {
    // afterEach in setup.ts handles cleanup, but we need a fresh client each test
    const client = await createTestWorkspace();
    workspaceId = client.id;
  });

  describe('getMetrics', () => {
    it('returns zero metrics when no data exists', async () => {
      const metrics = await ObservabilityService.getMetrics();

      expect(metrics.webhooks.pending).toBe(0);
      expect(metrics.webhooks.processing).toBe(0);
      expect(metrics.webhooks.failed).toBe(0);
      expect(metrics.webhooks.oldestPendingMinutes).toBeNull();
      expect(metrics.events.totalLastHour).toBe(0);
      expect(metrics.events.failedLastHour).toBe(0);
      expect(metrics.events.errorRatePercent).toBe(0);
      expect(metrics.workflows.failedLastHour).toBe(0);
      expect(metrics.workflows.runningNow).toBe(0);
    });

    it('counts pending webhooks correctly', async () => {
      // Create some webhook events
      await testPrisma.webhookEvent.createMany({
        data: [
          {
            workspaceId,
            correlationId: crypto.randomUUID(),
            provider: 'stripe',
            providerEventId: 'evt_1',
            rawBody: '{}',
            status: 'PENDING',
          },
          {
            workspaceId,
            correlationId: crypto.randomUUID(),
            provider: 'stripe',
            providerEventId: 'evt_2',
            rawBody: '{}',
            status: 'PENDING',
          },
          {
            workspaceId,
            correlationId: crypto.randomUUID(),
            provider: 'stripe',
            providerEventId: 'evt_3',
            rawBody: '{}',
            status: 'PROCESSED',
          },
        ],
      });

      const metrics = await ObservabilityService.getMetrics();

      expect(metrics.webhooks.pending).toBe(2);
    });

    it('calculates error rate correctly', async () => {
      // Create 10 events: 3 failed, 7 successful
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          workspaceId,
          system: 'BACKEND' as const,
          eventType: 'test_event',
          success: i >= 3, // First 3 fail
        });
      }
      await testPrisma.event.createMany({ data: events });

      const metrics = await ObservabilityService.getMetrics();

      expect(metrics.events.totalLastHour).toBe(10);
      expect(metrics.events.failedLastHour).toBe(3);
      expect(metrics.events.errorRatePercent).toBe(30);
    });

    it('scopes metrics to workspace when workspaceId provided', async () => {
      // Create another workspace
      const otherWorkspace = await testPrisma.workspace.create({
        data: { name: 'Other Workspace', slug: 'other-workspace' },
      });

      // Create events for both clients
      await testPrisma.event.createMany({
        data: [
          { workspaceId, system: 'BACKEND', eventType: 'test', success: false },
          { workspaceId, system: 'BACKEND', eventType: 'test', success: false },
          { workspaceId: otherWorkspace.id, system: 'BACKEND', eventType: 'test', success: false },
        ],
      });

      // System-wide should see all 3
      const systemMetrics = await ObservabilityService.getMetrics();
      expect(systemMetrics.events.failedLastHour).toBe(3);

      // Client-scoped should see only 2
      const clientMetrics = await ObservabilityService.getMetrics(workspaceId);
      expect(clientMetrics.events.failedLastHour).toBe(2);
    });
  });

  describe('checkThresholds', () => {
    it('returns no violations when under thresholds', async () => {
      const metrics = await ObservabilityService.getMetrics();
      const violations = await ObservabilityService.checkThresholds(metrics);

      expect(violations).toHaveLength(0);
    });

    it('detects webhook backlog violation', async () => {
      // Create 60 pending webhooks (above 50 threshold)
      const webhooks = [];
      for (let i = 0; i < 60; i++) {
        webhooks.push({
          workspaceId,
          correlationId: crypto.randomUUID(),
          provider: 'stripe' as const,
          providerEventId: `evt_${i}`,
          rawBody: '{}',
          status: 'PENDING' as const,
        });
      }
      await testPrisma.webhookEvent.createMany({ data: webhooks });

      const violations = await ObservabilityService.checkThresholds();

      expect(violations.some(v => v.type === 'webhook_backlog')).toBe(true);
    });

    it('detects error rate violation', async () => {
      // Create 10 events: 5 failed (50% error rate, above 10% threshold)
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          workspaceId,
          system: 'BACKEND' as const,
          eventType: 'test_event',
          success: i >= 5, // First 5 fail
        });
      }
      await testPrisma.event.createMany({ data: events });

      const violations = await ObservabilityService.checkThresholds();

      expect(violations.some(v => v.type === 'error_rate')).toBe(true);
    });

    it('respects custom thresholds', async () => {
      // Create 5 events: 1 failed (20% error rate)
      const events = [];
      for (let i = 0; i < 5; i++) {
        events.push({
          workspaceId,
          system: 'BACKEND' as const,
          eventType: 'test_event',
          success: i !== 0, // Only first one fails
        });
      }
      await testPrisma.event.createMany({ data: events });

      // With default 10% threshold, should violate
      const violations = await ObservabilityService.checkThresholds();
      expect(violations.some(v => v.type === 'error_rate')).toBe(true);

      // With 25% threshold, should not violate
      const metrics = await ObservabilityService.getMetrics();
      const violationsWithCustom = await ObservabilityService.checkThresholds(
        metrics,
        { errorRatePercent: 25 }
      );
      expect(violationsWithCustom.some(v => v.type === 'error_rate')).toBe(false);
    });
  });

  describe('getTableStats', () => {
    it('returns counts for all tables', async () => {
      // Create some data
      await testPrisma.event.create({
        data: { workspaceId, system: 'BACKEND', eventType: 'test', success: true },
      });

      const stats = await ObservabilityService.getTableStats();

      expect(stats.events).toBeGreaterThanOrEqual(1);
      expect(typeof stats.webhookEvents).toBe('number');
      expect(typeof stats.workflowExecutions).toBe('number');
      expect(typeof stats.idempotencyKeys).toBe('number');
      expect(typeof stats.leads).toBe('number');
    });
  });
});
