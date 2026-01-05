import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { sendPushoverNotification, isPushoverConfigured } from '@/app/_lib/pushover';

/**
 * POST /api/admin/clients/[id]/test-pushover
 * 
 * Send a test Pushover notification for a specific client.
 * Used to verify Pushover is configured correctly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin authentication
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const { id: clientId } = await params;

  // Get client info
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
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

