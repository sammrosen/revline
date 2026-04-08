/**
 * PhoneConfig CRUD API
 *
 * GET  /api/v1/workspaces/[id]/phone-configs -- List all phone configs
 * POST /api/v1/workspaces/[id]/phone-configs -- Create a new phone config
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { IntegrationType, Prisma } from '@prisma/client';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const CreatePhoneConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  twilioNumberKey: z.string().min(1, 'Twilio number is required'),
  forwardingNumber: z.string().regex(E164_REGEX, 'Must be E.164 format (e.g. +15551234567)'),
  mode: z.enum(['NOTIFICATION', 'AGENT']).default('NOTIFICATION'),
  agentId: z.string().uuid().optional().nullable(),
  autoTextTemplate: z.string().min(1).max(500).optional(),
  voiceGreeting: z.string().min(1).max(500).optional(),
  notificationTemplate: z.string().min(1).max(500).optional(),
  blocklist: z.array(z.string().regex(E164_REGEX, 'Blocklist entries must be E.164')).optional(),
  enabled: z.boolean().default(true),
});

interface TwilioPhoneNumbers {
  [key: string]: { number: string; label: string };
}

async function getTwilioPhoneNumbers(workspaceId: string): Promise<TwilioPhoneNumbers | null> {
  const integration = await prisma.workspaceIntegration.findFirst({
    where: { workspaceId, integration: IntegrationType.TWILIO },
    select: { meta: true },
  });
  if (!integration?.meta || typeof integration.meta !== 'object') return null;
  const meta = integration.meta as Record<string, unknown>;
  if (!meta.phoneNumbers || typeof meta.phoneNumbers !== 'object') return null;
  return meta.phoneNumbers as TwilioPhoneNumbers;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  try {
    const configs = await prisma.phoneConfig.findMany({
      where: { workspaceId },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return ApiResponse.success(configs);
  } catch {
    return ApiResponse.error('Failed to load phone configs', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

  const parsed = CreatePhoneConfigSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const data = parsed.data;

  if (data.mode === 'AGENT' && !data.agentId) {
    return ApiResponse.error(
      'Agent is required when mode is AGENT',
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const phoneNumbers = await getTwilioPhoneNumbers(workspaceId);
  if (!phoneNumbers || !phoneNumbers[data.twilioNumberKey]) {
    return ApiResponse.error(
      'Twilio number key not found. Configure phone numbers in the Twilio integration first.',
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  if (data.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: data.agentId, workspaceId },
      select: { id: true },
    });
    if (!agent) {
      return ApiResponse.error('Agent not found in this workspace', 404, ErrorCodes.NOT_FOUND);
    }
  }

  try {
    const config = await prisma.phoneConfig.create({
      data: {
        workspaceId,
        name: data.name,
        twilioNumberKey: data.twilioNumberKey,
        forwardingNumber: data.forwardingNumber,
        mode: data.mode,
        agentId: data.agentId || null,
        autoTextTemplate: data.autoTextTemplate ?? undefined,
        voiceGreeting: data.voiceGreeting ?? undefined,
        notificationTemplate: data.notificationTemplate ?? undefined,
        blocklist: data.blocklist ?? [],
        enabled: data.enabled,
      },
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'phone_config_created',
      success: true,
      metadata: { configId: config.id, name: config.name, mode: config.mode, twilioNumberKey: config.twilioNumberKey },
    });

    return ApiResponse.success(config, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return ApiResponse.error(
        'A phone config already exists for this Twilio number',
        409,
        'DUPLICATE'
      );
    }
    return ApiResponse.error('Failed to create phone config', 500);
  }
}
