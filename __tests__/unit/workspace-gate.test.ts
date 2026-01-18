/**
 * Workspace Gate Module Tests
 * 
 * Priority: P0 - Critical
 * If broken: Paused workspaces still execute (customer billing/support issues)
 * 
 * Tests:
 * - Active workspace returns workspace object
 * - Paused workspace returns null
 * - Non-existent workspace returns null
 * - Paused workspace emits execution_blocked event
 */

import { describe, it, expect } from 'vitest';
import { testPrisma, createTestWorkspace, getEventsForWorkspace } from '../setup';

describe('Workspace Gate Module', () => {
  
  describe('getWorkspaceBySlug', () => {
    it('should return workspace when slug exists', async () => {
      const { getWorkspaceBySlug } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ slug: 'test-slug' });
      const result = await getWorkspaceBySlug('test-slug');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(workspace.id);
      expect(result?.slug).toBe('test-slug');
    });

    it('should return null when slug does not exist', async () => {
      const { getWorkspaceBySlug } = await import('@/app/_lib/client-gate');
      
      const result = await getWorkspaceBySlug('non-existent-slug');
      
      expect(result).toBeNull();
    });

    it('should normalize slug to lowercase', async () => {
      const { getWorkspaceBySlug } = await import('@/app/_lib/client-gate');
      
      await createTestWorkspace({ slug: 'lowercase-slug' });
      const result = await getWorkspaceBySlug('LOWERCASE-SLUG');
      
      expect(result).not.toBeNull();
      expect(result?.slug).toBe('lowercase-slug');
    });
  });

  describe('checkWorkspaceActive', () => {
    it('should return true for active workspace', async () => {
      const { checkWorkspaceActive } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'ACTIVE' });
      const isActive = await checkWorkspaceActive(workspace.id);
      
      expect(isActive).toBe(true);
    });

    it('should return false for paused workspace', async () => {
      const { checkWorkspaceActive } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'PAUSED' });
      const isActive = await checkWorkspaceActive(workspace.id);
      
      expect(isActive).toBe(false);
    });

    it('should return false for non-existent workspace', async () => {
      const { checkWorkspaceActive } = await import('@/app/_lib/client-gate');
      
      const isActive = await checkWorkspaceActive('non-existent-id');
      
      expect(isActive).toBe(false);
    });
  });

  describe('getActiveWorkspace', () => {
    it('should return workspace when active', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ slug: 'active-workspace', status: 'ACTIVE' });
      const result = await getActiveWorkspace('active-workspace');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe(workspace.id);
      expect(result?.status).toBe('ACTIVE');
    });

    it('should return null when workspace does not exist', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      const result = await getActiveWorkspace('non-existent');
      
      expect(result).toBeNull();
    });

    it('should return null when workspace is paused', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      await createTestWorkspace({ slug: 'paused-workspace', status: 'PAUSED' });
      const result = await getActiveWorkspace('paused-workspace');
      
      expect(result).toBeNull();
    });

    it('should emit execution_blocked event when workspace is paused', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ slug: 'paused-blocked', status: 'PAUSED' });
      
      // Call getActiveWorkspace which should emit the blocked event
      await getActiveWorkspace('paused-blocked');
      
      // Check that the event was emitted
      const events = await getEventsForWorkspace(workspace.id);
      
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('execution_blocked');
      expect(events[0].success).toBe(false);
      expect(events[0].errorMessage).toContain('paused');
    });

    it('should NOT emit event when workspace is active', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ slug: 'active-no-event', status: 'ACTIVE' });
      
      await getActiveWorkspace('active-no-event');
      
      // No events should be emitted for active workspaces
      const events = await getEventsForWorkspace(workspace.id);
      expect(events.length).toBe(0);
    });

    it('should NOT emit event when workspace does not exist', async () => {
      const { getActiveWorkspace } = await import('@/app/_lib/client-gate');
      
      await getActiveWorkspace('totally-fake-workspace');
      
      // Can't emit events for non-existent workspace anyway
      const allEvents = await testPrisma.event.findMany();
      expect(allEvents.length).toBe(0);
    });
  });

  describe('pauseWorkspace', () => {
    it('should update workspace status to PAUSED', async () => {
      const { pauseWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'ACTIVE' });
      await pauseWorkspace(workspace.id);
      
      const updated = await testPrisma.workspace.findUnique({ where: { id: workspace.id } });
      expect(updated?.status).toBe('PAUSED');
    });

    it('should emit workspace_paused event', async () => {
      const { pauseWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'ACTIVE' });
      await pauseWorkspace(workspace.id);
      
      const events = await getEventsForWorkspace(workspace.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('workspace_paused');
      expect(events[0].success).toBe(true);
    });
  });

  describe('unpauseWorkspace', () => {
    it('should update workspace status to ACTIVE', async () => {
      const { unpauseWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'PAUSED' });
      await unpauseWorkspace(workspace.id);
      
      const updated = await testPrisma.workspace.findUnique({ where: { id: workspace.id } });
      expect(updated?.status).toBe('ACTIVE');
    });

    it('should emit workspace_unpaused event', async () => {
      const { unpauseWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ status: 'PAUSED' });
      await unpauseWorkspace(workspace.id);
      
      const events = await getEventsForWorkspace(workspace.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('workspace_unpaused');
      expect(events[0].success).toBe(true);
    });
  });

  describe('pause/unpause cycle', () => {
    it('should handle multiple pause/unpause cycles', async () => {
      const { getActiveWorkspace, pauseWorkspace, unpauseWorkspace } = await import('@/app/_lib/client-gate');
      
      const workspace = await createTestWorkspace({ slug: 'cycle-test', status: 'ACTIVE' });
      
      // Should be accessible when active
      expect(await getActiveWorkspace('cycle-test')).not.toBeNull();
      
      // Pause
      await pauseWorkspace(workspace.id);
      expect(await getActiveWorkspace('cycle-test')).toBeNull();
      
      // Unpause
      await unpauseWorkspace(workspace.id);
      expect(await getActiveWorkspace('cycle-test')).not.toBeNull();
      
      // Pause again
      await pauseWorkspace(workspace.id);
      expect(await getActiveWorkspace('cycle-test')).toBeNull();
    });
  });
});
