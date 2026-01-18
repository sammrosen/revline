/**
 * Get available form IDs from the registry
 * 
 * GET /api/v1/forms
 */

import { NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { FORM_REGISTRY } from '@/app/_lib/forms/registry';

export async function GET() {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    forms: FORM_REGISTRY,
  });
}
