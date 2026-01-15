import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';

// PATCH /api/v1/admin/integrations/[id]/meta - Update integration meta
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

  try {
    const body = await request.json();
    const { meta } = body;

    const integration = await prisma.clientIntegration.findUnique({
      where: { id },
      select: { clientId: true, integration: true },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    await prisma.clientIntegration.update({
      where: { id },
      data: { meta: meta || undefined },
    });

    await emitEvent({
      clientId: integration.clientId,
      system: EventSystem.BACKEND,
      eventType: 'integration_meta_updated',
      success: true,
      errorMessage: `Updated ${integration.integration} meta config`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update integration meta error:', error);
    return NextResponse.json(
      { error: 'Failed to update meta' },
      { status: 500 }
    );
  }
}




