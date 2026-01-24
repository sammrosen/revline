/**
 * Sync Workflow Execution Tests
 * 
 * Priority: P1 - High
 * If broken: User-facing booking flows will fail, sync workflow execution breaks,
 *           and booking API fallback logic may not work correctly.
 * 
 * Tests:
 * - Sync workflow execution with single matching workflow
 * - Error when multiple workflows match (ambiguous)
 * - Graceful handling when no workflow is configured
 * - Timeout handling
 * - Result data propagation from action
 * - Filter matching still works in sync mode
 */

import { describe, it, expect, vi } from 'vitest';
import {
  testPrisma,
  createTestWorkspace,
} from '../setup';
import { executeWorkflowSync } from '@/app/_lib/workflow';

// Mock the action executors to avoid calling real integrations
vi.mock('@/app/_lib/workflow/executors', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/app/_lib/workflow/executors')>();
  return {
    ...original,
    getActionExecutor: vi.fn((adapter: string, operation: string) => {
      // Mock revline.create_lead to succeed
      if (adapter === 'revline' && operation === 'create_lead') {
        return {
          execute: async () => ({
            success: true,
            data: { leadId: 'test-lead-123' },
          }),
        };
      }
      // Mock abc_ignite.create_appointment to succeed
      if (adapter === 'abc_ignite' && operation === 'create_appointment') {
        return {
          execute: async () => ({
            success: true,
            data: { eventId: 'abc-event-456', bookingId: 'abc-event-456' },
          }),
        };
      }
      // Mock failing action
      if (adapter === 'test' && operation === 'fail') {
        return {
          execute: async () => ({
            success: false,
            error: 'Simulated failure',
          }),
        };
      }
      // Default mock
      return {
        execute: async () => ({ success: true, data: {} }),
      };
    }),
  };
});

describe('Sync Workflow Execution', () => {
  describe('executeWorkflowSync', () => {
    it('should execute a single matching workflow and return results', async () => {
      // Create workspace with a workflow
      const workspace = await createTestWorkspace();
      
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Test Booking Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [
            { adapter: 'abc_ignite', operation: 'create_appointment', params: {} },
          ],
        },
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { employeeId: 'emp-1', eventTypeId: 'evt-1', startTime: '2026-01-24 09:00:00', memberId: 'mem-1' }
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe('abc-event-456');
      expect(result.data?.bookingId).toBe('abc-event-456');
      expect(result.workflowId).toBeDefined();
      expect(result.workflowName).toBe('Test Booking Workflow');
    });

    it('should return error when multiple workflows match the trigger', async () => {
      const workspace = await createTestWorkspace();
      
      // Create two workflows with the same trigger
      await testPrisma.workflow.createMany({
        data: [
          {
            workspaceId: workspace.id,
            name: 'Workflow 1',
            enabled: true,
            triggerAdapter: 'booking',
            triggerOperation: 'create_booking',
            actions: [{ adapter: 'revline', operation: 'create_lead', params: {} }],
          },
          {
            workspaceId: workspace.id,
            name: 'Workflow 2',
            enabled: true,
            triggerAdapter: 'booking',
            triggerOperation: 'create_booking',
            actions: [{ adapter: 'revline', operation: 'create_lead', params: {} }],
          },
        ],
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { test: true }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple workflows');
      expect(result.error).toContain('2');
    });

    it('should return error when no workflow is configured (without allowNoWorkflow)', async () => {
      const workspace = await createTestWorkspace();
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { test: true }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No workflow configured');
    });

    it('should return success with noWorkflow flag when allowNoWorkflow is true', async () => {
      const workspace = await createTestWorkspace();
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { test: true },
        { allowNoWorkflow: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.noWorkflow).toBe(true);
    });

    it('should respect trigger filter and skip non-matching payloads', async () => {
      const workspace = await createTestWorkspace();
      
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Filtered Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          triggerFilter: { eventType: 'premium' },
          actions: [{ adapter: 'revline', operation: 'create_lead', params: {} }],
        },
      });
      
      // This payload doesn't match the filter
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { eventType: 'standard' }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match workflow filter');
    });

    it('should not execute disabled workflows', async () => {
      const workspace = await createTestWorkspace();
      
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Disabled Workflow',
          enabled: false, // Disabled!
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [{ adapter: 'revline', operation: 'create_lead', params: {} }],
        },
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { test: true }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No workflow configured');
    });

    it('should return action error when action fails', async () => {
      const workspace = await createTestWorkspace();
      
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Failing Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [{ adapter: 'test', operation: 'fail', params: {} }],
        },
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { test: true }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated failure');
    });

    it('should create a workflow execution record for audit trail', async () => {
      const workspace = await createTestWorkspace();
      
      const workflow = await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Audited Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [{ adapter: 'revline', operation: 'create_lead', params: {} }],
        },
      });
      
      await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { email: 'test@example.com' }
      );
      
      // Check that execution record was created
      const executions = await testPrisma.workflowExecution.findMany({
        where: { workflowId: workflow.id },
      });
      
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe('COMPLETED');
      expect(executions[0].triggerAdapter).toBe('booking');
      expect(executions[0].triggerOperation).toBe('create_booking');
    });

    it('should return last action result data for multi-action workflows', async () => {
      const workspace = await createTestWorkspace();
      
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Multi-Action Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [
            { adapter: 'revline', operation: 'create_lead', params: {} },
            { adapter: 'abc_ignite', operation: 'create_appointment', params: {} },
          ],
        },
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { email: 'test@example.com' }
      );
      
      // Should return the last action's result (abc_ignite.create_appointment)
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe('abc-event-456');
    });
  });
});
