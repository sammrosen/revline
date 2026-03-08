/**
 * Agent CRUD API
 *
 * GET  /api/v1/workspaces/[id]/agents -- List all agents for workspace
 * POST /api/v1/workspaces/[id]/agents -- Create a new agent
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { IntegrationType, Prisma } from '@prisma/client';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { CreateAgentSchema } from '@/app/_lib/agent/schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          conversations: { where: { isTest: false } },
        },
      },
    },
  });

  return ApiResponse.success(
    agents.map((bot) => ({
      ...bot,
      conversationCount: bot._count.conversations,
      _count: undefined,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role === 'VIEWER') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const data = parsed.data;

  const aiInt = await prisma.workspaceIntegration.findFirst({
    where: { workspaceId, integration: data.aiIntegration as IntegrationType },
  });
  if (!aiInt) {
    return ApiResponse.error(
      `AI integration ${data.aiIntegration} not configured for this workspace`,
      400,
      ErrorCodes.INTEGRATION_NOT_CONFIGURED
    );
  }

  if (data.channelIntegration) {
    const channelInt = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: data.channelIntegration as IntegrationType },
    });
    if (!channelInt) {
      return ApiResponse.error(
        `Channel integration ${data.channelIntegration} not configured for this workspace`,
        400,
        ErrorCodes.INTEGRATION_NOT_CONFIGURED
      );
    }
  }

  const agent = await prisma.agent.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description || null,
      channelType: data.channelType || null,
      channelIntegration: data.channelIntegration || null,
      channelAddress: data.channelAddress || null,
      aiIntegration: data.aiIntegration,
      systemPrompt: data.systemPrompt,
      initialMessage: data.initialMessage || null,
      modelOverride: data.modelOverride || null,
      temperatureOverride: data.temperatureOverride ?? null,
      maxTokensOverride: data.maxTokensOverride ?? null,
      maxMessagesPerConversation: data.maxMessagesPerConversation,
      maxTokensPerConversation: data.maxTokensPerConversation,
      conversationTimeoutMinutes: data.conversationTimeoutMinutes,
      responseDelaySeconds: data.responseDelaySeconds,
      autoResumeMinutes: data.autoResumeMinutes,
      rateLimitPerHour: data.rateLimitPerHour,
      fallbackMessage: data.fallbackMessage || null,
      escalationPattern: data.escalationPattern || null,
      faqOverrides: data.faqOverrides ?? Prisma.JsonNull,
      allowedEvents: data.allowedEvents,
      active: data.active,
    },
  });

  return ApiResponse.success(agent, 201);
}
