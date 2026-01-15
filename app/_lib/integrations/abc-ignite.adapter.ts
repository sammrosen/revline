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
 * ABC Ignite member in event context
 */
export interface AbcIgniteMember {
  memberId: string;
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
 * Supporting types
 */
export interface AbcIgniteEventTrainingLevel {
  eventTrainingLevelId?: string;
  name?: string;
  description?: string;
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

/**
 * Availability response
 * GET /{clubNumber}/employees/{employeeId}/availability
 */
interface AbcAvailabilityResponse {
  status?: AbcApiStatus;
  availability?: AbcIgniteAvailabilitySlot[];
}

/**
 * Availability slot for employee/event booking
 */
export interface AbcIgniteAvailabilitySlot {
  startTime: string;
  endTime: string;
  employeeId?: string;
  employeeName?: string;
  eventTypeId?: string;
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
   * Load ABC Ignite adapter for a client
   */
  static async forClient(clientId: string): Promise<AbcIgniteAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<AbcIgniteMeta>(
      clientId,
      IntegrationType.ABC_IGNITE
    );
    
    if (!data) {
      return null;
    }

    // Ensure secrets are configured
    if (data.secrets.length === 0) {
      console.warn('ABC Ignite integration has no secrets configured:', { clientId });
      return null;
    }
    
    // Ensure clubNumber is configured
    if (!data.meta?.clubNumber) {
      console.warn('ABC Ignite integration missing clubNumber in meta:', { clientId });
      return null;
    }
    
    return new AbcIgniteAdapter(clientId, data.secrets, data.meta);
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
   * Get the default event type ID from meta (optional)
   */
  getDefaultEventTypeId(): string | undefined {
    return this.meta?.defaultEventTypeId;
  }

  /**
   * Get the default employee/trainer ID from meta (optional)
   */
  getDefaultEmployeeId(): string | undefined {
    return this.meta?.defaultEmployeeId;
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
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<IntegrationResult<T>> {
    const clubNumber = this.getClubNumber();
    const url = `${ABC_IGNITE_API_BASE}/${clubNumber}${endpoint}`;
    
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle non-OK responses
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
        
        // 5xx errors are retryable, 4xx are not
        const isRetryable = response.status >= 500;
        return this.error(errorMessage, isRetryable);
      }

      // Parse successful response
      const data = await response.json() as T;
      await this.touch();
      return this.success(data);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('ABC Ignite API error:', {
        clientId: this.clientId,
        method,
        endpoint,
        error: message,
      });
      return this.error(message, true);
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
   * GET /{clubNumber}/members/{memberId}/appointments
   */
  async getMemberEvents(memberId: string): Promise<IntegrationResult<AbcIgniteEvent[]>> {
    // Response likely has "appointments" key
    const result = await this.apiRequest<{ status?: AbcApiStatus; appointments?: AbcIgniteEvent[] }>(
      'GET',
      `/members/${memberId}/appointments`
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEvent[]>;
    }

    return this.success(result.data?.appointments || []);
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
  // AVAILABILITY & SESSION BALANCE
  // ===========================================================================

  /**
   * Get employee availability for a specific event type
   * GET /{clubNumber}/employees/{employeeId}/availability
   * 
   * @param employeeId - The employee/trainer ID
   * @param eventTypeId - The event type to check availability for
   * @param dateRange - Optional date range filter
   */
  async getEmployeeAvailability(
    employeeId: string,
    eventTypeId: string,
    dateRange?: DateRange
  ): Promise<IntegrationResult<AbcIgniteAvailabilitySlot[]>> {
    const params = new URLSearchParams();
    params.append('eventTypeId', eventTypeId);
    
    if (dateRange?.startDate) {
      params.append('startDate', dateRange.startDate);
    }
    if (dateRange?.endDate) {
      params.append('endDate', dateRange.endDate);
    }

    const queryString = params.toString();
    const endpoint = `/employees/${employeeId}/availability?${queryString}`;
    
    const result = await this.apiRequest<AbcAvailabilityResponse>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteAvailabilitySlot[]>;
    }

    return this.success(result.data?.availability || []);
  }

  // NOTE: getAvailableEmployees and getSessionBalance/canEnroll removed
  // These require endpoints not currently activated:
  // - /calendars/events/{id}/availableemployees
  // - /session-balance
  // Re-add when those endpoints are activated in ABC Ignite

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
