/**
 * Domain Verification API
 * 
 * POST /api/v1/workspaces/[id]/domain/verify
 * 
 * Triggers DNS lookup to verify domain ownership.
 * 
 * STANDARDS:
 * - Workspace-scoped operations
 * - Authentication required
 * - Event logging for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAndActivateDomain } from '@/app/_lib/domain';
import { prisma } from '@/app/_lib/db';

// =============================================================================
// POST - Verify Domain
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

    // Verify domain
    const result = await verifyAndActivateDomain(workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          verified: false,
          error: result.error,
          details: result.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: result.verified,
      details: result.details,
    });

  } catch (error) {
    console.error('Domain verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
