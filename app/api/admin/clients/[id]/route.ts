import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { pauseClient, unpauseClient } from '@/app/_lib/client-gate';

// GET /api/admin/clients/[id] - Get client details with events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      integrations: {
        select: {
          id: true,
          integration: true,
          healthStatus: true,
          lastSeenAt: true,
          meta: true,
          createdAt: true,
        },
      },
      events: {
        take: 50,
        orderBy: { createdAt: 'desc' },
      },
      leads: {
        where: {
          stage: 'CAPTURED',
          lastEventAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h ago
          },
        },
        take: 20,
        orderBy: { lastEventAt: 'asc' },
        select: {
          id: true,
          email: true,
          stage: true,
          source: true,
          lastEventAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...client,
    stuckLeads: client.leads,
    leads: undefined, // Remove full leads from response
  });
}

// PATCH /api/admin/clients/[id] - Update client (pause/unpause)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (action === 'pause') {
    await pauseClient(id);
    return NextResponse.json({ success: true, status: 'PAUSED' });
  }

  if (action === 'unpause') {
    await unpauseClient(id);
    return NextResponse.json({ success: true, status: 'ACTIVE' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

