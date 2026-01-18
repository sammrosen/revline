import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { encryptSecret } from '@/app/_lib/crypto';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationType, Prisma } from '@prisma/client';
import { IntegrationSecret, SecretInput } from '@/app/_lib/types';
import { INTEGRATIONS, type IntegrationTypeId } from '@/app/_lib/integrations/config';
import { randomUUID } from 'crypto';

/**
 * Encrypt an array of secret inputs into IntegrationSecret objects
 */
function encryptSecrets(inputs: SecretInput[]): IntegrationSecret[] {
  return inputs.map(input => {
    const { encryptedSecret, keyVersion } = encryptSecret(input.plaintextValue);
    return {
      id: randomUUID(),
      name: input.name,
      encryptedValue: encryptedSecret,
      keyVersion,
    };
  });
}

// POST /api/v1/admin/integrations - Add a new integration for a client
export async function POST(request: NextRequest) {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, integration, secrets: secretInputs, meta } = body;

    // Validate required fields
    if (!clientId || !integration) {
      return NextResponse.json(
        { error: 'clientId and integration are required' },
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

    // Check if this integration requires secrets (from config)
    const integrationConfig = INTEGRATIONS[integration as IntegrationTypeId];
    const requiresSecrets = integrationConfig?.secrets && integrationConfig.secrets.length > 0;

    // Validate secrets only if required
    const validSecretInputs = secretInputs?.filter(
      (s: SecretInput) => s.name?.trim() && s.plaintextValue?.trim()
    ) || [];

    if (requiresSecrets && validSecretInputs.length === 0) {
      return NextResponse.json(
        { error: 'secrets array is required with at least one secret' },
        { status: 400 }
      );
    }

    // Validate each secret input (if any provided)
    for (const secret of validSecretInputs) {
      if (!secret.name || !secret.plaintextValue) {
        return NextResponse.json(
          { error: 'Each secret must have a name and plaintextValue' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate secret names (if any provided)
    if (validSecretInputs.length > 0) {
      const names = validSecretInputs.map((s: SecretInput) => s.name);
      if (new Set(names).size !== names.length) {
        return NextResponse.json(
          { error: 'Secret names must be unique within an integration' },
          { status: 400 }
        );
      }
    }

    // Verify client exists
    const client = await prisma.workspace.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Encrypt secrets (if any)
    const encryptedSecrets = validSecretInputs.length > 0 
      ? encryptSecrets(validSecretInputs) 
      : [];

    // Upsert the integration (update if exists, create if not)
    const workspaceIntegration = await prisma.workspaceIntegration.upsert({
      where: {
        workspaceId_integration: {
          workspaceId: clientId,
          integration,
        },
      },
      update: {
        secrets: encryptedSecrets as unknown as Prisma.InputJsonValue,
        meta: meta || undefined,
      },
      create: {
        workspaceId: clientId,
        integration,
        secrets: encryptedSecrets as unknown as Prisma.InputJsonValue,
        meta: meta || undefined,
      },
    });

    // Emit event
    await emitEvent({
      workspaceId: clientId,
      system: EventSystem.BACKEND,
      eventType: 'integration_added',
      success: true,
    });

    return NextResponse.json(
      {
        id: workspaceIntegration.id,
        integration: workspaceIntegration.integration,
        // Return secret summaries (names only, never values)
        secrets: encryptedSecrets.map(s => ({ id: s.id, name: s.name })),
        createdAt: workspaceIntegration.createdAt,
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
