import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getActiveClient } from '@/app/_lib/client-gate';
import { getClientIntegration, touchIntegration } from '@/app/_lib/integrations';
import { emitEvent, EventSystem, upsertLead, updateLeadStage } from '@/app/_lib/event-logger';
import { addSubscriberToGroup } from '@/app/_lib/mailerlite';
import { IntegrationType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // Get source from query params (e.g., ?source=sam)
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    if (!source) {
      console.error('No source parameter provided in webhook URL');
      return NextResponse.json(
        { error: 'Missing source parameter' },
        { status: 400 }
      );
    }

    const clientSlug = source.toLowerCase();

    // Look up client and check if active
    const client = await getActiveClient(clientSlug);
    if (!client) {
      // Client not found or paused - still return 200 to prevent Stripe retries
      console.error(`Client not found or paused: ${clientSlug}`);
      return NextResponse.json(
        { received: true, error: 'Client unavailable' },
        { status: 200 }
      );
    }

    // Get Stripe integration (webhook secret)
    const stripeIntegration = await getClientIntegration(client.id, IntegrationType.STRIPE);
    if (!stripeIntegration) {
      console.error(`Stripe not configured for client: ${clientSlug}`);
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Get the raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature header found');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      // We need a Stripe API key for constructEvent - get it from meta or use a default
      const stripeMeta = stripeIntegration.meta as { apiKey?: string } | null;
      const stripeApiKey = stripeMeta?.apiKey || process.env.STRIPE_API_KEY;
      
      if (!stripeApiKey) {
        console.error('No Stripe API key available');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      const stripe = new Stripe(stripeApiKey);
      event = stripe.webhooks.constructEvent(body, signature, stripeIntegration.secret);
    } catch (err) {
      const error = err as Error;
      console.error('Webhook signature verification failed:', error.message);
      
      await emitEvent({
        clientId: client.id,
        system: EventSystem.STRIPE,
        eventType: 'stripe_webhook_invalid_signature',
        success: false,
        errorMessage: error.message,
      });

      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    // Touch Stripe integration - signature verified successfully
    await touchIntegration(client.id, IntegrationType.STRIPE);

    // Only handle checkout.session.completed events
    if (event.type !== 'checkout.session.completed') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Extract customer information from the checkout session
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email;
    const name = session.customer_details?.name;

    if (!email) {
      console.error('No customer email found in checkout session:', session.id);
      
      await emitEvent({
        clientId: client.id,
        system: EventSystem.STRIPE,
        eventType: 'stripe_payment_failed',
        success: false,
        errorMessage: 'No customer email in session',
      });

      return NextResponse.json(
        { error: 'No customer email in session' },
        { status: 400 }
      );
    }

    // Create/update lead and mark as paid
    const leadId = await upsertLead({
      clientId: client.id,
      email,
      source: 'stripe',
    });
    await updateLeadStage(leadId, 'PAID');

    // Emit payment success event
    await emitEvent({
      clientId: client.id,
      leadId,
      system: EventSystem.STRIPE,
      eventType: 'stripe_payment_succeeded',
      success: true,
    });

    // Get MailerLite integration for adding customer to group
    const mailerliteIntegration = await getClientIntegration(client.id, IntegrationType.MAILERLITE);
    if (!mailerliteIntegration) {
      console.error(`MailerLite not configured for client: ${clientSlug}`);
      return NextResponse.json(
        {
          received: true,
          processed: true,
          warning: 'MailerLite not configured',
        },
        { status: 200 }
      );
    }

    // Check for program/product metadata for multi-product routing
    const program = session.metadata?.program;
    const mlMeta = mailerliteIntegration.meta as {
      groupIds?: { customer?: string; [key: string]: string | undefined };
    } | null;

    // Try program-specific group first, fall back to default customer group
    let customerGroupId: string | undefined;
    if (program && mlMeta?.groupIds?.[`customer_${program}`]) {
      customerGroupId = mlMeta.groupIds[`customer_${program}`];
    } else {
      customerGroupId = mlMeta?.groupIds?.customer;
    }

    if (!customerGroupId) {
      console.error(`No customer group ID configured for client: ${clientSlug}`);
      
      await emitEvent({
        clientId: client.id,
        leadId,
        system: EventSystem.MAILERLITE,
        eventType: 'mailerlite_subscribe_failed',
        success: false,
        errorMessage: 'No customer group configured',
      });

      return NextResponse.json(
        {
          received: true,
          processed: true,
          warning: 'Customer group not configured',
        },
        { status: 200 }
      );
    }

    // Add customer to MailerLite group
    const result = await addSubscriberToGroup({
      email,
      name: name ?? undefined,
      groupId: customerGroupId,
      apiKey: mailerliteIntegration.secret,
    });

    if (!result.success) {
      console.error(`Failed to add ${email} to MailerLite:`, result.error);
      
      await emitEvent({
        clientId: client.id,
        leadId,
        system: EventSystem.MAILERLITE,
        eventType: 'mailerlite_subscribe_failed',
        success: false,
        errorMessage: result.error,
      });

      return NextResponse.json(
        {
          received: true,
          warning: 'Webhook received but MailerLite sync failed',
        },
        { status: 200 }
      );
    }

    // Success
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
        received: true,
        processed: true,
        email,
        source,
        program: program || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      {
        received: true,
        error: 'Internal error processing webhook',
      },
      { status: 200 }
    );
  }
}
