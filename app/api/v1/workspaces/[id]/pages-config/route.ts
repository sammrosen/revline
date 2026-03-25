import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

export async function PATCH(
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

  try {
    const body = await request.json();
    const { pagesConfig } = body;

    await prisma.workspace.update({
      where: { id },
      data: { pagesConfig: pagesConfig ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update pages config:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { pagesConfig: true },
  });

  return NextResponse.json({ pagesConfig: workspace?.pagesConfig ?? null });
}
