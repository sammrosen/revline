/**
 * Check if a formId is in use by another client
 * 
 * GET /api/v1/admin/check-form-id?formId=xxx&excludeClientId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { IntegrationType } from '@prisma/client';
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
    // Find all RevLine integrations
    const revlineIntegrations = await prisma.clientIntegration.findMany({
      where: {
        integration: IntegrationType.REVLINE,
        ...(excludeClientId && { clientId: { not: excludeClientId } }),
      },
      include: {
        client: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Find one that has this formId enabled
    const matchingIntegration = revlineIntegrations.find(integration => {
      const meta = integration.meta as RevlineMeta | null;
      if (!meta?.forms) return false;
      
      const formConfig = meta.forms[formId];
      return formConfig?.enabled === true;
    });

    if (matchingIntegration) {
      return NextResponse.json({
        inUse: true,
        client: {
          id: matchingIntegration.client.id,
          name: matchingIntegration.client.name,
          slug: matchingIntegration.client.slug,
        },
      });
    }

    return NextResponse.json({ inUse: false });
  } catch (error) {
    console.error('Check form ID error:', error);
    return NextResponse.json({ error: 'Failed to check form ID' }, { status: 500 });
  }
}
