/**
 * Booking Workflow Integration Tests
 * 
 * Priority: P1 - High
 * If broken: Booking system fails, customers can't book appointments,
 *           workflow-based booking stops working.
 * 
 * Tests:
 * - Booking with configured workflow uses sync workflow
 * - Booking without workflow falls back to direct provider
 * - Booking workflow executes ABC Ignite action correctly
 * - Booking failure in workflow returns proper error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  testPrisma,
  createTestWorkspace,
  createAbcIgniteIntegration,
  createTestWorkflow,
} from '../setup';

// Mock the ABC Ignite adapter
vi.mock('@/app/_lib/integrations/abc-ignite.adapter', async () => {
  const actual = await vi.importActual('@/app/_lib/integrations/abc-ignite.adapter');
  
  return {
    ...actual,
    AbcIgniteAdapter: {
      forClient: vi.fn().mockImplementation(async (workspaceId: string) => {
        // Check if integration exists
        const integration = await testPrisma.workspaceIntegration.findFirst({
          where: { workspaceId, integration: 'ABC_IGNITE' },
        });
        
        if (!integration) {
          return null;
        }
        
        // Return mock adapter
        return {
          workspaceId,
          meta: integration.meta,
          createAppointment: vi.fn().mockResolvedValue({
            success: true,
            data: { eventId: 'mock-event-123' },
          }),
          getMemberByBarcode: vi.fn().mockResolvedValue({
            success: true,
            data: { memberId: 'mock-member-456', name: 'Test Member' },
          }),
          enrollMember: vi.fn().mockResolvedValue({
            success: true,
            data: { memberId: 'mock-member-456', enrolled: true },
          }),
          addToWaitlist: vi.fn().mockResolvedValue({
            success: true,
            data: { memberId: 'mock-member-456', position: 1 },
          }),
          getDefaultEmployeeId: () => 'default-emp',
          getDefaultEventTypeId: () => 'default-evt',
        };
      }),
    },
  };
});

// Mock the booking provider to use our mocked adapter
vi.mock('@/app/_lib/booking/get-provider', async () => {
  const actual = await vi.importActual('@/app/_lib/booking/get-provider');
  
  return {
    ...actual,
    getBookingProvider: vi.fn().mockImplementation(async (workspaceId: string) => {
      const integration = await testPrisma.workspaceIntegration.findFirst({
        where: { workspaceId, integration: 'ABC_IGNITE' },
      });
      
      if (!integration) {
        return null;
      }
      
      // Return mock provider
      return {
        capabilities: {
          supportsWaitlist: true,
          supportsEmployeeSelection: true,
        },
        createBooking: vi.fn().mockResolvedValue({
          success: true,
          bookingId: 'provider-booking-123',
        }),
        addToWaitlist: vi.fn().mockResolvedValue({
          success: true,
        }),
        lookupCustomer: vi.fn().mockResolvedValue({
          id: 'customer-123',
          name: 'Test Customer',
          email: 'test@example.com',
          providerData: {},
        }),
      };
    }),
  };
});

describe('Booking Workflow Integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('Sync Workflow Execution with Booking', () => {
    it('should execute booking workflow when configured', async () => {
      const { executeWorkflowSync } = await import('@/app/_lib/workflow');
      
      // Create workspace with ABC Ignite configured
      const workspace = await createTestWorkspace({ slug: 'booking-workflow-test' });
      await createAbcIgniteIntegration(workspace.id, 'test-app-id', 'test-app-key', {
        clubNumber: '12345',
      });
      
      // Create booking workflow
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'ABC Ignite Booking',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [
            {
              adapter: 'abc_ignite',
              operation: 'create_appointment',
              params: {
                employeeId: '{{trigger.payload.employeeId}}',
                eventTypeId: '{{trigger.payload.eventTypeId}}',
                startTime: '{{trigger.payload.startTime}}',
                memberId: '{{trigger.payload.memberId}}',
              },
            },
          ],
        },
      });
      
      // Execute sync workflow
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        {
          employeeId: 'emp-123',
          eventTypeId: 'evt-456',
          startTime: '2026-01-24 09:00:00',
          memberId: 'mem-789',
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.workflowName).toBe('ABC Ignite Booking');
      
      // Verify execution was recorded
      const executions = await testPrisma.workflowExecution.findMany({
        where: { workspaceId: workspace.id },
      });
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe('COMPLETED');
    });

    it('should return noWorkflow when no workflow configured and allowNoWorkflow is true', async () => {
      const { executeWorkflowSync } = await import('@/app/_lib/workflow');
      
      // Create workspace without any workflow
      const workspace = await createTestWorkspace({ slug: 'no-workflow-test' });
      await createAbcIgniteIntegration(workspace.id, 'test-app-id', 'test-app-key', {
        clubNumber: '12345',
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { employeeId: 'emp', eventTypeId: 'evt', startTime: 'time', memberId: 'mem' },
        { allowNoWorkflow: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.noWorkflow).toBe(true);
    });

    it('should fail gracefully when ABC Ignite is not configured', async () => {
      const { executeWorkflowSync } = await import('@/app/_lib/workflow');
      
      // Create workspace WITHOUT ABC Ignite
      const workspace = await createTestWorkspace({ slug: 'no-abc-test' });
      
      // Create booking workflow (but ABC not configured)
      await testPrisma.workflow.create({
        data: {
          workspaceId: workspace.id,
          name: 'Unconfigured ABC Workflow',
          enabled: true,
          triggerAdapter: 'booking',
          triggerOperation: 'create_booking',
          actions: [
            {
              adapter: 'abc_ignite',
              operation: 'create_appointment',
              params: {},
            },
          ],
        },
      });
      
      const result = await executeWorkflowSync(
        workspace.id,
        { adapter: 'booking', operation: 'create_booking' },
        { employeeId: 'emp', eventTypeId: 'evt', startTime: 'time', memberId: 'mem' }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ABC Ignite not configured');
    });
  });

  describe('Booking Registry and Adapters', () => {
    it('should have booking adapter registered', async () => {
      const { getAdapter, ADAPTER_REGISTRY } = await import('@/app/_lib/workflow');
      
      const bookingAdapter = getAdapter('booking');
      expect(bookingAdapter).not.toBeNull();
      expect(bookingAdapter?.name).toBe('Booking System');
      expect(bookingAdapter?.triggers.create_booking).toBeDefined();
      expect(bookingAdapter?.triggers.add_to_waitlist).toBeDefined();
      
      // Also check it's in the registry
      expect(ADAPTER_REGISTRY.booking).toBeDefined();
    });

    it('should have create_appointment action registered for ABC Ignite', async () => {
      const { getAction } = await import('@/app/_lib/workflow');
      
      const action = getAction('abc_ignite', 'create_appointment');
      expect(action).not.toBeNull();
      expect(action?.label).toBe('Create Appointment');
    });
  });
});
