/**
 * Custom Field Definition API (Individual Field)
 * 
 * GET /api/v1/workspaces/[id]/custom-fields/[key] - Get a single field definition
 * PATCH /api/v1/workspaces/[id]/custom-fields/[key] - Update a field definition
 * DELETE /api/v1/workspaces/[id]/custom-fields/[key] - Delete a field definition
 * 
 * STANDARDS:
 * - Workspace isolation enforced
 * - Role-based access control (VIEWER+ for GET, ADMIN+ for PATCH/DELETE)
 * - Cannot change key or fieldType after creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { CustomFieldService } from '@/app/_lib/services';
import { UpdateFieldDefinitionSchema } from '@/app/_lib/types/custom-fields';

/**
 * GET /api/v1/workspaces/[id]/custom-fields/[key]
 * Get a single field definition
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, key } = await params;

  // Verify user has at least VIEWER access
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    const definition = await CustomFieldService.getFieldDefinition(workspaceId, key);
    
    if (!definition) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    return NextResponse.json({ field: definition });
  } catch (error) {
    console.error('Failed to get custom field definition:', error);
    return NextResponse.json(
      { error: 'Failed to get field' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/workspaces/[id]/custom-fields/[key]
 * Update a field definition
 * Note: key and fieldType cannot be changed
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, key } = await params;

  // Verify user has ADMIN or higher access
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Reject attempts to change key or fieldType
  const bodyObj = body as Record<string, unknown>;
  if ('key' in bodyObj || 'fieldType' in bodyObj) {
    return NextResponse.json(
      { error: 'Cannot change key or fieldType after creation' },
      { status: 400 }
    );
  }

  const validation = UpdateFieldDefinitionSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return NextResponse.json(
      { error: `${firstError.path.join('.')}: ${firstError.message}` },
      { status: 400 }
    );
  }

  // Update the field definition
  const result = await CustomFieldService.updateFieldDefinition(workspaceId, key, validation.data);

  if (!result.success) {
    const status = result.error.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ field: result.data });
}

/**
 * DELETE /api/v1/workspaces/[id]/custom-fields/[key]
 * Delete a field definition
 * Note: Does NOT delete existing values on leads
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, key } = await params;

  // Verify user has ADMIN or higher access
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Delete the field definition
  const result = await CustomFieldService.deleteFieldDefinition(workspaceId, key);

  if (!result.success) {
    const status = result.error.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
