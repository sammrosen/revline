/**
 * Pipedrive Activity Logging
 *
 * Fire-and-forget hook called after agent engine sends a message.
 * Logs the outbound message as a Pipedrive activity on the person's timeline.
 *
 * STANDARDS:
 * - Never throws — entire function is wrapped in try/catch
 * - Never blocks message delivery — called with .catch(() => {})
 * - Respects meta.logActivities opt-in flag
 * - Workspace-isolated via adapter lookup
 */

import { z } from 'zod';
import { PipedriveAdapter } from '@/app/_lib/integrations/pipedrive.adapter';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { logStructured } from '@/app/_lib/reliability';
import { prisma } from '@/app/_lib/db';
import type { AgentConfig } from './types';

const JsonRecord = z.record(z.unknown()).catch({});

export async function logPipedriveActivity(
  workspaceId: string,
  agent: AgentConfig,
  contactAddress: string,
  body: string,
  channelType: string | undefined,
): Promise<void> {
  try {
    const adapter = await PipedriveAdapter.forWorkspace(workspaceId);
    if (!adapter || !adapter.isActivityLoggingEnabled()) return;

    const lead = await prisma.lead.findFirst({
      where: {
        workspaceId,
        OR: [
          { email: contactAddress },
          { phone: contactAddress },
        ],
      },
      select: { id: true, properties: true },
    });

    if (!lead) return;

    const props = JsonRecord.parse(lead.properties);
    const personId = Number(props.pipedrivePersonId);
    if (!personId || Number.isNaN(personId)) return;

    const activityType = channelType?.toUpperCase() === 'SMS' ? 'call' : 'email';
    const subject = `${agent.name || 'Agent'} ${activityType === 'call' ? 'SMS' : 'Email'} to ${contactAddress}`;
    const truncatedBody = body.length > 2000 ? body.slice(0, 2000) + '…' : body;

    const result = await adapter.createActivity({
      personId,
      type: activityType,
      subject,
      note: truncatedBody,
      done: true,
    });

    if (result.success) {
      await emitEvent({
        workspaceId,
        system: EventSystem.PIPEDRIVE,
        eventType: 'pipedrive_activity_logged',
        success: true,
        metadata: {
          agentId: agent.id,
          personId,
          activityType,
          activityId: result.data?.activityId,
        },
      });
    } else {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'pipedrive_activity_log_failed',
        workspaceId,
        provider: 'pipedrive',
        success: false,
        error: result.error,
        metadata: { agentId: agent.id, personId },
      });
    }
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'pipedrive_activity_log_error',
      workspaceId,
      provider: 'pipedrive',
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}
