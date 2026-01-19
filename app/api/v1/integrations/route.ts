import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { encryptSecret } from '@/app/_lib/crypto';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationType, Prisma } from '@prisma/client';
import { IntegrationSecret, SecretInput } from '@/app/_lib/types';
import { INTEGRATIONS, type IntegrationTypeId } from '@/app/_lib/integrations/config';
import { randomUUID } from 'crypto';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

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

// POST /api/v1/integrations - Add a new integration for a workspace
export async function POST(request: NextRequest) {
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workspaceId, integration, secrets: secretInputs, meta } = body;

    // Validate required fields
    if (!workspaceId || !integration) {
      return NextResponse.json(
        { error: 'workspaceId and integration are required' },
        { status: 400 }
      );
    }

    // Verify user has ADMIN or higher access to manage integrations
    const access = await getWorkspaceAccess(userId, workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions to manage integrations' }, { status: 403 });
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

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
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
          workspaceId,
          integration,
        },
      },
      update: {
        secrets: encryptedSecrets as unknown as Prisma.InputJsonValue,
        meta: meta || undefined,
      },
      create: {
        workspaceId,
        integration,
        secrets: encryptedSecrets as unknown as Prisma.InputJsonValue,
        meta: meta || undefined,
      },
    });

    // Emit event
    await emitEvent({
      workspaceId,
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
