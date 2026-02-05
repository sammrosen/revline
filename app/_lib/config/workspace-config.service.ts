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
  SignupCopyConfig,
  SignupClubInfo,
  SignupFeatures,
  SignupPolicies,
  SignupPlan,
} from '@/app/_lib/types';
import {
  DEFAULT_BRANDING,
  DEFAULT_BOOKING_COPY,
  DEFAULT_FEATURES,
  DEFAULT_SIGNUP_CONFIG,
  DEFAULT_SIGNUP_COPY,
  DEFAULT_SIGNUP_CLUB,
  DEFAULT_SIGNUP_FEATURES,
  DEFAULT_SIGNUP_POLICIES,
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

/**
 * Fully resolved signup copy (no optional fields)
 */
export interface ResolvedSignupCopy {
  stepTitles: Record<number, string>;
  smsConsent: string;
  disclaimer: string;
  submitButton: string;
  successTitle: string;
  successMessage: string;
}

/**
 * Fully resolved signup club info
 */
export interface ResolvedSignupClub {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Fully resolved signup features
 */
export interface ResolvedSignupFeatures {
  showPromoCode: boolean;
  showPoweredBy: boolean;
  requireSmsConsent: boolean;
}

/**
 * Fully resolved signup policies
 */
export interface ResolvedSignupPolicies {
  privacy: string;
  accessibility: string;
  cancellation: string;
  terms: string;
}

/**
 * Resolved config for signup template specifically
 */
export interface ResolvedSignupConfig extends ResolvedWorkspaceConfig {
  enabled: boolean;
  club: ResolvedSignupClub;
  plans: SignupPlan[];
  copy: ResolvedSignupCopy;
  policies: ResolvedSignupPolicies;
  signupFeatures: ResolvedSignupFeatures;
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
   * Resolve config for signup template
   * Includes branding, features, club info, plans, copy, and policies
   */
  static async resolveForSignup(workspaceId: string): Promise<ResolvedSignupConfig> {
    const meta = await this.loadRevlineMeta(workspaceId);
    const signupConfig = meta?.signup;
    
    return {
      workspaceId,
      branding: this.resolveBranding(meta?.branding),
      features: this.resolveFeatures(meta?.features),
      enabled: signupConfig?.enabled ?? false,
      club: this.resolveSignupClub(signupConfig?.club),
      plans: this.resolveSignupPlans(signupConfig?.plans),
      copy: this.resolveSignupCopy(signupConfig?.copy),
      policies: this.resolveSignupPolicies(signupConfig?.policies),
      signupFeatures: this.resolveSignupFeatures(signupConfig?.features),
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

      return integration.meta as unknown as RevlineMeta;
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

  /**
   * Resolve signup club info by merging with defaults
   */
  private static resolveSignupClub(overrides?: SignupClubInfo): ResolvedSignupClub {
    const result = { ...DEFAULT_SIGNUP_CLUB };

    if (!overrides) {
      return result;
    }

    if (overrides.name) {
      result.name = sanitizeCopyText(overrides.name, 100);
    }
    if (overrides.address) {
      result.address = sanitizeCopyText(overrides.address, 200);
    }
    if (overrides.city) {
      result.city = sanitizeCopyText(overrides.city, 100);
    }
    if (overrides.state) {
      result.state = sanitizeCopyText(overrides.state, 2);
    }
    if (overrides.zip) {
      result.zip = sanitizeCopyText(overrides.zip, 10);
    }

    return result;
  }

  /**
   * Resolve signup plans, using default example if none provided
   */
  private static resolveSignupPlans(plans?: SignupPlan[]): SignupPlan[] {
    if (!plans || plans.length === 0) {
      return DEFAULT_SIGNUP_CONFIG.plans;
    }

    // Validate and sanitize each plan
    return plans.map(plan => ({
      id: plan.id || `plan-${Date.now()}`,
      name: sanitizeCopyText(plan.name || 'Membership', 100),
      price: typeof plan.price === 'number' ? plan.price : 0,
      period: plan.period === 'year' ? 'year' : 'month',
      image: plan.image && isValidLogoUrl(plan.image) ? plan.image : '',
      benefits: Array.isArray(plan.benefits) 
        ? plan.benefits.map(b => sanitizeCopyText(b, 100)).slice(0, 20)
        : [],
      pricingDetails: Array.isArray(plan.pricingDetails)
        ? plan.pricingDetails.map(d => ({
            label: sanitizeCopyText(d.label || '', 50),
            value: sanitizeCopyText(d.value || '', 50),
            strikethrough: d.strikethrough ? sanitizeCopyText(d.strikethrough, 50) : undefined,
          })).slice(0, 10)
        : [],
      promoNote: plan.promoNote ? sanitizeCopyText(plan.promoNote, 100) : undefined,
      disclaimer: plan.disclaimer ? sanitizeCopyText(plan.disclaimer, 300) : undefined,
      paymentDetails: {
        dueToday: typeof plan.paymentDetails?.dueToday === 'number' ? plan.paymentDetails.dueToday : 0,
        recurring: typeof plan.paymentDetails?.recurring === 'number' ? plan.paymentDetails.recurring : 0,
        fees: typeof plan.paymentDetails?.fees === 'number' ? plan.paymentDetails.fees : 0,
      },
    }));
  }

  /**
   * Resolve signup copy by merging with defaults
   */
  private static resolveSignupCopy(overrides?: SignupCopyConfig): ResolvedSignupCopy {
    const result: ResolvedSignupCopy = {
      stepTitles: { ...DEFAULT_SIGNUP_COPY.stepTitles } as Record<number, string>,
      smsConsent: DEFAULT_SIGNUP_COPY.smsConsent,
      disclaimer: DEFAULT_SIGNUP_COPY.disclaimer,
      submitButton: DEFAULT_SIGNUP_COPY.submitButton,
      successTitle: DEFAULT_SIGNUP_COPY.successTitle,
      successMessage: DEFAULT_SIGNUP_COPY.successMessage,
    };

    if (!overrides) {
      return result;
    }

    // Step titles
    if (overrides.stepTitles) {
      for (const step of [1, 2, 3, 4, 5, 6] as const) {
        const title = overrides.stepTitles[step];
        if (title) {
          result.stepTitles[step] = sanitizeCopyText(title, 30);
        }
      }
    }

    // Other copy fields
    if (overrides.smsConsent) {
      result.smsConsent = sanitizeCopyText(overrides.smsConsent, 300);
    }
    if (overrides.disclaimer) {
      result.disclaimer = sanitizeCopyText(overrides.disclaimer, 200);
    }
    if (overrides.submitButton) {
      result.submitButton = sanitizeCopyText(overrides.submitButton, 30);
    }
    if (overrides.successTitle) {
      result.successTitle = sanitizeCopyText(overrides.successTitle, 60);
    }
    if (overrides.successMessage) {
      result.successMessage = sanitizeCopyText(overrides.successMessage, 200);
    }

    return result;
  }

  /**
   * Resolve signup policies by merging with defaults
   */
  private static resolveSignupPolicies(overrides?: SignupPolicies): ResolvedSignupPolicies {
    const result = { ...DEFAULT_SIGNUP_POLICIES };

    if (!overrides) {
      return result;
    }

    // Validate URLs
    if (overrides.privacy && isValidLogoUrl(overrides.privacy)) {
      result.privacy = overrides.privacy;
    }
    if (overrides.accessibility && isValidLogoUrl(overrides.accessibility)) {
      result.accessibility = overrides.accessibility;
    }
    if (overrides.cancellation && isValidLogoUrl(overrides.cancellation)) {
      result.cancellation = overrides.cancellation;
    }
    if (overrides.terms && isValidLogoUrl(overrides.terms)) {
      result.terms = overrides.terms;
    }

    return result;
  }

  /**
   * Resolve signup features by merging with defaults
   */
  private static resolveSignupFeatures(overrides?: SignupFeatures): ResolvedSignupFeatures {
    const result = { ...DEFAULT_SIGNUP_FEATURES };

    if (!overrides) {
      return result;
    }

    if (typeof overrides.showPromoCode === 'boolean') {
      result.showPromoCode = overrides.showPromoCode;
    }
    if (typeof overrides.showPoweredBy === 'boolean') {
      result.showPoweredBy = overrides.showPoweredBy;
    }
    if (typeof overrides.requireSmsConsent === 'boolean') {
      result.requireSmsConsent = overrides.requireSmsConsent;
    }

    return result;
  }
}
