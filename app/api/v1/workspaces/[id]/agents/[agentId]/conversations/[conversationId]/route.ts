/**
 * Individual Conversation API
 *
 * PATCH /api/v1/workspaces/[id]/agents/[agentId]/conversations/[conversationId]
 *   - { action: 'pause' }  -- Pause bot for this conversation (human takeover)
 *   - { action: 'resume' } -- Resume bot for this conversation
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ConversationStatus } from '@prisma/client';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { ConversationActionSchema } from '@/app/_lib/agent/schemas';

type RouteParams = {
  params: Promise<{ id: string; agentId: string; conversationId: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId, conversationId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, agentId, workspaceId },
    select: { id: true, status: true },
  });
  if (!conversation) return ApiResponse.error('Conversation not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = ConversationActionSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      'Invalid action. Use "pause" or "resume".',
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const { action } = parsed.data;

  if (action === 'pause') {
    if (conversation.status !== ConversationStatus.ACTIVE) {
      return ApiResponse.error(
        `Cannot pause a ${conversation.status} conversation`,
        400,
        ErrorCodes.INVALID_STATE
      );
    }
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.PAUSED,
        pausedAt: new Date(),
        pausedBy: userId,
      },
    });
    return ApiResponse.success({ id: updated.id, status: updated.status });
  }

  if (conversation.status !== ConversationStatus.PAUSED) {
    return ApiResponse.error(
      `Cannot resume a ${conversation.status} conversation`,
      400,
      ErrorCodes.INVALID_STATE
    );
  }
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.ACTIVE,
      pausedAt: null,
      pausedBy: null,
    },
  });
  return ApiResponse.success({ id: updated.id, status: updated.status });
}
