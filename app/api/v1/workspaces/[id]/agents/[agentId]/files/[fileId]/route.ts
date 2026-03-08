/**
 * Individual Agent File API
 *
 * DELETE /api/v1/workspaces/[id]/agents/[agentId]/files/[fileId] -- Delete file
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';

type RouteParams = { params: Promise<{ id: string; agentId: string; fileId: string }> };

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId, fileId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const file = await prisma.agentFile.findFirst({
    where: { id: fileId, agentId },
  });
  if (!file) return ApiResponse.error('File not found', 404, ErrorCodes.NOT_FOUND);

  await prisma.agentFile.delete({ where: { id: fileId } });

  return ApiResponse.success({ deleted: true });
}
