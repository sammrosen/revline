/**
 * Pipedrive Deal Adapter — Unit Tests
 *
 * Covers the new deal-related methods on PipedriveAdapter:
 * createDeal, updateDeal, getDeal, moveDealStage, listPipelines, listStages.
 *
 * Uses the same pattern as abc-ignite.test.ts: mock global fetch,
 * create workspace + integration via testPrisma, load adapter, assert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { testPrisma, createTestWorkspace } from '../setup';

const mockFetch = vi.fn();
global.fetch = mockFetch;

async function createPipedriveIntegration(workspaceId: string) {
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { encryptedSecret, keyVersion } = encryptSecret('test-api-token-123');
  return testPrisma.workspaceIntegration.create({
    data: {
      workspaceId,
      integration: 'PIPEDRIVE',
      secrets: [
        {
          id: randomUUID(),
          name: 'API Token',
          encryptedValue: encryptedSecret,
          keyVersion,
        },
      ] as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: {} as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

function okResponse(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    headers: { get: () => null },
    json: async () => ({ success: true, data }),
  };
}

function errorResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

describe('PipedriveAdapter — Deal Operations', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('createDeal', () => {
    it('creates a deal with required fields', async () => {
      const ws = await createTestWorkspace({ slug: `pd-create-${Date.now()}` });
      await createPipedriveIntegration(ws.id);

      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500,
        title: 'Demo Deal',
        value: 1000,
        currency: 'USD',
        status: 'open',
        stage_id: 1,
        pipeline_id: 1,
        person_id: 99,
      }));

      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      expect(adapter).not.toBeNull();

      const result = await adapter!.createDeal({
        title: 'Demo Deal',
        personId: 99,
        pipelineId: 1,
        value: 1000,
        currency: 'USD',
      });

      expect(result.success).toBe(true);
      expect(result.data?.pipedriveDealId).toBe(500);
      expect(result.data?.isNew).toBe(true);

      const call = mockFetch.mock.calls[0];
      expect(String(call[0])).toContain('/v1/deals');
      expect(call[1].method).toBe('POST');
      const body = JSON.parse(call[1].body);
      expect(body.title).toBe('Demo Deal');
      expect(body.person_id).toBe(99);
      expect(body.pipeline_id).toBe(1);
    });

    it('marks 401 as non-retryable', async () => {
      const ws = await createTestWorkspace({ slug: `pd-401-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(errorResponse(401));

      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.createDeal({ title: 't', personId: 1 });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });

    it('marks 429 as retryable with retryAfterMs', async () => {
      const ws = await createTestWorkspace({ slug: `pd-429-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (k: string) => (k === 'Retry-After' ? '3' : null) },
        json: async () => ({}),
      });

      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.createDeal({ title: 't', personId: 1 });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.retryAfterMs).toBe(3000);
    });

    it('marks 500 as retryable', async () => {
      const ws = await createTestWorkspace({ slug: `pd-500-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(errorResponse(500, { error: 'boom' }));

      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.createDeal({ title: 't', personId: 1 });
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });

  describe('updateDeal', () => {
    it('updates a deal by id', async () => {
      const ws = await createTestWorkspace({ slug: `pd-upd-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500, title: 'Updated', status: 'won', stage_id: 2, pipeline_id: 1, value: null, currency: null, person_id: 99,
      }));

      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.updateDeal(500, { title: 'Updated', status: 'won' });

      expect(result.success).toBe(true);
      expect(result.data?.pipedriveDealId).toBe(500);
      expect(result.data?.isNew).toBe(false);
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('no-ops when opts is empty', async () => {
      const ws = await createTestWorkspace({ slug: `pd-upd-noop-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.updateDeal(500, {});
      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getDeal', () => {
    it('returns the deal on success', async () => {
      const ws = await createTestWorkspace({ slug: `pd-get-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500, title: 'Deal', value: null, currency: null, status: 'open', stage_id: 1, pipeline_id: 1, person_id: 99,
      }));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.getDeal(500);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(500);
    });

    it('returns null on 404', async () => {
      const ws = await createTestWorkspace({ slug: `pd-404-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(errorResponse(404));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.getDeal(999);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('moveDealStage', () => {
    it('calls updateDeal with stageId', async () => {
      const ws = await createTestWorkspace({ slug: `pd-move-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500, title: 'Deal', value: null, currency: null, status: 'open', stage_id: 7, pipeline_id: 1, person_id: 99,
      }));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.moveDealStage(500, 7);
      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.stage_id).toBe(7);
    });
  });

  describe('listPipelines / listStages', () => {
    it('lists pipelines', async () => {
      const ws = await createTestWorkspace({ slug: `pd-pipes-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse([
        { id: 1, name: 'Sales' },
        { id: 2, name: 'Support' },
      ]));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.listPipelines();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].name).toBe('Sales');
    });

    it('lists stages filtered by pipeline', async () => {
      const ws = await createTestWorkspace({ slug: `pd-stages-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse([
        { id: 10, name: 'Lead', order_nr: 1, pipeline_id: 1 },
        { id: 11, name: 'Contacted', order_nr: 2, pipeline_id: 1 },
      ]));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.listStages(1);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].pipelineId).toBe(1);
      expect(String(mockFetch.mock.calls[0][0])).toContain('pipeline_id=1');
    });

    it('returns error on listPipelines 500', async () => {
      const ws = await createTestWorkspace({ slug: `pd-pipes-500-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      const { PipedriveAdapter } = await import('@/app/_lib/integrations');
      const adapter = await PipedriveAdapter.forWorkspace(ws.id);
      const result = await adapter!.listPipelines();
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });
  });
});
