/**
 * Individual PhoneConfig CRUD API
 *
 * GET    /api/v1/workspaces/[id]/phone-configs/[configId] -- Get config details
 * PATCH  /api/v1/workspaces/[id]/phone-configs/[configId] -- Update config
 * DELETE /api/v1/workspaces/[id]/phone-configs/[configId] -- Delete config
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { logStructured } from '@/app/_lib/reliability';
import { IntegrationType, Prisma } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string; configId: string }> };

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const UpdatePhoneConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  twilioNumberKey: z.string().min(1).optional(),
  forwardingNumber: z.string().regex(E164_REGEX, 'Must be E.164 format').optional(),
  mode: z.enum(['NOTIFICATION', 'AGENT']).optional(),
  agentId: z.string().uuid().optional().nullable(),
  autoTextTemplate: z.string().min(1).max(500).optional(),
  voiceGreeting: z.string().min(1).max(500).optional(),
  notificationTemplate: z.string().min(1).max(500).optional(),
  blocklist: z.array(z.string().regex(E164_REGEX, 'Blocklist entries must be E.164')).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  try {
    const config = await prisma.phoneConfig.findFirst({
      where: { id: configId, workspaceId },
      include: { agent: { select: { id: true, name: true } } },
    });

    if (!config) return ApiResponse.error('Phone config not found', 404, ErrorCodes.NOT_FOUND);

    return ApiResponse.success(config);
  } catch {
    return ApiResponse.error('Failed to load phone config', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role === 'VIEWER') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.phoneConfig.findFirst({
    where: { id: configId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Phone config not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = UpdatePhoneConfigSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const data = parsed.data;

  const finalMode = data.mode ?? existing.mode;
  const finalAgentId = data.agentId !== undefined ? data.agentId : existing.agentId;

  if (finalMode === 'AGENT' && !finalAgentId) {
    return ApiResponse.error(
      'Agent is required when mode is AGENT',
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  if (data.twilioNumberKey) {
    const integration = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: IntegrationType.TWILIO },
      select: { meta: true },
    });
    const meta = integration?.meta as Record<string, unknown> | null;
    const phoneNumbers = meta?.phoneNumbers as Record<string, unknown> | null;
    if (!phoneNumbers || !phoneNumbers[data.twilioNumberKey]) {
      return ApiResponse.error(
        'Twilio number key not found. Configure phone numbers in the Twilio integration first.',
        400,
        ErrorCodes.VALIDATION_FAILED
      );
    }
  }

  if (data.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: data.agentId, workspaceId },
    });
    if (!agent) {
      return ApiResponse.error('Agent not found in this workspace', 404, ErrorCodes.NOT_FOUND);
    }
  }

  try {
    const result = await prisma.phoneConfig.updateMany({
      where: { id: configId, workspaceId },
      data,
    });

    if (result.count === 0) {
      return ApiResponse.error('Phone config not found', 404, ErrorCodes.NOT_FOUND);
    }

    const config = await prisma.phoneConfig.findUnique({ where: { id: configId } });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'phone_config_updated',
      success: true,
      metadata: { configId, fields: Object.keys(data) },
    });

    return ApiResponse.success(config);
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'phone_config_update_error',
      workspaceId,
      provider: 'backend',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { configId },
    });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return ApiResponse.error(
        'A phone config already exists for this Twilio number',
        409,
        'DUPLICATE'
      );
    }
    return ApiResponse.error('Failed to update phone config', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, configId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  const existing = await prisma.phoneConfig.findFirst({
    where: { id: configId, workspaceId },
  });
  if (!existing) return ApiResponse.error('Phone config not found', 404, ErrorCodes.NOT_FOUND);

  try {
    const result = await prisma.phoneConfig.deleteMany({
      where: { id: configId, workspaceId },
    });

    if (result.count === 0) {
      return ApiResponse.error('Phone config not found', 404, ErrorCodes.NOT_FOUND);
    }

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'phone_config_deleted',
      success: true,
      metadata: { configId, name: existing.name },
    });

    return ApiResponse.success({ deleted: true });
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'phone_config_delete_error',
      workspaceId,
      provider: 'backend',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { configId },
    });
    return ApiResponse.error('Failed to delete phone config', 500);
  }
}
