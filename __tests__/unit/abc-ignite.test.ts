/**
 * ABC Ignite Adapter Tests
 * 
 * Priority: P1 - High
 * If broken: ABC Ignite calendar/booking operations fail
 * 
 * Tests:
 * - Configuration validation (clubNumber, secrets)
 * - Adapter loading (forClient factory)
 * - API request handling (success, errors, retryable)
 * - Secret security (no leaks in logs or errors)
 * - Member and enrollment operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testPrisma, createTestWorkspace, createAbcIgniteIntegration } from '../setup';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ABC Ignite Adapter', () => {
  // Test credentials (not real - just for testing structure)
  const TEST_APP_ID = 'test-app-id-12345';
  const TEST_APP_KEY = 'test-app-key-67890';
  const TEST_CLUB_NUMBER = '7715';
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration validation', () => {
    it('should detect missing clubNumber in meta', async () => {
      const client = await createTestWorkspace({ slug: 'abc-config-test' });
      
      // Create integration WITHOUT clubNumber in meta
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: '', // Empty club number
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      // Should return null when clubNumber is missing
      expect(adapter).toBeNull();
    });

    it('should detect missing secrets', async () => {
      const client = await createTestWorkspace({ slug: 'abc-no-secrets' });
      
      // Create integration with no secrets (using base function)
      await testPrisma.workspaceIntegration.create({
        data: {
          workspaceId: client.id,
          integration: 'ABC_IGNITE',
          secrets: [], // No secrets
          meta: { clubNumber: TEST_CLUB_NUMBER },
        },
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      // Should return null when secrets are missing
      expect(adapter).toBeNull();
    });

    it('should validate config and return missing items', async () => {
      const client = await createTestWorkspace({ slug: 'abc-validate' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      expect(adapter).not.toBeNull();
      
      const configCheck = adapter!.isConfigured();
      expect(configCheck.valid).toBe(true);
      expect(configCheck.missing).toEqual([]);
    });
  });

  describe('forClient factory', () => {
    it('should return null when integration does not exist', async () => {
      const client = await createTestWorkspace({ slug: 'abc-no-integration' });
      // No integration created
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      expect(adapter).toBeNull();
    });

    it('should load adapter successfully when properly configured', async () => {
      const client = await createTestWorkspace({ slug: 'abc-load-success' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
        eventTypes: {
          pt_session: { id: 'event-123', name: 'Personal Training', category: 'Appointment', duration: 30 },
        },
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      expect(adapter).not.toBeNull();
      expect(adapter!.getClubNumber()).toBe(TEST_CLUB_NUMBER);
    });

    it('should return correct client ID', async () => {
      const client = await createTestWorkspace({ slug: 'abc-client-id' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      expect(adapter!.getClientId()).toBe(client.id);
    });
  });

  describe('API request handling', () => {
    it('should handle successful API response', async () => {
      const client = await createTestWorkspace({ slug: 'abc-api-success' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          eventTypes: [
            { eventTypeId: '123', name: 'PT Session', category: 'Appointment' },
          ],
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${TEST_CLUB_NUMBER}/calendars/eventtypes`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'app_id': TEST_APP_ID,
            'app_key': TEST_APP_KEY,
          }),
        })
      );
    });

    it('should mark 5xx errors as retryable', async () => {
      const client = await createTestWorkspace({ slug: 'abc-5xx-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should NOT mark 4xx errors as retryable', async () => {
      const client = await createTestWorkspace({ slug: 'abc-4xx-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock 400 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('should handle network errors as retryable', async () => {
      const client = await createTestWorkspace({ slug: 'abc-network-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock network failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should parse error messages from JSON response', async () => {
      const client = await createTestWorkspace({ slug: 'abc-json-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock error with JSON body
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Invalid event ID' }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid event ID');
    });
  });

  describe('member operations', () => {
    it('should lookup member by barcode', async () => {
      const client = await createTestWorkspace({ slug: 'abc-member-lookup' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock member lookup response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          members: [
            { memberId: 'member-123', firstName: 'John', lastName: 'Doe', barcode: '12345' },
          ],
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getMemberByBarcode('12345');
      
      expect(result.success).toBe(true);
      expect(result.data?.memberId).toBe('member-123');
    });

    it('should return null for non-existent member', async () => {
      const client = await createTestWorkspace({ slug: 'abc-member-not-found' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock empty response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ members: [] }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getMemberByBarcode('nonexistent');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('enrollment operations', () => {
    it('should enroll member by memberId', async () => {
      const client = await createTestWorkspace({ slug: 'abc-enroll-id' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock enrollment success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.enrollMember('event-123', 'member-456');
      
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe('event-123');
      expect(result.data?.memberId).toBe('member-456');
    });

    it('should enroll member by barcode (with lookup)', async () => {
      const client = await createTestWorkspace({ slug: 'abc-enroll-barcode' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock member lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          members: [{ memberId: 'member-789', barcode: '12345' }],
        }),
      });
      
      // Mock enrollment success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.enrollMember('event-123', { barcode: '12345' });
      
      expect(result.success).toBe(true);
      expect(result.data?.memberId).toBe('member-789');
    });

    it('should fail enrollment when member not found by barcode', async () => {
      const client = await createTestWorkspace({ slug: 'abc-enroll-not-found' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock empty member lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ members: [] }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.enrollMember('event-123', { barcode: 'invalid' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should unenroll member successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-unenroll' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock unenrollment success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.unenrollMember('event-123', 'member-456');
      
      expect(result.success).toBe(true);
    });
  });

  describe('waitlist operations', () => {
    it('should add member to waitlist', async () => {
      const client = await createTestWorkspace({ slug: 'abc-waitlist-add' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock waitlist add success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.addToWaitlist('event-123', 'member-456');
      
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe('event-123');
    });

    it('should remove member from waitlist', async () => {
      const client = await createTestWorkspace({ slug: 'abc-waitlist-remove' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock waitlist remove success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.removeFromWaitlist('event-123', 'member-456');
      
      expect(result.success).toBe(true);
    });
  });

  describe('secret security', () => {
    it('should send secrets only in headers, never in URL', async () => {
      const client = await createTestWorkspace({ slug: 'abc-secret-headers' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      await adapter!.getEventTypes();
      
      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();
      
      const [url, options] = mockFetch.mock.calls[0];
      
      // Secrets should NOT be in URL
      expect(url).not.toContain(TEST_APP_ID);
      expect(url).not.toContain(TEST_APP_KEY);
      
      // Secrets SHOULD be in headers
      expect(options.headers['app_id']).toBe(TEST_APP_ID);
      expect(options.headers['app_key']).toBe(TEST_APP_KEY);
    });

    it('should not include secrets in error messages', async () => {
      const client = await createTestWorkspace({ slug: 'abc-secret-errors' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEventTypes();
      
      expect(result.success).toBe(false);
      // Error message should NOT contain secrets
      expect(result.error).not.toContain(TEST_APP_ID);
      expect(result.error).not.toContain(TEST_APP_KEY);
    });

    it('should not expose secrets through public getters', async () => {
      const client = await createTestWorkspace({ slug: 'abc-secret-getters' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      // Public getters should only expose safe, non-sensitive values
      expect(adapter!.getClubNumber()).toBe(TEST_CLUB_NUMBER);
      expect(adapter!.getClientId()).toBe(client.id);
      expect(adapter!.getDefaultEventTypeId()).toBeUndefined(); // Not set in test
      expect(adapter!.getDefaultEmployeeId()).toBeUndefined(); // Not set in test
      
      // None of the public getters should return anything resembling secrets
      const publicValues = [
        adapter!.getClubNumber(),
        adapter!.getClientId(),
        adapter!.getDefaultEventTypeId(),
        adapter!.getDefaultEmployeeId(),
      ];
      
      for (const value of publicValues) {
        if (value) {
          expect(value).not.toBe(TEST_APP_ID);
          expect(value).not.toBe(TEST_APP_KEY);
          expect(value).not.toContain('app');
          expect(value).not.toContain('key');
        }
      }
    });
  });

  describe('employee operations', () => {
    it('should fetch employees successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-employees-fetch' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock employees response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          employees: [
            {
              employeeId: 'emp-123',
              barcode: 'EMP123',
              personal: { firstName: 'John', lastName: 'Doe' },
              employment: { employeeStatus: 'Active' },
              assignedRoles: [{ roleId: '1', roleName: 'Personal Trainer' }],
            },
            {
              employeeId: 'emp-456',
              barcode: 'EMP456',
              personal: { firstName: 'Jane', lastName: 'Smith' },
              employment: { employeeStatus: 'Active' },
              assignedRoles: [],
            },
          ],
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEmployees();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].employeeId).toBe('emp-123');
      expect(result.data![0].personal?.firstName).toBe('John');
    });

    it('should filter employees by status', async () => {
      const client = await createTestWorkspace({ slug: 'abc-employees-filter' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock filtered response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ employees: [] }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      await adapter!.getEmployees({ employeeStatus: 'Inactive' });
      
      // Verify request URL includes filter parameter
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('employeeStatus=Inactive'),
        expect.anything()
      );
    });

    it('should handle employee API errors', async () => {
      const client = await createTestWorkspace({ slug: 'abc-employees-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Access denied',
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.getEmployees();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('rawRequest for testing', () => {
    it('should execute raw GET request successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-raw-get' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful response with all required properties
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ eventTypes: [{ id: '1', name: 'Test' }] }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.rawRequest('GET', '/calendars/eventtypes');
      
      expect(result.status).toBe(200);
      expect(result.error).toBeUndefined();
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect((result.data as { eventTypes: unknown[] }).eventTypes).toHaveLength(1);
    });

    it('should execute raw POST request with body', async () => {
      const client = await createTestWorkspace({ slug: 'abc-raw-post' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful response with all required properties
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ eventId: 'new-event-123' }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const body = { employeeId: 'emp-1', memberId: 'mem-1' };
      const result = await adapter!.rawRequest('POST', '/calendars/events', body);
      
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('should handle raw request errors gracefully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-raw-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Resource not found' }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.rawRequest('GET', '/invalid/endpoint');
      
      expect(result.status).toBe(404);
      expect(result.error).toContain('not found');
    });

    it('should handle network errors in raw request', async () => {
      const client = await createTestWorkspace({ slug: 'abc-raw-network-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock network failure
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.rawRequest('GET', '/employees');
      
      expect(result.status).toBe(0);
      expect(result.error).toBe('Connection refused');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should not leak secrets in raw request logs', async () => {
      const client = await createTestWorkspace({ slug: 'abc-raw-no-secrets' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ result: 'ok' }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      await adapter!.rawRequest('GET', '/employees');
      
      // Check that no log contains secrets
      for (const call of consoleSpy.mock.calls) {
        const logString = JSON.stringify(call);
        expect(logString).not.toContain(TEST_APP_ID);
        expect(logString).not.toContain(TEST_APP_KEY);
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('knownEndpoints', () => {
    it('should expose known endpoints as static property', async () => {
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      expect(AbcIgniteAdapter.knownEndpoints).toBeDefined();
      expect(Array.isArray(AbcIgniteAdapter.knownEndpoints)).toBe(true);
      expect(AbcIgniteAdapter.knownEndpoints.length).toBeGreaterThan(0);
    });

    it('should include required endpoint properties', async () => {
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      for (const endpoint of AbcIgniteAdapter.knownEndpoints) {
        expect(endpoint).toHaveProperty('method');
        expect(endpoint).toHaveProperty('path');
        expect(endpoint).toHaveProperty('description');
        expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(endpoint.method);
        expect(typeof endpoint.path).toBe('string');
        expect(typeof endpoint.description).toBe('string');
      }
    });

    it('should include employees endpoint', async () => {
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const employeesEndpoint = AbcIgniteAdapter.knownEndpoints.find(
        ep => ep.path === '/employees' && ep.method === 'GET'
      );
      
      expect(employeesEndpoint).toBeDefined();
      expect(employeesEndpoint?.description).toContain('employee');
    });

    it('should include booking endpoint', async () => {
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const bookingEndpoint = AbcIgniteAdapter.knownEndpoints.find(
        ep => ep.path === '/calendars/events' && ep.method === 'POST'
      );
      
      expect(bookingEndpoint).toBeDefined();
      expect(bookingEndpoint?.description.toLowerCase()).toContain('booking');
    });
  });

  describe('connection test', () => {
    it('should test connection successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-test-conn' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful event types response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventTypes: [
            { eventTypeId: '1', name: 'PT Session' },
            { eventTypeId: '2', name: 'Group Class' },
          ],
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('2 event types');
    });

    it('should report connection failure', async () => {
      const client = await createTestWorkspace({ slug: 'abc-test-conn-fail' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials',
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection test failed');
    });
  });
});
