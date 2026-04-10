/**
 * RevLine Pages Adapter
 * 
 * Handles pages configuration for a specific workspace.
 * Pages are a built-in platform feature (not an external integration).
 * Config is stored directly on the workspace.pagesConfig column.
 * 
 * STANDARDS:
 * - Returns structured IntegrationResult for all operations
 * - Used to check form enablement for workflow triggers
 * - Each enabled form becomes a workflow trigger (formId = trigger operation)
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { RevlineMeta, IntegrationResult, LandingFormField } from '@/app/_lib/types';
import { prisma } from '@/app/_lib/db';

/**
 * Form configuration from pages meta
 * Note: formId IS the workflow trigger operation
 */
export interface FormConfig {
  formId: string;
  enabled: boolean;
}

export class RevlineAdapter extends BaseIntegrationAdapter<RevlineMeta> {
  readonly type = IntegrationType.REVLINE;

  /**
   * Load pages adapter for a workspace.
   * Reads from workspace.pagesConfig instead of the integration table.
   */
  static async forClient(workspaceId: string): Promise<RevlineAdapter | null> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { pagesConfig: true },
      });

      if (!workspace?.pagesConfig) {
        return null;
      }

      const meta = workspace.pagesConfig as unknown as RevlineMeta;
      return new RevlineAdapter(workspaceId, [], meta);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // FORM CONFIGURATION
  // ===========================================================================

  getEnabledForms(): string[] {
    if (!this.meta?.forms) {
      return [];
    }

    return Object.entries(this.meta.forms)
      .filter(([, config]) => config.enabled)
      .map(([formId]) => formId);
  }

  getFormFields(): LandingFormField[] {
    return this.meta?.copy?.landing?.formFields ?? [];
  }

  isFormEnabled(formId: string): boolean {
    return this.meta?.forms?.[formId]?.enabled ?? false;
  }

  getFormConfig(formId: string): FormConfig | null {
    const formMeta = this.meta?.forms?.[formId];
    if (!formMeta) {
      return null;
    }

    return {
      formId,
      enabled: formMeta.enabled,
    };
  }

  getAllFormConfigs(): FormConfig[] {
    if (!this.meta?.forms) {
      return [];
    }

    return Object.entries(this.meta.forms).map(([formId, config]) => ({
      formId,
      enabled: config.enabled,
    }));
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  getDefaultSource(): string | undefined {
    return this.meta?.settings?.defaultSource;
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  validateForm(formId: string): IntegrationResult<FormConfig> {
    const config = this.getFormConfig(formId);
    
    if (!config) {
      return this.error(`Form '${formId}' not found in pages configuration`);
    }

    if (!config.enabled) {
      return this.error(`Form '${formId}' is disabled`);
    }

    return this.success(config);
  }

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
