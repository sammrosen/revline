import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { CUSTOMER_GROUP_MAP } from '@/app/_config/mailerlite';
import { addSubscriberToGroup, validateMailerLiteConfig } from '@/app/_lib/mailerlite';

/**
 * Get the webhook signing secret for a specific source/trainer
 */
function getWebhookSecret(source: string): string | undefined {
  const sourceKey = source.toUpperCase();
  const envKey = `STRIPE_WEBHOOK_SECRET_${sourceKey}`;
  return process.env[envKey];
}

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

    // Get the webhook secret for this source
    const webhookSecret = getWebhookSecret(source);
    if (!webhookSecret) {
      console.error(`No webhook secret configured for source: ${source}`);
      return NextResponse.json(
        { error: 'Webhook not configured for this source' },
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

    // Verify webhook signature and construct event using Stripe SDK
    // This is the official recommended approach for webhook verification
    let event: Stripe.Event;
    
    try {
      // Initialize Stripe instance (API key required by SDK, even for webhook verification)
      const stripeApiKey = process.env.STRIPE_API_KEY;
      if (!stripeApiKey) {
        console.error('STRIPE_API_KEY not configured');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }
      
      const stripe = new Stripe(stripeApiKey, { apiVersion: '2024-11-20.acacia' });
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error('Webhook signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    // Only handle checkout.session.completed events
    if (event.type !== 'checkout.session.completed') {
      console.log(`Ignoring event type: ${event.type}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Extract customer information from the checkout session
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email;
    const name = session.customer_details?.name;

    if (!email) {
      console.error('No customer email found in checkout session:', session.id);
      return NextResponse.json(
        { error: 'No customer email in session' },
        { status: 400 }
      );
    }

    // Check for program/product metadata to support multiple products per source
    const program = session.metadata?.program;
    const logContext = program 
      ? `${source}/${program}` 
      : source;

    console.log(`Processing checkout for ${email} from: ${logContext}`);

    // Get MailerLite configuration
    const apiKey = process.env.MAILERLITE_API_KEY;
    const sourceKey = source.toUpperCase();
    
    // Try to find a program-specific group first, fall back to source-only
    let customerGroupId: string | undefined;
    
    if (program) {
      const programKey = program.toUpperCase();
      const combinedKey = `${sourceKey}_${programKey}`;
      customerGroupId = CUSTOMER_GROUP_MAP[combinedKey];
      
      if (customerGroupId) {
        console.log(`Using program-specific group: ${combinedKey}`);
      } else {
        console.log(`No program-specific group found for ${combinedKey}, falling back to ${sourceKey}`);
        customerGroupId = CUSTOMER_GROUP_MAP[sourceKey];
      }
    } else {
      customerGroupId = CUSTOMER_GROUP_MAP[sourceKey];
    }

    // Validate configuration
    const configValidation = validateMailerLiteConfig(apiKey, customerGroupId);
    if (!configValidation.valid) {
      console.error(`MailerLite config error for ${source}:`, configValidation.error);
      return NextResponse.json(
        { error: 'MailerLite configuration error' },
        { status: 500 }
      );
    }

    // Add customer to MailerLite group
    const result = await addSubscriberToGroup({
      email,
      name,
      groupId: customerGroupId!,
      apiKey: apiKey!,
    });

    if (!result.success) {
      console.error(`Failed to add ${email} to MailerLite:`, result.error);
      // Return 200 to acknowledge receipt but log the error
      // This prevents Stripe from retrying indefinitely
      return NextResponse.json(
        { 
          received: true,
          warning: 'Webhook received but MailerLite sync failed',
        },
        { status: 200 }
      );
    }

    console.log(`Successfully added ${email} to MailerLite group for ${logContext}`);

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
    // Return 200 to prevent Stripe retries for unrecoverable errors
    return NextResponse.json(
      { 
        received: true,
        error: 'Internal error processing webhook',
      },
      { status: 200 }
    );
  }
}

