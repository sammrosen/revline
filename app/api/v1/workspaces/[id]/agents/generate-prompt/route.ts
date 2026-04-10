/**
 * Agent Prompt Template & Generation API
 *
 * GET  /api/v1/workspaces/[id]/agents/generate-prompt -- List all templates
 * POST /api/v1/workspaces/[id]/agents/generate-prompt -- Generate a prompt from a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { validateBody } from '@/app/_lib/utils/validation';
import { listTemplates } from '@/app/_lib/agent/prompt-templates';
import { generatePrompt } from '@/app/_lib/agent/prompt-generator';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { rateLimitByIdentifier } from '@/app/_lib/middleware/rate-limit';

// =============================================================================
// SCHEMAS
// =============================================================================

const GeneratePromptSchema = z.object({
  templateId: z.string().min(1, 'templateId is required'),
  variables: z.record(z.string(), z.string()).default({}),
  referenceContent: z.string().max(50000).optional(),
});

// =============================================================================
// GET — List templates
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId } = await params;
  if (!z.string().uuid().safeParse(workspaceId).success) {
    return ApiResponse.error('Invalid workspace ID', 400);
  }

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  return ApiResponse.success(listTemplates());
}

// =============================================================================
// POST — Generate prompt from template
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const rateLimit = rateLimitByIdentifier(`generate_prompt:${userId}`, { requests: 10, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return ApiResponse.error('Rate limit exceeded', 429);
  }

  const validation = await validateBody(request, GeneratePromptSchema);
  if (!validation.success) return validation.response;

  const { templateId, variables, referenceContent } = validation.data;

  try {
    const result = await generatePrompt({
      templateId,
      variables,
      referenceContent,
      workspaceId,
    });

    if (!result.success) {
      return ApiResponse.error(
        result.error ?? 'Failed to generate prompt',
        400,
        ErrorCodes.VALIDATION_FAILED,
      );
    }

    emitEvent({
      workspaceId,
      system: EventSystem.AGENT,
      eventType: 'agent_prompt_generated',
      success: true,
      metadata: { templateId, aiGenerated: !!referenceContent },
    }).catch(() => {});

    return ApiResponse.success({
      prompt: result.prompt,
      initialMessage: result.initialMessage,
      suggestedTools: result.suggestedTools,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown';
    console.error('[GeneratePrompt] POST failed:', { workspaceId, templateId, error: errorMessage });
    try {
      await emitEvent({
        workspaceId,
        system: EventSystem.AGENT,
        eventType: 'agent_prompt_generation_failed',
        success: false,
        errorMessage,
        metadata: { templateId },
      });
    } catch { /* never break main flow */ }
    return ApiResponse.error('Failed to generate prompt', 500);
  }
}
