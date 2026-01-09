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
 * API list response wrapper
 */
export interface AbcIgniteListResponse<T> {
  status?: string;
  results?: T[];
  pagingStatus?: {
    totalCount?: number;
    pageSize?: number;
    pageNumber?: number;
  };
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
  // CALENDAR OPERATIONS
  // ===========================================================================

  /**
   * Get available calendar events
   * GET /{clubNumber}/calendars/events
   * 
   * @param options - Filter options
   */
  async getEvents(options?: {
    eventTypeId?: string;
    startDate?: string;
    endDate?: string;
    isAvailableOnline?: boolean;
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

    const queryString = params.toString();
    const endpoint = `/calendars/events${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.apiRequest<AbcIgniteListResponse<AbcIgniteEvent>>(
      'GET',
      endpoint
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEvent[]>;
    }

    return this.success(result.data?.results || []);
  }

  /**
   * Get a single calendar event by ID
   * GET /{clubNumber}/calendars/events/{eventId}
   */
  async getEvent(eventId: string): Promise<IntegrationResult<AbcIgniteEvent>> {
    return this.apiRequest<AbcIgniteEvent>('GET', `/calendars/events/${eventId}`);
  }

  /**
   * Get event types (appointment categories)
   * GET /{clubNumber}/calendars/eventtypes
   */
  async getEventTypes(): Promise<IntegrationResult<AbcIgniteEventType[]>> {
    const result = await this.apiRequest<AbcIgniteListResponse<AbcIgniteEventType>>(
      'GET',
      '/calendars/eventtypes'
    );

    if (!result.success) {
      return result as IntegrationResult<AbcIgniteEventType[]>;
    }

    return this.success(result.data?.results || []);
  }

  /**
   * Get a single event type by ID
   * GET /{clubNumber}/calendars/eventtypes/{eventTypeId}
   */
  async getEventType(eventTypeId: string): Promise<IntegrationResult<AbcIgniteEventType>> {
    return this.apiRequest<AbcIgniteEventType>('GET', `/calendars/eventtypes/${eventTypeId}`);
  }

  // ===========================================================================
  // ENROLLMENT OPERATIONS
  // ===========================================================================

  /**
   * Enroll a member in an event (book appointment)
   * POST /{clubNumber}/calendars/secured/events/{eventId}/members/{memberId}
   * 
   * @param eventId - The event to enroll in
   * @param memberId - The member to enroll
   * @param options - Optional enrollment parameters
   */
  async enrollMember(
    eventId: string,
    memberId: string,
    options?: EnrollmentOptions
  ): Promise<IntegrationResult<EnrollmentResult>> {
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
      `/calendars/secured/events/${eventId}/members/${memberId}`,
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
   * Unenroll a member from an event (cancel appointment)
   * DELETE /{clubNumber}/calendars/secured/events/{eventId}/members/{memberId}
   */
  async unenrollMember(
    eventId: string,
    memberId: string
  ): Promise<IntegrationResult<EnrollmentResult>> {
    const result = await this.apiRequest<unknown>(
      'DELETE',
      `/calendars/secured/events/${eventId}/members/${memberId}`
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
   * POST /{clubNumber}/calendars/secured/events/{eventId}/waitlist/members/{memberId}
   */
  async addToWaitlist(
    eventId: string,
    memberId: string
  ): Promise<IntegrationResult<WaitlistResult>> {
    const result = await this.apiRequest<unknown>(
      'POST',
      `/calendars/secured/events/${eventId}/waitlist/members/${memberId}`
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
   * DELETE /{clubNumber}/calendars/secured/events/{eventId}/waitlist/members/{memberId}
   */
  async removeFromWaitlist(
    eventId: string,
    memberId: string
  ): Promise<IntegrationResult<WaitlistResult>> {
    const result = await this.apiRequest<unknown>(
      'DELETE',
      `/calendars/secured/events/${eventId}/waitlist/members/${memberId}`
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
