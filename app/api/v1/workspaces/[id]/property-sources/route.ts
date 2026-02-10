import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { getPropertySources } from '@/app/_lib/services/payload-compatibility';

/**
 * GET /api/v1/workspaces/[id]/property-sources
 * 
 * Returns a map of property keys to the triggers that can populate them.
 * No DB needed — pure registry introspection.
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

  const sources = getPropertySources();

  return NextResponse.json({ sources });
}
