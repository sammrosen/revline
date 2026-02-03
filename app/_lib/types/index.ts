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

import { IntegrationType, HealthStatus, LeadStage, EventSystem, WorkspaceStatus, WorkspaceRole } from '@prisma/client';

// Re-export Prisma enums for convenience
export { IntegrationType, HealthStatus, LeadStage, EventSystem, WorkspaceStatus, WorkspaceRole };

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
 *   "primaryColor": "#8B2346",
 *   "logo": "https://example.com/logo.png",
 *   "fontFamily": "inter"
 * }
 */
export interface BrandingConfig {
  /** Primary brand color (hex format) */
  primaryColor?: string;
  /** Secondary/accent color (hex format) */
  secondaryColor?: string;
  /** Page background color (hex format) */
  backgroundColor?: string;
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
}

/**
 * Copy configuration for all templates
 * Each template type has its own copy schema
 */
export interface CopyConfig {
  /** Booking template copy */
  booking?: BookingCopyConfig;
}

/**
 * Feature flags for workspace
 */
export interface WorkspaceFeatures {
  /** Show "Powered by RevLine" footer (default: true) */
  showPoweredBy?: boolean;
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
 *     "primaryColor": "#8B2346",
 *     "logo": "https://example.com/logo.png"
 *   },
 *   "copy": {
 *     "booking": {
 *       "headline": "Schedule Your Session"
 *     }
 *   }
 * }
 */
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
  /** Copy configuration per template */
  copy?: CopyConfig;
  /** Feature flags */
  features?: WorkspaceFeatures;
}

/**
 * Resend integration metadata
 * Configuration for transactional email sending
 * 
 * @example
 * {
 *   "fromEmail": "bookings@yourdomain.com",
 *   "fromName": "Sports West",
 *   "replyTo": "support@yourdomain.com"
 * }
 */
export interface ResendMeta {
  /** Verified sender email address (required) */
  fromEmail: string;
  /** Display name for sender (e.g., "Sports West") */
  fromName?: string;
  /** Default reply-to address */
  replyTo?: string;
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
  | Record<string, unknown>;

/**
 * Type guard for MailerLite meta
 */
export function isMailerLiteMeta(meta: IntegrationMeta | null): meta is MailerLiteMeta {
  if (!meta) return false;
  return 'groups' in meta;
}

/**
 * Type guard for Stripe meta
 */
export function isStripeMeta(meta: IntegrationMeta | null): meta is StripeMeta {
  if (!meta) return false;
  return 'productMap' in meta || 'apiKey' in meta || Object.keys(meta).length === 0;
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
  stage: LeadStage;
  errorState: string | null;
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
  SUBSCRIBE: { requests: 10, windowMs: 60_000 },  // 10 per minute
  WEBHOOK: { requests: 100, windowMs: 60_000 },   // 100 per minute
  ADMIN: { requests: 100, windowMs: 60_000 },     // 100 per minute
  // Booking rate limits - stricter to prevent abuse
  BOOKING_BY_IDENTIFIER: { requests: 3, windowMs: 15 * 60_000 },  // 3 per 15 minutes per identifier
  BOOKING_BY_IP: { requests: 5, windowMs: 10 * 60_000 },          // 5 per 10 minutes per IP
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
