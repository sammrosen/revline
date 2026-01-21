import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { AbcIgniteAdapter } from '@/app/_lib/integrations';
import { IntegrationType } from '@prisma/client';
import { getWorkspaceAccess, WorkspaceRole } from '@/app/_lib/workspace-access';

/**
 * GET /api/v1/workspaces/[id]/test-integration
 * 
 * Returns available integrations and their known endpoints for testing.
 * Used by the Testing tab to populate the integration dropdown.
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

  // Verify user has access to this workspace
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    // Get configured integrations for this workspace
    const integrations = await prisma.workspaceIntegration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        integration: true,
        healthStatus: true,
      },
    });

    // Build response with known endpoints for each integration type
    const availableIntegrations = integrations.map(int => {
      let knownEndpoints: { method: string; path: string; description: string }[] = [];
      
      if (int.integration === IntegrationType.ABC_IGNITE) {
        knownEndpoints = [...AbcIgniteAdapter.knownEndpoints];
      }
      // Add other integration types here as needed
      
      return {
        id: int.id,
        type: int.integration,
        healthStatus: int.healthStatus,
        knownEndpoints,
      };
    });

    return NextResponse.json({
      success: true,
      integrations: availableIntegrations,
    });

  } catch (error) {
    console.error('Get test integrations error:', error);
    return NextResponse.json(
      { error: 'Failed to get integrations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/workspaces/[id]/test-integration
 * 
 * Execute a raw API request against an integration for testing.
 * 
 * Request body:
 * {
 *   integration: 'ABC_IGNITE',
 *   method: 'GET' | 'POST' | 'PUT' | 'DELETE',
 *   endpoint: '/employees',
 *   body?: { ... }  // Optional for POST/PUT
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   status: 200,
 *   data: { ... },
 *   duration_ms: 234
 * }
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

  // Verify user has ADMIN or higher access (testing requires elevated permissions)
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  if (access.role !== WorkspaceRole.ADMIN && access.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: 'Insufficient permissions. Testing requires admin access.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { integration, method, endpoint, body: requestBody } = body;

    // Validate required fields
    if (!integration || !method || !endpoint) {
      return NextResponse.json(
        { error: 'Missing required fields: integration, method, endpoint' },
        { status: 400 }
      );
    }

    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!validMethods.includes(method.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    // Handle ABC Ignite integration
    if (integration === 'ABC_IGNITE') {
      // Verify integration is configured for this workspace
      const intConfig = await prisma.workspaceIntegration.findFirst({
        where: {
          workspaceId,
          integration: IntegrationType.ABC_IGNITE,
        },
      });

      if (!intConfig) {
        return NextResponse.json(
          { error: 'ABC Ignite integration not configured for this workspace' },
          { status: 400 }
        );
      }

      // Load the adapter
      const adapter = await AbcIgniteAdapter.forClient(workspaceId);
      if (!adapter) {
        return NextResponse.json(
          { error: 'ABC Ignite is not properly configured. Check App ID, App Key, and Club Number.' },
          { status: 400 }
        );
      }

      // Execute the raw request
      const result = await adapter.rawRequest(
        method.toUpperCase(),
        endpoint,
        requestBody
      );

      return NextResponse.json({
        success: !result.error,
        status: result.status,
        data: result.data,
        duration_ms: result.duration_ms,
        error: result.error,
      });
    }

    // Add other integration types here as needed

    return NextResponse.json(
      { error: `Unsupported integration type: ${integration}` },
      { status: 400 }
    );

  } catch (error) {
    console.error('Test integration error:', error);
    return NextResponse.json(
      { error: 'Failed to execute test request' },
      { status: 500 }
    );
  }
}
