/**
 * Individual WebchatConfig CRUD API
 *
 * GET    /api/v1/workspaces/[id]/webchat-configs/[configId] -- Get config details
 * PATCH  /api/v1/workspaces/[id]/webchat-configs/[configId] -- Update config
 * DELETE /api/v1/workspaces/[id]/webchat-configs/[configId] -- Delete config
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';

type RouteParams = { params: Promise<{ id: string; configId: string }> };

const UpdateWebchatConfigSchema = z.object({
  agentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  chatName: z.string().max(50).optional(),
  collectEmail: z.boolean().optional(),
  collectPhone: z.boolean().optional(),
  greeting: z.string().max(500).nullish(),
  active: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const config = await prisma.webchatConfig.findFirst({
    where: { id: configId, workspaceId },
    include: { agent: { select: { id: true, name: true } } },
  });

  if (!config) return ApiResponse.error('Webchat config not found', 404, ErrorCodes.NOT_FOUND);

  return ApiResponse.success(config);
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role === 'VIEWER') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.webchatConfig.findFirst({
    where: { id: configId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Webchat config not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = UpdateWebchatConfigSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const data = parsed.data;

  if (data.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: data.agentId, workspaceId },
    });
    if (!agent) {
      return ApiResponse.error('Agent not found in this workspace', 404, ErrorCodes.NOT_FOUND);
    }
  }

  const config = await prisma.webchatConfig.update({
    where: { id: configId },
    data,
  });

  return ApiResponse.success(config);
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.webchatConfig.findFirst({
    where: { id: configId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Webchat config not found', 404, ErrorCodes.NOT_FOUND);

  await prisma.webchatConfig.delete({ where: { id: configId } });

  return ApiResponse.success({ deleted: true });
}
