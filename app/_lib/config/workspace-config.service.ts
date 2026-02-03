/**
 * Workspace Configuration Service
 * 
 * Resolves workspace configuration by merging global defaults with
 * workspace-specific overrides from RevLine integration.
 * 
 * STANDARDS:
 * - Always returns fully resolved config (no undefined values)
 * - Fail-safe: returns defaults if workspace or config not found
 * - Validates config values (colors, URLs)
 * - Never throws - returns defaults on error
 */

import { prisma } from '@/app/_lib/db';
import { IntegrationType } from '@prisma/client';
import { 
  BrandingConfig, 
  BookingCopyConfig, 
  WorkspaceFeatures,
  RevlineMeta,
} from '@/app/_lib/types';
import {
  DEFAULT_BRANDING,
  DEFAULT_BOOKING_COPY,
  DEFAULT_FEATURES,
  isValidHexColor,
  isValidLogoUrl,
  sanitizeCopyText,
} from './defaults';

// =============================================================================
// RESOLVED CONFIG TYPES
// =============================================================================

/**
 * Fully resolved branding config (no optional fields)
 */
export interface ResolvedBranding {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  logo: string;
  fontFamily: 'inter' | 'poppins' | 'roboto' | 'system';
}

/**
 * Fully resolved booking copy (no optional fields)
 */
export interface ResolvedBookingCopy {
  headline: string;
  subhead: string;
  submitButton: string;
  successTitle: string;
  successMessage: string;
  footerText: string;
}

/**
 * Fully resolved features (no optional fields)
 */
export interface ResolvedFeatures {
  showPoweredBy: boolean;
}

/**
 * Complete resolved config for a workspace
 */
export interface ResolvedWorkspaceConfig {
  workspaceId: string;
  branding: ResolvedBranding;
  features: ResolvedFeatures;
}

/**
 * Resolved config for booking template specifically
 */
export interface ResolvedBookingConfig extends ResolvedWorkspaceConfig {
  copy: ResolvedBookingCopy;
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Workspace Configuration Service
 * 
 * Resolves configuration by merging defaults with workspace overrides.
 * 
 * @example
 * const config = await WorkspaceConfigService.resolveForBooking(workspaceId);
 * // config.branding.primaryColor is always defined
 * // config.copy.headline is always defined
 */
export class WorkspaceConfigService {
  /**
   * Resolve base workspace config (branding + features)
   * Does not include template-specific copy
   */
  static async resolve(workspaceId: string): Promise<ResolvedWorkspaceConfig> {
    const meta = await this.loadRevlineMeta(workspaceId);
    
    return {
      workspaceId,
      branding: this.resolveBranding(meta?.branding),
      features: this.resolveFeatures(meta?.features),
    };
  }

  /**
   * Resolve config for booking template
   * Includes branding, features, and booking-specific copy
   */
  static async resolveForBooking(workspaceId: string): Promise<ResolvedBookingConfig> {
    const meta = await this.loadRevlineMeta(workspaceId);
    
    return {
      workspaceId,
      branding: this.resolveBranding(meta?.branding),
      features: this.resolveFeatures(meta?.features),
      copy: this.resolveBookingCopy(meta?.copy?.booking),
    };
  }

  /**
   * Get raw RevlineMeta for a workspace
   * Returns null if not found or on error
   */
  private static async loadRevlineMeta(workspaceId: string): Promise<RevlineMeta | null> {
    try {
      const integration = await prisma.workspaceIntegration.findUnique({
        where: {
          workspaceId_integration: {
            workspaceId,
            integration: IntegrationType.REVLINE,
          },
        },
        select: {
          meta: true,
        },
      });

      if (!integration?.meta) {
        return null;
      }

      return integration.meta as RevlineMeta;
    } catch (error) {
      console.error('Failed to load RevLine config:', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Resolve branding config by merging with defaults
   * Validates values and falls back to defaults for invalid values
   */
  private static resolveBranding(overrides?: BrandingConfig): ResolvedBranding {
    const result = { ...DEFAULT_BRANDING };

    if (!overrides) {
      return result;
    }

    // Primary color
    if (overrides.primaryColor && isValidHexColor(overrides.primaryColor)) {
      result.primaryColor = overrides.primaryColor;
    }

    // Secondary color
    if (overrides.secondaryColor && isValidHexColor(overrides.secondaryColor)) {
      result.secondaryColor = overrides.secondaryColor;
    }

    // Background color
    if (overrides.backgroundColor && isValidHexColor(overrides.backgroundColor)) {
      result.backgroundColor = overrides.backgroundColor;
    }

    // Logo URL
    if (overrides.logo !== undefined) {
      if (isValidLogoUrl(overrides.logo)) {
        result.logo = overrides.logo;
      }
    }

    // Font family
    if (overrides.fontFamily) {
      result.fontFamily = overrides.fontFamily;
    }

    return result;
  }

  /**
   * Resolve booking copy by merging with defaults
   * Sanitizes text values to prevent XSS
   */
  private static resolveBookingCopy(overrides?: BookingCopyConfig): ResolvedBookingCopy {
    const result = { ...DEFAULT_BOOKING_COPY };

    if (!overrides) {
      return result;
    }

    // Headline
    if (overrides.headline) {
      result.headline = sanitizeCopyText(overrides.headline, 60);
    }

    // Subhead
    if (overrides.subhead) {
      result.subhead = sanitizeCopyText(overrides.subhead, 120);
    }

    // Submit button
    if (overrides.submitButton) {
      result.submitButton = sanitizeCopyText(overrides.submitButton, 30);
    }

    // Success title
    if (overrides.successTitle) {
      result.successTitle = sanitizeCopyText(overrides.successTitle, 60);
    }

    // Success message
    if (overrides.successMessage) {
      result.successMessage = sanitizeCopyText(overrides.successMessage, 200);
    }

    // Footer text
    if (overrides.footerText) {
      result.footerText = sanitizeCopyText(overrides.footerText, 50);
    }

    return result;
  }

  /**
   * Resolve features by merging with defaults
   */
  private static resolveFeatures(overrides?: WorkspaceFeatures): ResolvedFeatures {
    const result = { ...DEFAULT_FEATURES };

    if (!overrides) {
      return result;
    }

    // showPoweredBy
    if (typeof overrides.showPoweredBy === 'boolean') {
      result.showPoweredBy = overrides.showPoweredBy;
    }

    return result;
  }
}
