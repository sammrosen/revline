import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

/**
 * GET /api/v1/workspaces/[id]/property-coverage
 * 
 * Returns per-property coverage stats: how many leads have data for each key.
 * Single DB query, counted in JS to avoid N raw queries.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const access = await getWorkspaceAccess(userId, id);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Count total leads
  const totalLeads = await prisma.lead.count({ where: { workspaceId: id } });

  // Fetch all leads that have properties data
  const leadsWithProps = await prisma.lead.findMany({
    where: {
      workspaceId: id,
      NOT: { properties: { equals: Prisma.DbNull } },
    },
    select: { properties: true },
  });

  // Count per-key coverage in JS
  const coverage: Record<string, number> = {};
  for (const lead of leadsWithProps) {
    const props = lead.properties as Record<string, unknown> | null;
    if (!props) continue;
    for (const [key, value] of Object.entries(props)) {
      if (value !== null && value !== undefined && value !== '') {
        coverage[key] = (coverage[key] || 0) + 1;
      }
    }
  }

  return NextResponse.json({ totalLeads, coverage });
}
