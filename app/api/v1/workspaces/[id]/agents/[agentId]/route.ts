/**
 * Individual Agent CRUD API
 *
 * GET    /api/v1/workspaces/[id]/agents/[agentId] -- Get agent details
 * PATCH  /api/v1/workspaces/[id]/agents/[agentId] -- Update agent config
 * DELETE /api/v1/workspaces/[id]/agents/[agentId] -- Delete agent
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus, IntegrationType, Prisma } from '@prisma/client';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { UpdateAgentSchema } from '@/app/_lib/agent/schemas';

type RouteParams = { params: Promise<{ id: string; agentId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    include: {
      _count: {
        select: {
          conversations: { where: { isTest: false } },
        },
      },
    },
  });

  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  return ApiResponse.success({
    ...agent,
    conversationCount: agent._count.conversations,
    _count: undefined,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role === 'VIEWER') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = UpdateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const updateData = parsed.data;

  if (updateData.channelIntegration) {
    const channelInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: updateData.channelIntegration as IntegrationType },
    });
    if (!channelInt) {
      return ApiResponse.error(
        `Channel integration ${updateData.channelIntegration} not configured`,
        400,
        ErrorCodes.INTEGRATION_NOT_CONFIGURED
      );
    }
  }

  if (updateData.aiIntegration) {
    const aiInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: updateData.aiIntegration as IntegrationType },
    });
    if (!aiInt) {
      return ApiResponse.error(
        `AI integration ${updateData.aiIntegration} not configured`,
        400,
        ErrorCodes.INTEGRATION_NOT_CONFIGURED
      );
    }
  }

  const prismaData: Record<string, unknown> = { ...updateData };
  if ('faqOverrides' in prismaData && prismaData.faqOverrides === null) {
    prismaData.faqOverrides = Prisma.JsonNull;
  }

  const agent = await prisma.agent.update({
    where: { id: agentId },
    data: prismaData,
  });

  return ApiResponse.success(agent);
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  await prisma.conversation.updateMany({
    where: {
      agentId,
      workspaceId,
      status: ConversationStatus.ACTIVE,
    },
    data: {
      status: ConversationStatus.COMPLETED,
      endedAt: new Date(),
    },
  });

  await prisma.agent.delete({ where: { id: agentId } });

  return ApiResponse.success({ deleted: true });
}
