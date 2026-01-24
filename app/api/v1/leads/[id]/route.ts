/**
 * Lead API (Individual Lead)
 * 
 * GET /api/v1/leads/[id] - Get lead details with custom fields
 * 
 * STANDARDS:
 * - Workspace isolation enforced (user must have access to lead's workspace)
 * - Includes customFields (defined fields only by default)
 * - Optional ?includeRawCustomData=true for full custom data blob
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { CustomFieldService } from '@/app/_lib/services';
import { LeadCustomData } from '@/app/_lib/types/custom-fields';

/**
 * GET /api/v1/leads/[id]
 * Get lead details including custom fields
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
  const includeRawCustomData = searchParams.get('includeRawCustomData') === 'true';

  // Get the lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      source: true,
      stage: true,
      errorState: true,
      customData: true,
      createdAt: true,
      lastEventAt: true,
    },
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
  const rawCustomData = lead.customData as LeadCustomData | null;
  let customFields: LeadCustomData | null = null;

  if (rawCustomData) {
    // Filter to defined fields only
    const definitions = await CustomFieldService.getFieldDefinitions(lead.workspaceId);
    const definedKeys = new Set(definitions.map(d => d.key));

    customFields = {};
    for (const [key, value] of Object.entries(rawCustomData)) {
      if (definedKeys.has(key)) {
        customFields[key] = value;
      }
    }
  }

  // Build response
  const response: Record<string, unknown> = {
    id: lead.id,
    workspaceId: lead.workspaceId,
    email: lead.email,
    source: lead.source,
    stage: lead.stage,
    errorState: lead.errorState,
    customFields: customFields || {},
    createdAt: lead.createdAt,
    lastEventAt: lead.lastEventAt,
  };

  // Include raw custom data if requested
  if (includeRawCustomData) {
    response.rawCustomData = rawCustomData || {};
  }

  return NextResponse.json(response);
}
