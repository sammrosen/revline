/**
 * Calendly Booking Provider
 *
 * Wraps the Calendly adapter to implement the BookingProvider interface.
 * Uses Calendly's event_type_available_times API for availability and
 * scheduling_links API for booking (Calendly does not support direct
 * event creation via API).
 *
 * Flow:
 * 1. getAvailability() -> fetches available times for the configured event type
 * 2. createBooking() -> creates a single-use scheduling link for the invitee
 */

import {
  BookingProvider,
  BookingProviderCapabilities,
  BookingCustomer,
  TimeSlot,
  AvailabilityQuery,
  BookingResult,
} from '../types';
import {
  CalendlyAdapter,
  CalendlyAvailableTime,
  CalendlyEventType,
} from '@/app/_lib/integrations/calendly.adapter';

/**
 * Calendly Booking Provider
 *
 * Lightweight provider - no customer lookup or eligibility required.
 * Customer identification is by email.
 */
export class CalendlyBookingProvider implements BookingProvider {
  readonly providerId = 'calendly';
  readonly providerName = 'Calendly';
  readonly capabilities: BookingProviderCapabilities = {
    requiresCustomerLookup: false,
    requiresEligibilityCheck: false,
    supportsWaitlist: false,
    customerIdentifierType: 'email',
    customerIdentifierLabel: 'Email Address',
  };

  /** Cached user URI for event type lookups */
  private userUri: string | null = null;
  /** Cached event types */
  private eventTypes: CalendlyEventType[] | null = null;

  constructor(private adapter: CalendlyAdapter) {}

  /**
   * Create provider instance for a workspace
   */
  static async forClient(workspaceId: string): Promise<CalendlyBookingProvider | null> {
    const adapter = await CalendlyAdapter.forWorkspace(workspaceId);
    if (!adapter) return null;
    return new CalendlyBookingProvider(adapter);
  }

  // ===========================================================================
  // AVAILABILITY
  // ===========================================================================

  /**
   * Get available time slots from Calendly.
   *
   * Fetches available times for the first active event type (or a specific one
   * if eventTypeId is provided in the query).
   */
  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    // Ensure we have the user URI
    const userUri = await this.getUserUri();
    if (!userUri) return [];

    // Get event types
    const eventTypes = await this.getEventTypes(userUri);
    if (eventTypes.length === 0) return [];

    // Find the target event type
    let targetEventType: CalendlyEventType | undefined;
    if (query.eventTypeId) {
      targetEventType = eventTypes.find(
        et => et.uri === query.eventTypeId || et.slug === query.eventTypeId
      );
    }
    if (!targetEventType) {
      targetEventType = eventTypes[0];
    }

    // Fetch available times
    const startTime = new Date(`${query.startDate}T00:00:00Z`).toISOString();
    const endTime = new Date(`${query.endDate}T23:59:59Z`).toISOString();

    const result = await this.adapter.getAvailableTimes(
      targetEventType.uri,
      startTime,
      endTime
    );

    if (!result.success || !result.data) {
      return [];
    }

    return result.data
      .filter(slot => slot.status === 'available' && slot.invitees_remaining > 0)
      .map(slot => this.mapAvailableTimeToSlot(slot, targetEventType));
  }

  // ===========================================================================
  // BOOKING
  // ===========================================================================

  /**
   * Create a booking via Calendly.
   *
   * Since Calendly does not support direct event creation via API,
   * we create a single-use scheduling link. The invitee uses this link
   * to complete the booking through Calendly's UI.
   */
  async createBooking(
    slot: TimeSlot,
    _customer: BookingCustomer
  ): Promise<BookingResult> {
    const eventTypeUri = slot.providerData?.eventTypeUri as string | undefined;
    if (!eventTypeUri) {
      return {
        success: false,
        message: 'Missing event type information for Calendly booking',
        error: 'No eventTypeUri in slot providerData',
      };
    }

    const linkResult = await this.adapter.createSchedulingLink(eventTypeUri);

    if (!linkResult.success || !linkResult.data) {
      return {
        success: false,
        message: linkResult.error || 'Failed to create Calendly scheduling link',
        error: linkResult.error,
      };
    }

    return {
      success: true,
      bookingId: `calendly-${Date.now()}`,
      message: 'Scheduling link created. Complete your booking at the provided URL.',
      booking: {
        id: `calendly-${Date.now()}`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.title,
        location: linkResult.data.bookingUrl,
      },
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get cached user URI, fetching if needed
   */
  private async getUserUri(): Promise<string | null> {
    if (this.userUri) return this.userUri;

    const result = await this.adapter.getCurrentUser();
    if (!result.success || !result.data) return null;

    this.userUri = result.data.uri;
    return this.userUri;
  }

  /**
   * Get cached event types, fetching if needed
   */
  private async getEventTypes(userUri: string): Promise<CalendlyEventType[]> {
    if (this.eventTypes) return this.eventTypes;

    const result = await this.adapter.listEventTypes(userUri);
    if (!result.success || !result.data) return [];

    this.eventTypes = result.data;
    return this.eventTypes;
  }

  /**
   * Map a Calendly available time to a generic TimeSlot
   */
  private mapAvailableTimeToSlot(
    availableTime: CalendlyAvailableTime,
    eventType: CalendlyEventType
  ): TimeSlot {
    const startTime = availableTime.start_time;
    const endTime = new Date(
      new Date(startTime).getTime() + eventType.duration * 60 * 1000
    ).toISOString();

    return {
      id: `calendly-${startTime}`,
      startTime,
      endTime,
      duration: eventType.duration,
      title: eventType.name,
      description: eventType.description_plain ?? undefined,
      spotsAvailable: availableTime.invitees_remaining,
      providerData: {
        eventTypeUri: eventType.uri,
        schedulingUrl: availableTime.scheduling_url,
        eventTypeSlug: eventType.slug,
      },
    };
  }
}
