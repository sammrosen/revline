/**
 * Workflow Registry API
 *
 * GET /api/admin/workflow-registry - Get available adapters, triggers, and actions
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/app/_lib/auth';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import {
  ADAPTER_REGISTRY,
  getTriggersForUI,
  getActionsForUI,
} from '@/app/_lib/workflow';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
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

