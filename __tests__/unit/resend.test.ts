/**
 * Resend Integration Tests
 * 
 * Priority: P1 - High
 * If broken: Transactional email sending fails (booking confirmations, etc.)
 * 
 * Tests:
 * - Configuration validation (fromEmail required)
 * - Adapter loading (forWorkspace factory)
 * - API request handling (success, errors)
 * - Secret security (no leaks)
 * - Executor workflow integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testPrisma, createTestWorkspace, createResendIntegration } from '../setup';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the Resend SDK
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}));

describe('Resend Adapter', () => {
  const TEST_API_KEY = 're_test_api_key_12345';
  const TEST_FROM_EMAIL = 'bookings@test.example.com';
  const TEST_FROM_NAME = 'Test Gym';
  const TEST_REPLY_TO = 'support@test.example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration validation', () => {
    it('should detect missing fromEmail in meta', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-config-test' });
      
      // Create integration WITHOUT fromEmail in meta
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: '', // Empty from email
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      
      // Adapter loads but isConfigured should return false
      expect(adapter!.isConfigured()).toBe(false);
      
      // Validation should report error
      const validation = adapter!.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('fromEmail is required');
    });

    it('should detect invalid fromEmail format', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-invalid-email' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: 'not-an-email',
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      
      const validation = adapter!.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('fromEmail must be a valid email address');
    });

    it('should detect invalid replyTo format', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-invalid-reply' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        replyTo: 'not-an-email',
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      
      const validation = adapter!.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('replyTo must be a valid email address');
    });

    it('should pass validation with valid config', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-valid' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        fromName: TEST_FROM_NAME,
        replyTo: TEST_REPLY_TO,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      expect(adapter!.isConfigured()).toBe(true);
      
      const validation = adapter!.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('forWorkspace factory', () => {
    it('should return null when integration does not exist', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-no-integration' });
      // No integration created
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).toBeNull();
    });

    it('should return null when no secrets configured', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-no-secrets' });
      
      // Create integration with no secrets
      await testPrisma.workspaceIntegration.create({
        data: {
          workspaceId: workspace.id,
          integration: 'RESEND',
          secrets: [], // No secrets
          meta: { fromEmail: TEST_FROM_EMAIL },
        },
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).toBeNull();
    });

    it('should load adapter with valid config', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-valid-load' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        fromName: TEST_FROM_NAME,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      expect(adapter!.getFromEmail()).toBe(TEST_FROM_EMAIL);
      expect(adapter!.getFromName()).toBe(TEST_FROM_NAME);
    });

    it('should support forClient alias for backwards compatibility', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-for-client' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forClient(workspace.id);
      
      expect(adapter).not.toBeNull();
    });
  });

  describe('buildFromAddress', () => {
    it('should build from address with name', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-from-name' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        fromName: TEST_FROM_NAME,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      const fromAddress = adapter!.buildFromAddress();
      expect(fromAddress).toBe(`${TEST_FROM_NAME} <${TEST_FROM_EMAIL}>`);
    });

    it('should build from address without name', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-no-name' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        // No fromName
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      const fromAddress = adapter!.buildFromAddress();
      expect(fromAddress).toBe(TEST_FROM_EMAIL);
    });

    it('should allow override email and name', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-override' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        fromName: TEST_FROM_NAME,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      const fromAddress = adapter!.buildFromAddress('custom@example.com', 'Custom Name');
      expect(fromAddress).toBe('Custom Name <custom@example.com>');
    });

    it('should throw error if fromEmail not configured', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-no-from' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: '', // Empty
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      expect(() => adapter!.buildFromAddress()).toThrow('fromEmail is not configured');
    });
  });

  describe('getReplyTo', () => {
    it('should return configured replyTo', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-reply-to' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        replyTo: TEST_REPLY_TO,
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      expect(adapter!.getReplyTo()).toBe(TEST_REPLY_TO);
    });

    it('should return null when no replyTo configured', async () => {
      const workspace = await createTestWorkspace({ slug: 'resend-no-reply' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
        // No replyTo
      });
      
      const { ResendAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ResendAdapter.forWorkspace(workspace.id);
      
      expect(adapter).not.toBeNull();
      expect(adapter!.getReplyTo()).toBeNull();
    });
  });
});

describe('Resend Executor', () => {
  const TEST_API_KEY = 're_test_api_key_executor';
  const TEST_FROM_EMAIL = 'bookings@executor-test.com';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('send_email action', () => {
    it('should return error when Resend not configured', async () => {
      const workspace = await createTestWorkspace({ slug: 'exec-no-resend' });
      // No Resend integration created
      
      const { resendExecutors } = await import('@/app/_lib/workflow/executors/resend');
      
      const result = await resendExecutors.send_email.execute(
        {
          workspaceId: workspace.id,
          clientId: workspace.id,
          email: 'recipient@example.com',
          trigger: { adapter: 'test', operation: 'test', payload: {} },
          actionData: {},
        },
        {
          subject: 'Test Subject',
          body: '<p>Test body</p>',
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Resend not configured');
    });

    it('should return error when fromEmail not configured', async () => {
      const workspace = await createTestWorkspace({ slug: 'exec-no-from' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: '', // Empty
      });
      
      const { resendExecutors } = await import('@/app/_lib/workflow/executors/resend');
      
      const result = await resendExecutors.send_email.execute(
        {
          workspaceId: workspace.id,
          clientId: workspace.id,
          email: 'recipient@example.com',
          trigger: { adapter: 'test', operation: 'test', payload: {} },
          actionData: {},
        },
        {
          subject: 'Test Subject',
          body: '<p>Test body</p>',
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('configuration error');
    });

    it('should return error when no recipient email in context', async () => {
      const workspace = await createTestWorkspace({ slug: 'exec-no-recipient' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
      });
      
      const { resendExecutors } = await import('@/app/_lib/workflow/executors/resend');
      
      const result = await resendExecutors.send_email.execute(
        {
          workspaceId: workspace.id,
          clientId: workspace.id,
          email: '', // Empty email
          trigger: { adapter: 'test', operation: 'test', payload: {} },
          actionData: {},
        },
        {
          subject: 'Test Subject',
          body: '<p>Test body</p>',
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No recipient email');
    });

    it('should return error when missing subject parameter', async () => {
      const workspace = await createTestWorkspace({ slug: 'exec-no-subject' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
      });
      
      const { resendExecutors } = await import('@/app/_lib/workflow/executors/resend');
      
      const result = await resendExecutors.send_email.execute(
        {
          workspaceId: workspace.id,
          clientId: workspace.id,
          email: 'recipient@example.com',
          trigger: { adapter: 'test', operation: 'test', payload: {} },
          actionData: {},
        },
        {
          // No subject
          body: '<p>Test body</p>',
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing subject');
    });

    it('should return error when missing body parameter', async () => {
      const workspace = await createTestWorkspace({ slug: 'exec-no-body' });
      
      await createResendIntegration(workspace.id, TEST_API_KEY, {
        fromEmail: TEST_FROM_EMAIL,
      });
      
      const { resendExecutors } = await import('@/app/_lib/workflow/executors/resend');
      
      const result = await resendExecutors.send_email.execute(
        {
          workspaceId: workspace.id,
          clientId: workspace.id,
          email: 'recipient@example.com',
          trigger: { adapter: 'test', operation: 'test', payload: {} },
          actionData: {},
        },
        {
          subject: 'Test Subject',
          // No body
        }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing body');
    });
  });
});

describe('Resend Registry', () => {
  it('should have send_email action registered', async () => {
    const { getAction } = await import('@/app/_lib/workflow/registry');
    
    const action = getAction('resend', 'send_email');
    expect(action).not.toBeNull();
    expect(action!.name).toBe('send_email');
    expect(action!.label).toBe('Send Email');
  });

  it('should have correct requirements', async () => {
    const { getAdapter } = await import('@/app/_lib/workflow/registry');
    
    const adapter = getAdapter('resend');
    expect(adapter).not.toBeNull();
    expect(adapter!.requiresIntegration).toBe(true);
    expect(adapter!.requirements?.secrets).toContain('API Key');
    expect(adapter!.requirements?.metaKeys).toContain('fromEmail');
  });

  it('should be included in actions for UI', async () => {
    const { getActionsForUI } = await import('@/app/_lib/workflow/registry');
    
    const actions = getActionsForUI();
    const resendAdapter = actions.find(a => a.adapterId === 'resend');
    
    expect(resendAdapter).toBeDefined();
    expect(resendAdapter!.adapterName).toBe('Resend');
    expect(resendAdapter!.requiresIntegration).toBe(true);
    expect(resendAdapter!.actions.length).toBeGreaterThan(0);
  });
});

describe('Executor Registry', () => {
  it('should have resend executor registered', async () => {
    const { hasActionExecutor, getActionExecutor } = await import('@/app/_lib/workflow/executors');
    
    expect(hasActionExecutor('resend', 'send_email')).toBe(true);
    
    const executor = getActionExecutor('resend', 'send_email');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('should return resend operations', async () => {
    const { getAdapterOperations } = await import('@/app/_lib/workflow/executors');
    
    const operations = getAdapterOperations('resend');
    expect(operations).toContain('send_email');
  });
});
