/**
 * Agent Test Trigger API
 *
 * POST -- Simulate a workflow trigger hitting the agent.
 * Tests the "bot reaches out first" flow where a workflow
 * action activates the agent for a contact.
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { handleInboundMessage } from '@/app/_lib/agent';
import { estimateCost, getDefaultModel } from '@/app/_lib/agent/pricing';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { TestTriggerSchema } from '@/app/_lib/agent/schemas';

type RouteParams = { params: Promise<{ id: string; agentId: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = TestTriggerSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const {
    from = `test-contact-${userId}`,
    to = 'test-bot',
    messageBody,
    systemPromptOverride,
  } = parsed.data;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const result = await handleInboundMessage({
    workspaceId,
    agentId,
    contactAddress: from,
    channelAddress: to,
    channel: 'TEST',
    messageText: messageBody,
    testMode: true,
    systemPromptOverride: systemPromptOverride || undefined,
  });

  const model = agent.modelOverride || getDefaultModel(agent.aiIntegration);
  const costEstimate = estimateCost(
    model,
    result.usage.promptTokens,
    result.usage.completionTokens
  );

  return ApiResponse.success({
    ...result,
    costEstimate,
    model,
    triggerSimulated: true,
    triggerPayload: { from, to, body: messageBody },
  });
}
