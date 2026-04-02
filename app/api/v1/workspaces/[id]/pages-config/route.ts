import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { logStructured } from '@/app/_lib/reliability/types';
import { validatePagesConfig } from '@/app/_lib/config/schema';

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
    const raw = body?.pagesConfig ?? null;

    const validation = validatePagesConfig(raw);
    if (!validation.success) {
      logStructured({
        correlationId: id,
        event: 'pages_config_validation_failed',
        workspaceId: id,
        success: false,
        metadata: { errors: validation.errors },
      });
      return ApiResponse.validationError(
        'Invalid pages config',
        validation.errors!.map((e) => ({ code: 'INVALID_FIELD', message: e.message, param: e.path })),
      );
    }

    await prisma.workspace.update({
      where: { id },
      data: {
        pagesConfig: raw
          ? (raw as Prisma.InputJsonValue)
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

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { pagesConfig: true },
    });

    return ApiResponse.success({ pagesConfig: workspace?.pagesConfig ?? null });
  } catch (error) {
    logStructured({
      correlationId: id,
      event: 'pages_config_get_failed',
      workspaceId: id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return ApiResponse.internalError();
  }
}
