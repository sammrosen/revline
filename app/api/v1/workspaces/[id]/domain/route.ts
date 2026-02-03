/**
 * Domain Configuration API
 * 
 * POST /api/v1/workspaces/[id]/domain - Setup custom domain
 * DELETE /api/v1/workspaces/[id]/domain - Remove custom domain
 * 
 * STANDARDS:
 * - Workspace-scoped operations
 * - Authentication required
 * - Event logging for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setupCustomDomain, removeCustomDomain } from '@/app/_lib/domain';
import { prisma } from '@/app/_lib/db';

// =============================================================================
// VALIDATION
// =============================================================================

const SetupDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

// =============================================================================
// POST - Setup Domain
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = await params;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = SetupDomainSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { domain } = parseResult.data;

    // Setup domain
    const result = await setupCustomDomain(workspaceId, domain);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      instructions: result.instructions,
    });

  } catch (error) {
    console.error('Domain setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Domain
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: workspaceId } = await params;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Remove domain
    const result = await removeCustomDomain(workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Domain removal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
