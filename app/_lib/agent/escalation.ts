/**
 * Agent Escalation Notification
 *
 * Sends email notifications to workspace owners/admins when an agent
 * conversation escalates to human intervention.
 */

import { EmailService } from '@/app/_lib/email';
import { getWorkspaceMembers } from '@/app/_lib/workspace-access';
import { logStructured } from '@/app/_lib/reliability';

interface EscalationParams {
  workspaceId: string;
  agentId: string;
  conversationId: string;
  contactAddress: string;
  summary: string;
}

export async function notifyEscalation(params: EscalationParams): Promise<void> {
  const { workspaceId, conversationId, contactAddress, summary } = params;

  const members = await getWorkspaceMembers(workspaceId);
  const recipients = members
    .filter((m) => m.role === 'OWNER' || m.role === 'ADMIN')
    .map((m) => m.user.email)
    .filter(Boolean);

  if (recipients.length === 0) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_escalation_no_recipients',
      workspaceId,
      provider: 'agent',
      metadata: { agentId: params.agentId, conversationId },
    });
    return;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2 style="color: #7c3aed;">Agent Escalation</h2>
      <p>An agent conversation needs human attention.</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #888;">Contact</td><td>${contactAddress}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #888;">Conversation</td><td style="font-family: monospace; font-size: 12px;">${conversationId.slice(0, 8)}...</td></tr>
      </table>
      <h3 style="margin-top: 24px;">Conversation Summary</h3>
      <pre style="background: #f4f4f5; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-x: auto;">${escapeHtml(summary)}</pre>
    </div>
  `.trim();

  const text = `Agent Escalation\n\nContact: ${contactAddress}\n\n${summary}`;

  for (const email of recipients) {
    try {
      await EmailService.send({
        workspaceId,
        to: email,
        subject: `Agent escalation — ${contactAddress}`,
        html,
        text,
      });
    } catch (err) {
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'agent_escalation_email_failed',
        workspaceId,
        provider: 'email',
        error: err instanceof Error ? err.message : 'Failed to send escalation email',
        metadata: { recipient: email, conversationId },
      });
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
