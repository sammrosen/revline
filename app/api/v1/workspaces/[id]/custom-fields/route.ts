/**
 * Custom Field Definitions API
 * 
 * GET /api/v1/workspaces/[id]/custom-fields - List all custom field definitions
 * POST /api/v1/workspaces/[id]/custom-fields - Create a new custom field definition
 * 
 * STANDARDS:
 * - Workspace isolation enforced
 * - Role-based access control (VIEWER+ for GET, ADMIN+ for POST)
 * - Zod validation for input
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import {
  CustomFieldService,
} from '@/app/_lib/services';
import { CreateFieldDefinitionSchema } from '@/app/_lib/types/custom-fields';

/**
 * GET /api/v1/workspaces/[id]/custom-fields
 * List all custom field definitions for a workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  // Verify user has at least VIEWER access
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    const definitions = await CustomFieldService.getFieldDefinitions(workspaceId);
    return NextResponse.json({ fields: definitions });
  } catch (error) {
    console.error('Failed to get custom field definitions:', error);
    return NextResponse.json(
      { error: 'Failed to get custom fields' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/workspaces/[id]/custom-fields
 * Create a new custom field definition
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

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

  const validation = CreateFieldDefinitionSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return NextResponse.json(
      { error: `${firstError.path.join('.')}: ${firstError.message}` },
      { status: 400 }
    );
  }

  // Create the field definition
  const result = await CustomFieldService.defineField(workspaceId, validation.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { field: result.data },
    { status: 201 }
  );
}
