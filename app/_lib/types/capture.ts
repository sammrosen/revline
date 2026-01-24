/**
 * Capture Types and Validation Schemas
 * 
 * Defines types for the form capture system including:
 * - Security configuration for browser/server modes
 * - Payload validation schemas
 * - Denylist patterns for sensitive data
 * 
 * STANDARDS:
 * - Zod for runtime validation
 * - Explicit types for all structures
 * - Defense in depth with denylists
 */

import { z } from 'zod';

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

/**
 * Capture security modes
 * - browser: Public endpoint with origin validation + rate limiting
 * - server: Requires HMAC signature + timestamp
 * - both: Accepts either mode
 */
export type CaptureSecurityMode = 'browser' | 'server' | 'both';

/**
 * Form security configuration stored in WorkspaceForm.security
 */
export const FormSecuritySchema = z.object({
  mode: z.enum(['browser', 'server', 'both']).default('browser'),
  allowedOrigins: z.array(z.string()).default([]),
  rateLimitPerIp: z.number().min(1).max(100).default(10),
  signingSecret: z.string().optional(), // Encrypted at rest, server mode only
});

export type FormSecurity = z.infer<typeof FormSecuritySchema>;

/**
 * Default security configuration for new forms
 */
export const DEFAULT_FORM_SECURITY: FormSecurity = {
  mode: 'browser',
  allowedOrigins: [],
  rateLimitPerIp: 10,
};

// =============================================================================
// TARGET FIELD VALIDATION
// =============================================================================

/**
 * Known lead fields that can be targeted
 */
export const LEAD_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'source'] as const;
export type LeadField = typeof LEAD_FIELDS[number];

/**
 * Validate a target field - must be a lead field or custom.* field
 */
export const AllowedTargetSchema = z.string().refine(
  (val) => {
    // Must be a known lead field OR start with custom.
    if (LEAD_FIELDS.includes(val as LeadField)) return true;
    if (val.startsWith('custom.')) {
      // Validate custom field key format: custom.fieldKey
      const key = val.slice(7);
      return /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(key);
    }
    return false;
  },
  { message: 'Target must be a known lead field or custom.fieldKey' }
);

/**
 * Validate array of allowed targets
 */
export const AllowedTargetsSchema = z.array(AllowedTargetSchema).min(1, 'At least one target required');

// =============================================================================
// CAPTURE PAYLOAD VALIDATION
// =============================================================================

/**
 * Capture request payload (after client-side mapping)
 * Email is required, other fields optional
 */
export const CapturePayloadSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  source: z.string().max(100).optional(),
}).catchall(
  // Allow custom.* fields with string values up to 1000 chars
  z.string().max(1000)
);

export type CapturePayload = z.infer<typeof CapturePayloadSchema>;

/**
 * Maximum payload size in bytes (32KB)
 */
export const MAX_PAYLOAD_SIZE = 32 * 1024;

/**
 * Maximum field value length
 */
export const MAX_FIELD_LENGTH = 1000;

// =============================================================================
// SENSITIVE DATA PROTECTION
// =============================================================================

/**
 * Denylist patterns for sensitive field VALUES
 * These patterns indicate the value itself is sensitive (e.g., looks like a credit card)
 */
export const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /^\d{13,19}$/,           // Credit card numbers (13-19 digits)
  /^\d{3}-\d{2}-\d{4}$/,   // SSN format (XXX-XX-XXXX)
  /^\d{9}$/,               // SSN without dashes (9 digits)
  /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, // Credit card with spaces/dashes
];

/**
 * Denylist field NAMES - never accept these as targets
 * Case-insensitive matching
 */
export const DENYLIST_TARGETS: string[] = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'ssn',
  'socialsecurity',
  'social_security',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'cvv2',
  'expiry',
  'expiration',
  'routing',
  'accountnumber',
  'account_number',
  'bankaccount',
  'bank_account',
];

/**
 * Check if a field name is denylisted
 */
export function isDenylistedTarget(target: string): boolean {
  const normalized = target.toLowerCase().replace(/[_-]/g, '');
  return DENYLIST_TARGETS.some(
    denied => normalized.includes(denied.replace(/[_-]/g, ''))
  );
}

/**
 * Check if a value matches sensitive patterns
 */
export function hasSensitiveValuePattern(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value.trim()));
}

// =============================================================================
// FORM CONFIGURATION SCHEMAS
// =============================================================================

/**
 * Create form input validation
 */
export const CreateFormSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  security: FormSecuritySchema.optional(),
  allowedTargets: AllowedTargetsSchema,
  triggerName: z.string().min(1).max(64).default('form_captured'),
});

export type CreateFormInput = z.infer<typeof CreateFormSchema>;

/**
 * Update form input validation
 */
export const UpdateFormSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  security: FormSecuritySchema.partial().optional(),
  allowedTargets: AllowedTargetsSchema.optional(),
  triggerName: z.string().min(1).max(64).optional(),
});

export type UpdateFormInput = z.infer<typeof UpdateFormSchema>;

// =============================================================================
// CAPTURE RESULT TYPES
// =============================================================================

/**
 * Result of capture validation
 */
export interface CaptureValidationResult {
  valid: boolean;
  mode: CaptureSecurityMode | null;
  errors: string[];
  sanitizedPayload?: Record<string, unknown>;
}

/**
 * Result of capture processing
 */
export interface CaptureProcessResult {
  success: boolean;
  leadId?: string;
  isNewLead?: boolean;
  error?: string;
  captureId: string;
}

// =============================================================================
// SERVER MODE SIGNATURE
// =============================================================================

/**
 * Headers required for server mode authentication
 */
export const SERVER_SIGNATURE_HEADER = 'x-revline-signature';
export const SERVER_TIMESTAMP_HEADER = 'x-revline-timestamp';

/**
 * Signature validation window in seconds (5 minutes)
 */
export const SIGNATURE_WINDOW_SECONDS = 300;

// =============================================================================
// RATE LIMIT CONFIGURATION
// =============================================================================

/**
 * Rate limits for capture endpoints
 * Added to RATE_LIMITS in types/index.ts
 */
export const CAPTURE_RATE_LIMITS = {
  BROWSER: { requests: 10, windowMs: 60_000 },  // 10 per minute per IP
  SERVER: { requests: 100, windowMs: 60_000 },  // 100 per minute per workspace
};
