/**
 * Shared Twilio Webhook Utilities
 *
 * Common helpers used by both the SMS webhook (twilio-webhook) and
 * voice webhook (twilio-voice) routes.
 */

import { NextRequest, NextResponse } from 'next/server';

export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export function twimlResponse(status = 200): NextResponse {
  return new NextResponse(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function voiceTwimlResponse(greeting: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${escapeXml(greeting)}</Say><Hangup/></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export function parseFormBody(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = raw.split('&');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, idx).replace(/\+/g, ' '));
    const value = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    params[key] = value;
  }
  return params;
}

/**
 * Reconstruct the webhook URL that Twilio signed against.
 * Must match the exact URL configured in Twilio Console.
 */
export function getWebhookUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const url = new URL(request.url);
  return `${proto}://${host}${url.pathname}${url.search}`;
}
