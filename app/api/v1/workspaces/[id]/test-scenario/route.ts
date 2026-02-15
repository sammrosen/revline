/**
 * Test Scenario API Route
 * 
 * Runs composite end-to-end test scenarios that chain multiple operations.
 * Used by the Testing tab's "Scenarios" section.
 * 
 * Unlike test-integration (raw API calls) or test-action (single trigger),
 * this endpoint runs multi-step flows that verify the full pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';
import { AbcIgniteAdapter, normalizeMemberPayload } from '@/app/_lib/integrations';
import { emitTrigger } from '@/app/_lib/workflow';
import { IntegrationType } from '@prisma/client';
import type { AbcIgniteMeta } from '@/app/_lib/types';

// =============================================================================
// SCENARIO DEFINITIONS
// =============================================================================

interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  integration: string;
  fields: Array<{
    name: string;
    label: string;
    placeholder?: string;
    required: boolean;
  }>;
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'abc_member_lookup_and_add',
    name: 'Member Lookup → Add to CRM',
    description: 'Look up an ABC Ignite member by barcode, normalize their data, emit the new_member trigger, and create/update the lead in your CRM. Tests the full member sync pipeline.',
    integration: 'ABC_IGNITE',
    fields: [
      { name: 'barcode', label: 'Member Barcode', placeholder: 'e.g., 1234567890', required: true },
    ],
  },
  {
    id: 'abc_member_sync_preview',
    name: 'Member Sync Preview (Dry Run)',
    description: 'Preview which members would be detected by the sync cron without emitting triggers or creating leads. Shows both new direct signups and recently converted prospects.',
    integration: 'ABC_IGNITE',
    fields: [
      { name: 'lookbackMinutes', label: 'Lookback Window (minutes)', placeholder: '75', required: false },
    ],
  },
];

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/v1/workspaces/[id]/test-scenario
 * Returns available test scenarios for the workspace's configured integrations.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Get configured integrations to filter available scenarios
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
    select: { integration: true },
  });

  const configuredTypes = new Set(integrations.map(i => i.integration));
  const available = SCENARIOS.filter(s => configuredTypes.has(s.integration as IntegrationType));

  return NextResponse.json({ scenarios: available });
}

/**
 * POST /api/v1/workspaces/[id]/test-scenario
 * Execute a test scenario.
 * 
 * Body: { scenario: 'abc_member_lookup_and_add', fields: { barcode: '...' } }
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

  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { scenario, fields } = body;

    if (!scenario) {
      return NextResponse.json({ error: 'scenario is required' }, { status: 400 });
    }

    // =========================================================================
    // SCENARIO: abc_member_lookup_and_add
    // =========================================================================
    if (scenario === 'abc_member_lookup_and_add') {
      const barcode = fields?.barcode?.trim();
      if (!barcode) {
        return NextResponse.json({ error: 'barcode is required' }, { status: 400 });
      }

      const steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; data?: unknown; error?: string; duration_ms?: number }> = [];

      // Step 1: Load ABC Ignite adapter
      const stepStart = Date.now();
      const adapter = await AbcIgniteAdapter.forClient(workspaceId);
      if (!adapter) {
        steps.push({
          step: 'Load ABC Ignite adapter',
          status: 'failed',
          error: 'ABC Ignite is not configured. Check App ID, App Key, and Club Number.',
          duration_ms: Date.now() - stepStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }
      steps.push({
        step: 'Load ABC Ignite adapter',
        status: 'success',
        duration_ms: Date.now() - stepStart,
      });

      // Step 2: Lookup member by barcode
      const lookupStart = Date.now();
      const memberResult = await adapter.getMemberByBarcode(barcode);
      if (!memberResult.success || !memberResult.data) {
        steps.push({
          step: `Lookup member by barcode "${barcode}"`,
          status: 'failed',
          error: memberResult.error || 'Member not found',
          duration_ms: Date.now() - lookupStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }

      const member = memberResult.data;
      steps.push({
        step: `Lookup member by barcode "${barcode}"`,
        status: 'success',
        data: {
          memberId: member.memberId,
          name: `${member.personal?.firstName || ''} ${member.personal?.lastName || ''}`.trim(),
          email: member.personal?.email,
          memberStatus: member.personal?.memberStatus,
        },
        duration_ms: Date.now() - lookupStart,
      });

      // Step 3: Normalize payload
      const normalizeStart = Date.now();
      const payload = normalizeMemberPayload(member);
      
      if (!payload.email) {
        steps.push({
          step: 'Normalize member payload',
          status: 'failed',
          error: 'Member has no email address — cannot create lead without email.',
          data: payload,
          duration_ms: Date.now() - normalizeStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }

      steps.push({
        step: 'Normalize member payload',
        status: 'success',
        data: payload,
        duration_ms: Date.now() - normalizeStart,
      });

      // Step 4: Emit new_member trigger (fires workflows → creates lead)
      const triggerStart = Date.now();
      try {
        const triggerResult = await emitTrigger(
          workspaceId,
          { adapter: 'abc_ignite', operation: 'new_member' },
          payload
        );

        const noWorkflows = triggerResult.workflowsFound === 0;
        const allCompleted = triggerResult.executions.every(e => e.status === 'completed');

        steps.push({
          step: 'Emit new_member trigger → execute workflows',
          status: noWorkflows ? 'failed' : (allCompleted ? 'success' : 'failed'),
          error: noWorkflows
            ? 'No workflows found for the abc_ignite.new_member trigger. Create a workflow with trigger "ABC Ignite → New Member Detected" and action "RevLine → Create/Update Lead" to complete this pipeline.'
            : undefined,
          data: {
            workflowsFound: triggerResult.workflowsFound,
            workflowsExecuted: triggerResult.workflowsExecuted,
            executions: triggerResult.executions.map(e => ({
              workflow: e.workflowName,
              status: e.status,
              actionsExecuted: e.actionsExecuted,
              actionsTotal: e.actionsTotal,
              error: e.error,
              results: e.results.map(r => ({
                action: `${r.action.adapter}.${r.action.operation}`,
                success: r.result.success,
                error: r.result.error,
              })),
            })),
          },
          duration_ms: Date.now() - triggerStart,
        });

        // If no workflows ran, skip verification — lead won't exist
        if (noWorkflows) {
          steps.push({
            step: 'Verify lead in CRM',
            status: 'skipped',
            error: 'Skipped — no workflows executed to create the lead.',
            duration_ms: 0,
          });

          return NextResponse.json({
            scenario,
            success: false,
            steps,
            duration_ms: Date.now() - startTime,
          });
        }

        // Step 5: Verify lead was created/updated
        const verifyStart = Date.now();
        const lead = await prisma.lead.findFirst({
          where: { workspaceId, email: payload.email },
          select: {
            id: true,
            email: true,
            stage: true,
            source: true,
            properties: true,
            createdAt: true,
            lastEventAt: true,
          },
        });

        steps.push({
          step: 'Verify lead in CRM',
          status: lead ? 'success' : 'failed',
          data: lead ? {
            leadId: lead.id,
            email: lead.email,
            stage: lead.stage,
            source: lead.source,
            properties: lead.properties,
            createdAt: lead.createdAt,
            lastEventAt: lead.lastEventAt,
          } : undefined,
          error: lead ? undefined : `No lead found for ${payload.email} after trigger execution. Check your workflow actions.`,
          duration_ms: Date.now() - verifyStart,
        });

        const allPassed = steps.every(s => s.status === 'success');
        return NextResponse.json({
          scenario,
          success: allPassed,
          steps,
          duration_ms: Date.now() - startTime,
        });

      } catch (triggerErr) {
        steps.push({
          step: 'Emit new_member trigger',
          status: 'failed',
          error: triggerErr instanceof Error ? triggerErr.message : 'Trigger execution failed',
          duration_ms: Date.now() - triggerStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }
    }

    // =========================================================================
    // SCENARIO: abc_member_sync_preview (Dry Run)
    // =========================================================================
    if (scenario === 'abc_member_sync_preview') {
      const lookbackMinutes = parseInt(fields?.lookbackMinutes?.trim() || '75', 10) || 75;

      const steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; data?: unknown; error?: string; duration_ms?: number }> = [];

      // Step 1: Load ABC Ignite adapter
      const stepStart = Date.now();
      const adapter = await AbcIgniteAdapter.forClient(workspaceId);
      if (!adapter) {
        steps.push({
          step: 'Load ABC Ignite adapter',
          status: 'failed',
          error: 'ABC Ignite is not configured. Check App ID, App Key, and Club Number.',
          duration_ms: Date.now() - stepStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }
      steps.push({
        step: 'Load ABC Ignite adapter',
        status: 'success',
        duration_ms: Date.now() - stepStart,
      });

      // Step 2: Run detection queries
      const detectStart = Date.now();
      const now = new Date();
      const since = new Date(now.getTime() - lookbackMinutes * 60 * 1000);

      const membersResult = await adapter.getNewAndConvertedMembers(since, now);

      if (!membersResult.success) {
        steps.push({
          step: `Detect members (${lookbackMinutes}min window)`,
          status: 'failed',
          error: membersResult.error || 'Detection query failed',
          duration_ms: Date.now() - detectStart,
        });
        return NextResponse.json({
          scenario,
          success: false,
          steps,
          duration_ms: Date.now() - startTime,
        });
      }

      const allDetected = membersResult.data || [];
      steps.push({
        step: `Detect members (${lookbackMinutes}min window)`,
        status: 'success',
        data: {
          totalDetected: allDetected.length,
          window: {
            since: since.toISOString(),
            until: now.toISOString(),
          },
        },
        duration_ms: Date.now() - detectStart,
      });

      // Step 3: Apply member type filter from workspace config
      const filterStart = Date.now();
      const integration = await prisma.workspaceIntegration.findFirst({
        where: { workspaceId, integration: IntegrationType.ABC_IGNITE },
        select: { meta: true },
      });
      const abcMeta = integration?.meta as AbcIgniteMeta | null;
      const excludedTypes = abcMeta?.memberSync?.excludedMemberTypes || [];
      const excludedSet = new Set(excludedTypes.map(t => t.toLowerCase()));

      const detected = excludedSet.size > 0
        ? allDetected.filter(m => {
            const memberType = m.agreement?.membershipType?.toLowerCase();
            return !memberType || !excludedSet.has(memberType);
          })
        : allDetected;
      const skippedMemberType = allDetected.length - detected.length;

      if (excludedTypes.length > 0) {
        steps.push({
          step: `Filter excluded member types`,
          status: 'success',
          data: {
            excludedTypes,
            beforeFilter: allDetected.length,
            afterFilter: detected.length,
            skipped: skippedMemberType,
          },
          duration_ms: Date.now() - filterStart,
        });
      }

      // Step 4: Show normalized results
      const normalizeStart = Date.now();
      const memberSummaries = detected.map(member => {
        const payload = normalizeMemberPayload(member);
        return {
          memberId: member.memberId,
          name: `${member.personal?.firstName || ''} ${member.personal?.lastName || ''}`.trim() || '(no name)',
          email: member.personal?.email || '(no email)',
          memberStatus: member.personal?.memberStatus,
          joinStatus: member.personal?.joinStatus,
          isConvertedProspect: member.personal?.isConvertedProspect,
          convertedDate: member.agreement?.convertedDate || null,
          membershipType: member.agreement?.membershipType,
          createTimestamp: member.personal?.createTimestamp,
          detectionReason: member._detectionReason,
          hasEmail: !!payload.email,
          normalizedPayload: payload,
        };
      });

      const withEmail = memberSummaries.filter(m => m.hasEmail).length;
      const withoutEmail = memberSummaries.filter(m => !m.hasEmail).length;
      const directCount = memberSummaries.filter(m => m.detectionReason === 'new_direct_signup').length;
      const convertedCount = memberSummaries.filter(m => m.detectionReason === 'converted_prospect').length;

      steps.push({
        step: 'Preview detected members (NO triggers emitted)',
        status: detected.length > 0 ? 'success' : 'skipped',
        error: detected.length === 0 ? `No new members or conversions found in the last ${lookbackMinutes} minutes.` : undefined,
        data: {
          summary: {
            total: detected.length,
            withEmail,
            withoutEmail,
            newDirectSignups: directCount,
            convertedProspects: convertedCount,
          },
          members: memberSummaries,
        },
        duration_ms: Date.now() - normalizeStart,
      });

      return NextResponse.json({
        scenario,
        success: true,
        steps,
        duration_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json({ error: `Unknown scenario: ${scenario}` }, { status: 400 });

  } catch (error) {
    console.error('Test scenario error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
