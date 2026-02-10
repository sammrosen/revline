import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

/**
 * DELETE /api/v1/workspaces/[id]/leads/[leadId]
 * 
 * Deletes a single lead and its associated events.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, leadId } = await params;

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Verify lead belongs to this workspace
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Delete associated events first, then the lead
  await prisma.$transaction([
    prisma.event.deleteMany({ where: { leadId } }),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);

  return NextResponse.json({ success: true });
}
