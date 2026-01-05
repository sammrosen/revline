import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getClientBySlug } from '@/app/_lib/client-gate';
import { getClientIntegration, touchIntegration } from '@/app/_lib/integrations';
import { emitEvent, upsertLead, updateLeadStage } from '@/app/_lib/event-logger';
import { IntegrationType, EventSystem } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('calendly-webhook-signature');
    
    if (!signature) {
      console.error('[CALENDLY] No signature header');
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    
    // Extract client identifier from UTM source
    // Calendly includes UTM params in the tracking object
    const utmSource = payload.payload?.tracking?.utm_source;
    if (!utmSource) {
      console.error('[CALENDLY] No utm_source in webhook payload');
      return NextResponse.json({ error: 'No client identifier' }, { status: 400 });
    }

    console.log(`[CALENDLY] Processing webhook for utm_source: ${utmSource}`);

    // Look up client by slug (from utm_source)
    const client = await getClientBySlug(utmSource);
    if (!client) {
      console.error(`[CALENDLY] Client not found: ${utmSource}`);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.status !== 'ACTIVE') {
      console.error(`[CALENDLY] Client is paused: ${utmSource}`);
      await emitEvent({
        clientId: client.id,
        system: EventSystem.CALENDLY,
        eventType: 'execution_blocked',
        success: false,
        errorMessage: `Client ${utmSource} is paused`
      });
      return NextResponse.json({ error: 'Client paused' }, { status: 403 });
    }

    // Get Calendly integration config
    const calendlyIntegration = await getClientIntegration(client.id, IntegrationType.CALENDLY);
    if (!calendlyIntegration) {
      console.error(`[CALENDLY] Calendly integration not configured for client: ${utmSource}`);
      return NextResponse.json({ error: 'Calendly not configured' }, { status: 404 });
    }

    // Get signing key from encrypted secret (not meta - security!)
    const signingKey = calendlyIntegration.secret;
    if (!signingKey) {
      console.error(`[CALENDLY] No webhook signing key in secret for client: ${utmSource}`);
      return NextResponse.json({ error: 'Webhook signing key not configured' }, { status: 500 });
    }

    if (!verifyCalendlySignature(body, signature, signingKey)) {
      console.error(`[CALENDLY] Invalid webhook signature for client: ${utmSource}`);
      await emitEvent({
        clientId: client.id,
        system: EventSystem.CALENDLY,
        eventType: 'calendly_signature_invalid',
        success: false,
        errorMessage: 'Invalid webhook signature'
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log(`[CALENDLY] Signature verified for ${utmSource}`);

    // Touch integration health
    await touchIntegration(client.id, IntegrationType.CALENDLY);

    // Handle event types
    const eventType = payload.event;
    const email = payload.payload?.email;
    
    if (!email) {
      console.error('[CALENDLY] No email in payload');
      return NextResponse.json({ error: 'No email in payload' }, { status: 400 });
    }

    console.log(`[CALENDLY] Processing ${eventType} for ${email}`);

    // Find or create lead
    const leadId = await upsertLead({
      clientId: client.id,
      email,
      source: 'calendly'
    });

    if (eventType === 'invitee.created') {
      // Update lead stage to BOOKED
      await updateLeadStage(leadId, 'BOOKED');
      
      console.log(`[CALENDLY] Booking created for ${email} - stage updated to BOOKED`);
      
      await emitEvent({
        clientId: client.id,
        leadId,
        system: EventSystem.CALENDLY,
        eventType: 'calendly_booking_created',
        success: true
      });

      // Optional: Add to "Booked Calls" MailerLite segment
      const addToSegment = (calendlyIntegration.meta as { addToBookedSegment?: boolean } | null)?.addToBookedSegment;
      if (addToSegment) {
        console.log(`[CALENDLY] addToBookedSegment is enabled but not yet implemented for ${email}`);
        // TODO: Add MailerLite call here if desired
        // This would add the lead to a special "Booked Calls" group in MailerLite
      }

    } else if (eventType === 'invitee.canceled') {
      // Revert stage back to CAPTURED
      await updateLeadStage(leadId, 'CAPTURED');
      
      console.log(`[CALENDLY] Booking canceled for ${email} - stage reverted to CAPTURED`);
      
      await emitEvent({
        clientId: client.id,
        leadId,
        system: EventSystem.CALENDLY,
        eventType: 'calendly_booking_canceled',
        success: true
      });
    } else {
      console.log(`[CALENDLY] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[CALENDLY] Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Verify Calendly webhook signature
 * 
 * Calendly sends signature in header: "Calendly-Webhook-Signature: t=1492774577,v1=5257a869..."
 * 
 * Steps:
 * 1. Extract timestamp (t) and signature (v1) from header
 * 2. Create signed payload: timestamp + '.' + request_body
 * 3. Compute HMAC SHA256 using webhook signing key
 * 4. Compare computed signature with provided signature
 * 5. Reject if timestamp is >3 minutes old (replay attack prevention)
 */
function verifyCalendlySignature(
  body: string,
  signatureHeader: string,
  signingKey: string
): boolean {
  try {
    const parts = signatureHeader.split(',');
    if (parts.length !== 2) {
      console.error('[CALENDLY] Invalid signature format');
      return false;
    }

    const [tPart, v1Part] = parts;
    const timestamp = tPart.split('=')[1];
    const providedSignature = v1Part.split('=')[1];
    
    if (!timestamp || !providedSignature) {
      console.error('[CALENDLY] Missing timestamp or signature');
      return false;
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${body}`;
    
    // Compute expected signature
    const hmac = createHmac('sha256', signingKey);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');
    
    // Verify signatures match
    if (expectedSignature !== providedSignature) {
      console.error('[CALENDLY] Signature mismatch');
      return false;
    }
    
    // Prevent replay attacks (3 minute tolerance)
    const eventTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - eventTime;
    
    if (timeDiff > 180) {
      console.error(`[CALENDLY] Timestamp too old: ${timeDiff}s > 180s`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[CALENDLY] Error verifying signature:', error);
    return false;
  }
}

