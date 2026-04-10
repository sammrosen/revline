import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import {
  checkTriggerCompatibility,
  checkTriggerCompatibilityWithDynamicFields,
  extractCustomFormFields,
} from '@/app/_lib/services/payload-compatibility';
import type { LeadPropertyDefinition } from '@/app/_lib/types';

/**
 * GET /api/v1/workspaces/[id]/property-compatibility
 * 
 * Query params:
 *   adapter   - e.g. "abc_ignite"
 *   operation - e.g. "new_member"
 * 
 * Returns a CompatibilityResult showing which payload fields match
 * the workspace's leadPropertySchema and which are available to add.
 */
export async function GET(
  request: NextRequest,
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

  const { searchParams } = request.nextUrl;
  const adapter = searchParams.get('adapter');
  const operation = searchParams.get('operation');

  if (!adapter || !operation) {
    return NextResponse.json(
      { error: 'Missing required query params: adapter, operation' },
      { status: 400 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { leadPropertySchema: true, pagesConfig: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const leadPropertySchema = (workspace.leadPropertySchema as LeadPropertyDefinition[] | null) ?? [];

  // RevLine triggers may have dynamic custom form fields from workspace config
  const result = adapter === 'revline'
    ? checkTriggerCompatibilityWithDynamicFields(
        adapter, operation, leadPropertySchema,
        extractCustomFormFields(workspace.pagesConfig)
      )
    : checkTriggerCompatibility(adapter, operation, leadPropertySchema);

  if (!result) {
    return NextResponse.json(
      { error: `Unknown trigger: ${adapter}/${operation}` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
