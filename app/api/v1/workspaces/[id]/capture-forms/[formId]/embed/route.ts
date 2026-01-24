/**
 * Capture Form Embed Code API
 * 
 * GET /api/v1/workspaces/[id]/capture-forms/[formId]/embed - Get embed code (VIEWER+)
 * 
 * Query params:
 * - formSelector: CSS selector for the form (required)
 * - fields: Comma-separated field mappings (required, format: "source:target,source:target")
 * - endpoint: Optional custom endpoint URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getAuthenticatedUser } from '@/app/_lib/auth';
import { requireWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import {
  generateEmbedCode,
  getFormById,
} from '@/app/_lib/services/capture.service';

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

    // Load form
    const form = await getFormById(formId);
    if (!form || form.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const formSelector = searchParams.get('formSelector');
    const fieldsRaw = searchParams.get('fields');
    const endpoint = searchParams.get('endpoint') || undefined;

    // Validate required params
    if (!formSelector) {
      return NextResponse.json(
        { error: 'formSelector query parameter is required' },
        { status: 400 }
      );
    }

    if (!fieldsRaw) {
      return NextResponse.json(
        { error: 'fields query parameter is required' },
        { status: 400 }
      );
    }

    // Parse field mappings
    const fieldMappings: Array<{ source: string; target: string }> = [];
    const pairs = fieldsRaw.split(',');
    for (const pair of pairs) {
      const [source, target] = pair.trim().split(':');
      if (source && target) {
        // Validate target is in allowedTargets
        if (!form.allowedTargets.includes(target.trim())) {
          return NextResponse.json(
            { error: `Target '${target}' is not in allowed targets for this form` },
            { status: 400 }
          );
        }
        fieldMappings.push({ source: source.trim(), target: target.trim() });
      }
    }

    if (fieldMappings.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid field mapping is required' },
        { status: 400 }
      );
    }

    // Generate embed code
    const embedCode = generateEmbedCode(form, {
      endpoint,
      formSelector,
      fieldMappings,
    });

    return NextResponse.json({
      embedCode,
      formId: form.id,
      formSelector,
      fieldMappings,
    });
  } catch (error) {
    console.error('Failed to generate embed code:', error);
    return NextResponse.json({ error: 'Failed to generate embed code' }, { status: 500 });
  }
}
