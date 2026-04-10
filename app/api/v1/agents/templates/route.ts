/**
 * Public Agent Templates API
 *
 * GET /api/v1/agents/templates -- List all available prompt templates (no auth)
 */

import { NextResponse } from 'next/server';
import { ApiResponse } from '@/app/_lib/utils/api-response';
import { listTemplates } from '@/app/_lib/agent/prompt-templates';

export async function GET(): Promise<NextResponse> {
  return ApiResponse.success(listTemplates());
}
