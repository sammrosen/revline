/**
 * Test Action API Route
 *
 * Fires a workflow trigger for testing purposes and returns detailed results.
 * Used by the workspace test suite modal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitTrigger } from '@/app/_lib/workflow';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require user auth
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const { id: clientId } = await params;

  // Verify user has ADMIN or higher access (test actions can trigger workflows)
  const access = await getWorkspaceAccess(userId, clientId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { trigger, email, name, payload } = body;

    // Validate required fields
    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger is required (e.g., "revline.email_captured")' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Parse trigger string (adapter.operation)
    const [adapter, operation] = trigger.split('.');
    if (!adapter || !operation) {
      return NextResponse.json(
        {
          error:
            'Invalid trigger format. Use "adapter.operation" (e.g., "revline.email_captured")',
        },
        { status: 400 }
      );
    }

    // Validate client exists
    const client = await prisma.workspace.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build trigger payload
    const triggerPayload = {
      email,
      name: name || undefined,
      source: 'test-suite',
      ...(payload || {}),
    };

    // Emit the trigger
    const result = await emitTrigger(
      clientId,
      { adapter, operation },
      triggerPayload
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
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
    console.error('Test action error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
