/**
 * WebchatConfig CRUD API
 *
 * GET  /api/v1/workspaces/[id]/webchat-configs -- List all webchat configs
 * POST /api/v1/workspaces/[id]/webchat-configs -- Create a new webchat config
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';

const CreateWebchatConfigSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  name: z.string().min(1, 'Name is required').max(100),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#2563eb'),
  chatName: z.string().max(50).default('Chat'),
  collectEmail: z.boolean().default(true),
  collectPhone: z.boolean().default(false),
  greeting: z.string().max(500).nullish(),
  active: z.boolean().default(true),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const configs = await prisma.webchatConfig.findMany({
    where: { workspaceId },
    include: { agent: { select: { id: true, name: true, channels: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return ApiResponse.success(configs);
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

  const parsed = CreateWebchatConfigSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const data = parsed.data;

  const agent = await prisma.agent.findFirst({
    where: { id: data.agentId, workspaceId },
    select: { id: true, channels: true },
  });
  if (!agent) {
    return ApiResponse.error('Agent not found in this workspace', 404, ErrorCodes.NOT_FOUND);
  }

  const channels = Array.isArray(agent.channels)
    ? (agent.channels as Array<{ channel: string }>)
    : [];
  if (!channels.some((c) => c.channel === 'WEB_CHAT')) {
    return ApiResponse.error(
      'Agent does not have WEB_CHAT channel configured. Add it in the agent editor first.',
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const config = await prisma.webchatConfig.create({
    data: {
      workspaceId,
      agentId: data.agentId,
      name: data.name,
      brandColor: data.brandColor,
      chatName: data.chatName,
      collectEmail: data.collectEmail,
      collectPhone: data.collectPhone,
      greeting: data.greeting || null,
      active: data.active,
    },
  });

  return ApiResponse.success(config, 201);
}
