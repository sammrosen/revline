import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { HealthStatus } from '@prisma/client';

// GET /api/v1/admin/workspaces - List all clients with health status
export async function GET() {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    // This should not happen if middleware is working correctly
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await prisma.workspace.findMany({
    include: {
      integrations: {
        select: {
          integration: true,
          healthStatus: true,
          lastSeenAt: true,
        },
      },
      events: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Derive client-level health from integrations
  const clientsWithHealth = clients.map((client) => {
    const integrationHealth = client.integrations.map((i) => i.healthStatus);
    let derivedHealth: HealthStatus = HealthStatus.GREEN;
    
    if (integrationHealth.includes(HealthStatus.RED)) {
      derivedHealth = HealthStatus.RED;
    } else if (integrationHealth.includes(HealthStatus.YELLOW)) {
      derivedHealth = HealthStatus.YELLOW;
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      status: client.status,
      timezone: client.timezone,
      createdAt: client.createdAt,
      derivedHealth,
      integrations: client.integrations,
      lastEventAt: client.events[0]?.createdAt || null,
    };
  });

  return NextResponse.json(clientsWithHealth);
}

// POST /api/v1/admin/workspaces - Create a new client
export async function POST(request: NextRequest) {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    // This should not happen if middleware is working correctly
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, timezone } = body;

    if (!name || !slug || !timezone) {
      return NextResponse.json(
        { error: 'Name, slug, and timezone are required' },
        { status: 400 }
      );
    }

    const client = await prisma.workspace.create({
      data: {
        name,
        slug: slug.toLowerCase(),
        timezone,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Client with this slug already exists' },
        { status: 400 }
      );
    }
    throw error;
  }
}

