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
    vi.resetModules();
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

  describe('createAppointment', () => {
    it('should extract eventId from result.links href', async () => {
      const client = await createTestWorkspace({ slug: 'abc-create-appt' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock ABC response with eventId in result.links[0].href
      const expectedEventId = 'e8a60ab5cdfc46b6b123f7a07974cc18';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: {
            message: 'success',
            count: '1',
            messageCode: 'API-CAL-EVT-0000',
          },
          result: {
            links: [
              {
                rel: 'events',
                href: `/rest/${TEST_CLUB_NUMBER}/calendars/events/${expectedEventId}`,
              },
            ],
          },
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.createAppointment({
        employeeId: 'emp-123',
        eventTypeId: 'evt-456',
        levelId: 'level-789',
        startTime: '2026-01-24 10:00:00',
        memberId: 'member-abc',
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe(expectedEventId);
      expect(result.data?.message).toContain('Appointment created successfully');
    });

    it('should handle missing links in response gracefully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-create-appt-no-links' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock response without links (edge case)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: { message: 'success' },
          result: {},
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.createAppointment({
        employeeId: 'emp-123',
        eventTypeId: 'evt-456',
        levelId: 'level-789',
        startTime: '2026-01-24 10:00:00',
        memberId: 'member-abc',
      });
      
      // Should succeed but eventId will be undefined
      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBeUndefined();
    });

    it('should handle API errors', async () => {
      const client = await createTestWorkspace({ slug: 'abc-create-appt-error' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Member has no available sessions' }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.createAppointment({
        employeeId: 'emp-123',
        eventTypeId: 'evt-456',
        levelId: 'level-789',
        startTime: '2026-01-24 10:00:00',
        memberId: 'member-abc',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('no available sessions');
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

  describe('getEmployeeConfig', () => {
    it('should return employee config by key', async () => {
      const client = await createTestWorkspace({ slug: 'abc-emp-config' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
        employees: {
          sam_rosen: {
            id: '12d0d1472b314a95b4e53b08b20d8769',
            name: 'Sam Rosen',
            title: 'Personal Trainer',
          },
          jane_doe: {
            id: 'abc123def456',
            name: 'Jane Doe',
          },
        },
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const config = adapter!.getEmployeeConfig('sam_rosen');
      
      expect(config).toBeDefined();
      expect(config?.id).toBe('12d0d1472b314a95b4e53b08b20d8769');
      expect(config?.name).toBe('Sam Rosen');
      expect(config?.title).toBe('Personal Trainer');
    });

    it('should return undefined for unknown employee key', async () => {
      const client = await createTestWorkspace({ slug: 'abc-emp-config-missing' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
        employees: {
          sam_rosen: {
            id: '12d0d1472b314a95b4e53b08b20d8769',
            name: 'Sam Rosen',
          },
        },
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const config = adapter!.getEmployeeConfig('unknown_employee');
      
      expect(config).toBeUndefined();
    });

    it('should return undefined when no employees configured', async () => {
      const client = await createTestWorkspace({ slug: 'abc-emp-config-none' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
        // No employees configured
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const config = adapter!.getEmployeeConfig('sam_rosen');
      
      expect(config).toBeUndefined();
    });
  });

  describe('createAppointment soft failures', () => {
    it('should detect ABC soft failure (200 with count=0)', async () => {
      const client = await createTestWorkspace({ slug: 'abc-soft-fail' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock ABC "soft failure" - HTTP 200 but with error in status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: {
            message: "The employee for provided club doesn't exist or not active.",
            count: '0',
            clubNumber: TEST_CLUB_NUMBER,
          },
        }),
      });
      
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      
      const result = await adapter!.createAppointment({
        employeeId: 'invalid_employee',
        eventTypeId: 'evt-456',
        levelId: 'level-789',
        startTime: '2026-01-24 10:00:00',
        memberId: 'member-abc',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("employee");
      expect(result.error).toContain("not active");
    });
  });
});

describe('ABC Ignite Booking Provider', () => {
  const TEST_APP_ID = 'test-app-id-12345';
  const TEST_APP_KEY = 'test-app-key-67890';
  const TEST_CLUB_NUMBER = '7715';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('timezone handling (local time for ABC API)', () => {
    it('should use abcLocalStartTime from providerData in buildBookingPayload', async () => {
      const client = await createTestWorkspace({ slug: 'abc-tz-payload' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      // Simulate a slot from availability API:
      // UTC: 17:00 (5pm UTC) = 9:00 AM Pacific
      // The abcLocalStartTime should be "2026-01-24 09:00:00" (local time)
      const slot = {
        id: 'slot-123',
        startTime: '2026-01-24T17:00:00.000Z', // 5pm UTC = 9am Pacific
        endTime: '2026-01-24T18:00:00.000Z',
        duration: 60,
        title: 'PT Session',
        providerData: {
          employeeId: '12d0d1472b314a95b4e53b08b20d8769',
          eventTypeId: 'e97a362c66fe4b4683a36852eba33e5b',
          levelId: 'xzxxxxxxxxxxxxxxxxxxxxxxxxxxx001',
          isAvailabilitySlot: true,
          date: '01/24/2026', // ABC format MM/DD/YYYY
          localStartTime: '09:00', // Block start time (for reference)
          abcLocalStartTime: '2026-01-24 09:00:00', // Pre-calculated local time
        },
      };
      
      const customer = { id: 'member-abc123', name: 'John Doe' };
      const result = await provider.buildBookingPayload(slot, customer);
      
      expect(result.success).toBe(true);
      // Should use the LOCAL time (9:00), NOT the UTC time (17:00)
      expect(result.payload?.startTime).toBe('2026-01-24 09:00:00');
    });

    it('should fail buildBookingPayload when abcLocalStartTime is missing', async () => {
      const client = await createTestWorkspace({ slug: 'abc-tz-missing' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      // Slot WITHOUT abcLocalStartTime (legacy format or error)
      const slot = {
        id: 'slot-123',
        startTime: '2026-01-24T17:00:00.000Z',
        endTime: '2026-01-24T18:00:00.000Z',
        duration: 60,
        title: 'PT Session',
        providerData: {
          employeeId: 'emp-123',
          eventTypeId: 'evt-456',
          levelId: 'level-789',
          isAvailabilitySlot: true,
          // abcLocalStartTime is MISSING
        },
      };
      
      const customer = { id: 'member-abc123', name: 'John Doe' };
      const result = await provider.buildBookingPayload(slot, customer);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('abcLocalStartTime');
    });

    it('should calculate correct abcLocalStartTime for multiple slots in a time block', async () => {
      const client = await createTestWorkspace({ slug: 'abc-tz-multi-slots' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
        defaultEventTypeId: 'pt_session',
        eventTypes: {
          pt_session: {
            id: 'evt-123',
            name: 'Personal Training',
            category: 'Appointment',
            duration: 30, // 30-minute slots
          },
        },
        defaultEmployeeId: 'trainer1',
        employees: {
          trainer1: {
            id: 'emp-456',
            name: 'John Trainer',
          },
        },
      });
      
      // Mock availability API response:
      // A 2-hour block from 9:00-11:00 local (17:00-19:00 UTC for Pacific)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          availabilities: [
            {
              date: '01/24/2026',
              times: [
                {
                  startTime: '09:00', // Local time
                  endTime: '11:00',   // Local time
                  utcStartDateTime: '2026-01-24T17:00:00.000Z',
                  utcEndDateTime: '2026-01-24T19:00:00.000Z',
                },
              ],
            },
          ],
        }),
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const slots = await provider.getAvailability({
        startDate: '2026-01-24',
        endDate: '2026-01-24',
      });
      
      // With 30-min duration, a 2-hour block should produce 4 slots:
      // 9:00, 9:30, 10:00, 10:30
      expect(slots.length).toBe(4);
      
      // Verify each slot has the correct LOCAL time
      expect(slots[0].providerData?.abcLocalStartTime).toBe('2026-01-24 09:00:00');
      expect(slots[1].providerData?.abcLocalStartTime).toBe('2026-01-24 09:30:00');
      expect(slots[2].providerData?.abcLocalStartTime).toBe('2026-01-24 10:00:00');
      expect(slots[3].providerData?.abcLocalStartTime).toBe('2026-01-24 10:30:00');
    });

    it('should send correct local time to ABC API when creating booking', async () => {
      const client = await createTestWorkspace({ slug: 'abc-tz-create' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful ABC response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: { message: 'success', count: '1' },
          result: {
            links: [{ rel: 'events', href: `/rest/${TEST_CLUB_NUMBER}/calendars/events/new-event-123` }],
          },
        }),
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const slot = {
        id: 'slot-123',
        startTime: '2026-01-24T17:00:00.000Z', // 5pm UTC
        endTime: '2026-01-24T18:00:00.000Z',
        duration: 60,
        title: 'PT Session',
        providerData: {
          employeeId: 'emp-123',
          eventTypeId: 'evt-456',
          levelId: 'level-789',
          isAvailabilitySlot: true,
          abcLocalStartTime: '2026-01-24 09:00:00', // 9am LOCAL
        },
      };
      
      const customer = { id: 'member-abc', name: 'John' };
      await provider.createBooking(slot, customer);
      
      // Verify ABC API was called with LOCAL time, not UTC
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('09:00:00'), // Should contain local time
        })
      );
      
      // Also verify it does NOT contain the UTC time
      const requestBody = mockFetch.mock.calls[0][1].body;
      expect(requestBody).not.toContain('17:00:00'); // UTC time should NOT be present
    });
  });

  describe('buildBookingPayload', () => {
    it('should build appointment payload from availability slot', async () => {
      const client = await createTestWorkspace({ slug: 'abc-build-payload-appt' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const slot = {
        id: 'slot-123',
        startTime: '2026-01-24T18:00:00.000Z',
        endTime: '2026-01-24T19:00:00.000Z',
        duration: 60,
        title: 'PT Session',
        providerData: {
          employeeId: '12d0d1472b314a95b4e53b08b20d8769',
          eventTypeId: 'e97a362c66fe4b4683a36852eba33e5b',
          levelId: 'xzxxxxxxxxxxxxxxxxxxxxxxxxxxx001',
          isAvailabilitySlot: true,
          abcLocalStartTime: '2026-01-24 10:00:00', // Added required field
        },
      };
      
      const customer = {
        id: 'member-abc123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      
      const result = await provider.buildBookingPayload(slot, customer);
      
      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.type).toBe('appointment');
      expect(result.payload?.employeeId).toBe('12d0d1472b314a95b4e53b08b20d8769');
      expect(result.payload?.eventTypeId).toBe('e97a362c66fe4b4683a36852eba33e5b');
      expect(result.payload?.levelId).toBe('xzxxxxxxxxxxxxxxxxxxxxxxxxxxx001');
      expect(result.payload?.memberId).toBe('member-abc123');
      expect(result.payload?.startTime).toBe('2026-01-24 10:00:00'); // Uses local time now
    });

    it('should build enrollment payload from pre-scheduled event', async () => {
      const client = await createTestWorkspace({ slug: 'abc-build-payload-enroll' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const slot = {
        id: 'event-xyz789',
        startTime: '2026-01-24T18:00:00.000Z',
        endTime: '2026-01-24T19:00:00.000Z',
        duration: 60,
        title: 'Group Class',
        providerData: {
          isAvailabilitySlot: false,
        },
      };
      
      const customer = {
        id: 'member-def456',
        name: 'Jane Doe',
      };
      
      const result = await provider.buildBookingPayload(slot, customer);
      
      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.type).toBe('enrollment');
      expect(result.payload?.eventId).toBe('event-xyz789');
      expect(result.payload?.memberId).toBe('member-def456');
    });

    it('should fail when missing required slot data', async () => {
      const client = await createTestWorkspace({ slug: 'abc-build-payload-fail' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const slot = {
        id: 'slot-123',
        startTime: '2026-01-24T18:00:00.000Z',
        endTime: '2026-01-24T19:00:00.000Z',
        duration: 60,
        title: 'PT Session',
        providerData: {
          isAvailabilitySlot: true,
          // Missing employeeId, eventTypeId, levelId
        },
      };
      
      const customer = { id: 'member-abc', name: 'John' };
      
      const result = await provider.buildBookingPayload(slot, customer);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required slot data');
    });
  });

  describe('executeBookingPayload', () => {
    it('should execute appointment payload successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-exec-payload-appt' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const expectedEventId = 'new-event-abc123';
      
      // Mock successful ABC response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: { message: 'success', count: '1' },
          result: {
            links: [{ rel: 'events', href: `/rest/${TEST_CLUB_NUMBER}/calendars/events/${expectedEventId}` }],
          },
        }),
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const payload = {
        type: 'appointment',
        employeeId: '12d0d1472b314a95b4e53b08b20d8769',
        eventTypeId: 'e97a362c66fe4b4683a36852eba33e5b',
        levelId: 'xzxxxxxxxxxxxxxxxxxxxxxxxxxxx001',
        startTime: '2026-01-24 18:00:00',
        memberId: 'member-abc123',
      };
      
      const result = await provider.executeBookingPayload(payload);
      
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe(expectedEventId);
    });

    it('should execute enrollment payload successfully', async () => {
      const client = await createTestWorkspace({ slug: 'abc-exec-payload-enroll' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      // Mock successful enrollment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const payload = {
        type: 'enrollment',
        eventId: 'event-xyz789',
        memberId: 'member-def456',
      };
      
      const result = await provider.executeBookingPayload(payload);
      
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe('event-xyz789-member-def456');
    });

    it('should fail with unknown payload type', async () => {
      const client = await createTestWorkspace({ slug: 'abc-exec-payload-unknown' });
      await createAbcIgniteIntegration(client.id, TEST_APP_ID, TEST_APP_KEY, {
        clubNumber: TEST_CLUB_NUMBER,
      });
      
      const { AbcIgniteBookingProvider } = await import('@/app/_lib/booking/providers/abc-ignite');
      const { AbcIgniteAdapter } = await import('@/app/_lib/integrations');
      
      const adapter = await AbcIgniteAdapter.forClient(client.id);
      const provider = new AbcIgniteBookingProvider(adapter!);
      
      const payload = {
        type: 'invalid_type',
        someData: 'value',
      };
      
      const result = await provider.executeBookingPayload(payload);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown payload type');
    });
  });
});
