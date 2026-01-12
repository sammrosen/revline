/**
 * RevLine Integration Adapter
 * 
 * Handles RevLine internal configuration for a specific client.
 * Unlike other adapters, RevLine has no external API - it manages
 * internal configuration like forms and settings.
 * 
 * Secret names: None (internal system)
 * 
 * STANDARDS:
 * - Returns structured IntegrationResult for all operations
 * - Used to check form enablement and get trigger operations
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { RevlineMeta, IntegrationResult } from '@/app/_lib/types';

/** Default trigger operation for forms */
const DEFAULT_TRIGGER_OPERATION = 'form_submitted';

/**
 * Form configuration from RevLine meta
 */
export interface FormConfig {
  formId: string;
  enabled: boolean;
  triggerOperation: string;
}

/**
 * RevLine adapter for client-scoped configuration
 * 
 * @example
 * const adapter = await RevlineAdapter.forClient(clientId);
 * if (!adapter) {
 *   // RevLine not configured for this client
 * }
 * 
 * if (adapter.isFormEnabled('prospect-intake')) {
 *   const trigger = adapter.getFormTrigger('prospect-intake');
 *   // Use trigger for workflow
 * }
 */
export class RevlineAdapter extends BaseIntegrationAdapter<RevlineMeta> {
  readonly type = IntegrationType.REVLINE;

  /**
   * Load RevLine adapter for a client
   */
  static async forClient(clientId: string): Promise<RevlineAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<RevlineMeta>(
      clientId,
      IntegrationType.REVLINE
    );
    
    if (!data) {
      return null;
    }
    
    return new RevlineAdapter(clientId, data.secrets, data.meta);
  }

  // ===========================================================================
  // FORM CONFIGURATION
  // ===========================================================================

  /**
   * Get all enabled form IDs
   */
  getEnabledForms(): string[] {
    if (!this.meta?.forms) {
      return [];
    }

    return Object.entries(this.meta.forms)
      .filter(([, config]) => config.enabled)
      .map(([formId]) => formId);
  }

  /**
   * Check if a specific form is enabled
   */
  isFormEnabled(formId: string): boolean {
    return this.meta?.forms?.[formId]?.enabled ?? false;
  }

  /**
   * Get the trigger operation for a form
   * Returns 'form_submitted' as default if not specified
   */
  getFormTrigger(formId: string): string {
    return this.meta?.forms?.[formId]?.triggerOperation ?? DEFAULT_TRIGGER_OPERATION;
  }

  /**
   * Get full form configuration
   */
  getFormConfig(formId: string): FormConfig | null {
    const formMeta = this.meta?.forms?.[formId];
    if (!formMeta) {
      return null;
    }

    return {
      formId,
      enabled: formMeta.enabled,
      triggerOperation: formMeta.triggerOperation ?? DEFAULT_TRIGGER_OPERATION,
    };
  }

  /**
   * Get all form configurations
   */
  getAllFormConfigs(): FormConfig[] {
    if (!this.meta?.forms) {
      return [];
    }

    return Object.entries(this.meta.forms).map(([formId, config]) => ({
      formId,
      enabled: config.enabled,
      triggerOperation: config.triggerOperation ?? DEFAULT_TRIGGER_OPERATION,
    }));
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  /**
   * Get the default source identifier for this client
   */
  getDefaultSource(): string | undefined {
    return this.meta?.settings?.defaultSource;
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate a form ID is enabled and return its config
   */
  validateForm(formId: string): IntegrationResult<FormConfig> {
    const config = this.getFormConfig(formId);
    
    if (!config) {
      return this.error(`Form '${formId}' not found in RevLine configuration`);
    }

    if (!config.enabled) {
      return this.error(`Form '${formId}' is disabled`);
    }

    return this.success(config);
  }

  /**
   * Check if RevLine is configured with at least one form
   */
  isConfigured(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.meta?.forms || Object.keys(this.meta.forms).length === 0) {
      missing.push('At least one form');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
