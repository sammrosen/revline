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
  type ResolvedBookingCopy,
  type ResolvedFeatures,
  type ResolvedWorkspaceConfig,
  type ResolvedBookingConfig,
} from './workspace-config.service';

export {
  DEFAULT_BRANDING,
  DEFAULT_BOOKING_COPY,
  DEFAULT_FEATURES,
  isValidHexColor,
  isValidLogoUrl,
  sanitizeCopyText,
} from './defaults';
