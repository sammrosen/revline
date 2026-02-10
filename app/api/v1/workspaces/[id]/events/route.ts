import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { EventSystem } from '@prisma/client';

const VALID_SYSTEMS = new Set(Object.values(EventSystem));
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/v1/workspaces/[id]/events
 * 
 * Paginated, filterable event log.
 * 
 * Query params:
 *   system  - Filter by EventSystem (e.g. "MAILERLITE", "STRIPE")
 *   cursor  - Event ID to start after (cursor-based pagination)
 *   limit   - Page size (default 50, max 200)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const systemParam = searchParams.get('system');
  const cursor = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');

  // Validate system filter
  let systemFilter: EventSystem | undefined;
  if (systemParam) {
    if (!VALID_SYSTEMS.has(systemParam as EventSystem)) {
      return NextResponse.json(
        { error: `Invalid system. Must be one of: ${[...VALID_SYSTEMS].join(', ')}` },
        { status: 400 }
      );
    }
    systemFilter = systemParam as EventSystem;
  }

  // Validate limit
  const limit = Math.min(Math.max(parseInt(limitParam || '', 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  // Build where clause
  const where = {
    workspaceId,
    ...(systemFilter ? { system: systemFilter } : {}),
  };

  // Fetch events + total count in parallel
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to determine if there's a next page
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // skip the cursor itself
          }
        : {}),
      select: {
        id: true,
        system: true,
        eventType: true,
        success: true,
        errorMessage: true,
        createdAt: true,
        leadId: true,
      },
    }),
    prisma.event.count({ where }),
  ]);

  // Determine next cursor
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({
    events: page,
    nextCursor,
    total,
  });
}
