/**
 * RevLine Core Type Definitions
 * 
 * This file contains all shared type definitions for the RevLine platform.
 * Import from '@/app/_lib/types' in all files.
 * 
 * STANDARDS:
 * - Use interfaces for object shapes that may be extended
 * - Use types for unions, intersections, and utility types
 * - Export everything that's used across modules
 * - Keep integration-specific types with their meta definitions
 */

import { IntegrationType, HealthStatus, EventSystem, WorkspaceStatus, WorkspaceRole } from '@prisma/client';

// Re-export Prisma enums for convenience
export { IntegrationType, HealthStatus, EventSystem, WorkspaceStatus, WorkspaceRole };

// =============================================================================
// LEAD STAGE TYPES
// =============================================================================

/**
 * Definition for a single lead pipeline stage.
 * Stored as JSON array on the Workspace model.
 */
export interface LeadStageDefinition {
  /** Stored value, uppercase (e.g., "CAPTURED"). Immutable once leads exist with it. */
  key: string;
  /** Display name (e.g., "Captured"). Renamable. */
  label: string;
  /** Hex color for badges (e.g., "#6B7280"). */
  color: string;
}

/**
 * Default lead stages for new workspaces.
 * CAPTURED is always required as the first/default stage.
 */
export const DEFAULT_LEAD_STAGES: LeadStageDefinition[] = [
  { key: 'CAPTURED', label: 'Captured', color: '#6B7280' },
  { key: 'BOOKED', label: 'Booked', color: '#3B82F6' },
  { key: 'PAID', label: 'Paid', color: '#10B981' },
  { key: 'DEAD', label: 'Dead', color: '#EF4444' },
];

// =============================================================================
// LEAD PROPERTY TYPES
// =============================================================================

/**
 * Supported value types for custom lead properties.
 */
export type LeadPropertyType = 'string' | 'number' | 'boolean' | 'email' | 'url';

/**
 * Definition for a single custom lead property.
 * Stored as JSON array on the Workspace model (leadPropertySchema).
 * 
 * @example
 * { key: "barcode", label: "Member Barcode", type: "string", required: true }
 */
export interface LeadPropertyDefinition {
  /** Machine name, immutable once leads have data (e.g., "barcode"). Lowercase, alphanumeric + underscores. */
  key: string;
  /** Display name (e.g., "Member Barcode"). Renamable. */
  label: string;
  /** Value type for validation. */
  type: LeadPropertyType;
  /** Whether this property is required on new submissions. Not retroactive for existing leads. */
  required: boolean;
}

/**
 * Valid property key pattern: lowercase letters, numbers, and underscores.
 * Must start with a letter.
 */
export const LEAD_PROPERTY_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

/**
 * Maximum number of custom properties per workspace.
 */
export const MAX_LEAD_PROPERTIES = 25;

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

/**
 * Organization permission toggles
 * Owners bypass all checks (implicit all-true)
 * Members get explicit permissions set by owner
 */
export interface OrgPermissions {
  /** Can add/edit/remove integrations and see secrets */
  canManageIntegrations: boolean;
  /** Can create/edit/delete workflows */
  canManageWorkflows: boolean;
  /** Can create/edit org templates */
  canManageTemplates: boolean;
  /** Can invite/remove other members (not owner) */
  canInviteMembers: boolean;
  /** Can create new workspaces in org */
  canCreateWorkspaces: boolean;
  /** Can access all org workspaces vs only assigned ones */
  canAccessAllWorkspaces: boolean;
}

/**
 * Default permissions for new organization members
 */
export const DEFAULT_MEMBER_PERMISSIONS: OrgPermissions = {
  canManageIntegrations: false,
  canManageWorkflows: true,
  canManageTemplates: false,
  canInviteMembers: false,
  canCreateWorkspaces: false,
  canAccessAllWorkspaces: false,
};

/**
 * Full permissions (for owners)
 */
export const OWNER_PERMISSIONS: OrgPermissions = {
  canManageIntegrations: true,
  canManageWorkflows: true,
  canManageTemplates: true,
  canInviteMembers: true,
  canCreateWorkspaces: true,
  canAccessAllWorkspaces: true,
};

/**
 * Organization access information for a user
 */
export interface OrganizationAccess {
  organizationId: string;
  userId: string;
  isOwner: boolean;
  permissions: OrgPermissions;
}

/**
 * Organization context with basic info
 */
export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
}

/**
 * Organization with user's access attached
 */
export interface OrganizationWithAccess extends OrganizationContext {
  isOwner: boolean;
  permissions: OrgPermissions;
}

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * User context for authenticated requests
 */
export interface UserContext {
  id: string;
  email: string;
  name: string | null;
}

// =============================================================================
// WORKSPACE TYPES
// =============================================================================

export interface WorkspaceContext {
  id: string;
  slug: string;
  name: string;
  status: WorkspaceStatus;
  timezone: string;
}

/**
 * Workspace with the user's access role attached
 * Used when listing workspaces for a specific user
 */
export interface WorkspaceWithAccess extends WorkspaceContext {
  userRole: WorkspaceRole;
}

export interface WorkspaceWithIntegrations extends WorkspaceContext {
  integrations: IntegrationSummary[];
}

export interface IntegrationSummary {
  id: string;
  integration: IntegrationType;
  healthStatus: HealthStatus;
  lastSeenAt: Date | null;
}

// =============================================================================
// INTEGRATION META TYPES
// =============================================================================

/**
 * A named MailerLite group with ID and display name
 */
export interface MailerLiteGroup {
  id: string;
  name: string;
}

/**
 * MailerLite integration metadata
 * Groups are referenced by key in workflow actions (e.g., add_to_group with group: "welcome")
 * 
 * @example
 * {
 *   "groups": {
 *     "welcome": { "id": "123456", "name": "Welcome List" },
 *     "customers": { "id": "789012", "name": "Paying Customers" }
 *   }
 * }
 */
export interface MailerLiteMeta {
  groups: Record<string, MailerLiteGroup>;
}

/**
 * Stripe integration metadata
 * Optional product mapping for multi-product routing
 */
export interface StripeMeta {
  productMap?: Record<string, string>;
  apiKey?: string; // Optional: stored in env by default
}

/**
 * Calendly integration metadata
 * Scheduling URLs and webhook configuration
 */
export interface CalendlyMeta {
  schedulingUrls?: Record<string, string>;
  addToBookedSegment?: boolean;
}

/**
 * ManyChat integration metadata
 * Flow IDs and tag mappings
 */
export interface ManyChatMeta {
  flowIds?: Record<string, string>;
  tagMappings?: Record<string, string[]>;
}

/**
 * ABC Ignite integration metadata
 * Club configuration for calendar/appointment booking
 * 
 * @example
 * {
 *   "clubNumber": "7715",
 *   "defaultEventCategory": "Appointment",
 *   "defaultEventTypeId": "pt_session",
 *   "defaultEmployeeId": "trainer1",
 *   "eventTypes": {
 *     "pt_session": { "id": "abc-uuid", "name": "Personal Training", "category": "Appointment", "duration": 60, "levelId": "level-uuid" }
 *   },
 *   "employees": {
 *     "trainer1": { "id": "emp-uuid", "name": "John Smith", "title": "Personal Trainer" }
 *   }
 * }
 */
export interface AbcIgniteMeta {
  /** ABC Ignite club/location number (required) */
  clubNumber: string;
  /** Default event type key (references eventTypes) */
  defaultEventTypeId?: string;
  /** Default event category filter for getEventTypes (Appointment | Event) */
  defaultEventCategory?: 'Appointment' | 'Event';
  /** Synced event types from ABC Ignite (key → { id, name, category, duration, levelId }) */
  eventTypes?: Record<string, { 
    id: string; 
    name: string; 
    category: 'Appointment' | 'Event';
    duration?: number;
    /** Training level ID for availability queries */
    levelId?: string;
  }>;
  /** Default employee key (references employees) */
  defaultEmployeeId?: string;
  /** Configured employees/trainers (key → { id, name, title }) */
  employees?: Record<string, {
    /** ABC Ignite employee ID */
    id: string;
    /** Display name */
    name: string;
    /** Job title (e.g., "Personal Trainer") */
    title?: string;
  }>;
  /** Hourly member sync configuration */
  memberSync?: {
    /** Enable hourly polling for new ABC members */
    enabled: boolean;
    /** ISO timestamp of the last successful sync run (watermark for next run) */
    lastSyncTimestamp?: string;
    /** Recently processed member IDs for cross-run dedup (capped at ~500) */
    recentMemberIds?: string[];
    /**
     * Membership types to exclude from sync (exact match on agreement.membershipType).
     * Free-text strings — must match the ABC Ignite membership type name exactly.
     * Example: ["Kids Club", "Prospect"]
     */
    excludedMemberTypes?: string[];
  };
}

// =============================================================================
// WORKSPACE BRANDING & COPY TYPES
// =============================================================================

/**
 * Branding configuration for workspace templates
 * Used to customize the visual appearance of public pages
 * 
 * @example
 * {
 *   "color1": "#8B2346",
 *   "logo": "https://example.com/logo.png",
 *   "fontFamily": "inter"
 * }
 */
export interface BrandingConfig {
  /** Palette color 1 — accent: buttons, section headers (hex format) */
  color1?: string;
  /** Palette color 2 — accent hover states (hex format) */
  color2?: string;
  /** Palette color 3 — page background (hex format) */
  color3?: string;
  /** Palette color 4 — card/panel surface (hex format) */
  color4?: string;
  /** Palette color 5 — body text (hex format) */
  color5?: string;
  /** Logo URL (https only for security) */
  logo?: string;
  /** Font family for templates */
  fontFamily?: 'inter' | 'poppins' | 'roboto' | 'system';
}

/**
 * Copy configuration for booking template
 */
export interface BookingCopyConfig {
  /** Main headline (default: "Book a Session") */
  headline?: string;
  /** Subheadline text */
  subhead?: string;
  /** Submit button text (default: "Request Booking") */
  submitButton?: string;
  /** Success page title (default: "Check Your Email") */
  successTitle?: string;
  /** Success page message */
  successMessage?: string;
  /** Footer text (default: "Powered by RevLine") */
  footerText?: string;
  /** Footer email address */
  footerEmail?: string;
}

/**
 * Copy configuration for landing page template
 */
export interface LandingFormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  required?: boolean;
  placeholder?: string;
}

export interface LandingSections {
  hero?: boolean;
  services?: boolean;
  gallery?: boolean;
  footer?: boolean;
}

export interface LandingCopyConfig {
  heroHeadline?: string;
  heroSubhead?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  heroBackgroundImage?: string;
  phoneNumber?: string;
  servicesTitle?: string;
  services?: Array<{ title: string; description: string }>;
  images?: string[];
  contactTitle?: string;
  contactSubhead?: string;
  contactSubmitText?: string;
  contactSuccessMessage?: string;
  consentText?: string;
  formFields?: LandingFormField[];
  footerText?: string;
  footerEmail?: string;
  sections?: LandingSections;
}

/**
 * Copy configuration for all templates
 * Each template type has its own copy schema
 */
export interface CopyConfig {
  /** Booking template copy */
  booking?: BookingCopyConfig;
  /** Signup template copy */
  signup?: SignupCopyConfig;
  /** Landing page copy */
  landing?: LandingCopyConfig;
}

/**
 * Feature flags for workspace
 */
export interface WorkspaceFeatures {
  /** Show "Powered by RevLine" footer (default: true) */
  showPoweredBy?: boolean;
}

// =============================================================================
// SIGNUP TEMPLATE TYPES
// =============================================================================

/**
 * Copy configuration for signup/membership template
 */
export interface SignupCopyConfig {
  /** Step titles (1-6) */
  stepTitles?: {
    1?: string;
    2?: string;
    3?: string;
    4?: string;
    5?: string;
    6?: string;
  };
  /** SMS/Marketing consent text */
  smsConsent?: string;
  /** Page disclaimer text */
  disclaimer?: string;
  /** Final submit button text */
  submitButton?: string;
  /** Confirmation page title */
  successTitle?: string;
  /** Confirmation page message */
  successMessage?: string;
  /** Footer text line */
  footerText?: string;
  /** Footer contact email */
  footerEmail?: string;
  /** Header right-side text (empty = "Join {workspaceName}") */
  headerText?: string;
  /** Header right-side link URL (empty = plain text) */
  headerLink?: string;
}

/**
 * Club/location information for signup
 */
export interface SignupClubInfo {
  /** Club name */
  name: string;
  /** Street address */
  address: string;
  /** City */
  city: string;
  /** State abbreviation */
  state: string;
  /** ZIP/Postal code */
  zip: string;
}

/**
 * Pricing detail line item
 */
export interface SignupPricingDetail {
  /** Label (e.g., "Enrollment Fee", "First Month") */
  label: string;
  /** Display value (e.g., "$65.99") */
  value: string;
  /** Strikethrough value for promotions (e.g., "$49.00") */
  strikethrough?: string;
}

/**
 * Payment summary for a plan
 */
export interface SignupPaymentDetails {
  /** Amount due today */
  dueToday: number;
  /** Recurring monthly/yearly amount */
  recurring: number;
  /** Additional fees */
  fees: number;
}

/**
 * Membership plan configuration
 */
export interface SignupPlan {
  /** Unique plan identifier */
  id: string;
  /** Display name (e.g., "Premier All Location") */
  name: string;
  /** Price amount */
  price: number;
  /** Billing period */
  period: 'month' | 'year';
  /** Plan image URL */
  image?: string;
  /** List of member benefits */
  benefits: string[];
  /** Pricing breakdown details */
  pricingDetails: SignupPricingDetail[];
  /** Promotional note (e.g., "$0 Enrollment Fee!") */
  promoNote?: string;
  /** Fine print disclaimer */
  disclaimer?: string;
  /** Payment summary */
  paymentDetails: SignupPaymentDetails;
}

/**
 * Policy links configuration
 */
export interface SignupPolicies {
  /** Privacy policy URL */
  privacy?: string;
  /** Accessibility statement URL */
  accessibility?: string;
  /** Cancellation request URL */
  cancellation?: string;
  /** Terms and conditions URL */
  terms?: string;
}

/**
 * Feature flags for signup template
 */
export interface SignupFeatures {
  /** Show promo code input (default: true) */
  showPromoCode?: boolean;
  /** Show powered by footer (default: true) */
  showPoweredBy?: boolean;
  /** Require SMS consent checkbox (default: true) */
  requireSmsConsent?: boolean;
}

/**
 * Full signup/membership configuration
 * Stored in RevlineMeta.signup
 */
export interface SignupConfig {
  /** Whether signup form is enabled */
  enabled: boolean;
  /** Club/location information */
  club: SignupClubInfo;
  /** Available membership plans */
  plans: SignupPlan[];
  /** Copy/text customization */
  copy: SignupCopyConfig;
  /** Policy page links */
  policies: SignupPolicies;
  /** Feature toggles */
  features: SignupFeatures;
}

/**
 * RevLine integration metadata
 * Forms configuration, branding, copy, and internal settings
 * 
 * Each enabled form becomes a workflow trigger option.
 * The form ID IS the trigger operation - no separate mapping needed.
 * 
 * @example
 * {
 *   "forms": {
 *     "prospect-intake": { "enabled": true },
 *     "booking-form": { "enabled": true }
 *   },
 *   "settings": {
 *     "defaultSource": "landing"
 *   },
 *   "branding": {
 *     "color1": "#8B2346",
 *     "logo": "https://example.com/logo.png"
 *   },
 *   "copy": {
 *     "booking": {
 *       "headline": "Schedule Your Session"
 *     }
 *   }
 * }
 */
/**
 * Maps each DerivedBrand slot to a palette color index (1-5).
 * Stored on RevlineMeta so it's shared across form types.
 */
export interface ThemeMapping {
  /** Accent — buttons, section headers, step indicator (default: 1) */
  primary?: number;
  /** Accent hover states (default: 2) */
  primaryHover?: number;
  /** Page background (default: 3) */
  background?: number;
  /** Card/panel backgrounds (default: 4) */
  card?: number;
  /** Body text and headings (default: 5) */
  text?: number;
  /** Top navigation bar background (default: 5) */
  header?: number;
}

/**
 * Size + weight for a single text role.
 * Used by TypographyConfig to control how each tier of text renders.
 */
export interface TextRoleStyle {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

/**
 * Typography config — maps semantic text roles to size/weight.
 * Stored on RevlineMeta so it's shared across form types.
 *
 * Roles:
 * - sectionHeader: colored bar headings ("SELECT YOUR TRAINER", "Personal Info")
 * - pageTitle: success/confirmation page titles
 * - body: general text, descriptions, plan names
 * - label: form field labels
 * - caption: helper text, disclaimers, footer fine print
 */
export interface TypographyConfig {
  sectionHeader?: TextRoleStyle;
  pageTitle?: TextRoleStyle;
  body?: TextRoleStyle;
  label?: TextRoleStyle;
  caption?: TextRoleStyle;
}

/**
 * Controls how the workspace name renders in the header when no logo is set.
 * Stored on RevlineMeta so it's shared across form types.
 */
export interface HeaderStyle {
  /** pill = white badge (default), plain = just text on header bg */
  variant?: 'pill' | 'plain';
  /** Font size for the name text */
  size?: 'sm' | 'base' | 'lg' | 'xl';
  /** Bold text (default: true) */
  bold?: boolean;
  /** Italic text (default: false) */
  italic?: boolean;
  /** Right-side header text size */
  textSize?: 'xs' | 'sm' | 'base' | 'lg';
  /** Right-side header text weight */
  textWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export interface RevlineMeta {
  /** Enabled forms - each becomes a workflow trigger (formId = trigger operation) */
  forms: Record<string, { 
    enabled: boolean; 
  }>;
  /** General RevLine settings */
  settings: {
    defaultSource?: string;
  };
  /** Branding configuration for templates */
  branding?: BrandingConfig;
  /** Theme mapping — assigns palette colors to form elements */
  theme?: ThemeMapping;
  /** Header name/logo style */
  headerStyle?: HeaderStyle;
  /** Typography — size/weight per text role */
  typography?: TypographyConfig;
  /** Copy configuration per template */
  copy?: CopyConfig;
  /** Feature flags */
  features?: WorkspaceFeatures;
  /** Signup/membership template configuration */
  signup?: SignupConfig;
  /** Webchat widget configuration for landing pages */
  webchat?: {
    agentId: string;
    enabled: boolean;
    collectEmail?: boolean;
  };
}

/**
 * A named Resend template with ID and variable definitions
 */
export interface ResendTemplate {
  /** Resend template ID (UUID) */
  id: string;
  /** Display name for the template */
  name: string;
  /** Variable keys defined in the template (e.g., ["BARCODE", "FIRST_NAME"]) */
  variables?: string[];
}

/**
 * Resend integration metadata
 * Configuration for transactional email sending
 * Templates are referenced by key in workflow actions (e.g., send_email with template: "welcome")
 * 
 * @example
 * {
 *   "fromEmail": "bookings@yourdomain.com",
 *   "fromName": "Sports West",
 *   "replyTo": "support@yourdomain.com",
 *   "templates": {
 *     "welcome": { "id": "f3b9756c-...", "name": "Welcome Email", "variables": ["FIRST_NAME", "BARCODE"] },
 *     "payment-confirm": { "id": "a1b2c3d4-...", "name": "Payment Confirmation", "variables": ["FIRST_NAME", "AMOUNT"] }
 *   }
 * }
 */
export interface ResendMeta {
  /** Verified sender email address (required) */
  fromEmail: string;
  /** Display name for sender (e.g., "Sports West") */
  fromName?: string;
  /** Default reply-to address */
  replyTo?: string;
  /** Named templates with Resend template IDs and variable definitions */
  templates?: Record<string, ResendTemplate>;
}

/**
 * Twilio integration metadata
 * Phone number configuration for SMS messaging
 * 
 * @example
 * {
 *   "phoneNumbers": {
 *     "main": { "number": "+15551234567", "label": "Main Line" }
 *   }
 * }
 */
export interface TwilioMeta {
  /** Configured phone numbers: key → { number (E.164), label } */
  phoneNumbers: Record<string, {
    /** E.164 format phone number (e.g., "+15551234567") */
    number: string;
    /** Display label (e.g., "Main Line") */
    label: string;
  }>;
}

/**
 * OpenAI integration metadata
 * Model and generation settings for AI completions
 * 
 * @example
 * {
 *   "model": "gpt-4.1-mini",
 *   "temperature": 0.7,
 *   "maxTokens": 1024
 * }
 */
export interface OpenAIMeta {
  /** Model ID (e.g., "gpt-4.1-mini", "gpt-4o") */
  model: string;
  /** Sampling temperature (0-2). Lower = more deterministic. */
  temperature?: number;
  /** Maximum tokens in the completion response */
  maxTokens?: number;
  /** OpenAI organization ID (for org-scoped API keys) */
  organizationId?: string;
}

export interface AnthropicMeta {
  /** Model ID (e.g., "claude-sonnet-4-6") */
  model: string;
  /** Maximum tokens in the response -- required by Anthropic on every call */
  maxTokens: number;
  /** Sampling temperature (0-1). Anthropic range is 0-1. */
  temperature?: number;
}

/**
 * Union of all integration meta types
 */
export type IntegrationMeta = 
  | MailerLiteMeta 
  | StripeMeta 
  | CalendlyMeta 
  | ManyChatMeta 
  | AbcIgniteMeta
  | RevlineMeta
  | ResendMeta
  | TwilioMeta
  | OpenAIMeta
  | AnthropicMeta
  | Record<string, unknown>;

/**
 * Type guard for MailerLite meta
 */
export function isMailerLiteMeta(meta: IntegrationMeta | null): meta is MailerLiteMeta {
  if (!meta) return false;
  return 'groups' in meta;
}

/**
 * Type guard for Resend meta
 */
export function isResendMeta(meta: IntegrationMeta | null): meta is ResendMeta {
  if (!meta) return false;
  return 'fromEmail' in meta;
}

/**
 * Type guard for Stripe meta
 */
export function isStripeMeta(meta: IntegrationMeta | null): meta is StripeMeta {
  if (!meta) return false;
  return 'productMap' in meta || 'apiKey' in meta || Object.keys(meta).length === 0;
}

/**
 * Type guard for Twilio meta
 */
export function isTwilioMeta(meta: IntegrationMeta | null): meta is TwilioMeta {
  if (!meta) return false;
  return 'phoneNumbers' in meta;
}

/**
 * Type guard for OpenAI meta
 */
export function isOpenAIMeta(meta: IntegrationMeta | null): meta is OpenAIMeta {
  if (!meta) return false;
  return 'model' in meta && typeof (meta as OpenAIMeta).model === 'string' && !('maxTokens' in meta && typeof (meta as AnthropicMeta).maxTokens === 'number');
}

export function isAnthropicMeta(meta: IntegrationMeta | null): meta is AnthropicMeta {
  if (!meta) return false;
  return 'model' in meta && 'maxTokens' in meta && typeof (meta as AnthropicMeta).maxTokens === 'number';
}

// =============================================================================
// LEAD TYPES
// =============================================================================

export interface LeadData {
  email: string;
  name?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface Lead {
  id: string;
  workspaceId: string;
  email: string;
  source: string | null;
  stage: string;
  errorState: string | null;
  properties: Record<string, unknown> | null;
  createdAt: Date;
  lastEventAt: Date;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface EventData {
  workspaceId: string;
  leadId?: string;
  system: EventSystem;
  eventType: string;
  success: boolean;
  errorMessage?: string;
}

export interface Event {
  id: string;
  workspaceId: string;
  leadId: string | null;
  system: EventSystem;
  eventType: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Webhook processing result
 */
export interface WebhookResult {
  received: boolean;
  processed: boolean;
  leadId?: string;
  warning?: string;
  error?: string;
}

/**
 * Capture endpoint input
 */
export interface CaptureInput {
  email: string;
  name?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Capture endpoint result
 */
export interface CaptureResult {
  leadId: string;
  email: string;
  subscriberId?: string;
  message: string;
}

// =============================================================================
// INTEGRATION SECRET TYPES
// =============================================================================

/**
 * A single named secret within an integration
 * Stored encrypted in the database, decrypted only in memory
 */
export interface IntegrationSecret {
  id: string;           // UUID for targeting updates/deletes
  name: string;         // Display name, e.g., "API Key", "Webhook Secret"
  encryptedValue: string;
  keyVersion: number;
}

/**
 * Input for creating/updating a secret (before encryption)
 */
export interface SecretInput {
  name: string;
  plaintextValue: string;
}

/**
 * Secret summary for API responses (never expose actual values)
 */
export interface SecretSummary {
  id: string;
  name: string;
  createdAt?: Date;
}

// =============================================================================
// INTEGRATION ADAPTER TYPES
// =============================================================================

/**
 * Configuration for integration adapters
 */
export interface IntegrationConfig {
  workspaceId: string;
  secrets: IntegrationSecret[];
  meta: IntegrationMeta | null;
}

/**
 * Result from integration operations
 */
export interface IntegrationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retryable?: boolean;
  /** Milliseconds to wait before retrying, from Retry-After header when available */
  retryAfterMs?: number;
}

/**
 * Webhook verification result
 */
export interface WebhookVerification {
  valid: boolean;
  error?: string;
  payload?: unknown;
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

export interface HealthIssue {
  workspaceId: string;
  workspaceName: string;
  integration?: IntegrationType;
  issue: string;
  severity: 'warning' | 'critical';
}

export interface HealthCheckResult {
  workspacesChecked: number;
  issuesFound: number;
  issues: HealthIssue[];
  timestamp: Date;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  field?: string;
}

/**
 * Email validation regex (RFC 5322 simplified)
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Slug validation regex (lowercase, alphanumeric, underscores)
 */
export const SLUG_REGEX = /^[a-z][a-z0-9_]*$/;

// =============================================================================
// CONSTANTS
// =============================================================================

export const RATE_LIMITS = {
  SUBSCRIBE: { requests: 10, windowMs: 60_000 },  // 10 per minute (form submits, subscribe)
  BOOKING_READ: { requests: 60, windowMs: 60_000 },  // 60 per minute (employees, availability, lookup, eligibility)
  WEBHOOK: { requests: 100, windowMs: 60_000 },   // 100 per minute
  ADMIN: { requests: 100, windowMs: 60_000 },     // 100 per minute
  // Booking write limits - stricter to prevent abuse
  BOOKING_BY_IDENTIFIER: { requests: 3, windowMs: 15 * 60_000 },  // 3 per 15 minutes per identifier
  BOOKING_BY_IP: { requests: 5, windowMs: 10 * 60_000 },          // 5 per 10 minutes per IP
  CHAT: { requests: 10, windowMs: 60_000 },                       // 10 per minute (webchat messages)
} as const;

export const TIMEOUTS = {
  EXTERNAL_API: 30_000,  // 30 seconds
  DATABASE: 10_000,      // 10 seconds
} as const;

export const HEALTH_THRESHOLDS = {
  SILENCE_WARNING_HOURS: 4,
  SILENCE_CRITICAL_HOURS: 24,
  CONSECUTIVE_FAILURES: 3,
  STUCK_LEAD_HOURS: 24,
} as const;
