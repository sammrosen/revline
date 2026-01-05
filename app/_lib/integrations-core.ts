/**
 * Core Integration Utilities
 * 
 * Low-level functions for working with integrations.
 * For new code, prefer using the adapter classes in ./integrations/
 * 
 * @deprecated Use MailerLiteAdapter, StripeAdapter, etc. instead
 */

import { prisma } from './db';
import { decryptSecret } from './crypto';
import { IntegrationType, HealthStatus } from '@prisma/client';
import { IntegrationMeta, IntegrationSecret } from './types';

/**
 * Get a client's decrypted primary secret for a specific integration
 * Fetches from DB and decrypts at runtime - never caches secrets
 * 
 * @deprecated Use adapter.forClient() instead
 */
export async function getClientSecret(
  clientId: string,
  integration: IntegrationType
): Promise<string | null> {
  const row = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration,
      },
    },
    select: {
      secrets: true,
    },
  });

  if (!row || !row.secrets) {
    return null;
  }

  const secrets = row.secrets as unknown as IntegrationSecret[];
  if (secrets.length === 0) {
    return null;
  }

  // Return the first (primary) secret
  const primary = secrets[0];
  return decryptSecret(primary.encryptedValue, primary.keyVersion);
}

/**
 * Get a client's integration config (meta) and optionally the decrypted primary secret
 * 
 * @deprecated Use adapter.forClient() instead
 */
export async function getClientIntegration(
  clientId: string,
  integration: IntegrationType
): Promise<{
  secret: string;
  meta: IntegrationMeta | null;
} | null> {
  const row = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration,
      },
    },
    select: {
      secrets: true,
      meta: true,
    },
  });

  if (!row || !row.secrets) {
    return null;
  }

  const secrets = row.secrets as unknown as IntegrationSecret[];
  if (secrets.length === 0) {
    return null;
  }

  // Return the first (primary) secret
  const primary = secrets[0];
  return {
    secret: decryptSecret(primary.encryptedValue, primary.keyVersion),
    meta: row.meta as IntegrationMeta | null,
  };
}

/**
 * Update the lastSeenAt timestamp for an integration (call after successful API call)
 * 
 * @deprecated Use adapter.touch() instead (called automatically on success)
 */
export async function touchIntegration(
  clientId: string,
  integration: IntegrationType
): Promise<void> {
  await prisma.clientIntegration.update({
    where: {
      clientId_integration: {
        clientId,
        integration,
      },
    },
    data: {
      lastSeenAt: new Date(),
      healthStatus: HealthStatus.GREEN,
    },
  });
}

/**
 * Mark an integration as unhealthy
 * 
 * @deprecated Use adapter.markUnhealthy() instead
 */
export async function markIntegrationUnhealthy(
  clientId: string,
  integration: IntegrationType,
  status: HealthStatus
): Promise<void> {
  await prisma.clientIntegration.update({
    where: {
      clientId_integration: {
        clientId,
        integration,
      },
    },
    data: {
      healthStatus: status,
    },
  });
}
