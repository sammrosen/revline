/**
 * Capture Form API - Get, Update, Delete
 * 
 * GET    /api/v1/workspaces/[id]/capture-forms/[formId] - Get form (VIEWER+)
 * PATCH  /api/v1/workspaces/[id]/capture-forms/[formId] - Update form (ADMIN+)
 * DELETE /api/v1/workspaces/[id]/capture-forms/[formId] - Delete form (ADMIN+)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedUser } from '@/app/_lib/auth';
import { requireWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { emitEvent } from '@/app/_lib/event-logger';
import { EventSystem } from '@prisma/client';
import { encryptSecret } from '@/app/_lib/crypto';
import { randomBytes } from 'crypto';
import {
  UpdateFormSchema,
  FormSecuritySchema,
  FormSecurity,
  DEFAULT_FORM_SECURITY,
} from '@/app/_lib/types/capture';

// =============================================================================
// GET - Get single form
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formId: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId, formId } = await params;

    // Authenticate
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access (VIEWER+)
    try {
      await requireWorkspaceAccess(userId, workspaceId, WorkspaceRole.VIEWER);
    } catch {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch form
    const form = await prisma.workspaceForm.findUnique({
      where: { id: formId },
    });

    if (!form || form.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Parse security
    let security: FormSecurity;
    try {
      security = FormSecuritySchema.parse(form.security);
    } catch {
      security = DEFAULT_FORM_SECURITY;
    }

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        enabled: form.enabled,
        security: {
          mode: security.mode,
          allowedOrigins: security.allowedOrigins,
          rateLimitPerIp: security.rateLimitPerIp,
          hasSigningSecret: !!security.signingSecret,
        },
        allowedTargets: form.allowedTargets,
        triggerName: form.triggerName,
        captureCount: form.captureCount,
        lastCaptureAt: form.lastCaptureAt,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get capture form:', error);
    return NextResponse.json({ error: 'Failed to get form' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update form
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formId: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId, formId } = await params;

    // Authenticate
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access (ADMIN+)
    try {
      await requireWorkspaceAccess(userId, workspaceId, WorkspaceRole.ADMIN);
    } catch {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch existing form
    const existingForm = await prisma.workspaceForm.findUnique({
      where: { id: formId },
    });

    if (!existingForm || existingForm.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Parse body
    const body = await request.json();
    const validation = UpdateFormSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        { error: `${firstError.path.join('.')}: ${firstError.message}` },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.allowedTargets !== undefined) updateData.allowedTargets = input.allowedTargets;
    if (input.triggerName !== undefined) updateData.triggerName = input.triggerName;

    // Handle security updates
    if (input.security !== undefined) {
      let currentSecurity: FormSecurity;
      try {
        currentSecurity = FormSecuritySchema.parse(existingForm.security);
      } catch {
        currentSecurity = DEFAULT_FORM_SECURITY;
      }

      const newSecurity = { ...currentSecurity, ...input.security };

      // If mode changed to server/both and no signing secret exists, generate one
      if (
        (newSecurity.mode === 'server' || newSecurity.mode === 'both') &&
        !newSecurity.signingSecret
      ) {
        const rawSecret = randomBytes(32).toString('hex');
        newSecurity.signingSecret = encryptSecret(rawSecret);
      }

      // If mode changed to browser only, clear signing secret
      if (newSecurity.mode === 'browser') {
        delete newSecurity.signingSecret;
      }

      updateData.security = newSecurity;
    }

    // Update form
    const form = await prisma.workspaceForm.update({
      where: { id: formId },
      data: updateData,
    });

    // Emit event
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'capture_form_updated',
      success: true,
    });

    // Parse security for response
    let security: FormSecurity;
    try {
      security = FormSecuritySchema.parse(form.security);
    } catch {
      security = DEFAULT_FORM_SECURITY;
    }

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        enabled: form.enabled,
        security: {
          mode: security.mode,
          allowedOrigins: security.allowedOrigins,
          rateLimitPerIp: security.rateLimitPerIp,
          hasSigningSecret: !!security.signingSecret,
        },
        allowedTargets: form.allowedTargets,
        triggerName: form.triggerName,
        captureCount: form.captureCount,
        lastCaptureAt: form.lastCaptureAt,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update capture form:', error);
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Delete form
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formId: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId, formId } = await params;

    // Authenticate
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access (ADMIN+)
    try {
      await requireWorkspaceAccess(userId, workspaceId, WorkspaceRole.ADMIN);
    } catch {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch form to verify ownership
    const form = await prisma.workspaceForm.findUnique({
      where: { id: formId },
    });

    if (!form || form.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Delete form
    await prisma.workspaceForm.delete({
      where: { id: formId },
    });

    // Emit event
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'capture_form_deleted',
      success: true,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete capture form:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}
