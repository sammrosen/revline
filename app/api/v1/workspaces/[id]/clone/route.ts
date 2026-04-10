import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { validateBody } from '@/app/_lib/utils/validation';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import { cloneWorkspace } from '@/app/_lib/services/workspace-clone.service';
import { prisma } from '@/app/_lib/db';

const CloneBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z][a-z0-9-]*$/, 'Slug must start with a letter and contain only lowercase letters, numbers, and hyphens'),
  timezone: z.string().optional(),
});

/**
 * POST /api/v1/workspaces/[id]/clone
 *
 * Clone a workspace — copies config, agents, workflows, webchat/phone
 * configs, and integration metadata (NOT secrets).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id: sourceWorkspaceId } = await params;

  // Verify user has access to source workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: sourceWorkspaceId },
    },
    select: { role: true },
  });

  if (!membership) {
    return ApiResponse.error('Workspace not found', 404);
  }

  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return ApiResponse.error('Only owners and admins can clone workspaces', 403);
  }

  // Get source workspace for org context
  const source = await prisma.workspace.findUnique({
    where: { id: sourceWorkspaceId },
    select: { organizationId: true },
  });

  if (!source) {
    return ApiResponse.error('Source workspace not found', 404);
  }

  const validation = await validateBody(request, CloneBodySchema);
  if (!validation.success) return validation.response;

  const { name, slug, timezone } = validation.data;

  try {
    const result = await cloneWorkspace({
      sourceWorkspaceId,
      name,
      slug,
      timezone,
      userId,
      organizationId: source.organizationId ?? undefined,
    });

    return ApiResponse.success(result, 201);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return ApiResponse.error('A workspace with this slug already exists', 400);
    }
    throw error;
  }
}
