import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { AbcIgniteAdapter } from '@/app/_lib/integrations';
import { IntegrationType } from '@prisma/client';

/**
 * GET /api/v1/admin/integrations/[id]/sync-event-types
 * 
 * Fetches event types from ABC Ignite API for the given integration.
 * Used by the config editor to sync available event types.
 * 
 * Response:
 * {
 *   success: true,
 *   eventTypes: [
 *     { eventTypeId, name, category, duration, maxAttendees, isAvailableOnline }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Load integration to verify it exists and is ABC Ignite
    const integration = await prisma.clientIntegration.findUnique({
      where: { id },
      select: { 
        id: true,
        clientId: true, 
        integration: true,
        meta: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    if (integration.integration !== IntegrationType.ABC_IGNITE) {
      return NextResponse.json(
        { error: 'This endpoint only works for ABC Ignite integrations' },
        { status: 400 }
      );
    }

    // Load the adapter (this validates credentials are configured)
    const adapter = await AbcIgniteAdapter.forClient(integration.clientId);
    
    if (!adapter) {
      return NextResponse.json(
        { 
          error: 'ABC Ignite is not properly configured. Make sure App ID, App Key, and Club Number are set.',
          code: 'NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    // Fetch ALL event types from ABC Ignite (category comes with each event type)
    const result = await adapter.getEventTypes();

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to fetch event types from ABC Ignite',
          code: 'API_ERROR',
        },
        { status: 502 }
      );
    }

    // Transform the response to a cleaner format
    const eventTypes = (result.data || []).map(et => ({
      eventTypeId: et.eventTypeId,
      name: et.name,
      category: et.category || 'Event',
      duration: typeof et.duration === 'string' ? parseInt(et.duration, 10) : et.duration,
      maxAttendees: typeof et.maxAttendees === 'string' ? parseInt(et.maxAttendees, 10) : et.maxAttendees,
      isAvailableOnline: et.isAvailableOnline === 'true',
    }));

    return NextResponse.json({
      success: true,
      eventTypes,
      clubNumber: adapter.getClubNumber(),
    });

  } catch (error) {
    console.error('Sync event types error:', error);
    return NextResponse.json(
      { error: 'Failed to sync event types' },
      { status: 500 }
    );
  }
}
