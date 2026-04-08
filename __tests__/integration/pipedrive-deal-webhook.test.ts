/**
 * Pipedrive Deal Webhook — Integration Tests
 *
 * Exercises the POST handler in app/api/v1/pipedrive-webhook/route.ts for
 * deal-event branches (added.deal, updated.deal → deal_updated/won/lost),
 * echo detection, replay protection, invalid secret, invalid payload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { testPrisma, createTestWorkspace } from '../setup';

// Capture emitTrigger calls so tests can assert the operation emitted
const emitTriggerMock = vi.fn(
  async (
    _workspaceId: string,
    _op: { adapter: string; operation: string },
    _payload: Record<string, unknown>,
  ): Promise<{ executions: Array<{ status: string; error?: string }>; workflowsExecuted: number }> => ({
    executions: [],
    workflowsExecuted: 0,
  }),
);

vi.mock('@/app/_lib/workflow', () => ({
  emitTrigger: emitTriggerMock,
}));

const WEBHOOK_SECRET = 'test-webhook-secret-abc';

async function setupWorkspace(slug: string) {
  const ws = await createTestWorkspace({ slug });
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { encryptedSecret, keyVersion } = encryptSecret('test-api-token');
  await testPrisma.workspaceIntegration.create({
    data: {
      workspaceId: ws.id,
      integration: 'PIPEDRIVE',
      secrets: [
        {
          id: randomUUID(),
          name: 'API Token',
          encryptedValue: encryptedSecret,
          keyVersion,
        },
      ] as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: { webhookSecret: WEBHOOK_SECRET } as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
  return ws;
}

function buildDealWebhookV1(opts: {
  event: 'added.deal' | 'updated.deal';
  dealId: number;
  personId?: number;
  status?: string;
  previousStatus?: string;
  personName?: string;
}) {
  return {
    v: 1,
    event: opts.event,
    current: {
      id: opts.dealId,
      title: 'Test Deal',
      person_id: opts.personId ?? 99,
      person_name: opts.personName ?? 'Test Person',
      pipeline_id: 1,
      stage_id: 2,
      status: opts.status ?? 'open',
      value: 500,
      currency: 'USD',
    },
    previous: opts.previousStatus !== undefined ? { status: opts.previousStatus } : null,
    meta: {
      id: Math.floor(Math.random() * 1_000_000),
      timestamp: new Date().toISOString(),
      action: opts.event.split('.')[0],
      object: 'deal',
    },
  };
}

function buildDealWebhookV2(opts: {
  event: 'added.deal' | 'updated.deal';
  dealId: number;
  status?: string;
}) {
  // v2-ish: person_id as object, stringified IDs
  return {
    v: 2,
    event: opts.event,
    current: {
      id: String(opts.dealId),
      title: 'V2 Deal',
      person_id: { value: 99, name: 'Test Person' },
      pipeline_id: '1',
      stage_id: '2',
      status: opts.status ?? 'open',
      value: '500',
      currency: 'USD',
    },
    previous: null,
    meta: {
      id: Math.floor(Math.random() * 1_000_000),
      timestamp: new Date().toISOString(),
      action: opts.event.split('.')[0],
      object: 'deal',
    },
  };
}

async function createLeadWithPersonId(workspaceId: string, personId: number, email = 'lead@example.com') {
  return testPrisma.lead.create({
    data: {
      workspaceId,
      email,
      source: 'test',
      stage: 'CAPTURED',
      properties: { pipedrivePersonId: personId },
      lastEventAt: new Date(),
    },
  });
}

async function invokeWebhook(slug: string, secret: string, body: unknown) {
  const { POST } = await import('@/app/api/v1/pipedrive-webhook/route');
  const { NextRequest } = await import('next/server');
  const url = `https://example.com/api/v1/pipedrive-webhook?source=${slug}&secret=${encodeURIComponent(secret)}`;
  const req = new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  return POST(req);
}

describe('Pipedrive Deal Webhook', () => {
  beforeEach(() => {
    emitTriggerMock.mockClear();
  });

  it('added.deal fires deal_added trigger (v1 payload)', async () => {
    const ws = await setupWorkspace(`pdw-added-${Date.now()}`);
    await createLeadWithPersonId(ws.id, 99);
    const body = buildDealWebhookV1({ event: 'added.deal', dealId: 1001, personId: 99 });
    const res = await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect(res.status).toBe(200);
    expect(emitTriggerMock).toHaveBeenCalledTimes(1);
    const call = emitTriggerMock.mock.calls[0];
    expect((call[1] as { operation: string }).operation).toBe('deal_added');
  });

  it('added.deal with v2-shaped payload still fires deal_added', async () => {
    const ws = await setupWorkspace(`pdw-v2-${Date.now()}`);
    await createLeadWithPersonId(ws.id, 99);
    const body = buildDealWebhookV2({ event: 'added.deal', dealId: 1002 });
    const res = await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect(res.status).toBe(200);
    expect(emitTriggerMock).toHaveBeenCalledTimes(1);
    expect((emitTriggerMock.mock.calls[0][1] as { operation: string }).operation).toBe('deal_added');
  });

  it('updated.deal with no status change fires deal_updated', async () => {
    const ws = await setupWorkspace(`pdw-upd-${Date.now()}`);
    await createLeadWithPersonId(ws.id, 99);
    const body = buildDealWebhookV1({
      event: 'updated.deal',
      dealId: 1003,
      personId: 99,
      status: 'open',
      previousStatus: 'open',
    });
    await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect((emitTriggerMock.mock.calls[0][1] as { operation: string }).operation).toBe('deal_updated');
  });

  it('updated.deal with status transition to won fires deal_won (NOT deal_updated)', async () => {
    const ws = await setupWorkspace(`pdw-won-${Date.now()}`);
    await createLeadWithPersonId(ws.id, 99);
    const body = buildDealWebhookV1({
      event: 'updated.deal',
      dealId: 1004,
      personId: 99,
      status: 'won',
      previousStatus: 'open',
    });
    await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect(emitTriggerMock).toHaveBeenCalledTimes(1);
    const ops = emitTriggerMock.mock.calls.map(c => (c[1] as { operation: string }).operation);
    expect(ops).toContain('deal_won');
    expect(ops).not.toContain('deal_updated');
  });

  it('updated.deal with status transition to lost fires deal_lost', async () => {
    const ws = await setupWorkspace(`pdw-lost-${Date.now()}`);
    await createLeadWithPersonId(ws.id, 99);
    const body = buildDealWebhookV1({
      event: 'updated.deal',
      dealId: 1005,
      personId: 99,
      status: 'lost',
      previousStatus: 'open',
    });
    await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect((emitTriggerMock.mock.calls[0][1] as { operation: string }).operation).toBe('deal_lost');
  });

  it('echo detection: recent lead with matching pipedriveDealId is skipped', async () => {
    const ws = await setupWorkspace(`pdw-echo-${Date.now()}`);
    await testPrisma.lead.create({
      data: {
        workspaceId: ws.id,
        email: 'echo@example.com',
        source: 'test',
        stage: 'CAPTURED',
        properties: { pipedrivePersonId: 99, pipedriveDealId: 1006 },
        lastEventAt: new Date(),
      },
    });
    const body = buildDealWebhookV1({
      event: 'updated.deal',
      dealId: 1006,
      personId: 99,
      status: 'open',
      previousStatus: 'open',
    });
    const res = await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect(res.status).toBe(200);
    expect(emitTriggerMock).not.toHaveBeenCalled();
  });

  it('replay protection rejects old events', async () => {
    const ws = await setupWorkspace(`pdw-replay-${Date.now()}`);
    const body = buildDealWebhookV1({ event: 'added.deal', dealId: 1007, personId: 99 });
    body.meta.timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min old
    const res = await invokeWebhook(ws.slug, WEBHOOK_SECRET, body);
    expect(res.status).toBe(200);
    expect(emitTriggerMock).not.toHaveBeenCalled();
  });

  it('invalid secret returns 200 with warning, no trigger', async () => {
    const ws = await setupWorkspace(`pdw-badsec-${Date.now()}`);
    const body = buildDealWebhookV1({ event: 'added.deal', dealId: 1008, personId: 99 });
    const res = await invokeWebhook(ws.slug, 'wrong-secret', body);
    expect(res.status).toBe(200);
    expect(emitTriggerMock).not.toHaveBeenCalled();
  });

  it('invalid payload returns 200 with warning, no trigger', async () => {
    const ws = await setupWorkspace(`pdw-badpayload-${Date.now()}`);
    // Missing required fields
    const res = await invokeWebhook(ws.slug, WEBHOOK_SECRET, { garbage: true });
    expect(res.status).toBe(200);
    expect(emitTriggerMock).not.toHaveBeenCalled();
  });
});
