/**
 * Conversation Notification Email Template
 *
 * Sends workspace owners a summary when an agent conversation
 * completes, escalates, or times out.
 *
 * STANDARDS:
 * - No PII in subject line (agent name + outcome only)
 * - Mobile-friendly table layout
 * - Plain text fallback
 * - Follows booking-confirm.ts pattern
 */

import type { ConversationSummaryResult } from '@/app/_lib/agent/conversation-summary';

export interface ConversationNotifyEmailResult {
  subject: string;
  html: string;
  text: string;
}

// =============================================================================
// MAIN TEMPLATE
// =============================================================================

export function buildConversationNotifyEmail(
  data: ConversationSummaryResult,
  dashboardUrl: string
): ConversationNotifyEmailResult {
  const { summary, outcome, lead, details, transcript } = data;

  const outcomeLabel = OUTCOME_LABELS[outcome] || 'Completed';
  const outcomeColor = OUTCOME_COLORS[outcome] || '#18181b';

  // Subject is plain text — no HTML escaping (would display &amp; literally in email clients)
  const subject = `Agent ${details.agentName}: ${outcomeLabel}`;

  // Last 10 messages for condensed transcript
  const transcriptLines = transcript.split('\n');
  const lastMessages = transcriptLines.slice(-10).join('\n');

  const html = buildHtml({
    outcomeLabel,
    outcomeColor,
    summary,
    lead,
    details,
    lastMessages,
    dashboardUrl,
  });

  const text = buildPlainText({
    outcomeLabel,
    summary,
    lead,
    details,
    lastMessages,
    dashboardUrl,
  });

  return { subject, html, text };
}

// =============================================================================
// OUTCOME MAPS
// =============================================================================

const OUTCOME_LABELS: Record<string, string> = {
  completed: 'Completed',
  escalated: 'Escalation Needed',
  timed_out: 'Timed Out',
  qualified: 'Lead Qualified',
  booked: 'Booking Made',
  opted_out: 'Opted Out',
};

const OUTCOME_COLORS: Record<string, string> = {
  completed: '#16a34a',   // green
  escalated: '#dc2626',   // red
  timed_out: '#ca8a04',   // yellow
  qualified: '#2563eb',   // blue
  booked: '#16a34a',      // green
  opted_out: '#71717a',   // gray
};

// =============================================================================
// HTML BUILDER
// =============================================================================

interface HtmlParams {
  outcomeLabel: string;
  outcomeColor: string;
  summary: string;
  lead?: { email: string; name?: string; phone?: string; stage?: string };
  details: { messageCount: number; duration: string; channel: string; agentName: string };
  lastMessages: string;
  dashboardUrl: string;
}

function buildHtml(p: HtmlParams): string {
  const leadRows = p.lead
    ? `
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #71717a; width: 120px;">Lead</td>
        <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.lead.name || p.lead.email)}</td>
      </tr>
      ${p.lead.email ? `<tr>
        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Email</td>
        <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.lead.email)}</td>
      </tr>` : ''}
      ${p.lead.phone ? `<tr>
        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Phone</td>
        <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.lead.phone)}</td>
      </tr>` : ''}
      ${p.lead.stage ? `<tr>
        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Stage</td>
        <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.lead.stage)}</td>
      </tr>` : ''}
    `
    : '';

  // Format transcript for HTML (escape + preserve line breaks)
  const transcriptHtml = p.lastMessages
    ? escapeHtml(p.lastMessages).replace(/\n/g, '<br>')
    : '<em>No messages</em>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Conversation Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header with outcome badge -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <span style="display: inline-block; padding: 4px 12px; background-color: ${p.outcomeColor}; color: #ffffff; font-size: 12px; font-weight: 600; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">
                ${escapeHtml(p.outcomeLabel)}
              </span>
              <h1 style="margin: 12px 0 0; font-size: 22px; font-weight: 600; color: #18181b;">
                Agent ${escapeHtml(p.details.agentName)}
              </h1>
            </td>
          </tr>

          <!-- AI Summary -->
          <tr>
            <td style="padding: 24px 32px 16px;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                ${escapeHtml(p.summary)}
              </p>
            </td>
          </tr>

          <!-- Quick Facts -->
          <tr>
            <td style="padding: 8px 32px 24px;">
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px;">
                <tr><td style="padding: 16px;">
                  <table role="presentation" style="width: 100%;">
                    ${leadRows}
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #71717a; width: 120px;">Channel</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.details.channel)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Duration</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${escapeHtml(p.details.duration)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Messages</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #18181b;">${p.details.messageCount}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 32px 24px;">
              <a href="${escapeHtml(p.dashboardUrl)}"
                 style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; border-radius: 8px;">
                View in Dashboard
              </a>
            </td>
          </tr>

          <!-- Condensed Transcript -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">
                Recent Messages
              </p>
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; color: #3f3f46; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; white-space: pre-wrap; word-break: break-word;">
                ${transcriptHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #a1a1aa;">
                Powered by RevLine
              </p>
              <a href="mailto:hi@revlineops.com" style="font-size: 11px; color: #a1a1aa; text-decoration: none;">
                hi@revlineops.com
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

// =============================================================================
// PLAIN TEXT BUILDER
// =============================================================================

interface PlainTextParams {
  outcomeLabel: string;
  summary: string;
  lead?: { email: string; name?: string; phone?: string; stage?: string };
  details: { messageCount: number; duration: string; channel: string; agentName: string };
  lastMessages: string;
  dashboardUrl: string;
}

function buildPlainText(p: PlainTextParams): string {
  const leadLine = p.lead
    ? `Lead: ${p.lead.name || p.lead.email}${p.lead.phone ? ` (${p.lead.phone})` : ''}${p.lead.stage ? ` [${p.lead.stage}]` : ''}`
    : '';

  return `
Agent ${p.details.agentName}: ${p.outcomeLabel}

${p.summary}

Quick Facts:
${leadLine ? `${leadLine}\n` : ''}Channel: ${p.details.channel}
Duration: ${p.details.duration}
Messages: ${p.details.messageCount}

View in Dashboard: ${p.dashboardUrl}

--- Recent Messages ---
${p.lastMessages || '(no messages)'}

---
Powered by RevLine
hi@revlineops.com
`.trim();
}

// =============================================================================
// UTILS
// =============================================================================

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}
