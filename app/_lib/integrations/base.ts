/**
 * Base Integration Adapter
 * 
 * Abstract class that all integration adapters must extend.
 * Provides common functionality for client binding, health tracking, and configuration.
 * 
 * STANDARDS:
 * - All integrations MUST extend this class
 * - Never cache secrets - fetch fresh on each operation
 * - Always call touch() after successful operations
 * - Always call markUnhealthy() on failures
 */

import { prisma } from '@/app/_lib/db';
import { decryptSecret } from '@/app/_lib/crypto';
import { IntegrationType, HealthStatus } from '@prisma/client';
import { IntegrationResult, IntegrationMeta } from '@/app/_lib/types';

/**
 * Base class for all integration adapters
 * 
 * @template TMeta - The meta configuration type for this integration
 */
export abstract class BaseIntegrationAdapter<TMeta extends IntegrationMeta = IntegrationMeta> {
  /**
   * The integration type - must be set by subclass
   */
  abstract readonly type: IntegrationType;

  /**
   * Create a new adapter instance
   * Use the static forClient() method instead of calling directly
   */
  constructor(
    protected readonly clientId: string,
    protected readonly secret: string,
    protected readonly meta: TMeta | null
  ) {}

  /**
   * Load an adapter for a specific client
   * Returns null if the integration is not configured
   * 
   * Note: Subclasses should implement their own static forClient() method
   * that calls loadAdapter() with the appropriate type.
   */
  protected static async loadAdapter<TMeta extends IntegrationMeta>(
    clientId: string,
    type: IntegrationType
  ): Promise<{ secret: string; meta: TMeta | null } | null> {
    const row = await prisma.clientIntegration.findUnique({
      where: {
        clientId_integration: {
          clientId,
          integration: type,
        },
      },
      select: {
        encryptedSecret: true,
        meta: true,
      },
    });

    if (!row) {
      return null;
    }

    const secret = decryptSecret(row.encryptedSecret);
    const meta = row.meta as TMeta | null;

    return { secret, meta };
  }

  /**
   * Update the lastSeenAt timestamp and set health to GREEN
   * Call this after every successful API operation
   */
  protected async touch(): Promise<void> {
    await prisma.clientIntegration.update({
      where: {
        clientId_integration: {
          clientId: this.clientId,
          integration: this.type,
        },
      },
      data: {
        lastSeenAt: new Date(),
        healthStatus: HealthStatus.GREEN,
      },
    });
  }

  /**
   * Mark the integration as unhealthy
   * Call this after failures
   */
  protected async markUnhealthy(status: HealthStatus = HealthStatus.RED): Promise<void> {
    await prisma.clientIntegration.update({
      where: {
        clientId_integration: {
          clientId: this.clientId,
          integration: this.type,
        },
      },
      data: {
        healthStatus: status,
      },
    });
  }

  /**
   * Create a success result
   */
  protected success<T>(data: T): IntegrationResult<T> {
    return { success: true, data };
  }

  /**
   * Create an error result
   */
  protected error<T>(error: string, retryable = false): IntegrationResult<T> {
    return { success: false, error, retryable };
  }

  /**
   * Get the client ID (for event logging)
   */
  getClientId(): string {
    return this.clientId;
  }
}

/**
 * Type helper for adapter constructors
 */
export type AdapterConstructor<
  TMeta extends IntegrationMeta,
  T extends BaseIntegrationAdapter<TMeta>
> = new (clientId: string, secret: string, meta: TMeta | null) => T;

