/**
 * Agent Notification Executor
 *
 * Sends workspace owners an email summary when a conversation
 * completes or escalates. Fire-and-forget — notification failures
 * never block the agent or workflow.
 *
 * STANDARDS:
 * - Workspace-scoped: owner lookup via workspace -> org -> members
 * - Never throws: returns error ActionResult on failure
 * - Uses EmailService for delivery (workspace Resend integration or env fallback)
 */

import { prisma } from '@/app/_lib/db';
import { EmailService } from '@/app/_lib/email';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { buildConversationNotification } from '@/app/_lib/agent/conversation-summary';
import { buildConversationNotifyEmail } from '@/app/_lib/email/templates/conversation-notify';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// EXECUTOR
// =============================================================================

const notifyOwner: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const conversationId = (ctx.trigger.payload.conversationId ?? params.conversationId) as string | undefined;
    if (!conversationId) {
      return { success: false, error: 'Missing conversationId in trigger payload' };
    }

    const notifyTarget = (params.notifyTarget as string) || 'owner';
    const includeTranscript = params.includeTranscript !== false;

    try {
      // 1. Build conversation summary
      const summaryData = await buildConversationNotification(conversationId, ctx.workspaceId);

      if (!includeTranscript) {
        summaryData.transcript = '';
      }

      // 2. Find recipients — workspace owners via org membership
      const recipients = await findNotificationRecipients(ctx.workspaceId, notifyTarget);

      if (recipients.length === 0) {
        await emitEvent({
          workspaceId: ctx.workspaceId,
          system: EventSystem.AGENT,
          eventType: 'agent_notify_skipped',
          success: true,
          metadata: { reason: 'no_recipients', notifyTarget },
        });

        return {
          success: true,
          data: { skipped: true, reason: 'No recipients found for notification' },
        };
      }

      // 3. Build dashboard URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const dashboardUrl = `${baseUrl}/dashboard/agents?conversation=${conversationId}`;

      // 4. Build email
      const email = buildConversationNotifyEmail(summaryData, dashboardUrl);

      // Override subject if provided in params
      const customSubject = params.subject as string | undefined;
      if (customSubject) {
        email.subject = customSubject;
      }

      // 5. Send to each recipient
      let sentCount = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        const result = await EmailService.send({
          workspaceId: ctx.workspaceId,
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });

        if (result.success) {
          sentCount++;
        } else {
          errors.push(`${recipient.email}: ${result.error}`);
        }
      }

      // 6. Emit event
      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.AGENT,
        eventType: sentCount > 0 ? 'agent_notify_sent' : 'agent_notify_failed',
        success: sentCount > 0,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        metadata: {
          conversationId,
          recipientCount: recipients.length,
          sentCount,
          outcome: summaryData.outcome,
          agentName: summaryData.details.agentName,
        },
      });

      if (sentCount === 0) {
        return { success: false, error: `Failed to send to all recipients: ${errors.join('; ')}` };
      }

      return {
        success: true,
        data: {
          sentCount,
          recipientCount: recipients.length,
          outcome: summaryData.outcome,
          ...(errors.length > 0 ? { partialErrors: errors } : {}),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await emitEvent({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        system: EventSystem.AGENT,
        eventType: 'agent_notify_failed',
        success: false,
        errorMessage: message,
        metadata: { conversationId },
      });

      return { success: false, error: `Notification failed: ${message}` };
    }
  },
};

// =============================================================================
// HELPERS
// =============================================================================

interface NotificationRecipient {
  email: string;
  name: string | null;
}

/**
 * Find notification recipients for a workspace.
 *
 * Strategy: workspace -> organizationId -> OrganizationMember (isOwner / all)
 * Falls back to WorkspaceMember with OWNER or ADMIN role.
 */
async function findNotificationRecipients(
  workspaceId: string,
  target: string
): Promise<NotificationRecipient[]> {
  // Get workspace to find org
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });

  if (workspace?.organizationId) {
    // Use org membership
    const whereClause = target === 'all'
      ? { organizationId: workspace.organizationId }
      : target === 'admin'
        ? { organizationId: workspace.organizationId }
        : { organizationId: workspace.organizationId, isOwner: true };

    const members = await prisma.organizationMember.findMany({
      where: whereClause,
      include: { user: { select: { email: true, name: true } } },
    });

    return members.map((m) => ({ email: m.user.email, name: m.user.name }));
  }

  // Fallback: use workspace members table
  const roleFilter = target === 'all'
    ? ['OWNER', 'ADMIN', 'MEMBER']
    : target === 'admin'
      ? ['OWNER', 'ADMIN']
      : ['OWNER'];

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      role: { in: roleFilter as Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'> },
    },
    include: { user: { select: { email: true, name: true } } },
  });

  return members.map((m) => ({ email: m.user.email, name: m.user.name }));
}

// =============================================================================
// EXPORT
// =============================================================================

export const agentNotifyExecutors: Record<string, ActionExecutor> = {
  notify_owner: notifyOwner,
};
