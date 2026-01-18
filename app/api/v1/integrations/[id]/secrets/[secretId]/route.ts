import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { encryptSecret } from '@/app/_lib/crypto';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationSecret } from '@/app/_lib/types';
import { Prisma } from '@prisma/client';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

/**
 * PATCH /api/v1/integrations/[id]/secrets/[secretId] - Update (rotate) a secret
 * 
 * Body: { plaintextValue: string, name?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; secretId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, secretId } = await params;

  try {
    const body = await request.json();
    const { plaintextValue, name: newName } = body;

    // At least one field must be provided
    if (!plaintextValue && !newName) {
      return NextResponse.json(
        { error: 'plaintextValue or name is required' },
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

    // Verify user has ADMIN or higher access to manage secrets
    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions to manage secrets' }, { status: 403 });
    }

    // Parse existing secrets
    const secrets = (integration.secrets as IntegrationSecret[] | null) || [];

    // Find the secret to update
    const secretIndex = secrets.findIndex(s => s.id === secretId);
    if (secretIndex === -1) {
      return NextResponse.json(
        { error: 'Secret not found' },
        { status: 404 }
      );
    }

    const existingSecret = secrets[secretIndex];

    // If changing name, check for duplicates
    if (newName && newName !== existingSecret.name) {
      if (secrets.some(s => s.name === newName && s.id !== secretId)) {
        return NextResponse.json(
          { error: `A secret with name "${newName}" already exists` },
          { status: 400 }
        );
      }
    }

    // Build updated secret
    const updatedSecret: IntegrationSecret = {
      id: secretId,
      name: newName || existingSecret.name,
      encryptedValue: plaintextValue 
        ? encryptSecret(plaintextValue).encryptedSecret 
        : existingSecret.encryptedValue,
      keyVersion: plaintextValue 
        ? encryptSecret(plaintextValue).keyVersion 
        : existingSecret.keyVersion,
    };

    // Update the secrets array
    const updatedSecrets = [...secrets];
    updatedSecrets[secretIndex] = updatedSecret;

    // Update the integration
    await prisma.workspaceIntegration.update({
      where: { id },
      data: { secrets: updatedSecrets as unknown as Prisma.InputJsonValue },
    });

    // Emit event
    await emitEvent({
      workspaceId: integration.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'integration_secret_rotated',
      success: true,
      errorMessage: `Rotated secret "${updatedSecret.name}" for ${integration.integration}`,
    });

    return NextResponse.json({
      id: updatedSecret.id,
      name: updatedSecret.name,
    });
  } catch (error) {
    console.error('Update secret error:', error);
    return NextResponse.json(
      { error: 'Failed to update secret' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/integrations/[id]/secrets/[secretId] - Delete a secret
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; secretId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, secretId } = await params;

  try {
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

    // Verify user has ADMIN or higher access to manage secrets
    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions to delete secrets' }, { status: 403 });
    }

    // Parse existing secrets
    const secrets = (integration.secrets as IntegrationSecret[] | null) || [];

    // Find the secret to delete
    const secretToDelete = secrets.find(s => s.id === secretId);
    if (!secretToDelete) {
      return NextResponse.json(
        { error: 'Secret not found' },
        { status: 404 }
      );
    }

    // Remove the secret
    const updatedSecrets = secrets.filter(s => s.id !== secretId);

    // Update the integration
    await prisma.workspaceIntegration.update({
      where: { id },
      data: { secrets: updatedSecrets as unknown as Prisma.InputJsonValue },
    });

    // Emit event
    await emitEvent({
      workspaceId: integration.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'integration_secret_deleted',
      success: true,
      errorMessage: `Deleted secret "${secretToDelete.name}" from ${integration.integration}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete secret error:', error);
    return NextResponse.json(
      { error: 'Failed to delete secret' },
      { status: 500 }
    );
  }
}
