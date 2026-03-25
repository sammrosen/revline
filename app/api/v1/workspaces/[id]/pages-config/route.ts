import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { logStructured } from '@/app/_lib/reliability/types';

const patchSchema = z.object({
  pagesConfig: z.record(z.string(), z.unknown()).nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id } = await params;

  const access = await getWorkspaceAccess(userId, id);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.error('Invalid pages config payload', 400, ErrorCodes.INVALID_INPUT);
    }

    await prisma.workspace.update({
      where: { id },
      data: {
        pagesConfig: parsed.data.pagesConfig
          ? (parsed.data.pagesConfig as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    logStructured({
      correlationId: id,
      event: 'pages_config_updated',
      workspaceId: id,
      success: true,
    });

    return ApiResponse.success({ updated: true });
  } catch (error) {
    logStructured({
      correlationId: id,
      event: 'pages_config_update_failed',
      workspaceId: id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return ApiResponse.internalError();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id } = await params;

  const access = await getWorkspaceAccess(userId, id);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { pagesConfig: true },
  });

  return ApiResponse.success({ pagesConfig: workspace?.pagesConfig ?? null });
}
