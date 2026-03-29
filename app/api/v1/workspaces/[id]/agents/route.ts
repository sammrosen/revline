/**
 * Agent CRUD API
 *
 * GET  /api/v1/workspaces/[id]/agents -- List all agents for workspace
 * POST /api/v1/workspaces/[id]/agents -- Create a new agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { IntegrationType, Prisma } from '@prisma/client';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { CreateAgentSchema } from '@/app/_lib/agent/schemas';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { withTransaction } from '@/app/_lib/utils/transaction';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  if (!z.string().uuid().safeParse(workspaceId).success) {
    return ApiResponse.error('Invalid workspace ID', 400);
  }

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  try {
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
  } catch (err) {
    console.error('[Agents] GET failed:', {
      workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return ApiResponse.error('Failed to fetch agents', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  if (!z.string().uuid().safeParse(workspaceId).success) {
    return ApiResponse.error('Invalid workspace ID', 400);
  }

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

  try {
    const channels = data.channels || [];

    const agent = await withTransaction(async (tx) => {
      const aiInt = await tx.workspaceIntegration.findFirst({
        where: { workspaceId, integration: data.aiIntegration as IntegrationType },
      });
      if (!aiInt) {
        throw new Error(`AI integration ${data.aiIntegration} not configured for this workspace`);
      }

      for (const ch of channels) {
        if (ch.integration !== 'BUILT_IN') {
          const channelInt = await tx.workspaceIntegration.findFirst({
            where: { workspaceId, integration: ch.integration as IntegrationType },
          });
          if (!channelInt) {
            throw new Error(`Channel integration ${ch.integration} not configured for this workspace`);
          }
        }
      }

      return tx.agent.create({
        data: {
          workspaceId,
          name: data.name,
          description: data.description || null,
          channels: channels.length > 0 ? channels : [],
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
          enabledTools: data.enabledTools,
          active: data.active,
          guardrails: data.guardrails ?? {},
        },
      });
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'agent_created',
      success: true,
      metadata: { agentId: agent.id, channelType: agent.channelType },
    });

    return ApiResponse.success(agent, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    if (message.includes('not configured for this workspace')) {
      return ApiResponse.error(message, 400, ErrorCodes.INTEGRATION_NOT_CONFIGURED);
    }
    console.error('[Agents] POST failed:', {
      workspaceId,
      error: message,
    });
    return ApiResponse.error('Failed to create agent', 500);
  }
}
