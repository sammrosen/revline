/**
 * RevLine Integration Adapter
 * 
 * Handles RevLine internal configuration for a specific workspace.
 * Unlike other adapters, RevLine has no external API - it manages
 * internal configuration like forms and settings.
 * 
 * Secret names: None (internal system)
 * 
 * STANDARDS:
 * - Returns structured IntegrationResult for all operations
 * - Used to check form enablement for workflow triggers
 * - Each enabled form becomes a workflow trigger (formId = trigger operation)
 * 
 * @deprecated Form-related methods are deprecated.
 * The form system has been replaced by the Capture system:
 * - Forms are now stored in WorkspaceForm table (Capture tab)
 * - Use submitCaptureTrigger() instead of emitFormTrigger()
 * - Triggers are 'capture.triggerName' instead of 'revline.triggerId'
 * 
 * The adapter is kept for backward compatibility with existing workflows
 * that use 'revline' triggers. New code should use the Capture system.
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { RevlineMeta, RevlineFieldMapping, IntegrationResult } from '@/app/_lib/types';

/**
 * Form configuration from RevLine meta
 * Note: formId IS the workflow trigger operation
 */
export interface FormConfig {
  formId: string;
  enabled: boolean;
  /** Field mappings from form fields to custom fields */
  fieldMappings?: RevlineFieldMapping[];
}

/**
 * RevLine adapter for workspace-scoped configuration
 * 
 * @example
 * const adapter = await RevlineAdapter.forClient(workspaceId);
 * if (!adapter) {
 *   // RevLine not configured for this workspace
 * }
 * 
 * // Check if form is enabled (form submission will use formId as trigger)
 * if (adapter.isFormEnabled('prospect-intake')) {
 *   // Workflow triggers on { adapter: 'revline', operation: 'prospect-intake' }
 * }
 */
export class RevlineAdapter extends BaseIntegrationAdapter<RevlineMeta> {
  readonly type = IntegrationType.REVLINE;

  /**
   * Load RevLine adapter for a workspace
   */
  static async forClient(workspaceId: string): Promise<RevlineAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<RevlineMeta>(
      workspaceId,
      IntegrationType.REVLINE
    );
    
    if (!data) {
      return null;
    }
    
    return new RevlineAdapter(workspaceId, data.secrets, data.meta);
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
   * Get full form configuration
   * Note: The formId IS the workflow trigger operation
   */
  getFormConfig(formId: string): FormConfig | null {
    const formMeta = this.meta?.forms?.[formId];
    if (!formMeta) {
      return null;
    }

    return {
      formId,
      enabled: formMeta.enabled,
      fieldMappings: formMeta.fieldMappings,
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
      fieldMappings: config.fieldMappings,
    }));
  }

  /**
   * Get field mappings for a specific form
   * Used to map form submission fields to lead custom data
   */
  getFieldMappings(formId: string): RevlineFieldMapping[] {
    return this.meta?.forms?.[formId]?.fieldMappings ?? [];
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  /**
   * Get the default source identifier for this workspace
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
