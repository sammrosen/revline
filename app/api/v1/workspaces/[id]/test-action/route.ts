/**
 * Test Action API Route
 *
 * Fires a workflow trigger for testing purposes and returns detailed results.
 * Used by the workspace test suite modal and the chat test panel Workflow Tester.
 *
 * STANDARDS:
 * - Input Validation: Zod schema for request body
 * - API Response: ApiResponse helpers (no raw NextResponse.json)
 * - Event-Driven Debugging: logStructured (no console.error)
 * - Workspace Isolation: auth + workspace access check
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/_lib/db';
import { emitTrigger } from '@/app/_lib/workflow';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { logStructured } from '@/app/_lib/reliability';

const TestActionSchema = z.object({
  trigger: z
    .string()
    .min(1, 'Trigger is required')
    .refine((v) => v.includes('.'), 'Invalid trigger format. Use "adapter.operation" (e.g., "abc_ignite.new_member")'),
  email: z.string().email('Valid email is required'),
  name: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
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

  const parsed = TestActionSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(
      parsed.error.issues.map((e) => e.message).join(', '),
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const { trigger, email, name, payload, ...extraFields } = parsed.data;

  try {
    const [adapter, operation] = trigger.split('.');

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);
    }

    const triggerPayload = {
      email,
      name: name || undefined,
      source: 'test-suite',
      ...(payload || {}),
      ...extraFields,
    };

    const result = await emitTrigger(
      workspaceId,
      { adapter, operation },
      triggerPayload,
      { isTest: true }
    );

    const duration = Date.now() - startTime;

    return ApiResponse.success({
      trigger: `${adapter}.${operation}`,
      workflowsFound: result.workflowsFound,
      workflowsExecuted: result.workflowsExecuted,
      executions: result.executions.map((exec) => ({
        workflowId: exec.workflowId,
        workflowName: exec.workflowName,
        status: exec.status,
        actionsExecuted: exec.actionsExecuted,
        actionsTotal: exec.actionsTotal,
        error: exec.error,
        results: exec.results.map((r) => ({
          action: `${r.action.adapter}.${r.action.operation}`,
          success: r.result.success,
          error: r.result.error,
          data: r.result.data,
        })),
      })),
      allSucceeded: result.executions.every((e) => e.status === 'completed'),
      duration,
    });
  } catch (error) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'test_action_error',
      workspaceId,
      provider: 'workflow',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return ApiResponse.internalError();
  }
}
