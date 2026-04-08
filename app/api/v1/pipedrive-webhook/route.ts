/**
 * Pipedrive Inbound Webhook
 *
 * POST /api/v1/pipedrive-webhook?source={workspaceSlug}&secret={webhookSecret}
 *
 * Processes inbound person events from Pipedrive:
 * - Validates shared secret via timing-safe comparison
 * - Rate limits per workspace
 * - Rejects replayed events older than 3 minutes
 * - Deduplicates via WebhookProcessor
 * - Detects echoes from our own writes (30s window)
 * - Emits pipedrive.person_created / pipedrive.person_updated triggers
 * - Applies inbound field sync for updated.person events
 *
 * STANDARDS:
 * - Persist first, verify, dedupe, then process
 * - Always returns 200 for processed events (prevents Pipedrive retries)
 * - Timing-safe secret comparison (STANDARDS.md 1.3)
 * - Replay protection via meta.timestamp (STANDARDS.md 1.3)
 * - Rate limiting via rateLimitByClient (STANDARDS.md Section 4)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { getActiveWorkspace } from '@/app/_lib/client-gate';
import { PipedriveAdapter } from '@/app/_lib/integrations/pipedrive.adapter';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByClient, getRateLimitHeaders } from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { prisma } from '@/app/_lib/db';
import { syncInboundFields } from '@/app/_lib/services/integration-sync.service';

const REPLAY_MAX_AGE_SECONDS = 180;
const ECHO_WINDOW_MS = 30_000;

const PipedriveWebhookPayloadSchema = z.object({
  v: z.number(),
  event: z.string(),
  current: z.record(z.string(), z.unknown()),
  previous: z.record(z.string(), z.unknown()).nullable(),
  meta: z.object({
    id: z.number(),
    timestamp: z.string(),
    action: z.string(),
    object: z.string(),
  }),
});

/**
 * Zod schema for the `current` block of a Pipedrive deal webhook.
 * v1 and v2 shapes differ — use .passthrough() and coerce IDs.
 */
const PipedriveWebhookDealPayloadSchema = z.object({
  id: z.coerce.number(),
  title: z.string().nullish(),
  person_id: z.union([
    z.coerce.number(),
    z.object({ value: z.coerce.number() }).passthrough(),
  ]).nullish(),
  person_name: z.string().nullish(),
  pipeline_id: z.coerce.number().nullish(),
  stage_id: z.coerce.number().nullish(),
  status: z.string().nullish(),
  value: z.coerce.number().nullish(),
  currency: z.string().nullish(),
}).passthrough();

/**
 * Echo detection helper — returns a recent lead whose properties.{kind}Id
 * matches the given Pipedrive ID within the ECHO_WINDOW_MS window.
 * Scoped to workspaceId (STANDARDS.md workspace isolation).
 */
async function findRecentLeadByPipedriveId(
  workspaceId: string,
  kind: 'pipedrivePersonId' | 'pipedriveDealId',
  id: number,
): Promise<{ id: string } | null> {
  const echoThreshold = new Date(Date.now() - ECHO_WINDOW_MS);
  const lead = await prisma.lead.findFirst({
    where: {
      workspaceId,
      lastEventAt: { gte: echoThreshold },
      properties: {
        path: [kind],
        equals: id,
      },
    },
    select: { id: true },
  });
  return lead;
}

function verifySecret(provided: string, stored: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const secret = searchParams.get('secret');

  if (!source || !secret) {
    return ApiResponse.error(
      'Missing source or secret parameter',
      400,
      ErrorCodes.MISSING_REQUIRED,
    );
  }

  const workspaceSlug = source.toLowerCase();

  const rateLimit = rateLimitByClient(workspaceSlug);
  if (!rateLimit.allowed) {
    return ApiResponse.webhookAck({ warning: 'Rate limited - retry later' });
  }

  try {
    const workspace = await getActiveWorkspace(workspaceSlug);
    if (!workspace) {
      return ApiResponse.webhookAck({ warning: 'Workspace unavailable' });
    }

    const adapter = await PipedriveAdapter.forWorkspace(workspace.id);
    if (!adapter) {
      return ApiResponse.webhookAck({ warning: 'Pipedrive not configured' });
    }

    const storedSecret = adapter.getWebhookSecret();
    if (!storedSecret) {
      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_webhook_no_secret',
        success: false,
        errorMessage: 'webhookSecret not configured in adapter meta',
      });
      return ApiResponse.webhookAck({ warning: 'Webhook secret not configured' });
    }

    if (!verifySecret(secret, storedSecret)) {
      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_webhook_invalid_secret',
        success: false,
      });
      return ApiResponse.webhookAck({ warning: 'Invalid webhook secret' });
    }

    const parsed = PipedriveWebhookPayloadSchema.safeParse(
      JSON.parse(rawBody),
    );
    if (!parsed.success) {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'pipedrive_webhook_invalid_payload',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        error: parsed.error.message,
      });
      return ApiResponse.webhookAck({ warning: 'Invalid payload shape' });
    }

    const payload = parsed.data;
    const providerEventId = String(payload.meta.id);

    const registration = await WebhookProcessor.register({
      workspaceId: workspace.id,
      provider: 'pipedrive',
      providerEventId,
      rawBody,
    });

    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_duplicate',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        metadata: { providerEventId },
      });
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    const claimed = await WebhookProcessor.markProcessing(registration.id);
    if (!claimed) {
      return ApiResponse.webhookAck({
        duplicate: true,
        correlationId: registration.correlationId,
      });
    }

    // Replay protection — reject events older than 3 minutes
    const eventTime = Math.floor(
      new Date(payload.meta.timestamp).getTime() / 1000,
    );
    const currentTime = Math.floor(Date.now() / 1000);
    if (Number.isNaN(eventTime) || currentTime - eventTime > REPLAY_MAX_AGE_SECONDS) {
      await WebhookProcessor.markFailed(registration.id, 'Replay rejected — event too old');
      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_replay_rejected',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        metadata: { eventTime, currentTime, diff: currentTime - eventTime },
      });
      return ApiResponse.webhookAck({ warning: 'Replay rejected — event too old' });
    }

    // Process person events and deal events. Everything else no-ops.
    const { event, current, previous } = payload;
    const isPersonEvent =
      event === 'added.person' || event === 'updated.person';
    const isDealEvent =
      event === 'added.deal' || event === 'updated.deal';

    if (!isPersonEvent && !isDealEvent) {
      await WebhookProcessor.markProcessed(registration.id);
      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_skipped',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        metadata: { eventType: event },
      });
      return ApiResponse.webhookAck({ processed: true });
    }

    // =======================================================================
    // Deal branch
    // =======================================================================
    if (isDealEvent) {
      const dealParsed = PipedriveWebhookDealPayloadSchema.safeParse(current);
      if (!dealParsed.success) {
        await WebhookProcessor.markFailed(registration.id, 'Invalid deal payload');
        logStructured({
          correlationId: registration.correlationId,
          event: 'pipedrive_webhook_invalid_deal_payload',
          workspaceId: workspace.id,
          provider: 'pipedrive',
          error: dealParsed.error.message,
        });
        return ApiResponse.webhookAck({ warning: 'Invalid deal payload' });
      }
      const deal = dealParsed.data;

      // Echo detection — skip events from our own recent writes
      const echoLead = await findRecentLeadByPipedriveId(
        workspace.id,
        'pipedriveDealId',
        deal.id,
      );
      if (echoLead) {
        await WebhookProcessor.markProcessed(registration.id);
        await emitEvent({
          workspaceId: workspace.id,
          leadId: echoLead.id,
          system: EventSystem.PIPEDRIVE,
          eventType: 'pipedrive_webhook_deal_echo_skipped',
          success: true,
          metadata: { pipedriveDealId: deal.id, eventType: event },
        });
        logStructured({
          correlationId: registration.correlationId,
          event: 'pipedrive_webhook_deal_echo_skipped',
          workspaceId: workspace.id,
          provider: 'pipedrive',
          metadata: { pipedriveDealId: deal.id },
        });
        return ApiResponse.webhookAck({ processed: true, warning: 'Echo detected' });
      }

      // Determine trigger operation (mutually exclusive — exactly one fires)
      let dealOperation: 'deal_added' | 'deal_updated' | 'deal_won' | 'deal_lost';
      if (event === 'added.deal') {
        dealOperation = 'deal_added';
      } else {
        const prevStatus = previous && typeof previous === 'object'
          ? (previous as Record<string, unknown>).status
          : undefined;
        if (deal.status === 'won' && prevStatus !== 'won') {
          dealOperation = 'deal_won';
        } else if (deal.status === 'lost' && prevStatus !== 'lost') {
          dealOperation = 'deal_lost';
        } else {
          dealOperation = 'deal_updated';
        }
      }

      // Resolve person id + email. Prefer inline fields; fall back to fetching person.
      let pipedrivePersonId: number | undefined;
      if (typeof deal.person_id === 'number') {
        pipedrivePersonId = deal.person_id;
      } else if (deal.person_id && typeof deal.person_id === 'object') {
        pipedrivePersonId = deal.person_id.value;
      }

      let email: string | undefined;
      let name: string | undefined = deal.person_name ?? undefined;
      let phone: string | undefined;

      // Look for an existing lead linked to this person (scoped to workspace)
      if (pipedrivePersonId) {
        const linkedLead = await prisma.lead.findFirst({
          where: {
            workspaceId: workspace.id,
            properties: {
              path: ['pipedrivePersonId'],
              equals: pipedrivePersonId,
            },
          },
          select: { email: true, properties: true },
        });
        if (linkedLead) {
          email = linkedLead.email ?? undefined;
          const props = (linkedLead.properties as Record<string, unknown>) ?? {};
          if (!name && typeof props.name === 'string') name = props.name;
          if (typeof props.phone === 'string') phone = props.phone;
        }
      }

      // Fallback: fetch the person from Pipedrive to get their email
      if (!email && pipedrivePersonId) {
        const personResult = await adapter.getPerson(pipedrivePersonId);
        if (personResult.success && personResult.data) {
          const p = personResult.data;
          const emails = Array.isArray(p.email) ? p.email : [];
          const phones = Array.isArray(p.phone) ? p.phone : [];
          email = emails[0]?.value;
          phone = phone ?? phones[0]?.value;
          name = name ?? (typeof p.name === 'string' ? p.name : undefined);
        }
      }

      if (!email) {
        await WebhookProcessor.markFailed(registration.id, 'Deal has no resolvable email');
        logStructured({
          correlationId: registration.correlationId,
          event: 'pipedrive_webhook_deal_no_email',
          workspaceId: workspace.id,
          provider: 'pipedrive',
          metadata: { pipedriveDealId: deal.id, pipedrivePersonId },
        });
        return ApiResponse.webhookAck({ warning: 'Deal has no resolvable email — skipped' });
      }

      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_processing',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        metadata: {
          eventType: event,
          dealOperation,
          pipedriveDealId: deal.id,
          pipedrivePersonId,
          email,
        },
      });

      const triggerResult = await emitTrigger(
        workspace.id,
        { adapter: 'pipedrive', operation: dealOperation },
        {
          email,
          name,
          phone,
          pipedriveDealId: deal.id,
          pipedrivePersonId,
          pipelineId: deal.pipeline_id ?? undefined,
          stageId: deal.stage_id ?? undefined,
          status: deal.status ?? undefined,
          title: deal.title ?? undefined,
          value: deal.value ?? undefined,
          currency: deal.currency ?? undefined,
          correlationId: registration.correlationId,
        },
      );

      let dealWarning: string | undefined;
      const dealHasFailure = triggerResult.executions.some((e) => e.status === 'failed');
      if (dealHasFailure) {
        dealWarning = triggerResult.executions
          .filter((e) => e.status === 'failed')
          .map((e) => e.error)
          .join('; ');
      }

      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.PIPEDRIVE,
        eventType: `pipedrive_webhook_${dealOperation}`,
        success: true,
        metadata: {
          pipedriveDealId: deal.id,
          pipedrivePersonId,
          status: deal.status,
          pipelineId: deal.pipeline_id,
          stageId: deal.stage_id,
        },
      });

      await WebhookProcessor.markProcessed(registration.id);

      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_processed',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        success: true,
        metadata: {
          eventType: event,
          dealOperation,
          pipedriveDealId: deal.id,
          triggerFired: triggerResult.workflowsExecuted > 0,
        },
      });

      const dealResponse = ApiResponse.webhookAck({
        processed: true,
        correlationId: registration.correlationId,
        warning: dealWarning,
      });
      const dealHeaders = getRateLimitHeaders(rateLimit);
      for (const [key, value] of Object.entries(dealHeaders)) {
        dealResponse.headers.set(key, value);
      }
      return dealResponse;
    }

    // =======================================================================
    // Person branch (existing)
    // =======================================================================
    const personId = z.coerce.number().safeParse(current.id);
    if (!personId.success) {
      await WebhookProcessor.markFailed(registration.id, 'Missing person ID in current');
      return ApiResponse.webhookAck({ warning: 'Missing person ID' });
    }

    // Echo detection — skip events from our own recent writes
    const echoPersonLead = await findRecentLeadByPipedriveId(
      workspace.id,
      'pipedrivePersonId',
      personId.data,
    );

    if (echoPersonLead) {
      await WebhookProcessor.markProcessed(registration.id);
      logStructured({
        correlationId: registration.correlationId,
        event: 'pipedrive_webhook_echo_skipped',
        workspaceId: workspace.id,
        provider: 'pipedrive',
        metadata: { pipedrivePersonId: personId.data },
      });
      return ApiResponse.webhookAck({ processed: true, warning: 'Echo detected' });
    }

    // Extract contact data from Pipedrive person
    const emails = z.array(z.object({ value: z.string() })).catch([]).parse(current.email);
    const phones = z.array(z.object({ value: z.string() })).catch([]).parse(current.phone);
    const email = emails[0]?.value;
    const phone = phones[0]?.value;
    const name = typeof current.name === 'string' ? current.name : undefined;

    if (!email) {
      await WebhookProcessor.markFailed(registration.id, 'Person has no email');
      return ApiResponse.webhookAck({ warning: 'Person has no email — skipped' });
    }

    logStructured({
      correlationId: registration.correlationId,
      event: 'pipedrive_webhook_processing',
      workspaceId: workspace.id,
      provider: 'pipedrive',
      metadata: {
        eventType: event,
        pipedrivePersonId: personId.data,
        email,
      },
    });

    // Emit trigger for workflow engine
    const triggerOperation =
      event === 'added.person' ? 'person_created' : 'person_updated';

    const triggerResult = await emitTrigger(
      workspace.id,
      { adapter: 'pipedrive', operation: triggerOperation },
      {
        email,
        name,
        phone,
        pipedrivePersonId: personId.data,
        correlationId: registration.correlationId,
      },
    );

    let warning: string | undefined;
    const hasFailure = triggerResult.executions.some(
      (e) => e.status === 'failed',
    );
    if (hasFailure) {
      warning = triggerResult.executions
        .filter((e) => e.status === 'failed')
        .map((e) => e.error)
        .join('; ');
    }

    // Inbound field sync for updated.person events
    if (event === 'updated.person') {
      try {
        await syncInboundFields({
          workspaceId: workspace.id,
          pipedrivePersonId: personId.data,
          pipedriveData: current as Record<string, unknown>,
        });
      } catch (err) {
        logStructured({
          correlationId: registration.correlationId,
          event: 'pipedrive_inbound_field_sync_error',
          workspaceId: workspace.id,
          provider: 'pipedrive',
          error: err instanceof Error ? err.message : 'Unknown sync error',
        });
      }
    }

    await emitEvent({
      workspaceId: workspace.id,
      system: EventSystem.PIPEDRIVE,
      eventType: `pipedrive_webhook_${triggerOperation}`,
      success: true,
    });

    await WebhookProcessor.markProcessed(registration.id);

    logStructured({
      correlationId: registration.correlationId,
      event: 'pipedrive_webhook_processed',
      workspaceId: workspace.id,
      provider: 'pipedrive',
      success: true,
      metadata: {
        eventType: event,
        pipedrivePersonId: personId.data,
        triggerFired: triggerResult.workflowsExecuted > 0,
      },
    });

    const response = ApiResponse.webhookAck({
      processed: true,
      correlationId: registration.correlationId,
      warning,
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'pipedrive_webhook_error',
      workspaceId: workspaceSlug,
      provider: 'pipedrive',
      error: errorMessage,
    });

    return ApiResponse.webhookAck({
      warning: 'Internal error processing webhook',
    });
  }
}
