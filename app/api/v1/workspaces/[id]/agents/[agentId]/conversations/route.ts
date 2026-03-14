/**
 * Agent Conversations API
 *
 * GET /api/v1/workspaces/[id]/agents/[agentId]/conversations -- List conversations
 *
 * STANDARDS:
 * - Input Validation: Zod for query params
 * - Workspace Isolation: scoped by workspaceId
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';

const ConversationListQuery = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ESCALATED', 'TIMED_OUT']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const { searchParams } = new URL(request.url);
  const queryParsed = ConversationListQuery.safeParse({
    status: searchParams.get('status') || undefined,
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
  });

  if (!queryParsed.success) {
    return ApiResponse.error(
      queryParsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const { status, limit, offset } = queryParsed.data;

  const where: Record<string, unknown> = { agentId, workspaceId, isTest: false };
  if (status) {
    where.status = status;
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        contactAddress: true,
        channelAddress: true,
        channel: true,
        status: true,
        messageCount: true,
        totalTokens: true,
        startedAt: true,
        lastMessageAt: true,
        endedAt: true,
        lead: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return ApiResponse.success({ conversations, pagination: { total, limit, offset } });
}
