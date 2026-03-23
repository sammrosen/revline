/**
 * Base Integration Adapter
 * 
 * Abstract class that all integration adapters must extend.
 * Provides common functionality for workspace binding, health tracking, and configuration.
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
import { IntegrationResult, IntegrationMeta, IntegrationSecret } from '@/app/_lib/types';

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
   * Cached decrypted secrets (decrypted on first access per name)
   */
  private decryptedSecrets: Map<string, string> = new Map();

  /**
   * Create a new adapter instance
   * Use the static forWorkspace() method instead of calling directly
   */
  constructor(
    protected readonly workspaceId: string,
    protected readonly secrets: IntegrationSecret[],
    protected readonly meta: TMeta | null
  ) {}

  // Legacy alias for backwards compatibility
  protected get clientId(): string {
    return this.workspaceId;
  }

  /**
   * Load an adapter for a specific workspace
   * Returns null if the integration is not configured
   * 
   * Note: Subclasses should implement their own static forWorkspace() method
   * that calls loadAdapter() with the appropriate type.
   */
  protected static async loadAdapter<TMeta extends IntegrationMeta>(
    workspaceId: string,
    type: IntegrationType
  ): Promise<{ secrets: IntegrationSecret[]; meta: TMeta | null } | null> {
    const row = await prisma.workspaceIntegration.findUnique({
      where: {
        workspaceId_integration: {
          workspaceId,
          integration: type,
        },
      },
      select: {
        secrets: true,
        meta: true,
      },
    });

    if (!row) {
      return null;
    }

    // Parse secrets from JSON
    const secrets = (row.secrets as IntegrationSecret[] | null) || [];
    const meta = row.meta as TMeta | null;

    return { secrets, meta };
  }

  /**
   * Get a secret by name
   * Decrypts the secret on first access and caches in memory
   * 
   * @param name - The name of the secret (e.g., "API Key", "Webhook Secret")
   * @returns The decrypted secret value, or null if not found
   */
  protected getSecret(name: string): string | null {
    // Check cache first
    if (this.decryptedSecrets.has(name)) {
      return this.decryptedSecrets.get(name)!;
    }

    // Find secret by name
    const secret = this.secrets.find(s => s.name === name);
    if (!secret) {
      return null;
    }

    // Decrypt and cache
    const decrypted = decryptSecret(secret.encryptedValue, secret.keyVersion);
    this.decryptedSecrets.set(name, decrypted);
    return decrypted;
  }

  /**
   * Get the primary (first) secret
   * For integrations that only have one secret
   * 
   * @returns The decrypted first secret value
   * @throws Error if no secrets are configured
   */
  protected getPrimarySecret(): string {
    if (this.secrets.length === 0) {
      throw new Error(`No secrets configured for ${this.type} integration`);
    }

    const first = this.secrets[0];
    
    // Check cache first
    if (this.decryptedSecrets.has(first.name)) {
      return this.decryptedSecrets.get(first.name)!;
    }

    // Decrypt and cache
    const decrypted = decryptSecret(first.encryptedValue, first.keyVersion);
    this.decryptedSecrets.set(first.name, decrypted);
    return decrypted;
  }

  /**
   * Check if a secret with the given name exists
   */
  protected hasSecret(name: string): boolean {
    return this.secrets.some(s => s.name === name);
  }

  /**
   * Get the names of all configured secrets
   */
  protected getSecretNames(): string[] {
    return this.secrets.map(s => s.name);
  }

  /**
   * Update the lastSeenAt timestamp and set health to GREEN
   * Call this after every successful API operation
   */
  protected async touch(): Promise<void> {
    await prisma.workspaceIntegration.update({
      where: {
        workspaceId_integration: {
          workspaceId: this.workspaceId,
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
    await prisma.workspaceIntegration.update({
      where: {
        workspaceId_integration: {
          workspaceId: this.workspaceId,
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
  protected error<T>(error: string, retryable = false, retryAfterMs?: number): IntegrationResult<T> {
    return { success: false, error, retryable, retryAfterMs };
  }

  /**
   * Get the workspace ID (for event logging)
   */
  getWorkspaceId(): string {
    return this.workspaceId;
  }

  // Legacy alias
  getClientId(): string {
    return this.workspaceId;
  }
}

/**
 * Type helper for adapter constructors
 */
export type AdapterConstructor<
  TMeta extends IntegrationMeta,
  T extends BaseIntegrationAdapter<TMeta>
> = new (workspaceId: string, secrets: IntegrationSecret[], meta: TMeta | null) => T;
