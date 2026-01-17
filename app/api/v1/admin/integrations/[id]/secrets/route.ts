import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { encryptSecret } from '@/app/_lib/crypto';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationSecret } from '@/app/_lib/types';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * POST /api/v1/admin/integrations/[id]/secrets - Add a new secret
 * 
 * Body: { name: string, plaintextValue: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, plaintextValue } = body;

    // Validate input
    if (!name || !plaintextValue) {
      return NextResponse.json(
        { error: 'name and plaintextValue are required' },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { id: true, workspaceId: true, integration: true, secrets: true },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Parse existing secrets
    const secrets = (integration.secrets as IntegrationSecret[] | null) || [];

    // Check for duplicate name
    if (secrets.some(s => s.name === name)) {
      return NextResponse.json(
        { error: `A secret with name "${name}" already exists` },
        { status: 400 }
      );
    }

    // Encrypt the new secret
    const { encryptedSecret, keyVersion } = encryptSecret(plaintextValue);
    const newSecret: IntegrationSecret = {
      id: randomUUID(),
      name,
      encryptedValue: encryptedSecret,
      keyVersion,
    };

    // Add to secrets array
    const updatedSecrets = [...secrets, newSecret];

    // Update the integration
    await prisma.workspaceIntegration.update({
      where: { id },
      data: { secrets: updatedSecrets as unknown as Prisma.InputJsonValue },
    });

    // Emit event
    await emitEvent({
      workspaceId: integration.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'integration_secret_added',
      success: true,
      errorMessage: `Added secret "${name}" to ${integration.integration}`,
    });

    return NextResponse.json({
      id: newSecret.id,
      name: newSecret.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Add secret error:', error);
    return NextResponse.json(
      { error: 'Failed to add secret' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/admin/integrations/[id]/secrets - List secrets (names only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { secrets: true },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    const secrets = (integration.secrets as IntegrationSecret[] | null) || [];

    // Return only names and IDs, never values
    return NextResponse.json({
      secrets: secrets.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    console.error('List secrets error:', error);
    return NextResponse.json(
      { error: 'Failed to list secrets' },
      { status: 500 }
    );
  }
}

