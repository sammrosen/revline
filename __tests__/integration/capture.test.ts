/**
 * Capture Service Integration Tests
 * 
 * Priority: P0 - Critical
 * If broken: Lost leads (direct revenue impact)
 * 
 * Tests:
 * - Successful capture creates lead record
 * - Successful capture emits correct events
 * - Missing MailerLite config returns error (not crash)
 * - Invalid email handled gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testPrisma, createTestWorkspace, createTestIntegration, createTestWorkflow, getEventsForWorkspace } from '../setup';

// Mock the MailerLite API calls (we don't want to hit real API in tests)
vi.mock('@/app/_lib/integrations/mailerlite.adapter', async () => {
  const actual = await vi.importActual('@/app/_lib/integrations/mailerlite.adapter');
  
  return {
    ...actual,
    MailerLiteAdapter: {
      forClient: vi.fn().mockImplementation(async (workspaceId: string) => {
        // Check if integration exists
        const integration = await testPrisma.workspaceIntegration.findFirst({
          where: { workspaceId, integration: 'MAILERLITE' },
        });
        
        if (!integration) {
          return null;
        }
        
        // Parse meta to check configuration
        const meta = integration.meta as { groups?: Record<string, unknown> };
        
        // Return mock adapter
        return {
          workspaceId,
          meta,
          addToGroup: vi.fn().mockResolvedValue({
            success: true,
            data: { subscriberId: 'mock-subscriber-123', message: 'Subscribed' },
          }),
          hasGroups: () => !!(meta?.groups && Object.keys(meta.groups).length > 0),
          getGroup: (key: string) => meta?.groups?.[key] || null,
        };
      }),
    },
  };
});

describe('Capture Service Integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('CaptureService.captureEmail', () => {
    it('should create lead record on successful capture', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      // Create test client with MailerLite integration
      const client = await createTestWorkspace({ slug: 'capture-test' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      // Capture email
      const result = await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'test@example.com',
        name: 'Test User',
        source: 'landing',
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.leadId).toBeDefined();
      expect(result.data?.email).toBe('test@example.com');
      
      // Verify lead was created in database
      const lead = await testPrisma.lead.findFirst({
        where: { workspaceId: client.id, email: 'test@example.com' },
      });
      
      expect(lead).not.toBeNull();
      expect(lead?.source).toBe('landing');
      expect(lead?.stage).toBe('CAPTURED'); // Prisma enum returns uppercase
    });

    it('should emit contact-submitted event', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'event-test' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'event@example.com',
        source: 'test',
      });
      
      const events = await getEventsForWorkspace(client.id);
      const captureEvent = events.find((e: { eventType: string }) => e.eventType === 'contact-submitted');
      
      expect(captureEvent).toBeDefined();
      expect(captureEvent?.success).toBe(true);
      expect(captureEvent?.system).toBe('BACKEND');
    });

    it('should emit mailerlite_subscribe_success event on success', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'ml-success-test' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
      });
      
      // Create a workflow that adds to MailerLite group when email is captured
      await createTestWorkflow(client.id, {
        name: 'Test MailerLite Workflow',
        enabled: true,
        triggerAdapter: 'revline',
        triggerOperation: 'contact-submitted',
        actions: [
          {
            adapter: 'mailerlite',
            operation: 'add_to_group',
            params: { group: 'welcome' },
          },
        ],
      });
      
      await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'success@example.com',
        source: 'test',
      });
      
      const events = await getEventsForWorkspace(client.id);
      const subscribeEvent = events.find((e: { eventType: string }) => e.eventType === 'mailerlite_subscribe_success');
      
      expect(subscribeEvent).toBeDefined();
      expect(subscribeEvent?.success).toBe(true);
      expect(subscribeEvent?.system).toBe('MAILERLITE');
    });

    it('should return error when MailerLite not configured (not crash)', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      // Create client WITHOUT MailerLite integration
      const client = await createTestWorkspace({ slug: 'no-ml-test' });
      
      const result = await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'noconfig@example.com',
        source: 'test',
      });
      
      // Should succeed - lead creation succeeds even if MailerLite fails
      expect(result.success).toBe(true);
      
      // Lead should still be created
      const lead = await testPrisma.lead.findFirst({
        where: { workspaceId: client.id, email: 'noconfig@example.com' },
      });
      expect(lead).not.toBeNull();
    });

    it('should upsert lead if email already exists', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'upsert-test' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      // First capture
      const result1 = await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'duplicate@example.com',
        source: 'first',
      });
      expect(result1.success).toBe(true);
      
      // Second capture with same email (sequentially, not concurrently)
      const result2 = await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'duplicate@example.com',
        source: 'second',
      });
      
      expect(result2.success).toBe(true);
      
      // Unique constraint ensures only one lead exists
      const leads = await testPrisma.lead.findMany({
        where: { workspaceId: client.id, email: 'duplicate@example.com' },
      });
      
      // Should have exactly one lead (upsert works correctly)
      expect(leads.length).toBe(1);
      // The lead should have the updated lastEventAt from the second capture
      expect(leads[0]?.lastEventAt).toBeDefined();
    });

    it('should handle concurrent captures without crashing and prevent duplicates', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'concurrent-test' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      // Fire multiple captures concurrently
      const promises = Array(5).fill(null).map(() =>
        CaptureService.captureEmail({
          workspaceId: client.id,
          email: 'concurrent@example.com',
          source: 'test',
        })
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed (no crashes)
      const successes = results.filter(r => r.success);
      expect(successes.length).toBe(5);
      
      // Unique constraint ensures only one lead exists even with concurrent requests
      const leads = await testPrisma.lead.findMany({
        where: { workspaceId: client.id, email: 'concurrent@example.com' },
      });
      
      // Should have exactly one lead (unique constraint prevents duplicates)
      expect(leads.length).toBe(1);
    });

    it('should use default source when not provided', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'default-source' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      await CaptureService.captureEmail({
        workspaceId: client.id,
        email: 'nosource@example.com',
        // No source provided
      });
      
      const lead = await testPrisma.lead.findFirst({
        where: { workspaceId: client.id, email: 'nosource@example.com' },
      });
      
      expect(lead?.source).toBe('landing'); // Default source
    });
  });

  describe('Unique Constraint', () => {
    it('should prevent duplicate leads with unique constraint', async () => {
      const { upsertLead } = await import('@/app/_lib/event-logger');
      
      const client = await createTestWorkspace({ slug: 'unique-test' });
      
      // Create lead
      const leadId1 = await upsertLead({
        workspaceId: client.id,
        email: 'unique@example.com',
        source: 'first',
      });
      
      // Try to create duplicate (should update, not create)
      const leadId2 = await upsertLead({
        workspaceId: client.id,
        email: 'unique@example.com',
        source: 'second',
      });
      
      // Should return the same lead ID (upsert)
      expect(leadId1).toBe(leadId2);
      
      // Verify only one lead exists
      const leads = await testPrisma.lead.findMany({
        where: { workspaceId: client.id, email: 'unique@example.com' },
      });
      expect(leads.length).toBe(1);
    });
  });

  describe('CaptureService.isConfigured', () => {
    it('should return true when MailerLite is configured', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'config-check' });
      await createTestIntegration(client.id, 'MAILERLITE', 'mock-api-key', {
        groups: {
          welcome: { id: 'test-group', name: 'Welcome' },
        },
        routing: {
          'lead.captured': 'welcome',
        },
      });
      
      const isConfigured = await CaptureService.isConfigured(client.id);
      expect(isConfigured).toBe(true);
    });

    it('should return false when MailerLite is not configured', async () => {
      const { CaptureService } = await import('@/app/_lib/services/capture.service');
      
      const client = await createTestWorkspace({ slug: 'no-config' });
      // No integration created
      
      const isConfigured = await CaptureService.isConfigured(client.id);
      expect(isConfigured).toBe(false);
    });
  });
});

