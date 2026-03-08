/**
 * Test Action Direct API Route
 *
 * Executes a single workflow action directly for testing purposes.
 * Builds a WorkflowContext from the provided email/params and runs the executor.
 * Used by the chat test panel's Workflow Tester (Actions mode).
 *
 * STANDARDS:
 * - Input Validation: Zod schema for request body
 * - API Response: ApiResponse helpers
 * - Event-Driven Debugging: logStructured (no console.error)
 * - Workspace Isolation: auth + workspace access check
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { upsertLead } from '@/app/_lib/event-logger';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { getActionExecutor, hasActionExecutor } from '@/app/_lib/workflow/executors';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { WorkflowContext } from '@/app/_lib/workflow/types';
import { logStructured } from '@/app/_lib/reliability';

const TestActionDirectSchema = z.object({
  action: z
    .string()
    .min(1, 'Action is required')
    .refine((v) => v.includes('.'), 'Invalid action format. Use "adapter.operation" (e.g., "revline.update_lead_stage")'),
  email: z.string().email('Valid email is required'),
}).passthrough();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const startTime = Date.now();
  const { id: workspaceId } = await params;

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
  }

  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return ApiResponse.error('Insufficient permissions', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400, ErrorCodes.INVALID_INPUT);
  }

  const parsed = TestActionDirectSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const { action, email, ...fieldValues } = parsed.data;

  try {
    const [adapter, operation] = action.split('.');

    if (!hasActionExecutor(adapter, operation)) {
      return ApiResponse.error(`No executor found for action: ${action}`, 400);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
    }

    const leadId = await upsertLead({
      workspaceId,
      email,
      source: 'test-suite-direct',
    });

    const actionParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      if (key === 'name') continue;
      if (typeof value === 'string' && value.startsWith('{')) {
        try {
          actionParams[key] = JSON.parse(value);
        } catch {
          actionParams[key] = value;
        }
      } else if (key === 'success' && typeof value === 'string') {
        actionParams[key] = value === 'true';
      } else {
        actionParams[key] = value;
      }
    }

    const ctx: WorkflowContext = {
      trigger: {
        adapter: 'test-suite',
        operation: 'direct_action',
        payload: { email, name: fieldValues.name, source: 'test-suite-direct' },
      },
      email,
      name: fieldValues.name as string | undefined,
      workspaceId,
      clientId: workspaceId,
      leadId,
      isTest: true,
      actionData: {},
    };

    const executor = getActionExecutor(adapter, operation);
    const result = await executor.execute(ctx, actionParams);

    const duration = Date.now() - startTime;

    return ApiResponse.success({
      action: `${adapter}.${operation}`,
      ...result,
      duration,
    });
  } catch (error) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'test_action_direct_error',
      workspaceId,
      provider: 'workflow',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return ApiResponse.internalError();
  }
}
