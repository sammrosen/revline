import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { AlertService } from '@/app/_lib/alerts';
import { sendPushoverNotification, isPushoverConfigured } from '@/app/_lib/pushover';

/**
 * Test Alert Scenarios
 * 
 * Each scenario mimics a real system failure so you can see
 * exactly what the Pushover notification will look like.
 */
const ALERT_SCENARIOS = {
  // Basic connectivity test
  basic: {
    type: 'basic' as const,
    label: 'Basic Test',
    description: 'Simple notification to verify Pushover is working',
  },
  // Critical failures
  webhook_stripe: {
    type: 'critical' as const,
    label: 'Stripe Webhook Failed',
    description: 'Simulates a Stripe webhook signature verification failure',
  },
  webhook_calendly: {
    type: 'critical' as const,
    label: 'Calendly Webhook Failed',
    description: 'Simulates a Calendly webhook processing failure',
  },
  workflow_failed: {
    type: 'critical' as const,
    label: 'Workflow Failed',
    description: 'Simulates a workflow execution failure',
  },
  integration_error: {
    type: 'critical' as const,
    label: 'Integration Error',
    description: 'Simulates an external API integration failure (e.g., MailerLite)',
  },
  db_unreachable: {
    type: 'critical' as const,
    label: 'Database Unreachable',
    description: 'Simulates a database connectivity failure',
  },
  // Warnings
  rate_limit: {
    type: 'warning' as const,
    label: 'Rate Limit Warning',
    description: 'Simulates hitting rate limits on an external API',
  },
  health_degraded: {
    type: 'warning' as const,
    label: 'Health Check Degraded',
    description: 'Simulates a degraded health check status',
  },
} as const;

type ScenarioKey = keyof typeof ALERT_SCENARIOS;

/**
 * POST /api/admin/clients/[id]/test-alert
 * 
 * Fire a test alert through the AlertService to see what real
 * notifications look like on your phone.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isPushoverConfigured()) {
    return NextResponse.json(
      { 
        error: 'Pushover not configured',
        details: 'Set PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN environment variables.',
      },
      { status: 503 }
    );
  }

  const { id: clientId } = await params;

  // Get client info
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  let body: { scenario: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const scenario = body.scenario as ScenarioKey;
  
  if (!scenario || !ALERT_SCENARIOS[scenario]) {
    return NextResponse.json(
      { 
        error: 'Invalid scenario',
        validScenarios: Object.keys(ALERT_SCENARIOS),
      },
      { status: 400 }
    );
  }

  const scenarioConfig = ALERT_SCENARIOS[scenario];
  const correlationId = `test-${Date.now().toString(36)}`;
  
  let result: { sent: boolean; error?: string };

  try {
    switch (scenario) {
      case 'basic':
        // Simple test - bypass AlertService for basic connectivity
        const basicResult = await sendPushoverNotification({
          title: '✅ RevLine Test',
          message: `Test notification received for ${client.name}\n\nPushover is configured correctly!`,
          sound: 'pushover',
        });
        result = { sent: basicResult.success, error: basicResult.error };
        break;

      case 'webhook_stripe':
        result = await AlertService.critical(
          'Webhook Failed: stripe',
          `[TEST] Signature verification failed for checkout.session.completed\n\nEvent ID: evt_test_${correlationId}`,
          {
            clientId: client.id,
            provider: 'stripe',
            eventId: `evt_test_${correlationId}`,
            correlationId,
          }
        );
        break;

      case 'webhook_calendly':
        result = await AlertService.critical(
          'Webhook Failed: calendly',
          `[TEST] Failed to process invitee.created webhook\n\nEvent URI: https://calendly.com/events/${correlationId}`,
          {
            clientId: client.id,
            provider: 'calendly',
            eventId: `cal_${correlationId}`,
            correlationId,
          }
        );
        break;

      case 'workflow_failed':
        result = await AlertService.critical(
          'Workflow Failed: Welcome Sequence',
          `[TEST] mailerlite.add_to_group: API returned 401 Unauthorized\n\nExecution ID: exec_${correlationId}`,
          {
            clientId: client.id,
            workflowId: `wf_test_${correlationId}`,
            workflowName: 'Welcome Sequence',
            correlationId,
          }
        );
        break;

      case 'integration_error':
        result = await AlertService.critical(
          'Integration Error: mailerlite',
          `[TEST] Failed to add subscriber test@example.com\n\nError: Connection timeout after 10000ms`,
          {
            clientId: client.id,
            provider: 'mailerlite',
            correlationId,
          }
        );
        break;

      case 'db_unreachable':
        result = await AlertService.critical(
          'Database Unreachable',
          `[TEST] Health check failed: Connection refused\n\nHost: db.railway.internal:5432`,
          {
            correlationId,
          }
        );
        break;

      case 'rate_limit':
        result = await AlertService.warning(
          'Rate Limit Warning',
          `[TEST] MailerLite API rate limit approaching\n\n85/100 requests used in current window`,
          {
            clientId: client.id,
            provider: 'mailerlite',
            correlationId,
          }
        );
        break;

      case 'health_degraded':
        result = await AlertService.warning(
          'Health Check Degraded',
          `[TEST] Integration health check degraded\n\nstripe: OK\nmailerlite: SLOW (2.5s)\ncalendly: OK`,
          {
            clientId: client.id,
            correlationId,
          }
        );
        break;

      default:
        return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });
    }

    if (result.sent) {
      return NextResponse.json({
        success: true,
        scenario: scenarioConfig.label,
        message: `Test alert sent: ${scenarioConfig.label}`,
        correlationId,
      });
    }

    return NextResponse.json(
      {
        success: false,
        scenario: scenarioConfig.label,
        error: result.error || 'Failed to send alert',
        correlationId,
      },
      { status: 500 }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/clients/[id]/test-alert
 * 
 * Get available alert scenarios and current rate limit status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const scenarios = Object.entries(ALERT_SCENARIOS).map(([key, value]) => ({
    key,
    ...value,
  }));

  return NextResponse.json({
    clientId: client.id,
    clientName: client.name,
    configured: isPushoverConfigured(),
    rateLimitStatus: AlertService.getRateLimitStatus(),
    scenarios,
  });
}
