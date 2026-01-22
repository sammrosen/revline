/**
 * ABC Ignite Booking Provider
 * 
 * Wraps the ABC Ignite adapter to implement the BookingProvider interface.
 * Handles member lookup, session balance checks, and event enrollment.
 * 
 * Supports two availability modes:
 * - Employee availability (preferred): Uses configured employees to fetch open time slots
 * - Event-based (fallback): Fetches pre-scheduled events from the calendar
 */

import {
  BookingProvider,
  BookingProviderCapabilities,
  BookingCustomer,
  BookingEmployee,
  TimeSlot,
  AvailabilityQuery,
  BookingResult,
  EligibilityResult,
  BookingPayloadResult,
} from '../types';
import {
  AbcIgniteAdapter,
  AbcIgniteEvent,
  AbcIgniteMember,
  AbcIgniteAvailabilityDay,
  AbcIgniteAvailabilityTimeBlock,
} from '@/app/_lib/integrations/abc-ignite.adapter';

/**
 * ABC Ignite Booking Provider
 * 
 * Full-featured provider with:
 * - Barcode-based member lookup
 * - Event enrollment
 * - Waitlist support
 * 
 * Note: Session balance eligibility checks disabled until /session-balance endpoint activated
 */
export class AbcIgniteBookingProvider implements BookingProvider {
  readonly providerId = 'abc_ignite';
  readonly providerName = 'ABC Ignite';
  readonly capabilities: BookingProviderCapabilities;
  
  constructor(private adapter: AbcIgniteAdapter) {
    // Build capabilities - employee selection depends on config
    const employees = this.adapter.getConfiguredEmployees();
    const hasEmployees = Object.keys(employees).length > 0;
    
    this.capabilities = {
      requiresCustomerLookup: true,
      requiresEligibilityCheck: false, // Disabled until /session-balance endpoint activated
      supportsWaitlist: true,
      supportsEmployeeSelection: hasEmployees,
      customerIdentifierType: 'barcode',
      customerIdentifierLabel: 'Member Barcode',
    };
  }
  
  /**
   * Create provider instance for a client
   */
  static async forClient(clientId: string): Promise<AbcIgniteBookingProvider | null> {
    const adapter = await AbcIgniteAdapter.forClient(clientId);
    if (!adapter) return null;
    return new AbcIgniteBookingProvider(adapter);
  }
  
  // ===========================================================================
  // EMPLOYEE CONFIGURATION
  // ===========================================================================
  
  /**
   * Get configured employees for selection UI
   * Returns employee info suitable for frontend display (keys, not raw IDs)
   */
  getConfiguredEmployees(): BookingEmployee[] {
    const employeesConfig = this.adapter.getConfiguredEmployees();
    
    return Object.entries(employeesConfig).map(([key, config]) => ({
      key,
      name: config.name,
      title: config.title,
    }));
  }
  
  /**
   * Get the default employee key
   */
  getDefaultEmployeeKey(): string | undefined {
    return this.adapter.getDefaultEmployeeId();
  }
  
  // ===========================================================================
  // CUSTOMER OPERATIONS
  // ===========================================================================
  
  /**
   * Look up a member by barcode
   */
  async lookupCustomer(barcode: string): Promise<BookingCustomer | null> {
    const result = await this.adapter.getMemberByBarcode(barcode);
    
    if (!result.success || !result.data) {
      return null;
    }
    
    const member = result.data;
    return this.mapMemberToCustomer(member);
  }
  
  /**
   * Get customer's email address for magic link verification
   * Email is stored in the BookingCustomer after lookup
   */
  getCustomerEmail(customer: BookingCustomer): string | null {
    return customer.email || null;
  }
  
  /**
   * Check if member is eligible to book
   * 
   * Note: Session balance check disabled until /session-balance endpoint activated.
   * Currently always returns eligible - ABC will reject at enrollment if member lacks credits.
   */
  async checkEligibility(
    _customer: BookingCustomer,
    _eventTypeId?: string
  ): Promise<EligibilityResult> {
    // Session balance endpoint not activated - skip eligibility check
    // ABC will reject at enrollment time if member doesn't have credits
    return {
      eligible: true,
      reason: 'Eligibility check skipped - will validate at booking time',
    };
  }
  
  /**
   * Get available time slots
   * 
   * Uses employee availability endpoint if employees are configured,
   * otherwise falls back to pre-scheduled events.
   */
  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    // Try employee availability first (preferred method)
    const employeeSlots = await this.getEmployeeAvailability(query);
    if (employeeSlots !== null) {
      return employeeSlots;
    }
    
    // Fallback to event-based availability
    return this.getEventAvailability(query);
  }
  
  /**
   * Get availability using employee availability endpoint
   * Returns null if no employee is configured (triggering fallback)
   */
  private async getEmployeeAvailability(query: AvailabilityQuery): Promise<TimeSlot[] | null> {
    // Get employee - from query, or use default
    const employeeKey = query.staffId || this.adapter.getDefaultEmployeeId();
    if (!employeeKey) {
      return null; // No employee configured - use fallback
    }
    
    const employeeConfig = this.adapter.getEmployeeConfig(employeeKey);
    if (!employeeConfig) {
      console.warn('Employee key not found in config:', employeeKey);
      return null;
    }
    
    // Get event type config
    const eventTypeKey = query.eventTypeId || this.adapter.getDefaultEventTypeId();
    if (!eventTypeKey) {
      console.warn('No event type configured for availability');
      return null;
    }
    
    const eventTypeConfig = this.adapter.getEventTypeConfig(eventTypeKey);
    if (!eventTypeConfig) {
      console.warn('Event type key not found in config:', eventTypeKey);
      return null;
    }
    
    // Fetch availability from ABC Ignite
    const result = await this.adapter.getEmployeeAvailability(
      employeeConfig.id,
      eventTypeConfig.id,
      { startDate: query.startDate, endDate: query.endDate },
      eventTypeConfig.levelId
    );
    
    if (!result.success || !result.data) {
      console.error('Failed to fetch employee availability:', result.error);
      return [];
    }
    
    // Split time blocks into individual bookable slots
    const duration = eventTypeConfig.duration || 60;
    const slots: TimeSlot[] = [];
    
    for (const day of result.data) {
      for (const timeBlock of day.times) {
        const blockSlots = this.splitTimeBlockIntoSlots(
          timeBlock,
          day.date,
          duration,
          eventTypeConfig,
          employeeConfig
        );
        slots.push(...blockSlots);
      }
    }
    
    return slots;
  }
  
  /**
   * Split a time block into individual bookable slots based on duration
   */
  private splitTimeBlockIntoSlots(
    timeBlock: AbcIgniteAvailabilityTimeBlock,
    date: string,
    durationMinutes: number,
    eventType: { id: string; name: string; levelId?: string },
    employee: { id: string; name: string; title?: string }
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    const blockStart = new Date(timeBlock.utcStartDateTime);
    const blockEnd = new Date(timeBlock.utcEndDateTime);
    const durationMs = durationMinutes * 60 * 1000;
    
    let slotStart = blockStart;
    
    while (slotStart.getTime() + durationMs <= blockEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      
      slots.push({
        id: `${employee.id}-${slotStart.toISOString()}`,
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        duration: durationMinutes,
        title: eventType.name,
        staffName: employee.name,
        spotsAvailable: 1,
        maxCapacity: 1,
        providerData: {
          eventTypeId: eventType.id,
          employeeId: employee.id,
          levelId: eventType.levelId,
          date, // Original date from API
          localStartTime: timeBlock.startTime,
          isAvailabilitySlot: true,
        },
      });
      
      slotStart = slotEnd;
    }
    
    return slots;
  }
  
  /**
   * Get availability using pre-scheduled events (fallback)
   */
  private async getEventAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    const result = await this.adapter.getEvents({
      startDate: query.startDate,
      endDate: query.endDate,
      eventTypeId: query.eventTypeId,
      isAvailableOnline: query.onlineOnly ?? true,
    });
    
    if (!result.success || !result.data) {
      return [];
    }
    
    return result.data
      .filter(event => this.isEventBookable(event))
      .map(event => this.mapEventToSlot(event));
  }
  
  /**
   * Create a booking
   * 
   * Handles two scenarios:
   * - Availability slots: Creates a new appointment via POST /calendars/events
   * - Pre-scheduled events: Enrolls member in existing event
   */
  async createBooking(
    slot: TimeSlot,
    customer: BookingCustomer
  ): Promise<BookingResult> {
    const memberId = customer.id;
    
    // Check if this is an availability slot (needs appointment creation)
    // vs a pre-scheduled event (needs enrollment)
    if (slot.providerData?.isAvailabilitySlot) {
      // Create appointment from availability
      const result = await this.adapter.createAppointment({
        employeeId: slot.providerData.employeeId as string,
        eventTypeId: slot.providerData.eventTypeId as string,
        levelId: slot.providerData.levelId as string,
        startTime: this.formatDateTimeForApi(slot.startTime),
        memberId,
      });
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to create appointment',
          error: result.error,
        };
      }
      
      return {
        success: true,
        bookingId: result.data?.eventId,
        message: 'Appointment booked successfully',
        booking: {
          id: result.data?.eventId || slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          title: slot.title,
          staffName: slot.staffName,
        },
      };
    }
    
    // Existing logic for pre-scheduled events
    const eventId = slot.id;
    const result = await this.adapter.enrollMember(eventId, memberId);
    
    if (!result.success) {
      return {
        success: false,
        message: result.error || 'Failed to create booking',
        error: result.error,
      };
    }
    
    return {
      success: true,
      bookingId: `${eventId}-${memberId}`,
      message: 'Successfully booked',
      booking: {
        id: eventId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.title,
        staffName: slot.staffName,
        location: slot.location,
      },
    };
  }
  
  // ===========================================================================
  // PAYLOAD-BASED BOOKING (for magic link flow)
  // ===========================================================================
  
  /**
   * Build the exact payload needed to create a booking
   * 
   * Called at request time when all slot context is available.
   * The payload is stored in JSONB and sent as-is during confirmation.
   * This eliminates the need for ID resolution at confirm time.
   */
  async buildBookingPayload(
    slot: TimeSlot,
    customer: BookingCustomer
  ): Promise<BookingPayloadResult> {
    const memberId = customer.id;
    
    // Handle availability slot (POST /calendars/events)
    if (slot.providerData?.isAvailabilitySlot) {
      const employeeId = slot.providerData.employeeId as string;
      const eventTypeId = slot.providerData.eventTypeId as string;
      const levelId = slot.providerData.levelId as string;
      
      // Validate required fields
      if (!employeeId || !eventTypeId || !levelId) {
        return {
          success: false,
          error: 'Missing required slot data (employeeId, eventTypeId, or levelId)',
        };
      }
      
      return {
        success: true,
        payload: {
          type: 'appointment', // Identifies which API call to make
          employeeId,
          eventTypeId,
          levelId,
          startTime: this.formatDateTimeForApi(slot.startTime),
          memberId,
        },
      };
    }
    
    // Handle pre-scheduled event (POST /calendars/events/{eventId}/members/{memberId})
    const eventId = slot.id;
    if (!eventId) {
      return {
        success: false,
        error: 'Missing event ID for enrollment',
      };
    }
    
    return {
      success: true,
      payload: {
        type: 'enrollment', // Identifies which API call to make
        eventId,
        memberId,
      },
    };
  }
  
  /**
   * Execute a pre-built booking payload
   * 
   * Called at confirm time - just sends the payload as-is.
   * No ID resolution or transformation needed.
   */
  async executeBookingPayload(
    payload: Record<string, unknown>
  ): Promise<BookingResult> {
    const payloadType = payload.type as string;
    
    if (payloadType === 'appointment') {
      // Create appointment from availability
      const result = await this.adapter.createAppointment({
        employeeId: payload.employeeId as string,
        eventTypeId: payload.eventTypeId as string,
        levelId: payload.levelId as string,
        startTime: payload.startTime as string,
        memberId: payload.memberId as string,
      });
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to create appointment',
          error: result.error,
        };
      }
      
      return {
        success: true,
        bookingId: result.data?.eventId,
        message: 'Appointment booked successfully',
      };
    }
    
    if (payloadType === 'enrollment') {
      // Enroll in pre-scheduled event
      const eventId = payload.eventId as string;
      const memberId = payload.memberId as string;
      
      const result = await this.adapter.enrollMember(eventId, memberId);
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to enroll in event',
          error: result.error,
        };
      }
      
      return {
        success: true,
        bookingId: `${eventId}-${memberId}`,
        message: 'Successfully enrolled in event',
      };
    }
    
    return {
      success: false,
      message: `Unknown payload type: ${payloadType}`,
      error: `Unknown payload type: ${payloadType}`,
    };
  }
  
  /**
   * Format ISO datetime to ABC API format
   * ABC API expects: "YYYY-MM-DD HH:mm:ss" in UTC
   * Uses UTC methods to ensure consistent behavior regardless of server timezone
   */
  private formatDateTimeForApi(isoDateTime: string): string {
    const date = new Date(isoDateTime);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
  
  /**
   * Add member to waitlist
   */
  async addToWaitlist(
    slot: TimeSlot,
    customer: BookingCustomer
  ): Promise<BookingResult> {
    const result = await this.adapter.addToWaitlist(slot.id, customer.id);
    
    if (!result.success) {
      return {
        success: false,
        message: result.error || 'Failed to add to waitlist',
        error: result.error,
      };
    }
    
    return {
      success: true,
      bookingId: `waitlist-${slot.id}-${customer.id}`,
      message: 'Added to waitlist',
    };
  }
  
  // ===========================================================================
  // MAPPING HELPERS
  // ===========================================================================
  
  /**
   * Map ABC Ignite member to generic customer
   * Handles both nested personal object (GET /members) and flat fields (event context)
   */
  private mapMemberToCustomer(member: AbcIgniteMember): BookingCustomer {
    // Support both nested personal object and flat fields
    const personal = member.personal || {};
    const firstName = personal.firstName || member.firstName;
    const lastName = personal.lastName || member.lastName;
    const barcode = personal.barcode || member.barcode;
    const homeClub = personal.homeClub || member.homeClub;
    const email = personal.email;
    const phone = personal.primaryPhone;
    
    const name = [firstName, lastName]
      .filter(Boolean)
      .join(' ') || 'Member';
    
    return {
      id: member.memberId,
      name,
      email,
      providerData: {
        barcode,
        homeClub,
        phone,
        hasActiveRecurringService: member.hasActiveRecurringService,
      },
    };
  }
  
  /**
   * Map ABC Ignite event to generic time slot
   */
  private mapEventToSlot(event: AbcIgniteEvent): TimeSlot {
    // Calculate spots available
    const enrolled = event.members?.length || 0;
    const maxAttendees = event.maxAttendees || 0;
    const spotsAvailable = maxAttendees > 0 ? maxAttendees - enrolled : undefined;
    
    // Build staff name
    const staffName = event.employeeName || 
      [event.employeeFirstName, event.employeeLastName].filter(Boolean).join(' ') ||
      undefined;
    
    return {
      id: event.eventId,
      startTime: event.eventTimestamp,
      endTime: this.calculateEndTime(event.eventTimestamp, event.duration),
      duration: event.duration,
      title: event.eventName,
      description: event.comments,
      staffName,
      location: event.locationName,
      spotsAvailable,
      maxCapacity: maxAttendees > 0 ? maxAttendees : undefined,
      providerData: {
        eventTypeId: event.eventTypeId,
        category: event.category,
        status: event.status,
        hasWaitlist: !event.waitListEmpty,
        waitlistSize: event.waitList?.members?.length || 0,
      },
    };
  }
  
  /**
   * Check if an event is bookable
   */
  private isEventBookable(event: AbcIgniteEvent): boolean {
    // Must be available online
    if (event.isAvailableOnline !== 'true' && event.availableOnline !== 'true') {
      return false;
    }
    
    // Check status
    if (event.status && !['active', 'scheduled'].includes(event.status.toLowerCase())) {
      return false;
    }
    
    // Check booking window
    const now = new Date();
    const eventTime = new Date(event.eventTimestamp);
    
    if (event.stopBookingTime) {
      const stopTime = new Date(event.stopBookingTime);
      if (now > stopTime) return false;
    }
    
    // Event must be in the future
    if (eventTime < now) return false;
    
    return true;
  }
  
  /**
   * Calculate end time from start time and duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return end.toISOString();
  }
  
  // ===========================================================================
  // EMPLOYEE ID RESOLUTION
  // ===========================================================================
  
  /**
   * Resolve an internal employee key to the ABC employee ID
   * 
   * The client sends internal keys like "sam_rosen" but ABC needs the actual
   * employee ID like "12d0d1472b314a95b4e53b08b20d8769".
   * 
   * @param employeeKey - Internal key (e.g., "sam_rosen")
   * @returns ABC employee ID or null if not found
   */
  resolveEmployeeId(employeeKey: string): string | null {
    const config = this.adapter.getEmployeeConfig(employeeKey);
    return config?.id || null;
  }
}
