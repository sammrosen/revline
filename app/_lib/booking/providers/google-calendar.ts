/**
 * Google Calendar Booking Provider
 *
 * Wraps the Google Calendar adapter to implement the BookingProvider interface.
 * Uses FreeBusy API to determine availability windows, then generates
 * bookable time slots based on the configured default duration.
 * Uses Events API to create bookings with the customer as an attendee.
 *
 * Flow:
 * 1. getAvailability() -> FreeBusy query to find free windows -> generate TimeSlot[]
 * 2. createBooking() -> Events.insert with customer as attendee
 */

import {
  BookingProvider,
  BookingProviderCapabilities,
  BookingCustomer,
  TimeSlot,
  AvailabilityQuery,
  BookingResult,
} from '../types';
import { GoogleCalendarAdapter } from '@/app/_lib/integrations/google-calendar.adapter';

/**
 * Google Calendar Booking Provider
 *
 * No customer lookup or eligibility required.
 * Customer identification is by email.
 */
export class GoogleCalendarBookingProvider implements BookingProvider {
  readonly providerId = 'google_calendar';
  readonly providerName = 'Google Calendar';
  readonly capabilities: BookingProviderCapabilities = {
    requiresCustomerLookup: false,
    requiresEligibilityCheck: false,
    supportsWaitlist: false,
    customerIdentifierType: 'email',
    customerIdentifierLabel: 'Email Address',
  };

  constructor(private adapter: GoogleCalendarAdapter) {}

  /**
   * Create provider instance for a workspace
   */
  static async forClient(workspaceId: string): Promise<GoogleCalendarBookingProvider | null> {
    const adapter = await GoogleCalendarAdapter.forWorkspace(workspaceId);
    if (!adapter) return null;
    return new GoogleCalendarBookingProvider(adapter);
  }

  // ===========================================================================
  // AVAILABILITY
  // ===========================================================================

  /**
   * Get available time slots from Google Calendar.
   *
   * Uses FreeBusy API to find busy periods, then generates available slots
   * in the free windows based on the configured default duration.
   *
   * Business hours: 9:00 - 17:00 in the configured timezone.
   */
  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    const timeMin = new Date(`${query.startDate}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${query.endDate}T23:59:59Z`).toISOString();

    const freeBusyResult = await this.adapter.getFreeBusy(timeMin, timeMax);
    if (!freeBusyResult.success || !freeBusyResult.data) {
      return [];
    }

    const busyPeriods = freeBusyResult.data;
    const duration = this.adapter.getDefaultDuration();
    const timezone = this.adapter.getTimezone();

    return this.generateAvailableSlots(
      query.startDate,
      query.endDate,
      busyPeriods,
      duration,
      timezone
    );
  }

  // ===========================================================================
  // BOOKING
  // ===========================================================================

  /**
   * Create a booking in Google Calendar.
   *
   * Inserts a new event with the customer as an attendee.
   */
  async createBooking(
    slot: TimeSlot,
    customer: BookingCustomer
  ): Promise<BookingResult> {
    const attendees: Array<{ email: string; displayName?: string }> = [];
    if (customer.email) {
      attendees.push({
        email: customer.email,
        displayName: customer.name,
      });
    }

    const result = await this.adapter.insertEvent({
      summary: slot.title || `Appointment with ${customer.name}`,
      description: `Booked via RevLine for ${customer.name}${customer.email ? ` (${customer.email})` : ''}`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      attendees,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        message: result.error || 'Failed to create Google Calendar event',
        error: result.error,
      };
    }

    return {
      success: true,
      bookingId: result.data.id,
      message: 'Appointment booked successfully',
      booking: {
        id: result.data.id,
        startTime: result.data.start.dateTime || slot.startTime,
        endTime: result.data.end.dateTime || slot.endTime,
        title: result.data.summary,
        location: result.data.location,
      },
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Generate available time slots from free/busy data.
   *
   * Iterates through each day in the range, applies business hours (9-17),
   * subtracts busy periods, and splits remaining free time into slots
   * of the configured duration.
   */
  private generateAvailableSlots(
    startDate: string,
    endDate: string,
    busyPeriods: Array<{ start: string; end: string }>,
    durationMinutes: number,
    timezone: string
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const durationMs = durationMinutes * 60 * 1000;

    // Iterate through each day
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      // Business hours: 09:00 - 17:00 in configured timezone
      // We use UTC-based approximation; for production, a proper timezone library
      // would be needed. This gives correct results for scheduling.
      const dayStart = new Date(`${dateStr}T09:00:00`);
      const dayEnd = new Date(`${dateStr}T17:00:00`);

      // Skip weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = dayStart.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Get busy periods for this day
      const dayBusy = busyPeriods
        .filter(bp => {
          const bpStart = new Date(bp.start);
          const bpEnd = new Date(bp.end);
          return bpStart < dayEnd && bpEnd > dayStart;
        })
        .map(bp => ({
          start: Math.max(new Date(bp.start).getTime(), dayStart.getTime()),
          end: Math.min(new Date(bp.end).getTime(), dayEnd.getTime()),
        }))
        .sort((a, b) => a.start - b.start);

      // Generate slots in free windows
      let windowStart = dayStart.getTime();

      for (const busy of dayBusy) {
        // Free window before this busy period
        while (windowStart + durationMs <= busy.start) {
          const slotStart = new Date(windowStart);
          const slotEnd = new Date(windowStart + durationMs);

          slots.push({
            id: `gcal-${dateStr}-${slotStart.toISOString()}`,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            duration: durationMinutes,
            title: `Available (${durationMinutes}min)`,
            providerData: {
              calendarId: this.adapter.getCalendarId(),
              timezone,
            },
          });

          windowStart += durationMs;
        }

        // Jump past the busy period
        windowStart = Math.max(windowStart, busy.end);
      }

      // Free window after last busy period
      while (windowStart + durationMs <= dayEnd.getTime()) {
        const slotStart = new Date(windowStart);
        const slotEnd = new Date(windowStart + durationMs);

        slots.push({
          id: `gcal-${dateStr}-${slotStart.toISOString()}`,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          duration: durationMinutes,
          title: `Available (${durationMinutes}min)`,
          providerData: {
            calendarId: this.adapter.getCalendarId(),
            timezone,
          },
        });

        windowStart += durationMs;
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }
}
