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
  TimeSlot,
  AvailabilityQuery,
  BookingResult,
  EligibilityResult,
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
  
  readonly capabilities: BookingProviderCapabilities = {
    requiresCustomerLookup: true,
    requiresEligibilityCheck: false, // Disabled until /session-balance endpoint activated
    supportsWaitlist: true,
    customerIdentifierType: 'barcode',
    customerIdentifierLabel: 'Member Barcode',
  };
  
  constructor(private adapter: AbcIgniteAdapter) {}
  
  /**
   * Create provider instance for a client
   */
  static async forClient(clientId: string): Promise<AbcIgniteBookingProvider | null> {
    const adapter = await AbcIgniteAdapter.forClient(clientId);
    if (!adapter) return null;
    return new AbcIgniteBookingProvider(adapter);
  }
  
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
   * Create a booking (enroll member in event)
   */
  async createBooking(
    slot: TimeSlot,
    customer: BookingCustomer
  ): Promise<BookingResult> {
    const eventId = slot.id;
    const memberId = customer.id;
    
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
   */
  private mapMemberToCustomer(member: AbcIgniteMember): BookingCustomer {
    const name = [member.firstName, member.lastName]
      .filter(Boolean)
      .join(' ') || 'Member';
    
    return {
      id: member.memberId,
      name,
      providerData: {
        barcode: member.barcode,
        homeClub: member.homeClub,
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
}
