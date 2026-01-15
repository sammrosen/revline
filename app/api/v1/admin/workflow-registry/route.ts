/**
 * Workflow Registry API
 *
 * GET /api/v1/admin/workflow-registry - Get available adapters, triggers, and actions
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import {
  ADAPTER_REGISTRY,
  getTriggersForUI,
  getActionsForUI,
} from '@/app/_lib/workflow';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    return ApiResponse.unauthorized();
  }

  try {
    // Get all adapters with their capabilities
    const adapters = Object.values(ADAPTER_REGISTRY).map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      requiresIntegration: adapter.requiresIntegration,
      hasTriggers: Object.keys(adapter.triggers).length > 0,
      hasActions: Object.keys(adapter.actions).length > 0,
    }));

    // Get triggers grouped by adapter (for UI dropdowns)
    const triggers = getTriggersForUI();

    // Get actions grouped by adapter (for UI dropdowns)
    const actions = getActionsForUI();

    return ApiResponse.success({
      adapters,
      triggers,
      actions,
    });
  } catch (error) {
    console.error('Error fetching workflow registry:', error);
    return ApiResponse.internalError();
  }
}

