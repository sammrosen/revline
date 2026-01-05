import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { pauseClient, unpauseClient } from '@/app/_lib/client-gate';

// GET /api/admin/clients/[id] - Get client details with events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
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
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
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

// DELETE /api/admin/clients/[id] - Delete client (cascade deletes integrations, leads, events)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get client name for logging
    const client = await prisma.client.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Hard delete - Prisma cascade will handle related records (integrations, leads, events)
    await prisma.client.delete({
      where: { id },
    });

    console.log(`[ADMIN] Deleted client: ${client.name} (${id})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}

