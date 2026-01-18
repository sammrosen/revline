import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { sendPushoverNotification, isPushoverConfigured } from '@/app/_lib/pushover';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

/**
 * POST /api/v1/workspaces/[id]/test-pushover
 * 
 * Send a test Pushover notification for a specific workspace.
 * Used to verify Pushover is configured correctly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check user authentication
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  // Verify user has ADMIN or higher access
  const access = await getWorkspaceAccess(userId, clientId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Check if Pushover is configured
  if (!isPushoverConfigured()) {
    return NextResponse.json(
      { 
        error: 'Pushover not configured',
        details: 'Set PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN environment variables.',
      },
      { status: 503 }
    );
  }

  // Get workspace info
  const client = await prisma.workspace.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Send test notification
  const result = await sendPushoverNotification({
    title: 'RevLine Test',
    message: `Test notification received for ${client.name}`,
    sound: 'pushover',
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Test notification sent for ${client.name}`,
      requestId: result.requestId,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error,
      requestId: result.requestId,
    },
    { status: 500 }
  );
}

