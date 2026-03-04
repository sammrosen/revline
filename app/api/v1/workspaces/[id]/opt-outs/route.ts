/**
 * Opt-Out Management API
 *
 * GET    /api/v1/workspaces/[id]/opt-outs -- List opt-out records for workspace
 * DELETE /api/v1/workspaces/[id]/opt-outs?recordId=X -- Remove an opt-out (re-enable contact)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';

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

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const [records, total] = await Promise.all([
    prisma.optOutRecord.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.optOutRecord.count({ where: { workspaceId } }),
  ]);

  return NextResponse.json({ data: records, total });
}

export async function DELETE(
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

  if (access.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const url = new URL(request.url);
  const recordId = url.searchParams.get('recordId');
  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  const record = await prisma.optOutRecord.findFirst({
    where: { id: recordId, workspaceId },
  });

  if (!record) {
    return NextResponse.json({ error: 'Opt-out record not found' }, { status: 404 });
  }

  await prisma.optOutRecord.delete({ where: { id: recordId } });

  return NextResponse.json({ data: { deleted: true, contactAddress: record.contactAddress } });
}
