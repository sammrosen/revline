/**
 * ABC Ignite Integration Adapter
 * 
 * Handles ABC Ignite calendar/appointment booking operations.
 * Uses app_id and app_key header authentication.
 * 
 * Secret names:
 * - "App ID" - ABC Ignite app_id
 * - "App Key" - ABC Ignite app_key
 * 
 * API Base URL: https://api.abcfinancial.com/rest
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { AbcIgniteMeta, IntegrationResult } from '@/app/_lib/types';
import { resilientFetch, logStructured } from '@/app/_lib/reliability';

/** Secret names for ABC Ignite API */
export const ABC_IGNITE_APP_ID = 'App ID';
export const ABC_IGNITE_APP_KEY = 'App Key';

/** ABC Ignite API base URL */
const ABC_IGNITE_API_BASE = 'https://api.abcfinancial.com/rest';

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * ABC Ignite calendar event
 */
export interface AbcIgniteEvent {
  eventId: string;
  eventTypeId: string;
  eventName: string;
  category: string;
  isAvailableOnline: string;
  eventTimestamp: string;
  status: string;
  duration: number;
  allowCancelBefore: string;
  startBookingTime: string;
  stopBookingTime: string;
  maxAttendees: number;
  comments?: string;
  employeeId?: string;
  employeeName?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  createdTimestamp: string;
  modifiedTimestamp: string;
  locationId?: string;
  locationName?: string;
  earningsCode?: string;
  enrollAfterStartMinutes?: string;
  eventTrainingLevel?: AbcIgniteEventTrainingLevel;
  members?: AbcIgniteMember[];
  waitList?: AbcIgniteWaitList;
  onlineCancelation?: AbcIgniteOnlineCancelation;
  clubNumber: string;
  availableOnline?: string;
  waitListEmpty?: boolean;
}

/**
 * ABC Ignite event type (appointment category)
 */
export interface AbcIgniteEventType {
  eventTypeId: string;
  name: string;
  category?: string;
  isAvailableOnline?: string;
  description?: string;
  duration?: number;
  maxAttendees?: number;
  locationTypeId?: string;
  locationTypeName?: string;
  earningsCode?: string;
  eventTrainingLevels?: AbcIgniteEventTrainingLevel[];
  termsAndConditions?: string;
  isTrackAttendance?: boolean;
  isMemberRequiredToCreate?: boolean;
  isEmployeeRequiredToCreate?: boolean;
  isLocationRequiredToCreate?: boolean;
  waitListInfo?: AbcIgniteWaitListInfo;
  onlineCancelation?: AbcIgniteOnlineCancelation;
  onlineAllowBooking?: AbcIgniteOnlineAllowBooking;
  imageId?: string;
  timeBeforeStartToAllowEntry?: AbcIgniteTimeBeforeEvent;
  rebookingTimeOption?: string;
  customCategories?: AbcIgniteCustomCategory[];
  isVirtual?: boolean;
}

/**
 * ABC Ignite member personal info (nested in GET /members response)
 */
export interface AbcIgniteMemberPersonal {
  firstName?: string;
  lastName?: string;
  email?: string;
  primaryPhone?: string;
  mobilePhone?: string;
  barcode?: string;
  homeClub?: string;
  isActive?: string;
  memberStatus?: string;
  /** "Member" | "Prospect" */
  joinStatus?: string;
  /** "true" | "false" — whether this member was originally a prospect */
  isConvertedProspect?: string;
  birthDate?: string;
  gender?: string;
  /** ISO timestamp when the member record was created */
  createTimestamp?: string;
  /** ISO timestamp of the last modification (check-in, profile edit, conversion, etc.) */
  lastModifiedTimestamp?: string;
  /** ISO timestamp of the member's first check-in */
  firstCheckInTimestamp?: string;
  /** ISO timestamp of the member's most recent check-in */
  lastCheckInTimestamp?: string;
  /** Total number of check-ins as a string (e.g., "12") */
  totalCheckInCount?: string;
  /** "OK" or reason for status */
  memberStatusReason?: string;
  hasPhoto?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

/**
 * ABC Ignite member agreement info (nested in GET /members response)
 * Contains billing, membership type, and conversion details.
 */
export interface AbcIgniteMemberAgreement {
  agreementNumber?: string;
  isPrimaryMember?: string;
  /** Membership plan name (e.g., "Monthly Premier", "Prospect") */
  membershipType?: string;
  /** ABC internal code (e.g., "MONPRM", "PROSPECT") */
  membershipTypeAbcCode?: string;
  /** Payment plan name */
  paymentPlan?: string;
  paymentPlanId?: string;
  term?: string;
  paymentFrequency?: string;
  managedType?: string;
  isPastDue?: string;
  /** "None" | other renewal types */
  renewalType?: string;
  agreementPaymentMethod?: string;
  /** ISO date when the member's agreement "since" date was set */
  sinceDate?: string;
  /** ISO date when the agreement period begins */
  beginDate?: string;
  /** ISO date when the agreement was signed */
  signDate?: string;
  /** ISO date when a prospect was converted to a member — ONLY present for converted prospects */
  convertedDate?: string;
  /** Source of agreement entry (e.g., "Web", "DataTrak EAE", "Web Service") */
  agreementEntrySource?: string;
  agreementEntrySourceReportName?: string;
  /** Next billing date */
  nextBillingDate?: string;
  nextDueAmount?: string;
  pastDueBalance?: string;
  totalPastDueBalance?: string;
  /** Sales person info */
  salesPersonId?: string;
  salesPersonName?: string;
  /** Campaign info */
  campaignId?: string;
  campaignName?: string;
}

/**
 * ABC Ignite member
 * 
 * Supports two response formats:
 * - GET /members: Has nested `personal` and `agreement` objects with member details
 * - Event member context: Has flat fields directly on the object
 */
export interface AbcIgniteMember {
  memberId: string;
  // Nested personal info (from GET /members endpoint)
  personal?: AbcIgniteMemberPersonal;
  // Nested agreement info (from GET /members endpoint)
  agreement?: AbcIgniteMemberAgreement;
  // Flat fields for backwards compatibility (event member context)
  hasActiveRecurringService?: boolean;
  opportunityLevel?: string;
  lastUsed?: string;
  lastBookedDate?: string;
  attendedStatus?: string;
  firstName?: string;
  lastName?: string;
  barcode?: string;
  lastCheckinDate?: string;
  fundingType?: string;
  fundingReceiptNumber?: string;
  homeClub?: string;
}

/**
 * Training level for event types
 * Used in eventTrainingLevels array from /calendars/eventtypes
 */
export interface AbcIgniteEventTrainingLevel {
  levelId?: string;
  levelName?: string;
}

export interface AbcIgniteWaitList {
  members?: AbcIgniteMember[];
  maxSize?: number;
}

export interface AbcIgniteWaitListInfo {
  isWaitListEnabled?: boolean;
  maxWaitListSize?: number;
}

export interface AbcIgniteOnlineCancelation {
  allowOnlineCancelation?: boolean;
  hoursBeforeEventStart?: number;
}

export interface AbcIgniteOnlineAllowBooking {
  allowOnlineBooking?: boolean;
  hoursBeforeEventStart?: number;
}

export interface AbcIgniteTimeBeforeEvent {
  hours?: number;
  minutes?: number;
}

export interface AbcIgniteCustomCategory {
  categoryId?: string;
  name?: string;
}

/**
 * Enrollment request options
 */
export interface EnrollmentOptions {
  validateServiceRestriction?: boolean;
  allowUnfunded?: boolean;
}

/**
 * Result of enrollment operation
 */
export interface EnrollmentResult {
  success: boolean;
  eventId: string;
  memberId: string;
  message?: string;
}

/**
 * Result of waitlist operation
 */
export interface WaitlistResult {
  success: boolean;
  eventId: string;
  memberId: string;
  position?: number;
}

/**
 * Parameters for creating an appointment from availability
 */
export interface CreateAppointmentParams {
  employeeId: string;
  eventTypeId: string;
  levelId: string;
  startTime: string;  // Format: "YYYY-MM-DD HH:mm:ss"
  memberId: string;
}

/**
 * Result of appointment creation
 */
export interface CreateAppointmentResult {
  success: boolean;
  eventId?: string;
  message?: string;
}

/**
 * ABC API response status
 */
interface AbcApiStatus {
  message?: string;
  count?: string;
}

/**
 * Event types response
 * GET /{clubNumber}/calendars/eventtypes
 */
interface AbcEventTypesResponse {
  status?: AbcApiStatus;
  eventTypes?: AbcIgniteEventType[];
}

/**
 * Events response
 * GET /{clubNumber}/calendars/events
 */
interface AbcEventsResponse {
  status?: AbcApiStatus;
  events?: AbcIgniteEvent[];
}

/**
 * Members response
 * GET /{clubNumber}/members
 */
interface AbcMembersResponse {
  status?: AbcApiStatus;
  members?: AbcIgniteMember[];
}

// =============================================================================
// EMPLOYEE TYPES
// =============================================================================

/**
 * ABC Ignite employee personal info
 * From GET /employees response
 */
export interface AbcIgniteEmployeePersonal {
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  birthDate?: string;
  profile?: string;
}

/**
 * ABC Ignite employee employment info
 */
export interface AbcIgniteEmployeeEmployment {
  employeeStatus?: string;
  wage?: string;
  commissionLevel?: string;
  startDate?: string;
  terminationDate?: string;
  authorizedClubs?: { clubNumber?: string[] };
  departments?: { department?: string[] };
  trainingLevel?: string;
  earningsCode?: string;
}

/**
 * ABC Ignite employee assigned role
 */
export interface AbcIgniteEmployeeRole {
  roleId: string;
  roleName: string;
  roleDescription?: string;
}

/**
 * ABC Ignite employee
 * From GET /{clubNumber}/employees response
 */
export interface AbcIgniteEmployee {
  employeeId: string;
  barcode?: string;
  personal?: AbcIgniteEmployeePersonal;
  contact?: {
    email?: string;
    homePhone?: string;
    cellPhone?: string;
    workPhone?: string;
  };
  employment?: AbcIgniteEmployeeEmployment;
  assignedRoles?: AbcIgniteEmployeeRole[];
}

/**
 * Employees response
 * GET /{clubNumber}/employees
 */
interface AbcEmployeesResponse {
  status?: AbcApiStatus;
  employees?: AbcIgniteEmployee[];
}

/**
 * Time block within a day's availability
 * Represents a continuous period when the employee is available
 */
export interface AbcIgniteAvailabilityTimeBlock {
  /** Local time HH:MM format */
  startTime: string;
  /** Local time HH:MM format */
  endTime: string;
  /** UTC ISO datetime */
  utcStartDateTime: string;
  /** UTC ISO datetime */
  utcEndDateTime: string;
}

/**
 * Day availability containing time blocks
 */
export interface AbcIgniteAvailabilityDay {
  /** Date in MM/DD/YYYY format */
  date: string;
  /** Available time blocks for this day */
  times: AbcIgniteAvailabilityTimeBlock[];
}

/**
 * Availability response
 * GET /{clubNumber}/employees/{employeeId}/availability
 */
interface AbcAvailabilityResponse {
  status?: AbcApiStatus;
  request?: {
    clubNumber: string;
    employeeId: string;
    eventTypeId: string;
    levelId?: string;
    startDate: string;
    endDate: string;
  };
  availabilities?: AbcIgniteAvailabilityDay[];
}

/**
 * Flattened availability slot for booking UI
 * Created by splitting time blocks based on event duration
 */
export interface AbcIgniteAvailabilitySlot {
  /** UTC ISO datetime for slot start */
  startTime: string;
  /** UTC ISO datetime for slot end */
  endTime: string;
  /** Original date from API (MM/DD/YYYY) */
  date: string;
  /** Local start time (HH:MM) */
  localStartTime: string;
  /** Local end time (HH:MM) */
  localEndTime: string;
  /** Slot is available for booking */
  available: boolean;
}

/**
 * Date range filter for queries
 */
export interface DateRange {
  startDate: string;  // ISO format YYYY-MM-DD
  endDate: string;    // ISO format YYYY-MM-DD
}

/**
 * Event category for filtering
 */
export type EventCategory = 'appointment' | 'event';

// =============================================================================
// DETECTED MEMBER TYPE
// =============================================================================

/**
 * A member detected by getNewAndConvertedMembers() with a tag
 * indicating how it was detected (for debugging and audit).
 */
export interface DetectedMember extends AbcIgniteMember {
  /** Why this member was detected: new direct signup or converted from prospect */
  _detectionReason: 'new_direct_signup' | 'converted_prospect';
}

// =============================================================================
// TIMESTAMP HELPERS
// =============================================================================

/**
 * Format a Date to ABC Ignite timestamp format: "YYYY-MM-DD HH:mm:ss.000000"
 * Used for createdTimestampRange, lastModifiedTimestampRange, etc.
 */
export function formatAbcTimestamp(d: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000000`;
}

/**
 * Check if a date string (ISO "YYYY-MM-DD" or ABC timestamp) falls within a window.
 * Used to filter converted prospects by their agreement.convertedDate.
 * 
 * @param dateStr - Date string to check (e.g., "2026-01-12" or "2026-01-12 10:30:00")
 * @param since - Start of window (inclusive)
 * @param until - End of window (inclusive)
 */
export function isDateInWindow(dateStr: string, since: Date, until: Date): boolean {
  // Parse the date — handle both "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss.000000"
  // Truncate microseconds to milliseconds for JS Date compatibility
  let normalized = dateStr.replace(' ', 'T');
  // Convert "2026-01-12T10:30:00.000000" → "2026-01-12T10:30:00.000Z"
  normalized = normalized.replace(/\.(\d{3})\d*$/, '.$1Z');
  // If no timezone info and no trailing Z, assume UTC by appending Z
  if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('T')) {
    // Date-only, leave as-is for Date constructor
  } else if (!normalized.endsWith('Z') && normalized.includes('T') && !normalized.includes('+')) {
    normalized += 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return false;

  // For date-only strings (no time component), treat as start of day
  // and extend until end of that day for inclusive matching
  const isDateOnly = !dateStr.includes(':');
  const checkStart = d;
  const checkEnd = isDateOnly
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : d;

  // The date window overlaps with our sync window if:
  // checkEnd >= since AND checkStart <= until
  return checkEnd >= since && checkStart <= until;
}

// =============================================================================
// PAYLOAD NORMALIZATION
// =============================================================================

/**
 * Normalize an ABC Ignite member into a flat payload with consistent keys.
 * Used by the member sync cron to build workflow trigger payloads.
 * 
 * Keys are snake_case and designed to match common leadPropertySchema keys:
 * - personal.firstName  → first_name
 * - personal.lastName   → last_name
 * - personal.email      → email
 * - personal.primaryPhone → phone
 * - personal.barcode    → barcode
 * - personal.memberStatus → member_status
 * - personal.homeClub   → home_club
 * - personal.gender     → gender
 * - memberId            → member_id
 */
/**
 * Convert ALL CAPS or lowercase name to Title Case.
 * Handles hyphenated names (e.g., "MARY-JANE" → "Mary-Jane")
 * and multi-word names (e.g., "DE LA CRUZ" → "De La Cruz").
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(^|[\s-])(\w)/g, (_match, sep, char) => sep + char.toUpperCase());
}

export function normalizeMemberPayload(member: AbcIgniteMember): Record<string, string> {
  const p = member.personal;
  const a = member.agreement;
  const payload: Record<string, string> = {};

  // Email is the critical field — always include if available
  if (p?.email) payload.email = p.email;

  // Personal info — title case names (ABC returns ALL CAPS)
  if (p?.firstName) payload.first_name = titleCase(p.firstName);
  if (p?.lastName) payload.last_name = titleCase(p.lastName);
  if (p?.primaryPhone) payload.phone = p.primaryPhone;
  if (p?.barcode) payload.barcode = p.barcode;
  if (p?.memberStatus) payload.member_status = p.memberStatus;
  if (p?.homeClub) payload.home_club = p.homeClub;
  if (p?.gender) payload.gender = p.gender;

  // Join/conversion status
  if (p?.joinStatus) payload.join_status = p.joinStatus;
  if (p?.isConvertedProspect) payload.is_converted_prospect = p.isConvertedProspect;

  // Agreement info
  if (a?.membershipType) payload.membership_type = a.membershipType;
  if (a?.convertedDate) payload.converted_date = a.convertedDate;
  if (a?.agreementEntrySource) payload.agreement_entry_source = a.agreementEntrySource;

  // Top-level member ID
  if (member.memberId) payload.member_id = member.memberId;

  return payload;
}

// =============================================================================
// PAYMENT PLAN & AGREEMENT TYPES
// =============================================================================

/**
 * ABC payment plan from GET /{clubNumber}/clubs/plans
 */
export interface AbcPlan {
  paymentPlanId: string;
  name: string;
  description?: string;
  planType?: string;
  term?: string;
  paymentFrequency?: string;
  downPaymentAmount?: string;
  recurringPaymentAmount?: string;
  totalAmount?: string;
}

/**
 * ABC payment plan detail from GET /{clubNumber}/clubs/plans/{paymentPlanId}
 * Includes planValidationHash needed for agreement creation
 */
export interface AbcPlanDetail extends AbcPlan {
  planValidationHash: string;
  membershipType?: string;
  membershipTypeAbcCode?: string;
  renewalType?: string;
}

/**
 * Plans response from GET /{clubNumber}/clubs/plans
 */
interface AbcPlansResponse {
  status?: AbcApiStatus;
  plans?: AbcPlan[];
}

/**
 * Plan detail response from GET /{clubNumber}/clubs/plans/{paymentPlanId}
 */
interface AbcPlanDetailResponse {
  status?: AbcApiStatus;
  plan?: AbcPlanDetail;
}

/**
 * PayPage billing info for Create Agreement
 * Uses transaction IDs from PayPage iframe tokenization
 */
export interface AbcPayPageBillingInfo {
  /** PayPage transaction ID for recurring draft payments (credit card) */
  payPageDraftCreditCard?: string;
  /** PayPage transaction ID for recurring draft payments (bank account / EFT) */
  payPageDraftBankAccount?: string;
  /** PayPage transaction ID for due-today payment (credit card) */
  payPageDueTodayCreditCard?: string;
}

/**
 * Create Agreement request body
 * POST /{clubNumber}/members/agreements
 */
export interface AbcCreateAgreementRequest {
  agreementContactInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
  };
  agreementAddressInfo?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
  agreementSalesInfo: {
    paymentPlanId: string;
    planValidationHash: string;
    sendAgreementEmail?: string;
    beginDate?: string;
  };
  payPageBillingInfo: AbcPayPageBillingInfo;
}

/**
 * Create Agreement response
 * POST /{clubNumber}/members/agreements
 */
export interface AbcCreateAgreementResponse {
  status?: AbcApiStatus;
  agreementNumber?: string;
  memberId?: string;
  barcode?: string;
}

// =============================================================================
// ADAPTER CLASS
// =============================================================================

/**
 * ABC Ignite adapter for client-scoped calendar operations
 * 
 * @example
 * const adapter = await AbcIgniteAdapter.forClient(clientId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const events = await adapter.getEvents();
 * const result = await adapter.enrollMember(eventId, memberId);
 */
export class AbcIgniteAdapter extends BaseIntegrationAdapter<AbcIgniteMeta> {
  readonly type = IntegrationType.ABC_IGNITE;

  /**
   * Known API endpoints for testing UI
   * These are exposed in the Testing tab for quick access
   */
  static readonly knownEndpoints = [
    { method: 'GET', path: '/employees', description: 'List all employees' },
    { method: 'GET', path: '/members?barcode={barcode}', description: 'Lookup member by barcode' },
    { method: 'GET', path: '/members/{memberId}/scheduling/associatedevents/appointments', description: 'Get member appointments' },
    { method: 'GET', path: '/calendars/eventtypes', description: 'List event types' },
    { method: 'GET', path: '/calendars/eventtypes/{eventTypeId}/sessionbalances', description: 'Check session balance by event type' },
    { method: 'GET', path: '/members/{memberId}/services/purchasehistory?eventTypeId={eventTypeId}', description: 'Get member session balance for event type' },
    { method: 'GET', path: '/calendars/events', description: 'List calendar events' },
    { method: 'POST', path: '/calendars/events', description: 'Create booking' },
    { method: 'DELETE', path: '/calendars/events/{eventId}', description: 'Cancel booking' },
    { method: 'GET', path: '/employees/bookingavailability/{employeeId}?eventTypeId={eventTypeId}', description: 'Get employee availability' },
  ] as const;

  /**
   * Load ABC Ignite adapter for a workspace
   */
  static async forClient(workspaceId: string): Promise<AbcIgniteAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<AbcIgniteMeta>(
      workspaceId,
      IntegrationType.ABC_IGNITE
    );
    
    if (!data) {
      return null;
    }

    // Ensure secrets are configured
    if (data.secrets.length === 0) {
      console.warn('ABC Ignite integration has no secrets configured:', { workspaceId });
      return null;
    }
    
    // Ensure clubNumber is configured
    if (!data.meta?.clubNumber) {
      console.warn('ABC Ignite integration missing clubNumber in meta:', { workspaceId });
      return null;
    }
    
    return new AbcIgniteAdapter(workspaceId, data.secrets, data.meta);
  }

  /**
   * Get the club number from meta
   */
  getClubNumber(): string {
    if (!this.meta?.clubNumber) {
      throw new Error('ABC Ignite clubNumber not configured');
    }
    return this.meta.clubNumber;
  }

  /**
   * Get the default event type key from meta
   */
  getDefaultEventTypeId(): string | undefined {
    return this.meta?.defaultEventTypeId;
  }

  /**
   * Get the default employee key from meta
   */
  getDefaultEmployeeId(): string | undefined {
    return this.meta?.defaultEmployeeId;
  }

  /**
   * Get event type config by key
   * Returns the full config including ABC ID, name, duration, and levelId
   */
  getEventTypeConfig(key: string): { 
    id: string; 
    name: string; 
    category: 'Appointment' | 'Event';
    duration?: number; 
    levelId?: string;
  } | undefined {
    return this.meta?.eventTypes?.[key];
  }

  /**
   * Get the default event type config
   * Convenience method that combines getDefaultEventTypeId + getEventTypeConfig
   */
  getDefaultEventTypeConfig(): { 
    id: string; 
    name: string; 
    category: 'Appointment' | 'Event';
    duration?: number; 
    levelId?: string;
  } | undefined {
    const key = this.getDefaultEventTypeId();
    if (!key) return undefined;
    return this.getEventTypeConfig(key);
  }

  /**
   * Get all configured employees
   */
  getConfiguredEmployees(): Record<string, { id: string; name: string; title?: string }> {
    return this.meta?.employees || {};
  }

  /**
   * Get employee config by key
   * Returns the full config including ABC ID, name, and title
   */
  getEmployeeConfig(key: string): { id: string; name: string; title?: string } | undefined {
    return this.meta?.employees?.[key];
  }

  /**
   * Get the default employee config
   * Convenience method that combines getDefaultEmployeeId + getEmployeeConfig
   */
  getDefaultEmployeeConfig(): { id: string; name: string; title?: string } | undefined {
    const key = this.getDefaultEmployeeId();
    if (!key) return undefined;
    return this.getEmployeeConfig(key);
  }

  // ===========================================================================
  // API REQUEST HELPERS
  // ===========================================================================

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const appId = this.getSecret(ABC_IGNITE_APP_ID);
    const appKey = this.getSecret(ABC_IGNITE_APP_KEY);
    
    if (!appId || !appKey) {
      throw new Error('ABC Ignite app_id or app_key not configured');
    }

    return {
      'app_id': appId,
      'app_key': appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Make an authenticated API request with resilient retry logic
   * 
   * Uses resilientFetch for:
   * - Automatic retries on 5xx errors and network failures
   * - Exponential backoff with jitter
   * - Rate limit (429) handling with Retry-After support
   * - Per-request timeouts
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<IntegrationResult<T>> {
    const clubNumber = this.getClubNumber();
    const url = `${ABC_IGNITE_API_BASE}/${clubNumber}${endpoint}`;
    const correlationId = crypto.randomUUID();
    
    // Structured request log (no secrets, no PII)
    logStructured({
      correlationId,
      event: 'abc_api_request',
      workspaceId: this.workspaceId,
      metadata: { method, endpoint },
    });
    
    try {
      const headers = this.getAuthHeaders();
      
      const { response, attempts, totalTimeMs } = await resilientFetch(
        url,
        {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        },
        { timeout: 10000, deadline: 30000, retries: 3 }
      );

      // Handle non-OK responses (after retries exhausted)
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `ABC Ignite API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        // Structured error response log
        logStructured({
          correlationId,
          event: 'abc_api_response',
          workspaceId: this.workspaceId,
          error: errorMessage,
          metadata: {
            endpoint,
            status: response.status,
            success: false,
            duration_ms: totalTimeMs,
            attempts,
          },
        });
        
        // 5xx errors are retryable, 4xx are not
        const isRetryable = response.status >= 500;
        return this.error(errorMessage, isRetryable);
      }

      // Parse successful response
      const data = await response.json() as T;
      
      // Structured success response log (safe IDs only, no PII)
      logStructured({
        correlationId,
        event: 'abc_api_response',
        workspaceId: this.workspaceId,
        metadata: {
          endpoint,
          status: response.status,
          success: true,
          duration_ms: totalTimeMs,
          attempts,
          // Safe to log: IDs and counts only
          responseId: (data as Record<string, unknown>)?.eventId || (data as Record<string, unknown>)?.memberId,
          memberCount: Array.isArray((data as Record<string, unknown>)?.members) ? ((data as Record<string, unknown>).members as unknown[]).length : undefined,
          eventCount: Array.isArray((data as Record<string, unknown>)?.events) ? ((data as Record<string, unknown>).events as unknown[]).length : undefined,
          employeeCount: Array.isArray((data as Record<string, unknown>)?.employees) ? ((data as Record<string, unknown>).employees as unknown[]).length : undefined,
        },
      });
      
      await this.touch();
      return this.success(data);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Structured error log
      logStructured({
        correlationId,
        event: 'abc_api_error',
        workspaceId: this.workspaceId,
        error: message,
        metadata: { method, endpoint },
      });
      
      return this.error(message, true);
    }
  }

  /**
   * Raw API request for testing/debugging
   * Used by the Testing tab to make arbitrary API calls
   * 
   * Uses resilientFetch for automatic retries and rate limit handling.
   * 
   * @param method - HTTP method
   * @param endpoint - API endpoint path (without club number prefix)
   * @param body - Optional request body for POST/PUT
   * @returns Response with status, data, timing, and retry attempts
   */
  async rawRequest(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown; duration_ms: number; attempts: number; error?: string }> {
    const clubNumber = this.getClubNumber();
    const url = `${ABC_IGNITE_API_BASE}/${clubNumber}${endpoint}`;
    const correlationId = crypto.randomUUID();
    
    // Structured request log
    logStructured({
      correlationId,
      event: 'abc_raw_request',
      workspaceId: this.workspaceId,
      metadata: { method, endpoint },
    });
    
    try {
      const headers = this.getAuthHeaders();
      
      const { response, attempts, totalTimeMs } = await resilientFetch(
        url,
        {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        },
        { timeout: 10000, deadline: 30000, retries: 3 }
      );
      
      // Try to parse as JSON, fall back to text
      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Structured response log
      logStructured({
        correlationId,
        event: 'abc_raw_response',
        workspaceId: this.workspaceId,
        metadata: {
          endpoint,
          status: response.status,
          success: response.ok,
          duration_ms: totalTimeMs,
          attempts,
        },
      });
      
      if (!response.ok) {
        return {
          status: response.status,
          data,
          duration_ms: totalTimeMs,
          attempts,
          error: typeof data === 'string' ? data : (data as Record<string, unknown>)?.message as string || `HTTP ${response.status}`,
        };
      }
      
      await this.touch();
      return { status: response.status, data, duration_ms: totalTimeMs, attempts };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      logStructured({
        correlationId,
        event: 'abc_raw_error',
        workspaceId: this.workspaceId,
        error: message,
        metadata: { method, endpoint },
      });
      
      return {
        status: 0,
        data: null,
        duration_ms: 0,
        attempts: 0,
        error: message,
      };
    }
  }

  // ===========================================================================
  // MEMBER OPERATIONS
  // ===========================================================================

  /**
   * Get members with optional filters
   * GET /{clubNumber}/members
   * 
   * @param options - Filter options (barcode, activeStatus, etc.)
   */
  async getMembers(options?: {
    barcode?: string;
    activeStatus?: 'active' | 'inactive' | 'all';
    memberStatus?: string;
    joinStatus?: 'member' | 'prospect' | 'all';
    memberId?: string;
    /** Date range filter: "YYYY-MM-DD HH:mm:ss.000000,YYYY-MM-DD HH:mm:ss.000000" */
    createdTimestampRange?: string;
    /** Date range filter: "YYYY-MM-DD HH:mm:ss.000000,YYYY-MM-DD HH:mm:ss.000000" */
    memberSinceDateRange?: string;
    /** Date range filter on lastModifiedTimestamp: "YYYY-MM-DD HH:mm:ss.000000,YYYY-MM-DD HH:mm:ss.000000" */
    lastModifiedTimestampRange?: string;
    /** Page number (1-based, defaults to 1) */
    page?: number;
    /** Page size */
    size?: number;
  }): Promise<IntegrationResult<AbcIgniteMember[]>> {
    const params = new URLSearchParams();
    
    if (options?.barcode) {
      params.append('barcode', options.barcode);
    }
    if (options?.activeStatus) {
      params.append('activeStatus', options.activeStatus);
    }
    if (options?.memberStatus) {
      params.append('memberStatus', options.memberStatus);
    }
    if (options?.joinStatus) {
      params.append('joinStatus', options.joinStatus);
    }
    if (options?.memberId) {
      params.append('memberId', options.memberId);
    }
    if (options?.createdTimestampRange) {
      params.append('createdTimestampRange', options.createdTimestampRange);
    }
    if (options?.memberSinceDateRange) {
      params.append('memberSinceDateRange', options.memberSinceDateRange);
    }
    if (options?.lastModifiedTimestampRange) {
      params.append('lastModifiedTimestampRange', options.lastModifiedTimestampRange);
    }
    if (options?.page !== undefined) {
      params.append('page', String(options.page));
    }
    if (options?.size !== undefined) {
      params.append('size', String(options.size));
    }

    const queryString = params.toString();
    const endpoint = `/members${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.apiRequest<AbcMembersResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteMember[]>;
    }

    return this.success(result.data?.members || []);
  }

  /**
   * Paginate through a getMembers query, collecting all pages.
   * Shared helper for getNewMembers and getNewAndConvertedMembers.
   * 
   * @param baseOptions - Query options (without page/size)
   * @returns All members across pages
   */
  private async getMembersPaginated(
    baseOptions: Parameters<typeof this.getMembers>[0]
  ): Promise<IntegrationResult<AbcIgniteMember[]>> {
    const allMembers: AbcIgniteMember[] = [];
    const PAGE_SIZE = 50;
    let page = 1;

    while (true) {
      const result = await this.getMembers({
        ...baseOptions,
        page,
        size: PAGE_SIZE,
      });

      if (!result.success) {
        if (page === 1) return result;
        break;
      }

      const members = result.data || [];
      allMembers.push(...members);

      if (members.length < PAGE_SIZE) break;
      page++;
      if (page > 100) break;
    }

    return this.success(allMembers);
  }

  /**
   * Get new members created within the last N minutes.
   * Handles pagination automatically — fetches all pages.
   * 
   * @deprecated Use getNewAndConvertedMembers() which also catches prospect-to-member conversions
   * @param sinceMinutes - How many minutes back to query (e.g., 75 for hourly with overlap)
   * @returns All members created in the time window
   */
  async getNewMembers(sinceMinutes: number): Promise<IntegrationResult<AbcIgniteMember[]>> {
    const now = new Date();
    const since = new Date(now.getTime() - sinceMinutes * 60 * 1000);
    const range = `${formatAbcTimestamp(since)},${formatAbcTimestamp(now)}`;

    return this.getMembersPaginated({ createdTimestampRange: range });
  }

  /**
   * Detect new members using two strategies:
   * 
   * 1. **New direct signups**: Members created as `joinStatus=member` in the window.
   *    These are people who signed up and immediately became members (no prospect phase).
   * 
   * 2. **Converted prospects**: Members modified in the window who have
   *    `isConvertedProspect === "true"` AND `agreement.convertedDate` falls within
   *    the sync window. This catches prospects who were converted to members by staff.
   * 
   * Both queries run in parallel. Results are merged and deduplicated by `memberId`.
   * 
   * @param since - Start of the detection window
   * @param until - End of the detection window (defaults to now)
   * @returns Detected members with a `_detectionReason` tag on each
   */
  async getNewAndConvertedMembers(
    since: Date,
    until?: Date
  ): Promise<IntegrationResult<DetectedMember[]>> {
    const now = until || new Date();
    const range = `${formatAbcTimestamp(since)},${formatAbcTimestamp(now)}`;

    // Run both queries in parallel
    const [directResult, modifiedResult] = await Promise.all([
      // Query 1: New direct member signups
      this.getMembersPaginated({
        joinStatus: 'member',
        createdTimestampRange: range,
      }),
      // Query 2: Recently modified members (for conversion detection)
      this.getMembersPaginated({
        joinStatus: 'member',
        lastModifiedTimestampRange: range,
      }),
    ]);

    // Collect direct signups
    const detected = new Map<string, DetectedMember>();

    if (directResult.success && directResult.data) {
      for (const member of directResult.data) {
        detected.set(member.memberId, {
          ...member,
          _detectionReason: 'new_direct_signup',
        });
      }
    }

    // Filter modified members for actual conversions
    if (modifiedResult.success && modifiedResult.data) {
      for (const member of modifiedResult.data) {
        // Skip if already captured by Query 1
        if (detected.has(member.memberId)) continue;

        // Only keep genuine conversions: must be a converted prospect
        // with a convertedDate inside our sync window
        if (
          member.personal?.isConvertedProspect === 'true' &&
          member.agreement?.convertedDate &&
          isDateInWindow(member.agreement.convertedDate, since, now)
        ) {
          detected.set(member.memberId, {
            ...member,
            _detectionReason: 'converted_prospect',
          });
        }
      }
    }

    // If both queries failed, return the first error
    if (!directResult.success && !modifiedResult.success) {
      return {
        success: false,
        error: directResult.error || modifiedResult.error,
        retryable: directResult.retryable || modifiedResult.retryable,
      };
    }

    return this.success(Array.from(detected.values()));
  }

  /**
   * Get a single member by barcode
   * GET /{clubNumber}/members?barcode={barcode}
   * 
   * Convenience method for member lookup flow.
   * Returns null if member not found.
   */
  async getMemberByBarcode(barcode: string): Promise<IntegrationResult<AbcIgniteMember | null>> {
    const result = await this.getMembers({ barcode });
    
    if (!result.success) {
      // Propagate error without the data field
      return { success: false, error: result.error, retryable: result.retryable };
    }

    const members = result.data || [];
    if (members.length === 0) {
      return this.success(null);
    }

    return this.success(members[0]);
  }

  /**
   * Get a member's upcoming events/appointments
   * GET /{clubNumber}/members/{memberId}/scheduling/associatedevents/appointments
   */
  async getMemberEvents(memberId: string): Promise<IntegrationResult<AbcIgniteEvent[]>> {
    const result = await this.apiRequest<{ status?: AbcApiStatus; associatedEvents?: AbcIgniteEvent[] }>(
      'GET',
      `/members/${memberId}/scheduling/associatedevents/appointments`
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEvent[]>;
    }

    return this.success(result.data?.associatedEvents || []);
  }

  // ===========================================================================
  // CALENDAR OPERATIONS
  // ===========================================================================

  /**
   * Get available calendar events
   * GET /{clubNumber}/calendars/events
   * 
   * @param options - Filter options including category for appointments vs classes
   */
  async getEvents(options?: {
    eventTypeId?: string;
    startDate?: string;
    endDate?: string;
    isAvailableOnline?: boolean;
    eventCategory?: EventCategory;
  }): Promise<IntegrationResult<AbcIgniteEvent[]>> {
    const params = new URLSearchParams();
    
    if (options?.eventTypeId) {
      params.append('eventTypeId', options.eventTypeId);
    }
    if (options?.startDate) {
      params.append('startDate', options.startDate);
    }
    if (options?.endDate) {
      params.append('endDate', options.endDate);
    }
    if (options?.isAvailableOnline !== undefined) {
      params.append('isAvailableOnline', String(options.isAvailableOnline));
    }
    if (options?.eventCategory) {
      params.append('eventCategory', options.eventCategory);
    }

    const queryString = params.toString();
    const endpoint = `/calendars/events${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.apiRequest<AbcEventsResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEvent[]>;
    }

    return this.success(result.data?.events || []);
  }

  /**
   * Get a single calendar event by ID
   * GET /{clubNumber}/calendars/events/{eventId}
   */
  async getEvent(eventId: string): Promise<IntegrationResult<AbcIgniteEvent>> {
    return this.apiRequest<AbcIgniteEvent>('GET', `/calendars/events/${eventId}`);
  }

  /**
   * Get event types (appointment categories or class types)
   * GET /{clubNumber}/calendars/eventtypes
   * 
   * @param options - Filter options (category, isAvailableOnline)
   */
  async getEventTypes(options?: {
    eventCategory?: EventCategory;
    isAvailableOnline?: boolean;
  }): Promise<IntegrationResult<AbcIgniteEventType[]>> {
    const params = new URLSearchParams();
    
    // Use category from options or fall back to config default
    const category = options?.eventCategory || this.meta?.defaultEventCategory;
    if (category) {
      params.append('eventCategory', category);
    }
    if (options?.isAvailableOnline !== undefined) {
      params.append('isAvailableOnline', String(options.isAvailableOnline));
    }

    const queryString = params.toString();
    const endpoint = `/calendars/eventtypes${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.apiRequest<AbcEventTypesResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEventType[]>;
    }

    return this.success(result.data?.eventTypes || []);
  }

  /**
   * Get a single event type by ID
   * GET /{clubNumber}/calendars/eventtypes/{eventTypeId}
   */
  async getEventType(eventTypeId: string): Promise<IntegrationResult<AbcIgniteEventType>> {
    return this.apiRequest<AbcIgniteEventType>('GET', `/calendars/eventtypes/${eventTypeId}`);
  }

  // ===========================================================================
  // EMPLOYEE OPERATIONS
  // ===========================================================================

  /**
   * Get employees from ABC Ignite
   * GET /{clubNumber}/employees
   * 
   * Used to sync employee list for configuration.
   * 
   * @param options - Optional filter options
   * @returns Array of employees with personal info and roles
   */
  async getEmployees(options?: {
    employeeStatus?: string;
    departmentOnline?: string;
    eventTypeId?: string;
    levelId?: string;
  }): Promise<IntegrationResult<AbcIgniteEmployee[]>> {
    const params = new URLSearchParams();
    
    if (options?.employeeStatus) {
      params.append('employeeStatus', options.employeeStatus);
    }
    if (options?.departmentOnline) {
      params.append('departmentOnline', options.departmentOnline);
    }
    if (options?.eventTypeId) {
      params.append('eventTypeId', options.eventTypeId);
    }
    if (options?.levelId) {
      params.append('levelId', options.levelId);
    }

    const queryString = params.toString();
    const endpoint = `/employees${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.apiRequest<AbcEmployeesResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEmployee[]>;
    }

    return this.success(result.data?.employees || []);
  }

  // ===========================================================================
  // AVAILABILITY & SESSION BALANCE
  // ===========================================================================

  /**
   * Get employee availability for a specific event type
   * GET /{clubNumber}/employees/bookingavailability/{employeeId}
   * 
   * Returns raw availability days with time blocks. The provider is responsible
   * for splitting time blocks into bookable slots based on event duration.
   * 
   * @param employeeId - The employee/trainer ID
   * @param eventTypeId - The event type to check availability for
   * @param dateRange - Optional date range filter (format: MM/DD/YYYY)
   * @param levelId - Optional training level ID
   */
  async getEmployeeAvailability(
    employeeId: string,
    eventTypeId: string,
    dateRange?: DateRange,
    levelId?: string
  ): Promise<IntegrationResult<AbcIgniteAvailabilityDay[]>> {
    const params = new URLSearchParams();
    params.append('eventTypeId', eventTypeId);
    
    if (dateRange?.startDate) {
      // Convert ISO date to MM/DD/YYYY format expected by ABC API
      params.append('startDate', this.formatDateForApi(dateRange.startDate));
    }
    if (dateRange?.endDate) {
      params.append('endDate', this.formatDateForApi(dateRange.endDate));
    }
    if (levelId) {
      params.append('levelId', levelId);
    }

    const queryString = params.toString();
    const endpoint = `/employees/bookingavailability/${employeeId}?${queryString}`;
    
    const result = await this.apiRequest<AbcAvailabilityResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteAvailabilityDay[]>;
    }

    return this.success(result.data?.availabilities || []);
  }

  /**
   * Format date for ABC API (MM/DD/YYYY)
   * Accepts ISO format (YYYY-MM-DD) or already formatted dates
   */
  private formatDateForApi(date: string): string {
    // If already in MM/DD/YYYY format, return as-is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return date;
    }
    // Convert from ISO (YYYY-MM-DD) to MM/DD/YYYY
    const [year, month, day] = date.split('-');
    if (year && month && day) {
      return `${month}/${day}/${year}`;
    }
    // Fallback - return as-is
    return date;
  }

  // NOTE: Session balance check requires /session-balance endpoint
  // which may not be activated. Use getSessionBalances() when available.

  // ===========================================================================
  // ENROLLMENT OPERATIONS
  // ===========================================================================

  /**
   * Enroll a member in an event (book appointment or class)
   * POST /{clubNumber}/calendars/events/{eventId}/members/{memberId}
   * 
   * Supports both direct memberId or barcode lookup.
   * 
   * @param eventId - The event to enroll in
   * @param memberIdentifier - Either memberId directly or barcode for lookup
   * @param options - Optional enrollment parameters
   */
  async enrollMember(
    eventId: string,
    memberIdentifier: string | { barcode: string },
    options?: EnrollmentOptions
  ): Promise<IntegrationResult<EnrollmentResult>> {
    // Resolve memberId if barcode was provided
    let memberId: string;
    
    if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
      const memberResult = await this.getMemberByBarcode(memberIdentifier.barcode);
      if (!memberResult.success) {
        return {
          success: false,
          error: `Failed to lookup member by barcode: ${memberResult.error}`,
          data: {
            success: false,
            eventId,
            memberId: '',
            message: memberResult.error,
          },
        };
      }
      if (!memberResult.data) {
        return {
          success: false,
          error: `Member not found with barcode: ${memberIdentifier.barcode}`,
          data: {
            success: false,
            eventId,
            memberId: '',
            message: 'Member not found',
          },
        };
      }
      memberId = memberResult.data.memberId;
    } else {
      memberId = memberIdentifier;
    }

    const body: Record<string, unknown> = {
      clubNumber: this.getClubNumber(),
      eventId,
      memberId,
    };

    if (options?.validateServiceRestriction !== undefined) {
      body.validateServiceRestriction = options.validateServiceRestriction;
    }
    if (options?.allowUnfunded !== undefined) {
      body.allowUnfunded = options.allowUnfunded;
    }

    const result = await this.apiRequest<unknown>(
      'POST',
      `/calendars/events/${eventId}/members/${memberId}`,
      body
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: {
          success: false,
          eventId,
          memberId,
          message: result.error,
        },
      };
    }

    return this.success({
      success: true,
      eventId,
      memberId,
      message: 'Successfully enrolled member in event',
    });
  }

  /**
   * Create an appointment from availability
   * POST /{clubNumber}/calendars/events
   * 
   * Used to book an appointment when selecting from employee availability.
   * Unlike enrollMember which adds to an existing event, this creates a new appointment.
   * 
   * ABC Response format:
   * {
   *   "status": { "message": "success", ... },
   *   "result": {
   *     "links": [{ "rel": "events", "href": "/rest/7715/calendars/events/{eventId}" }]
   *   }
   * }
   * 
   * @param params - Appointment creation parameters
   */
  async createAppointment(
    params: CreateAppointmentParams
  ): Promise<IntegrationResult<CreateAppointmentResult>> {
    // ABC returns eventId in result.links[0].href, not as a top-level field
    interface CreateAppointmentResponse {
      status?: AbcApiStatus;
      result?: {
        links?: Array<{ rel: string; href: string }>;
      };
    }

    const result = await this.apiRequest<CreateAppointmentResponse>(
      'POST',
      '/calendars/events',
      {
        employeeId: params.employeeId,
        eventTypeId: params.eventTypeId,
        levelId: params.levelId,
        startTime: params.startTime,
        memberId: params.memberId,
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: { success: false, message: result.error },
      };
    }

    // Check for "soft failure" - ABC returns 200 but with error in status.message
    // Success responses have count >= 1 and result.links
    const status = result.data?.status;
    if (status && status.count === '0') {
      const errorMessage = status.message || 'Failed to create appointment';
      console.error('ABC createAppointment soft failure:', {
        workspaceId: this.workspaceId,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
        data: { success: false, message: errorMessage },
      };
    }

    // Extract eventId from href like "/rest/7715/calendars/events/e8a60ab5..."
    const eventLink = result.data?.result?.links?.find(l => l.rel === 'events');
    const eventId = eventLink?.href?.split('/').pop();

    return this.success({
      success: true,
      eventId,
      message: 'Appointment created successfully',
    });
  }

  /**
   * Unenroll a member from an event (cancel appointment or class booking)
   * DELETE /{clubNumber}/calendars/events/{eventId}/members/{memberId}
   * 
   * Supports both direct memberId or barcode lookup.
   */
  async unenrollMember(
    eventId: string,
    memberIdentifier: string | { barcode: string }
  ): Promise<IntegrationResult<EnrollmentResult>> {
    // Resolve memberId if barcode was provided
    let memberId: string;
    
    if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
      const memberResult = await this.getMemberByBarcode(memberIdentifier.barcode);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: `Failed to lookup member: ${memberResult.error || 'Not found'}`,
          data: {
            success: false,
            eventId,
            memberId: '',
            message: memberResult.error || 'Member not found',
          },
        };
      }
      memberId = memberResult.data.memberId;
    } else {
      memberId = memberIdentifier;
    }

    const result = await this.apiRequest<unknown>(
      'DELETE',
      `/calendars/events/${eventId}/members/${memberId}`
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: {
          success: false,
          eventId,
          memberId,
          message: result.error,
        },
      };
    }

    return this.success({
      success: true,
      eventId,
      memberId,
      message: 'Successfully unenrolled member from event',
    });
  }

  // ===========================================================================
  // WAITLIST OPERATIONS
  // ===========================================================================

  /**
   * Add a member to event waitlist
   * POST /{clubNumber}/calendars/events/{eventId}/waitlist/members/{memberId}
   * 
   * Supports both direct memberId or barcode lookup.
   */
  async addToWaitlist(
    eventId: string,
    memberIdentifier: string | { barcode: string }
  ): Promise<IntegrationResult<WaitlistResult>> {
    // Resolve memberId if barcode was provided
    let memberId: string;
    
    if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
      const memberResult = await this.getMemberByBarcode(memberIdentifier.barcode);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: `Failed to lookup member: ${memberResult.error || 'Not found'}`,
          data: { success: false, eventId, memberId: '' },
        };
      }
      memberId = memberResult.data.memberId;
    } else {
      memberId = memberIdentifier;
    }

    const result = await this.apiRequest<unknown>(
      'POST',
      `/calendars/events/${eventId}/waitlist/members/${memberId}`
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: {
          success: false,
          eventId,
          memberId,
        },
      };
    }

    return this.success({
      success: true,
      eventId,
      memberId,
    });
  }

  /**
   * Remove a member from event waitlist
   * DELETE /{clubNumber}/calendars/events/{eventId}/waitlist/members/{memberId}
   * 
   * Supports both direct memberId or barcode lookup.
   */
  async removeFromWaitlist(
    eventId: string,
    memberIdentifier: string | { barcode: string }
  ): Promise<IntegrationResult<WaitlistResult>> {
    // Resolve memberId if barcode was provided
    let memberId: string;
    
    if (typeof memberIdentifier === 'object' && 'barcode' in memberIdentifier) {
      const memberResult = await this.getMemberByBarcode(memberIdentifier.barcode);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: `Failed to lookup member: ${memberResult.error || 'Not found'}`,
          data: { success: false, eventId, memberId: '' },
        };
      }
      memberId = memberResult.data.memberId;
    } else {
      memberId = memberIdentifier;
    }

    const result = await this.apiRequest<unknown>(
      'DELETE',
      `/calendars/events/${eventId}/waitlist/members/${memberId}`
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        data: {
          success: false,
          eventId,
          memberId,
        },
      };
    }

    return this.success({
      success: true,
      eventId,
      memberId,
    });
  }

  // ===========================================================================
  // CONFIGURATION VALIDATION
  // ===========================================================================

  /**
   * Check if the integration is properly configured
   */
  isConfigured(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.hasSecret(ABC_IGNITE_APP_ID)) {
      missing.push('App ID');
    }
    if (!this.hasSecret(ABC_IGNITE_APP_KEY)) {
      missing.push('App Key');
    }
    if (!this.meta?.clubNumber) {
      missing.push('Club Number (meta)');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ===========================================================================
  // PAYMENT PLAN & AGREEMENT METHODS
  // ===========================================================================

  /**
   * Get the configured PayPage Service ID
   */
  getPpsId(): string | null {
    return this.meta?.ppsId ?? null;
  }

  /**
   * Whether ABC should send an agreement email to the new member (default true)
   */
  getSendAgreementEmail(): boolean {
    return this.meta?.sendAgreementEmail !== false;
  }

  /**
   * Fetch available payment plans from ABC
   * GET /{clubNumber}/clubs/plans
   */
  async getPlans(): Promise<IntegrationResult<AbcPlan[]>> {
    const result = await this.apiRequest<AbcPlansResponse>('GET', '/clubs/plans');
    if (!result.success) return result as IntegrationResult<AbcPlan[]>;

    const plans = result.data?.plans ?? [];
    return this.success(plans);
  }

  /**
   * Fetch payment plan details including planValidationHash
   * GET /{clubNumber}/clubs/plans/{paymentPlanId}
   */
  async getPlanDetails(paymentPlanId: string): Promise<IntegrationResult<AbcPlanDetail>> {
    const result = await this.apiRequest<AbcPlanDetailResponse>(
      'GET',
      `/clubs/plans/${encodeURIComponent(paymentPlanId)}`
    );
    if (!result.success) return result as IntegrationResult<AbcPlanDetail>;

    const plan = result.data?.plan;
    if (!plan) {
      return {
        success: false,
        error: `Payment plan ${paymentPlanId} not found`,
      };
    }
    return this.success(plan);
  }

  /**
   * Create a membership agreement via ABC's Create Agreement API
   * POST /{clubNumber}/members/agreements
   *
   * Uses PayPage transaction IDs for payment — card/bank numbers never touch our servers.
   */
  async createAgreement(
    request: AbcCreateAgreementRequest
  ): Promise<IntegrationResult<AbcCreateAgreementResponse>> {
    const result = await this.apiRequest<AbcCreateAgreementResponse>(
      'POST',
      '/members/agreements',
      request
    );
    return result;
  }

  /**
   * Validate the meta configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.meta?.clubNumber) {
      errors.push('clubNumber is required in meta');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test the connection by fetching event types
   */
  async testConnection(): Promise<IntegrationResult<{ message: string }>> {
    const result = await this.getEventTypes();
    
    if (!result.success) {
      return {
        success: false,
        error: `Connection test failed: ${result.error}`,
      };
    }

    return this.success({
      message: `Connected successfully. Found ${result.data?.length || 0} event types.`,
    });
  }
}
