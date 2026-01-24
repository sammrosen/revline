/**
 * Capture Forms API - List and Create
 * 
 * GET  /api/v1/workspaces/[id]/capture-forms - List all forms (VIEWER+)
 * POST /api/v1/workspaces/[id]/capture-forms - Create new form (ADMIN+)
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
  CreateFormSchema,
  FormSecuritySchema,
  DEFAULT_FORM_SECURITY,
} from '@/app/_lib/types/capture';

// =============================================================================
// GET - List capture forms
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = await params;

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

    // Fetch forms
    const forms = await prisma.workspaceForm.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        security: true,
        allowedTargets: true,
        triggerName: true,
        captureCount: true,
        lastCaptureAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Parse security and strip signing secret from response
    const sanitizedForms = forms.map(form => {
      let security = DEFAULT_FORM_SECURITY;
      try {
        security = FormSecuritySchema.parse(form.security);
      } catch { /* use default */ }

      return {
        ...form,
        security: {
          mode: security.mode,
          allowedOrigins: security.allowedOrigins,
          rateLimitPerIp: security.rateLimitPerIp,
          hasSigningSecret: !!security.signingSecret,
        },
      };
    });

    return NextResponse.json({ forms: sanitizedForms });
  } catch (error) {
    console.error('Failed to list capture forms:', error);
    return NextResponse.json({ error: 'Failed to list forms' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create capture form
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = await params;

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

    // Parse body
    const body = await request.json();
    const validation = CreateFormSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        { error: `${firstError.path.join('.')}: ${firstError.message}` },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Build security config
    let security = input.security || DEFAULT_FORM_SECURITY;

    // If server mode is enabled, generate signing secret
    if (security.mode === 'server' || security.mode === 'both') {
      const rawSecret = randomBytes(32).toString('hex');
      security = {
        ...security,
        signingSecret: encryptSecret(rawSecret),
      };
    }

    // Create form
    const form = await prisma.workspaceForm.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        security,
        allowedTargets: input.allowedTargets,
        triggerName: input.triggerName,
      },
    });

    // Emit event
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'capture_form_created',
      success: true,
    });

    // Return created form (strip signing secret)
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
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create capture form:', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
}
