/**
 * Check if a formId is in use by another workspace
 * 
 * GET /api/v1/check-form-id?formId=xxx&excludeClientId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { Prisma } from '@prisma/client';
import { RevlineMeta } from '@/app/_lib/types';

export async function GET(request: NextRequest) {
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formId = request.nextUrl.searchParams.get('formId');
  const excludeClientId = request.nextUrl.searchParams.get('excludeClientId');

  if (!formId) {
    return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        pagesConfig: { not: Prisma.JsonNull },
        ...(excludeClientId && { id: { not: excludeClientId } }),
      },
      select: { id: true, name: true, slug: true, pagesConfig: true },
    });

    const match = workspaces.find(ws => {
      const meta = ws.pagesConfig as unknown as RevlineMeta | null;
      if (!meta?.forms) return false;
      return meta.forms[formId]?.enabled === true;
    });

    if (match) {
      return NextResponse.json({
        inUse: true,
        workspace: {
          id: match.id,
          name: match.name,
          slug: match.slug,
        },
      });
    }

    return NextResponse.json({ inUse: false });
  } catch (error) {
    console.error('Check form ID error:', error);
    return NextResponse.json({ error: 'Failed to check form ID' }, { status: 500 });
  }
}
