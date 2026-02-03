/**
 * Global Default Configuration
 * 
 * Defines default values for branding, copy, and features.
 * These are used as fallbacks when workspace-specific config is not set.
 * 
 * STANDARDS:
 * - All defaults must be valid (no undefined values in resolved config)
 * - Copy defaults should be clear and professional
 * - Branding defaults should be neutral (RevLine blue theme)
 */

import { BrandingConfig, BookingCopyConfig, WorkspaceFeatures } from '@/app/_lib/types';

// =============================================================================
// BRANDING DEFAULTS
// =============================================================================

/**
 * Default branding configuration
 * Neutral blue theme that works well as a fallback
 */
export const DEFAULT_BRANDING: Required<BrandingConfig> = {
  primaryColor: '#3B82F6',      // Blue-500
  secondaryColor: '#1E40AF',    // Blue-800
  backgroundColor: '#F9FAFB',   // Gray-50
  logo: '',                     // No logo by default
  fontFamily: 'inter',
};

// =============================================================================
// COPY DEFAULTS
// =============================================================================

/**
 * Default copy for booking template
 */
export const DEFAULT_BOOKING_COPY: Required<BookingCopyConfig> = {
  headline: 'Book a Session',
  subhead: '',
  submitButton: 'Request Booking',
  successTitle: 'Check Your Email',
  successMessage: "If your information matches our records, you'll receive a confirmation email shortly.",
  footerText: 'Powered by RevLine',
};

// =============================================================================
// FEATURE DEFAULTS
// =============================================================================

/**
 * Default feature flags
 */
export const DEFAULT_FEATURES: Required<WorkspaceFeatures> = {
  showPoweredBy: true,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate a hex color string
 * Returns true if valid, false otherwise
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validate a logo URL
 * Must be https for security
 */
export function isValidLogoUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (no logo)
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize copy text to prevent XSS
 * Strips HTML tags and limits length
 */
export function sanitizeCopyText(text: string, maxLength: number = 200): string {
  // Strip HTML tags
  const stripped = text.replace(/<[^>]*>/g, '');
  // Limit length
  return stripped.slice(0, maxLength);
}
