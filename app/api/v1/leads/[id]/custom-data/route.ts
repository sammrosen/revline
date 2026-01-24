/**
 * Lead Custom Data API
 * 
 * GET /api/v1/leads/[id]/custom-data - Get custom data for a lead
 * PATCH /api/v1/leads/[id]/custom-data - Update custom data for a lead
 * 
 * STANDARDS:
 * - Workspace isolation enforced
 * - Role-based access control (MEMBER+ for PATCH)
 * - Validates against field definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { CustomFieldService } from '@/app/_lib/services';
import { LeadCustomData, CustomDataSchema } from '@/app/_lib/types/custom-fields';

/**
 * GET /api/v1/leads/[id]/custom-data
 * Get custom data for a lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { searchParams } = new URL(request.url);
  const definedOnly = searchParams.get('definedOnly') === 'true';

  // Get the lead to verify access
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Verify user has access to this lead's workspace
  const access = await getWorkspaceAccess(userId, lead.workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Get custom data
  const customData = await CustomFieldService.getLeadCustomData(leadId, { definedOnly });

  return NextResponse.json({ customData: customData || {} });
}

/**
 * PATCH /api/v1/leads/[id]/custom-data
 * Update custom data for a lead (merge by default)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: leadId } = await params;
  const { searchParams } = new URL(request.url);
  const replace = searchParams.get('replace') === 'true'; // If true, replace instead of merge

  // Get the lead to verify access
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Verify user has MEMBER or higher access
  const access = await getWorkspaceAccess(userId, lead.workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Check role - need at least MEMBER
  const allowedRoles = [WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER];
  if (!allowedRoles.includes(access.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Basic schema validation
  const validation = CustomDataSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return NextResponse.json(
      { error: `${firstError.path.join('.')}: ${firstError.message}` },
      { status: 400 }
    );
  }

  const customData = validation.data as LeadCustomData;

  // Set custom data (validates against field definitions)
  const result = await CustomFieldService.setLeadCustomData(leadId, customData, {
    validate: true,
    merge: !replace,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Return updated custom data
  const updatedData = await CustomFieldService.getLeadCustomData(leadId, { definedOnly: true });

  return NextResponse.json({
    success: true,
    customData: updatedData || {},
  });
}
