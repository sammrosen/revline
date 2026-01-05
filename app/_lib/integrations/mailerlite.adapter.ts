/**
 * MailerLite Integration Adapter
 * 
 * Handles all MailerLite API operations for a specific client.
 * Wraps the low-level mailerlite.ts functions with client context.
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
  MailerLiteGroup,
  Automation,
} from '@/app/_lib/mailerlite';

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
 * const result = await adapter.addToLeadGroup('user@example.com', 'John');
 * if (!result.success) {
 *   await emitEvent({ eventType: 'mailerlite_subscribe_failed', ... });
 * }
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
    
    return new MailerLiteAdapter(clientId, data.secret, data.meta);
  }

  /**
   * Get the lead group ID from meta
   */
  getLeadGroupId(): string | undefined {
    return this.meta?.groupIds?.lead;
  }

  /**
   * Get the customer group ID from meta
   * Supports program-specific groups via customer_{program}
   */
  getCustomerGroupId(program?: string): string | undefined {
    if (program && this.meta?.groupIds?.[`customer_${program}`]) {
      return this.meta.groupIds[`customer_${program}`];
    }
    return this.meta?.groupIds?.customer;
  }

  /**
   * Add subscriber to lead group
   * Use this for email captures from landing pages
   */
  async addToLeadGroup(
    email: string,
    name?: string
  ): Promise<IntegrationResult<AddSubscriberResult>> {
    const groupId = this.getLeadGroupId();
    if (!groupId) {
      return this.error('Lead group ID not configured');
    }

    return this.addToGroup(email, groupId, name);
  }

  /**
   * Add subscriber to customer group
   * Use this after successful payments
   * 
   * @param program - Optional program name for multi-product routing
   */
  async addToCustomerGroup(
    email: string,
    name?: string,
    program?: string
  ): Promise<IntegrationResult<AddSubscriberResult>> {
    const groupId = this.getCustomerGroupId(program);
    if (!groupId) {
      const context = program ? ` for program '${program}'` : '';
      return this.error(`Customer group ID not configured${context}`);
    }

    return this.addToGroup(email, groupId, name);
  }

  /**
   * Add subscriber to a specific group
   * Low-level method - prefer addToLeadGroup/addToCustomerGroup
   */
  async addToGroup(
    email: string,
    groupId: string,
    name?: string
  ): Promise<IntegrationResult<AddSubscriberResult>> {
    try {
      const result = await addSubscriberToGroup({
        email,
        name,
        groupId,
        apiKey: this.secret,
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
   * Used for insights/admin views
   */
  async getGroups(): Promise<IntegrationResult<MailerLiteGroup[]>> {
    try {
      const groups = await getMailerLiteGroups(this.secret);
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
      const automations = await getAllAutomations(this.secret);
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
      const automations = await getAutomationsByGroup(this.secret, groupId);
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
   * Check if the integration is properly configured
   */
  isConfigured(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.getLeadGroupId()) {
      missing.push('lead group ID');
    }
    if (!this.getCustomerGroupId()) {
      missing.push('customer group ID');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

