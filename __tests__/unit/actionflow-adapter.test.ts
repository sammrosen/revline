/**
 * ActionFlow Adapter — Unit Tests
 *
 * Covers ActionFlowAdapter operations:
 * token exchange and caching, createCustomerWithLead, createCustomer,
 * getCustomers, getJob, validateConfig, error handling, health tracking.
 *
 * Pattern: mock global fetch, create workspace + integration via testPrisma,
 * load adapter, assert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { testPrisma, createTestWorkspace } from '../setup';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const TEST_ENTERPRISE_ID = '77';

async function createActionFlowIntegration(workspaceId: string) {
  const { encryptSecret } = await import('@/app/_lib/crypto');

  const secrets = [
    { name: 'Client ID', value: 'test-client-id' },
    { name: 'Client Secret', value: 'test-client-secret' },
    { name: 'Username', value: 'test-username' },
    { name: 'Password', value: 'test-password' },
  ].map(({ name, value }) => {
    const { encryptedSecret, keyVersion } = encryptSecret(value);
    return {
      id: randomUUID(),
      name,
      encryptedValue: encryptedSecret,
      keyVersion,
    };
  });

  return testPrisma.workspaceIntegration.create({
    data: {
      workspaceId,
      integration: 'ACTIONFLOW',
      secrets: secrets as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: {
        enterpriseId: TEST_ENTERPRISE_ID,
      } as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

/** Mock a successful token exchange */
function mockTokenResponse(token = 'test-bearer-token') {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ access_token: token, token_type: 'bearer' }),
    text: async () => JSON.stringify({ access_token: token, token_type: 'bearer' }),
  };
}

/** Mock a successful JSON response */
function okResponse(data: unknown, status = 200) {
  const body = JSON.stringify(data);
  return {
    ok: true,
    status,
    headers: { get: () => null },
    json: async () => data,
    text: async () => body,
  };
}

/** Mock an error response */
function errorResponse(status: number, body = '') {
  return {
    ok: false,
    status,
    headers: { get: (k: string) => (k === 'Retry-After' ? '3' : null) },
    json: async () => ({}),
    text: async () => body,
  };
}

describe('ActionFlowAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('token management', () => {
    it('exchanges credentials for a bearer token', async () => {
      const ws = await createTestWorkspace({ slug: `af-token-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      // Token exchange + actual API call
      mockFetch
        .mockResolvedValueOnce(mockTokenResponse('my-token'))
        .mockResolvedValueOnce(okResponse(['Customer A', 'Customer B']));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);
      expect(adapter).not.toBeNull();

      const result = await adapter!.getCustomers();
      expect(result.success).toBe(true);

      // Verify token exchange was called
      const tokenCall = mockFetch.mock.calls[0];
      expect(String(tokenCall[0])).toContain('/clienttoken');

      // Verify API call used Bearer token
      const apiCall = mockFetch.mock.calls[1];
      expect(apiCall[1].headers['Authorization']).toBe('Bearer my-token');
      expect(apiCall[1].headers['EnterpriseID']).toBe(TEST_ENTERPRISE_ID);
    });

    it('retries with a fresh token on 401', async () => {
      const ws = await createTestWorkspace({ slug: `af-401-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch
        // First token exchange
        .mockResolvedValueOnce(mockTokenResponse('expired-token'))
        // API call returns 401
        .mockResolvedValueOnce(errorResponse(401))
        // Second token exchange (after invalidation)
        .mockResolvedValueOnce(mockTokenResponse('fresh-token'))
        // Retry API call succeeds
        .mockResolvedValueOnce(okResponse(['Customer A']));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getCustomers();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Customer A']);

      // Should have made 4 fetch calls: token, 401, token again, success
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('returns non-retryable error if token exchange fails', async () => {
      const ws = await createTestWorkspace({ slug: `af-tokenfail-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Invalid credentials'));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getCustomers();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Token exchange failed');
      expect(result.retryable).toBe(false);
    });
  });

  describe('createCustomerWithLead', () => {
    it('creates a customer with lead notification', async () => {
      const ws = await createTestWorkspace({ slug: `af-cwl-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      const customerResponse = {
        Phones: [{ PhoneParentID: 12345 }],
        Emails: [{ EmailParentID: 12345 }],
        Jobs: [{ JobID: 999, CustomerID: 12345, CustomerName: 'John Doe', Name: 'Kitchen Counters', Status: 'Created' }],
      };

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(okResponse(customerResponse));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.createCustomerWithLead({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '5555555555',
        actionComment: 'New lead from website',
        jobs: [{ name: 'Kitchen Counters', notes: 'Granite 3cm' }],
      });

      expect(result.success).toBe(true);
      expect(result.data?.customerId).toBe(12345);
      expect(result.data?.name).toBe('John Doe');
      expect(result.data?.jobs).toHaveLength(1);
      expect(result.data?.jobs?.[0].jobId).toBe(999);

      // Verify the API call body
      const apiCall = mockFetch.mock.calls[1];
      expect(String(apiCall[0])).toContain('/customers/createCustomerWithLead');
      const body = JSON.parse(apiCall[1].body);
      expect(body.Name).toBe('John Doe');
      expect(body.Phones[0].PhoneNumber).toBe('5555555555');
      expect(body.Emails[0].EmailAddress).toBe('john@example.com');
      expect(body.ActionEnts[0].ActionComment).toBe('New lead from website');
      expect(body.Jobs[0].Name).toBe('Kitchen Counters');
    });

    it('handles API failure gracefully', async () => {
      const ws = await createTestWorkspace({ slug: `af-cwl-fail-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.createCustomerWithLead({ name: 'Test' });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });

  describe('createCustomer', () => {
    it('creates a customer without lead notification', async () => {
      const ws = await createTestWorkspace({ slug: `af-cc-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      const customerResponse = {
        Phones: [{ PhoneParentID: 54321 }],
        Emails: [{ EmailParentID: 54321 }],
        Jobs: [],
      };

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(okResponse(customerResponse));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.createCustomer({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.customerId).toBe(54321);

      // Verify the API call goes to /customers/create (not createCustomerWithLead)
      const apiCall = mockFetch.mock.calls[1];
      expect(String(apiCall[0])).toContain('/customers/create');
      expect(String(apiCall[0])).not.toContain('createCustomerWithLead');
    });
  });

  describe('getCustomers', () => {
    it('returns a list of customer names', async () => {
      const ws = await createTestWorkspace({ slug: `af-gc-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      const customers = ['ABC Countertops', 'Quinn, Robert', 'Smith, Alan'];

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(okResponse(customers));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getCustomers();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(customers);
      expect(result.data).toHaveLength(3);
    });
  });

  describe('getJob', () => {
    it('returns job details by ID', async () => {
      const ws = await createTestWorkspace({ slug: `af-gj-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      const job = {
        JobID: 1507010,
        CustomerID: 12345,
        CustomerName: 'Mrs. Taylor',
        EnterpriseID: 77,
        JobNum: 3924,
        Name: 'Primary Home',
        Notes: 'Kitchen remodel',
        Status: 'Created',
        CreatedDate: '2024-03-21T00:00:00',
        Calcs: [
          {
            CalcID: 2975862,
            CalcNum: 6241,
            IsActive: true,
            Material: 'Caesarstone 3CM',
            Color: '1050 Shining Armor 3CM',
            CalcLineItems: [],
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(okResponse(job));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getJob(1507010);
      expect(result.success).toBe(true);
      expect(result.data?.JobID).toBe(1507010);
      expect(result.data?.Name).toBe('Primary Home');
      expect(result.data?.Calcs).toHaveLength(1);

      // Verify query params
      const apiCall = mockFetch.mock.calls[1];
      const url = new URL(String(apiCall[0]));
      expect(url.searchParams.get('jobID')).toBe('1507010');
      expect(url.searchParams.get('includeCompleted')).toBe('false');
    });

    it('handles 404 as non-retryable', async () => {
      const ws = await createTestWorkspace({ slug: `af-gj404-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(errorResponse(404));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getJob(99999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.retryable).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('returns valid on successful connection', async () => {
      const ws = await createTestWorkspace({ slug: `af-vc-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce(okResponse(['Customer A']));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.validateConfig();
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
    });

    it('returns error on invalid credentials', async () => {
      const ws = await createTestWorkspace({ slug: `af-vc-fail-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.validateConfig();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Token exchange failed');
    });
  });

  describe('rate limiting', () => {
    it('marks 429 as retryable with retryAfterMs', async () => {
      const ws = await createTestWorkspace({ slug: `af-429-${Date.now()}` });
      await createActionFlowIntegration(ws.id);

      mockFetch
        .mockResolvedValueOnce(mockTokenResponse())
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: (k: string) => (k === 'Retry-After' ? '5' : null) },
          json: async () => ({}),
          text: async () => '',
        });

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);

      const result = await adapter!.getCustomers();
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.retryAfterMs).toBe(5000);
    });
  });

  describe('forWorkspace', () => {
    it('returns null when integration is not configured', async () => {
      const ws = await createTestWorkspace({ slug: `af-null-${Date.now()}` });
      // No integration created

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);
      expect(adapter).toBeNull();
    });

    it('returns null when no secrets are configured', async () => {
      const ws = await createTestWorkspace({ slug: `af-nosec-${Date.now()}` });
      await testPrisma.workspaceIntegration.create({
        data: {
          workspaceId: ws.id,
          integration: 'ACTIONFLOW',
          secrets: [] as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
          meta: { enterpriseId: '77' } as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
        },
      });

      const { ActionFlowAdapter } = await import('@/app/_lib/integrations');
      const adapter = await ActionFlowAdapter.forWorkspace(ws.id);
      expect(adapter).toBeNull();
    });
  });
});
