import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { encryptSecret } from '@/app/_lib/crypto';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationType } from '@prisma/client';

// POST /api/admin/integrations - Add a new integration for a client
export async function POST(request: NextRequest) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, integration, plaintextSecret, meta } = body;

    // Validate required fields
    if (!clientId || !integration || !plaintextSecret) {
      return NextResponse.json(
        { error: 'clientId, integration, and plaintextSecret are required' },
        { status: 400 }
      );
    }

    // Validate integration type
    if (!Object.values(IntegrationType).includes(integration)) {
      return NextResponse.json(
        { error: `Invalid integration type. Must be one of: ${Object.values(IntegrationType).join(', ')}` },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Encrypt the secret
    const encryptedSecret = encryptSecret(plaintextSecret);

    // Upsert the integration (update if exists, create if not)
    const clientIntegration = await prisma.clientIntegration.upsert({
      where: {
        clientId_integration: {
          clientId,
          integration,
        },
      },
      update: {
        encryptedSecret,
        meta: meta || undefined,
      },
      create: {
        clientId,
        integration,
        encryptedSecret,
        meta: meta || undefined,
      },
    });

    // Emit event
    await emitEvent({
      clientId,
      system: EventSystem.BACKEND,
      eventType: 'integration_added',
      success: true,
    });

    return NextResponse.json(
      {
        id: clientIntegration.id,
        integration: clientIntegration.integration,
        createdAt: clientIntegration.createdAt,
        // Never return the secret
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add integration error:', error);
    return NextResponse.json(
      { error: 'Failed to add integration' },
      { status: 500 }
    );
  }
}

