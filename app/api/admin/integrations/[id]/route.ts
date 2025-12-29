import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';

// DELETE /api/admin/integrations/[id] - Delete an integration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const integration = await prisma.clientIntegration.findUnique({
      where: { id },
      select: { clientId: true, integration: true },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    await prisma.clientIntegration.delete({
      where: { id },
    });

    await emitEvent({
      clientId: integration.clientId,
      system: EventSystem.BACKEND,
      eventType: 'integration_deleted',
      success: true,
      errorMessage: `Deleted ${integration.integration} integration`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}



