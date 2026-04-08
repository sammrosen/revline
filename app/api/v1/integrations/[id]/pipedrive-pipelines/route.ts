import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { PipedriveAdapter } from '@/app/_lib/integrations';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { IntegrationType } from '@prisma/client';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import { DEFAULT_LEAD_STAGES, type LeadStageDefinition } from '@/app/_lib/types';

const LeadStagesSchema = z
  .array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      color: z.string().default('#6B7280'),
    }),
  )
  .min(1);

/**
 * GET /api/v1/integrations/[id]/pipedrive-pipelines
 *
 * Fetch all pipelines (with nested stages) from the workspace's Pipedrive
 * account. Returns a sanitized shape — raw Pipedrive error bodies are never
 * exposed to the client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return ApiResponse.unauthorized();
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return ApiResponse.error('Invalid integration ID', 400);
  }

  try {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: {
        workspaceId: true,
        integration: true,
        workspace: { select: { leadStages: true } },
      },
    });

    if (!integration) {
      return ApiResponse.error('Integration not found', 404);
    }

    if (integration.integration !== IntegrationType.PIPEDRIVE) {
      return ApiResponse.error(
        'This endpoint is only available for Pipedrive integrations',
        400,
      );
    }

    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return ApiResponse.error('Workspace not found', 404);
    }

    if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
      return ApiResponse.error('Insufficient permissions to manage integrations', 403);
    }

    const adapter = await PipedriveAdapter.forWorkspace(integration.workspaceId);
    if (!adapter) {
      return ApiResponse.error(
        'Pipedrive integration not properly configured (missing API Token)',
        400,
      );
    }

    const [pipelinesRes, stagesRes] = await Promise.all([
      adapter.listPipelines(),
      adapter.listStages(),
    ]);

    if (!pipelinesRes.success) {
      return ApiResponse.error('Failed to fetch pipelines from Pipedrive', 502);
    }
    if (!stagesRes.success) {
      return ApiResponse.error('Failed to fetch stages from Pipedrive', 502);
    }

    const stagesByPipeline = new Map<number, Array<{ id: number; name: string; orderNr?: number }>>();
    for (const stage of stagesRes.data || []) {
      if (stage.pipelineId == null) continue;
      const list = stagesByPipeline.get(stage.pipelineId) ?? [];
      list.push({ id: stage.id, name: stage.name, orderNr: stage.orderNr });
      stagesByPipeline.set(stage.pipelineId, list);
    }
    for (const list of stagesByPipeline.values()) {
      list.sort((a, b) => (a.orderNr ?? 0) - (b.orderNr ?? 0));
    }

    const pipelines = (pipelinesRes.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      stages: stagesByPipeline.get(p.id) ?? [],
    }));

    const parsedStages = LeadStagesSchema.safeParse(integration.workspace.leadStages);
    const leadStages: LeadStageDefinition[] = parsedStages.success
      ? parsedStages.data
      : DEFAULT_LEAD_STAGES;

    return ApiResponse.success({ pipelines, leadStages });
  } catch (error) {
    console.error('Fetch Pipedrive pipelines error:', error);
    return ApiResponse.error('Failed to fetch pipelines', 500);
  }
}
