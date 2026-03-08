/**
 * Configuration Module
 * 
 * Exports workspace configuration service and defaults.
 * 
 * @example
 * import { WorkspaceConfigService, DEFAULT_BRANDING } from '@/app/_lib/config';
 * 
 * const config = await WorkspaceConfigService.resolveForBooking(workspaceId);
 */

export {
  WorkspaceConfigService,
  type ResolvedBranding,
  type ResolvedThemeMapping,
  type ResolvedHeaderStyle,
  type ResolvedTextRole,
  type ResolvedTypography,
  type ResolvedBookingCopy,
  type ResolvedFeatures,
  type ResolvedWorkspaceConfig,
  type ResolvedBookingConfig,
  type ResolvedSignupCopy,
  type ResolvedSignupClub,
  type ResolvedSignupFeatures,
  type ResolvedSignupPolicies,
  type ResolvedSignupConfig,
} from './workspace-config.service';

export {
  DEFAULT_BRANDING,
  DEFAULT_THEME_MAPPING,
  DEFAULT_HEADER_STYLE,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_BOOKING_COPY,
  DEFAULT_FEATURES,
  DEFAULT_SIGNUP_CONFIG,
  DEFAULT_SIGNUP_COPY,
  DEFAULT_SIGNUP_CLUB,
  DEFAULT_SIGNUP_FEATURES,
  DEFAULT_SIGNUP_POLICIES,
  EXAMPLE_SIGNUP_PLAN,
  isValidHexColor,
  isValidLogoUrl,
  sanitizeCopyText,
} from './defaults';
