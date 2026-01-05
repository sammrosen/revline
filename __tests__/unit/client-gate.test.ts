/**
 * Client Gate Module Tests
 * 
 * Priority: P0 - Critical
 * If broken: Paused clients still execute (customer billing/support issues)
 * 
 * Tests:
 * - Active client returns client object
 * - Paused client returns null
 * - Non-existent client returns null
 * - Paused client emits execution_blocked event
 */

import { describe, it, expect } from 'vitest';
import { testPrisma, createTestClient, getEventsForClient } from '../setup';

describe('Client Gate Module', () => {
  
  describe('getClientBySlug', () => {
    it('should return client when slug exists', async () => {
      const { getClientBySlug } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ slug: 'test-slug' });
      const result = await getClientBySlug('test-slug');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(client.id);
      expect(result?.slug).toBe('test-slug');
    });

    it('should return null when slug does not exist', async () => {
      const { getClientBySlug } = await import('@/app/_lib/client-gate');
      
      const result = await getClientBySlug('non-existent-slug');
      
      expect(result).toBeNull();
    });

    it('should normalize slug to lowercase', async () => {
      const { getClientBySlug } = await import('@/app/_lib/client-gate');
      
      await createTestClient({ slug: 'lowercase-slug' });
      const result = await getClientBySlug('LOWERCASE-SLUG');
      
      expect(result).not.toBeNull();
      expect(result?.slug).toBe('lowercase-slug');
    });
  });

  describe('checkClientActive', () => {
    it('should return true for active client', async () => {
      const { checkClientActive } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'ACTIVE' });
      const isActive = await checkClientActive(client.id);
      
      expect(isActive).toBe(true);
    });

    it('should return false for paused client', async () => {
      const { checkClientActive } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'PAUSED' });
      const isActive = await checkClientActive(client.id);
      
      expect(isActive).toBe(false);
    });

    it('should return false for non-existent client', async () => {
      const { checkClientActive } = await import('@/app/_lib/client-gate');
      
      const isActive = await checkClientActive('non-existent-id');
      
      expect(isActive).toBe(false);
    });
  });

  describe('getActiveClient', () => {
    it('should return client when active', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ slug: 'active-client', status: 'ACTIVE' });
      const result = await getActiveClient('active-client');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(client.id);
      expect(result?.status).toBe('ACTIVE');
    });

    it('should return null when client does not exist', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      const result = await getActiveClient('non-existent');
      
      expect(result).toBeNull();
    });

    it('should return null when client is paused', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      await createTestClient({ slug: 'paused-client', status: 'PAUSED' });
      const result = await getActiveClient('paused-client');
      
      expect(result).toBeNull();
    });

    it('should emit execution_blocked event when client is paused', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ slug: 'paused-blocked', status: 'PAUSED' });
      
      // Call getActiveClient which should emit the blocked event
      await getActiveClient('paused-blocked');
      
      // Check that the event was emitted
      const events = await getEventsForClient(client.id);
      
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('execution_blocked');
      expect(events[0].success).toBe(false);
      expect(events[0].errorMessage).toContain('paused');
    });

    it('should NOT emit event when client is active', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ slug: 'active-no-event', status: 'ACTIVE' });
      
      await getActiveClient('active-no-event');
      
      // No events should be emitted for active clients
      const events = await getEventsForClient(client.id);
      expect(events.length).toBe(0);
    });

    it('should NOT emit event when client does not exist', async () => {
      const { getActiveClient } = await import('@/app/_lib/client-gate');
      
      await getActiveClient('totally-fake-client');
      
      // Can't emit events for non-existent client anyway
      const allEvents = await testPrisma.event.findMany();
      expect(allEvents.length).toBe(0);
    });
  });

  describe('pauseClient', () => {
    it('should update client status to PAUSED', async () => {
      const { pauseClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'ACTIVE' });
      await pauseClient(client.id);
      
      const updated = await testPrisma.client.findUnique({ where: { id: client.id } });
      expect(updated?.status).toBe('PAUSED');
    });

    it('should emit client_paused event', async () => {
      const { pauseClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'ACTIVE' });
      await pauseClient(client.id);
      
      const events = await getEventsForClient(client.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('client_paused');
      expect(events[0].success).toBe(true);
    });
  });

  describe('unpauseClient', () => {
    it('should update client status to ACTIVE', async () => {
      const { unpauseClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'PAUSED' });
      await unpauseClient(client.id);
      
      const updated = await testPrisma.client.findUnique({ where: { id: client.id } });
      expect(updated?.status).toBe('ACTIVE');
    });

    it('should emit client_unpaused event', async () => {
      const { unpauseClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ status: 'PAUSED' });
      await unpauseClient(client.id);
      
      const events = await getEventsForClient(client.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('client_unpaused');
      expect(events[0].success).toBe(true);
    });
  });

  describe('pause/unpause cycle', () => {
    it('should handle multiple pause/unpause cycles', async () => {
      const { getActiveClient, pauseClient, unpauseClient } = await import('@/app/_lib/client-gate');
      
      const client = await createTestClient({ slug: 'cycle-test', status: 'ACTIVE' });
      
      // Should be accessible when active
      expect(await getActiveClient('cycle-test')).not.toBeNull();
      
      // Pause
      await pauseClient(client.id);
      expect(await getActiveClient('cycle-test')).toBeNull();
      
      // Unpause
      await unpauseClient(client.id);
      expect(await getActiveClient('cycle-test')).not.toBeNull();
      
      // Pause again
      await pauseClient(client.id);
      expect(await getActiveClient('cycle-test')).toBeNull();
    });
  });
});

