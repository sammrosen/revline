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
import { IntegrationSecret, MailerLiteMeta } from '@/app/_lib/types';

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
  configured_groups: Record<string, ConfiguredGroup>;
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
  const client = await prisma.workspace.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Get MailerLite integration
  const mlIntegration = await prisma.workspaceIntegration.findFirst({
    where: {
      workspaceId: clientId,
      integration: IntegrationType.MAILERLITE,
    },
    select: {
      secrets: true,
      meta: true,
    },
  });

  if (!mlIntegration) {
    return NextResponse.json(
      { error: 'MailerLite integration not configured for this client' },
      { status: 404 }
    );
  }

  // Parse secrets
  const secrets = (mlIntegration.secrets as IntegrationSecret[] | null) || [];
  if (secrets.length === 0) {
    return NextResponse.json(
      { error: 'MailerLite API key not configured' },
      { status: 404 }
    );
  }

  try {
    // Decrypt API key (use first secret or one named "API Key")
    const apiKeySecret = secrets.find(s => s.name === 'API Key') || secrets[0];
    const apiKey = decryptSecret(apiKeySecret.encryptedValue, apiKeySecret.keyVersion);

    // Fetch data from MailerLite API
    const [groups, automations] = await Promise.all([
      getMailerLiteGroups(apiKey),
      getAllAutomations(apiKey),
    ]);

    // Parse meta to get configured groups (new format)
    const meta = mlIntegration.meta as MailerLiteMeta | null;
    const configuredGroupsMeta = meta?.groups || {};

    // Match configured groups with actual groups from API
    const configuredGroups: Record<string, ConfiguredGroup> = {};

    for (const [key, groupConfig] of Object.entries(configuredGroupsMeta)) {
      const group = groups.find((g) => g.id === groupConfig.id);
      if (group) {
        configuredGroups[key] = {
          ...group,
          type: 'lead', // Default type, can be inferred from routing if needed
          config_key: `groups.${key}`,
        };
      }
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
