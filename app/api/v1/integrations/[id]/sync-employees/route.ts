import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { AbcIgniteAdapter } from '@/app/_lib/integrations';
import { IntegrationType } from '@prisma/client';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';

/**
 * GET /api/v1/integrations/[id]/sync-employees
 * 
 * Fetches employees from ABC Ignite API for the given integration.
 * Used by the config editor to sync available employees.
 * 
 * Response:
 * {
 *   success: true,
 *   employees: [
 *     { employeeId, name, status, title, barcode }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Load integration to verify it exists and is ABC Ignite
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id },
      select: { 
        id: true,
        workspaceId: true, 
        integration: true,
        meta: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Verify user has access to this workspace
    const access = await getWorkspaceAccess(userId, integration.workspaceId);
    if (!access) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (integration.integration !== IntegrationType.ABC_IGNITE) {
      return NextResponse.json(
        { error: 'This endpoint only works for ABC Ignite integrations' },
        { status: 400 }
      );
    }

    // Load the adapter (this validates credentials are configured)
    const adapter = await AbcIgniteAdapter.forClient(integration.workspaceId);
    
    if (!adapter) {
      return NextResponse.json(
        { 
          error: 'ABC Ignite is not properly configured. Make sure App ID, App Key, and Club Number are set.',
          code: 'NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    // Fetch employees from ABC Ignite (active by default)
    const result = await adapter.getEmployees({ employeeStatus: 'Active' });

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to fetch employees from ABC Ignite',
          code: 'API_ERROR',
        },
        { status: 502 }
      );
    }

    // Transform the response to a cleaner format for the UI
    const employees = (result.data || []).map(emp => {
      // Build display name from personal info
      const firstName = emp.personal?.firstName || '';
      const lastName = emp.personal?.lastName || '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      
      // Get title from first assigned role if available
      const title = emp.assignedRoles?.[0]?.roleName;
      
      // Get status from employment
      const status = emp.employment?.employeeStatus || 'Unknown';
      
      return {
        employeeId: emp.employeeId,
        name,
        status,
        title,
        barcode: emp.barcode,
      };
    });

    return NextResponse.json({
      success: true,
      employees,
      clubNumber: adapter.getClubNumber(),
    });

  } catch (error) {
    console.error('Sync employees error:', error);
    return NextResponse.json(
      { error: 'Failed to sync employees' },
      { status: 500 }
    );
  }
}
