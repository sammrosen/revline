/**
 * Booking Employees
 * 
 * GET /api/v1/booking/employees
 * 
 * Returns configured employees/staff for a workspace's booking provider.
 * Used by booking forms to populate trainer/staff selection dropdown.
 */

import { NextRequest } from 'next/server';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getActiveWorkspace } from '@/app/_lib/client-gate';
import { getBookingProvider } from '@/app/_lib/booking';
import { 
  rateLimitByIP, 
  getClientIP, 
  RATE_LIMITS,
} from '@/app/_lib/middleware';

export async function GET(request: NextRequest) {
  // Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Support both workspaceSlug and clientSlug for backwards compatibility
    const workspaceSlug = searchParams.get('workspaceSlug') || searchParams.get('clientSlug');

    // Validate required params
    if (!workspaceSlug) {
      return ApiResponse.error(
        'workspaceSlug is required',
        400,
        ErrorCodes.MISSING_REQUIRED
      );
    }

    // Get active workspace
    const workspace = await getActiveWorkspace(workspaceSlug);
    if (!workspace) {
      return ApiResponse.error(
        'Workspace not found or inactive',
        404,
        ErrorCodes.CLIENT_NOT_FOUND
      );
    }

    // Get booking provider
    const provider = await getBookingProvider(workspace.id);
    if (!provider) {
      return ApiResponse.error(
        'No booking provider configured',
        400,
        ErrorCodes.INTEGRATION_NOT_CONFIGURED
      );
    }

    // Check if provider supports employee listing
    if (!('getConfiguredEmployees' in provider)) {
      // Provider doesn't support employee selection
      return ApiResponse.success({
        employees: [],
        defaultKey: null,
        supportsSelection: false,
      });
    }

    // Get configured employees from provider
    const providerWithEmployees = provider as typeof provider & {
      getConfiguredEmployees(): { key: string; name: string; title?: string }[];
      getDefaultEmployeeKey(): string | undefined;
    };

    const employees = providerWithEmployees.getConfiguredEmployees();
    const defaultKey = providerWithEmployees.getDefaultEmployeeKey() || null;

    return ApiResponse.success({
      employees,
      defaultKey,
      supportsSelection: employees.length > 0,
    });

  } catch (error) {
    console.error('Booking employees error:', error);
    return ApiResponse.internalError();
  }
}
