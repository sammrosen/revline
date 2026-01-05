import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { decryptSecret } from '@/app/_lib/crypto';
import {
  getMailerLiteGroups,
  getAllAutomations,
  type MailerLiteGroup,
  type Automation,
} from '@/app/_lib/mailerlite';
import { IntegrationType } from '@prisma/client';

interface ConfiguredGroup {
  id: string;
  name: string;
  active_count: number;
  type: 'lead' | 'customer' | 'program';
  config_key: string;
}

interface InsightsResponse {
  groups: MailerLiteGroup[];
  automations: Automation[];
  configured_groups: {
    lead?: ConfiguredGroup;
    customer?: ConfiguredGroup;
    programs?: ConfiguredGroup[];
  };
  summary: {
    total_groups: number;
    total_automations: number;
    active_automations: number;
    total_subscribers: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  // Get client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Get MailerLite integration
  const mlIntegration = await prisma.clientIntegration.findFirst({
    where: {
      clientId,
      integration: IntegrationType.MAILERLITE,
    },
  });

  if (!mlIntegration) {
    return NextResponse.json(
      { error: 'MailerLite integration not configured for this client' },
      { status: 404 }
    );
  }

  try {
    // Decrypt API key
    const apiKey = await decryptSecret(mlIntegration.encryptedSecret);

    // Fetch data from MailerLite API
    const [groups, automations] = await Promise.all([
      getMailerLiteGroups(apiKey),
      getAllAutomations(apiKey),
    ]);

    // Parse meta to get configured group IDs
    const meta = mlIntegration.meta as { groupIds?: { lead?: string; customer?: string; programs?: Record<string, string> } } | null;
    const groupIds = meta?.groupIds || {};

    // Match configured groups with actual groups from API
    const configuredGroups: InsightsResponse['configured_groups'] = {};

    if (groupIds.lead) {
      const group = groups.find((g) => g.id === groupIds.lead);
      if (group) {
        configuredGroups.lead = {
          ...group,
          type: 'lead',
          config_key: 'groupIds.lead',
        };
      }
    }

    if (groupIds.customer) {
      const group = groups.find((g) => g.id === groupIds.customer);
      if (group) {
        configuredGroups.customer = {
          ...group,
          type: 'customer',
          config_key: 'groupIds.customer',
        };
      }
    }

    // Check for program-specific groups (if meta has programs object)
    if (groupIds.programs && typeof groupIds.programs === 'object') {
      configuredGroups.programs = [];
      Object.entries(groupIds.programs).forEach(([programName, programGroupId]) => {
        const group = groups.find((g) => g.id === programGroupId);
        if (group) {
          configuredGroups.programs!.push({
            ...group,
            type: 'program',
            config_key: `groupIds.programs.${programName}`,
          });
        }
      });
    }

    // Calculate summary stats
    const totalSubscribers = groups.reduce(
      (sum, group) => sum + (group.active_count || 0),
      0
    );

    const summary = {
      total_groups: groups.length,
      total_automations: automations.length,
      active_automations: automations.filter((a) => a.enabled).length,
      total_subscribers: totalSubscribers,
    };

    const response: InsightsResponse = {
      groups,
      automations,
      configured_groups: configuredGroups,
      summary,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch MailerLite insights:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch insights from MailerLite',
        details: message,
      },
      { status: 500 }
    );
  }
}

