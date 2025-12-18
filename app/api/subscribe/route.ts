import { NextRequest, NextResponse } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { getClientIntegration, touchIntegration } from '@/app/_lib/integrations';
import { emitEvent, EventSystem, upsertLead } from '@/app/_lib/event-logger';
import { addSubscriberToGroup } from '@/app/_lib/mailerlite';
import { IntegrationType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, source } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Get source identifier (defaults to 'default')
    const clientSlug = (source || 'default').toLowerCase();

    // Look up client and check if active
    const client = await getActiveClient(clientSlug);
    if (!client) {
      // Client not found or paused
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      );
    }

    // Get MailerLite integration config
    const integration = await getClientIntegration(client.id, IntegrationType.MAILERLITE);
    if (!integration) {
      console.error(`MailerLite not configured for client: ${clientSlug}`);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Extract group ID from meta
    const meta = integration.meta as { groupIds?: { lead?: string } } | null;
    const groupId = meta?.groupIds?.lead;
    if (!groupId) {
      console.error(`No lead group ID configured for client: ${clientSlug}`);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create/update lead record
    const leadId = await upsertLead({
      clientId: client.id,
      email,
      source: 'landing',
    });

    // Emit email_captured event
    await emitEvent({
      clientId: client.id,
      leadId,
      system: EventSystem.BACKEND,
      eventType: 'email_captured',
      success: true,
    });

    // Add subscriber to MailerLite group
    const result = await addSubscriberToGroup({
      email,
      name,
      groupId,
      apiKey: integration.secret,
    });

    if (!result.success) {
      await emitEvent({
        clientId: client.id,
        leadId,
        system: EventSystem.MAILERLITE,
        eventType: 'mailerlite_subscribe_failed',
        success: false,
        errorMessage: result.error,
      });

      return NextResponse.json(
        { error: result.error || 'Failed to subscribe' },
        { status: 500 }
      );
    }

    // Success - touch integration and emit event
    await touchIntegration(client.id, IntegrationType.MAILERLITE);
    await emitEvent({
      clientId: client.id,
      leadId,
      system: EventSystem.MAILERLITE,
      eventType: 'mailerlite_subscribe_success',
      success: true,
    });

    return NextResponse.json(
      {
        message: result.message || 'Successfully subscribed!',
        subscriber: {
          email,
          id: result.subscriberId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Subscribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
