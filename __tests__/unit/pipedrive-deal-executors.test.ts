/**
 * Pipedrive Deal Executors — Unit Tests
 *
 * Covers createDeal, updateDeal, moveDealStage executors.
 * Tests dry-run, missing id, fallback to lead.properties, success, adapter error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { testPrisma, createTestWorkspace, createTestLead } from '../setup';

const mockFetch = vi.fn();
global.fetch = mockFetch;

async function createPipedriveIntegration(workspaceId: string) {
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { encryptedSecret, keyVersion } = encryptSecret('test-api-token');
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
      meta: { defaultPipelineId: 1 } as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ success: true, data }),
  };
}

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'overridden',
    workflowId: 'wf-1',
    executionId: 'exec-1',
    triggerAdapter: 'revline',
    triggerOperation: 'contact-submitted',
    triggerPayload: {},
    email: 'lead@example.com',
    name: 'Test Lead',
    phone: undefined,
    leadId: undefined,
    stage: undefined,
    isTest: false,
    actionData: {},
    ...overrides,
  } as unknown as import('@/app/_lib/workflow/types').WorkflowContext;
}

describe('Pipedrive Deal Executors', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('create_deal', () => {
    it('dry-runs when ctx.isTest is true', async () => {
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.create_deal.execute(
        buildCtx({ isTest: true }),
        {},
      );
      expect(result.success).toBe(true);
      expect((result.data as { dryRun: boolean }).dryRun).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails when no pipedrivePersonId in ctx or lead', async () => {
      const ws = await createTestWorkspace({ slug: `exec-nopid-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.create_deal.execute(
        buildCtx({ workspaceId: ws.id }),
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('pipedrivePersonId');
    });

    it('falls back to lead.properties.pipedrivePersonId', async () => {
      const ws = await createTestWorkspace({ slug: `exec-fallback-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      const lead = await createTestLead(ws.id, { email: 'lead@example.com' });
      await testPrisma.lead.update({
        where: { id: lead.id },
        data: { properties: { pipedrivePersonId: 77 } },
      });

      mockFetch.mockResolvedValueOnce(okResponse({
        id: 123, title: 'x', value: null, currency: null, status: 'open',
        stage_id: 1, pipeline_id: 1, person_id: 77,
      }));

      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.create_deal.execute(
        buildCtx({ workspaceId: ws.id, leadId: lead.id }),
        { title: 'Custom Title' },
      );
      expect(result.success).toBe(true);
      expect((result.data as { pipedriveDealId: number }).pipedriveDealId).toBe(123);
    });

    it('uses pipedrivePersonId from ctx.actionData', async () => {
      const ws = await createTestWorkspace({ slug: `exec-actiondata-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 124, title: 'x', value: null, currency: null, status: 'open',
        stage_id: 1, pipeline_id: 1, person_id: 88,
      }));
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.create_deal.execute(
        buildCtx({ workspaceId: ws.id, actionData: { pipedrivePersonId: 88 } }),
        {},
      );
      expect(result.success).toBe(true);
      expect((result.data as { pipedriveDealId: number }).pipedriveDealId).toBe(124);
    });

    it('propagates adapter errors', async () => {
      const ws = await createTestWorkspace({ slug: `exec-err-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: async () => ({ error: 'boom' }),
      });
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.create_deal.execute(
        buildCtx({ workspaceId: ws.id, actionData: { pipedrivePersonId: 1 } }),
        {},
      );
      expect(result.success).toBe(false);
    });
  });

  describe('update_deal', () => {
    it('dry-runs when ctx.isTest', async () => {
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.update_deal.execute(
        buildCtx({ isTest: true }),
        { title: 'x' },
      );
      expect(result.success).toBe(true);
    });

    it('fails without pipedriveDealId', async () => {
      const ws = await createTestWorkspace({ slug: `upd-nodeal-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.update_deal.execute(
        buildCtx({ workspaceId: ws.id }),
        { title: 'x' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('pipedriveDealId');
    });

    it('updates via ctx.actionData.pipedriveDealId', async () => {
      const ws = await createTestWorkspace({ slug: `upd-ok-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500, title: 'New', value: null, currency: null, status: 'open',
        stage_id: 1, pipeline_id: 1, person_id: 1,
      }));
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.update_deal.execute(
        buildCtx({ workspaceId: ws.id, actionData: { pipedriveDealId: 500 } }),
        { title: 'New' },
      );
      expect(result.success).toBe(true);
    });
  });

  describe('move_deal_stage', () => {
    it('dry-runs when ctx.isTest', async () => {
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.move_deal_stage.execute(
        buildCtx({ isTest: true }),
        { stageId: 3 },
      );
      expect(result.success).toBe(true);
    });

    it('rejects when no stageId param', async () => {
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.move_deal_stage.execute(
        buildCtx({}),
        {},
      );
      expect(result.success).toBe(false);
    });

    it('moves the deal when ids + params are present', async () => {
      const ws = await createTestWorkspace({ slug: `move-ok-${Date.now()}` });
      await createPipedriveIntegration(ws.id);
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 500, title: 'x', value: null, currency: null, status: 'open',
        stage_id: 7, pipeline_id: 1, person_id: 1,
      }));
      const { pipedriveExecutors } = await import('@/app/_lib/workflow/executors/pipedrive');
      const result = await pipedriveExecutors.move_deal_stage.execute(
        buildCtx({ workspaceId: ws.id, actionData: { pipedriveDealId: 500 } }),
        { stageId: 7 },
      );
      expect(result.success).toBe(true);
    });
  });
});
