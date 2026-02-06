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

import { 
  BrandingConfig, 
  BookingCopyConfig, 
  WorkspaceFeatures,
  SignupCopyConfig,
  SignupConfig,
  SignupClubInfo,
  SignupFeatures,
  SignupPolicies,
  SignupPlan,
} from '@/app/_lib/types';

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
  footerEmail: 'hi@revlineops.com',
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
// SIGNUP DEFAULTS
// =============================================================================

/**
 * Default copy for signup/membership template
 */
export const DEFAULT_SIGNUP_COPY: Required<SignupCopyConfig> = {
  stepTitles: {
    1: 'Location',
    2: 'About You',
    3: 'Select Plan',
    4: 'Member Info',
    5: 'Payment',
    6: 'Confirmation',
  },
  smsConsent: 'I agree to receive marketing and service messages. I can opt-out at any time by following the unsubscribe instructions. Consent is not a condition of purchase.',
  disclaimer: 'Results may vary from individual to individual.',
  submitButton: 'Complete Enrollment',
  successTitle: 'Welcome to the Team!',
  successMessage: 'Your membership is now active. Check your email for confirmation details.',
};

/**
 * Default club info (placeholder)
 */
export const DEFAULT_SIGNUP_CLUB: Required<SignupClubInfo> = {
  name: 'Your Gym',
  address: '123 Fitness Way',
  city: 'Anytown',
  state: 'CA',
  zip: '90210',
};

/**
 * Default signup feature flags
 */
export const DEFAULT_SIGNUP_FEATURES: Required<SignupFeatures> = {
  showPromoCode: true,
  showPoweredBy: true,
  requireSmsConsent: true,
};

/**
 * Default signup policies (empty - must be configured)
 */
export const DEFAULT_SIGNUP_POLICIES: Required<SignupPolicies> = {
  privacy: '',
  accessibility: '',
  cancellation: '',
  terms: '',
};

/**
 * Example membership plan (for template/reference)
 */
export const EXAMPLE_SIGNUP_PLAN: SignupPlan = {
  id: 'standard',
  name: 'Standard Membership',
  price: 49.99,
  period: 'month',
  image: '',
  benefits: [
    'Full gym access',
    'Locker room access',
    'Free fitness assessment',
    'Mobile app access',
  ],
  pricingDetails: [
    { label: 'Monthly Rate', value: '$49.99' },
    { label: 'Enrollment Fee', value: '$0', strikethrough: '$29' },
  ],
  promoNote: '$0 Enrollment Fee!',
  disclaimer: '',
  paymentDetails: {
    dueToday: 49.99,
    recurring: 49.99,
    fees: 0,
  },
};

/**
 * Default signup configuration
 * Includes example plan for template reference
 */
export const DEFAULT_SIGNUP_CONFIG: SignupConfig = {
  enabled: false,
  club: DEFAULT_SIGNUP_CLUB,
  plans: [EXAMPLE_SIGNUP_PLAN],
  copy: DEFAULT_SIGNUP_COPY,
  policies: DEFAULT_SIGNUP_POLICIES,
  features: DEFAULT_SIGNUP_FEATURES,
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
 * Validate a logo URL or data URL
 * Accepts https URLs or base64 data URLs for uploaded images
 */
export function isValidLogoUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (no logo)
  
  // Accept data URLs (base64 encoded images)
  if (url.startsWith('data:image/')) return true;
  
  // Accept https URLs
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
