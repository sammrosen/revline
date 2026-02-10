/**
 * MailerLite Integration Adapter
 * 
 * Handles MailerLite API operations for a specific client.
 * Groups are configured in the integration meta and referenced by key in workflows.
 * 
 * Secret names:
 * - "API Key" - Required for all operations
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes API key outside this module
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { MailerLiteMeta, IntegrationResult } from '@/app/_lib/types';
import {
  addSubscriberToGroup,
  getMailerLiteGroups,
  getAllAutomations,
  getAutomationsByGroup,
  getMailerLiteFields,
  createMailerLiteField,
  MailerLiteGroup,
  Automation,
} from '@/app/_lib/mailerlite';

/** Default secret name for MailerLite API key */
export const MAILERLITE_API_KEY_SECRET = 'API Key';

/**
 * Result of adding a subscriber
 */
export interface AddSubscriberResult {
  subscriberId?: string;
  message: string;
  alreadyExists?: boolean;
}

/**
 * MailerLite adapter for client-scoped operations
 * 
 * @example
 * const adapter = await MailerLiteAdapter.forClient(clientId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * // Add to a specific group
 * const result = await adapter.addToGroup('user@example.com', '123456', 'John');
 */
export class MailerLiteAdapter extends BaseIntegrationAdapter<MailerLiteMeta> {
  readonly type = IntegrationType.MAILERLITE;

  /**
   * Load MailerLite adapter for a client
   */
  static async forClient(clientId: string): Promise<MailerLiteAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<MailerLiteMeta>(
      clientId,
      IntegrationType.MAILERLITE
    );
    
    if (!data) {
      return null;
    }

    // Ensure at least one secret exists
    if (data.secrets.length === 0) {
      console.warn('MailerLite integration has no secrets configured:', { clientId });
      return null;
    }
    
    return new MailerLiteAdapter(clientId, data.secrets, data.meta);
  }

  /**
   * Get the API key for MailerLite operations
   */
  private getApiKey(): string {
    // Try to get by name first, fall back to primary
    const apiKey = this.getSecret(MAILERLITE_API_KEY_SECRET) || this.getPrimarySecret();
    return apiKey;
  }

  /**
   * Get the configured groups from meta
   */
  getConfiguredGroups(): Record<string, { id: string; name: string }> {
    return this.meta?.groups ?? {};
  }

  /**
   * Get a specific group by key
   */
  getGroup(key: string): { id: string; name: string } | null {
    return this.meta?.groups?.[key] ?? null;
  }

  /**
   * Add subscriber to a specific group by ID
   * Optionally pass custom subscriber fields (e.g., from lead properties)
   */
  async addToGroup(
    email: string,
    groupId: string,
    name?: string,
    fields?: Record<string, unknown>
  ): Promise<IntegrationResult<AddSubscriberResult>> {
    try {
      const result = await addSubscriberToGroup({
        email,
        name,
        groupId,
        apiKey: this.getApiKey(),
        fields,
      });

      if (result.success) {
        await this.touch();
        return this.success({
          subscriberId: result.subscriberId,
          message: result.message || 'Subscriber added',
          alreadyExists: result.message?.includes('already') || false,
        });
      }

      // Check if retryable (rate limit)
      const retryable = result.error?.includes('Rate limit') || false;
      
      return this.error(result.error || 'Failed to add subscriber', retryable);
    } catch (error) {
      console.error('MailerLite addToGroup error:', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error('Network error or API unavailable', true);
    }
  }

  /**
   * Get all groups in the MailerLite account
   * Used for insights/admin views and config validation
   */
  async getGroups(): Promise<IntegrationResult<MailerLiteGroup[]>> {
    try {
      const groups = await getMailerLiteGroups(this.getApiKey());
      await this.touch();
      return this.success(groups);
    } catch (error) {
      console.error('MailerLite getGroups error:', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error('Failed to fetch groups');
    }
  }

  /**
   * Get all automations in the MailerLite account
   * Used for insights/admin views
   */
  async getAutomations(): Promise<IntegrationResult<Automation[]>> {
    try {
      const automations = await getAllAutomations(this.getApiKey());
      await this.touch();
      return this.success(automations);
    } catch (error) {
      console.error('MailerLite getAutomations error:', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error('Failed to fetch automations');
    }
  }

  /**
   * Get automations triggered by a specific group
   * Used for insights/admin views
   */
  async getAutomationsByGroup(
    groupId: string
  ): Promise<IntegrationResult<Automation[]>> {
    try {
      const automations = await getAutomationsByGroup(this.getApiKey(), groupId);
      await this.touch();
      return this.success(automations);
    } catch (error) {
      console.error('MailerLite getAutomationsByGroup error:', {
        clientId: this.clientId,
        groupId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.error('Failed to fetch automations for group');
    }
  }

  /**
   * Ensure subscriber fields exist in MailerLite, creating any that are missing.
   * Fields default to type "text" which covers most use cases (barcodes, names, phones, etc.).
   */
  async ensureFieldsExist(fieldNames: string[]): Promise<void> {
    if (fieldNames.length === 0) return;

    try {
      const existingFields = await getMailerLiteFields(this.getApiKey());
      const existingKeys = new Set(existingFields.map(f => f.key));

      for (const name of fieldNames) {
        // MailerLite auto-generates the key from the name (e.g., "Barcode" → "barcode")
        // Check both the raw name and a snake_case version
        if (!existingKeys.has(name) && !existingKeys.has(name.toLowerCase())) {
          await createMailerLiteField(this.getApiKey(), name, 'text');
        }
      }
    } catch (error) {
      // Non-fatal: log and continue — subscriber upsert may still work if fields exist
      console.error('MailerLite ensureFieldsExist error:', {
        clientId: this.clientId,
        fieldNames,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Check if the integration has groups configured
   */
  hasGroups(): boolean {
    const groups = this.meta?.groups;
    return !!groups && Object.keys(groups).length > 0;
  }

  /**
   * Validate the meta configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.meta?.groups || Object.keys(this.meta.groups).length === 0) {
      errors.push('No groups configured');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
