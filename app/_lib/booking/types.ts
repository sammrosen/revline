/**
 * Booking Provider Types
 * 
 * Agnostic booking system that works with multiple providers
 * (ABC Ignite, Calendly, etc.)
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Customer information for booking
 */
export interface BookingCustomer {
  /** Provider-specific customer ID */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Provider-specific metadata */
  providerData?: Record<string, unknown>;
}

/**
 * Available time slot for booking
 */
export interface TimeSlot {
  /** Unique slot identifier */
  id: string;
  /** Start time (ISO string) */
  startTime: string;
  /** End time (ISO string) */
  endTime: string;
  /** Duration in minutes */
  duration: number;
  /** Display title (e.g., "Personal Training with John") */
  title: string;
  /** Optional description */
  description?: string;
  /** Staff/employee name if applicable */
  staffName?: string;
  /** Location name if applicable */
  location?: string;
  /** Number of spots available (for classes) */
  spotsAvailable?: number;
  /** Maximum capacity (for classes) */
  maxCapacity?: number;
  /** Provider-specific metadata */
  providerData?: Record<string, unknown>;
}

/**
 * Employee/staff member for booking selection
 */
export interface BookingEmployee {
  /** Config key for this employee */
  key: string;
  /** Display name */
  name: string;
  /** Job title (e.g., "Personal Trainer") */
  title?: string;
}

/**
 * Query parameters for availability search
 */
export interface AvailabilityQuery {
  /** Start date for search (YYYY-MM-DD) */
  startDate: string;
  /** End date for search (YYYY-MM-DD) */
  endDate: string;
  /** Event type/service ID to filter by */
  eventTypeId?: string;
  /** Staff/employee ID to filter by */
  staffId?: string;
  /** Only show online-bookable slots */
  onlineOnly?: boolean;
}

/**
 * Result of a booking creation
 */
export interface BookingResult {
  /** Whether the booking was successful */
  success: boolean;
  /** Booking confirmation ID */
  bookingId?: string;
  /** Human-readable message */
  message: string;
  /** Booking details if successful */
  booking?: {
    id: string;
    startTime: string;
    endTime: string;
    title: string;
    staffName?: string;
    location?: string;
  };
  /** Error details if failed */
  error?: string;
}

/**
 * Result of eligibility check
 */
export interface EligibilityResult {
  /** Whether customer is eligible to book */
  eligible: boolean;
  /** Reason if not eligible */
  reason?: string;
  /** Session/credit balance info */
  balance?: {
    remaining: number;
    unlimited: boolean;
    expiresAt?: string;
  };
}

/**
 * Provider capabilities - UI adapts based on these
 */
export interface BookingProviderCapabilities {
  /** Requires customer lookup before showing availability */
  requiresCustomerLookup: boolean;
  /** Requires eligibility check (e.g., session balance) */
  requiresEligibilityCheck: boolean;
  /** Supports waitlist for full events */
  supportsWaitlist: boolean;
  /** Supports employee/staff selection for availability */
  supportsEmployeeSelection?: boolean;
  /** Identifier type for customer lookup */
  customerIdentifierType?: 'barcode' | 'email' | 'phone' | 'memberId';
  /** Label for customer identifier input */
  customerIdentifierLabel?: string;
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Booking Provider Interface
 * 
 * All booking integrations implement this interface.
 * The UI adapts based on provider capabilities.
 */
export interface BookingProvider {
  /** Provider identifier */
  readonly providerId: string;
  
  /** Provider display name */
  readonly providerName: string;
  
  /** Provider capabilities */
  readonly capabilities: BookingProviderCapabilities;
  
  /**
   * Get available time slots
   * @param query - Search parameters
   * @returns Array of available time slots
   */
  getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]>;
  
  /**
   * Create a booking
   * @param slot - The time slot to book
   * @param customer - Customer information
   * @returns Booking result
   */
  createBooking(slot: TimeSlot, customer: BookingCustomer): Promise<BookingResult>;
  
  /**
   * Look up a customer by identifier (optional)
   * @param identifier - Customer identifier (barcode, email, etc.)
   * @returns Customer info or null if not found
   */
  lookupCustomer?(identifier: string): Promise<BookingCustomer | null>;
  
  /**
   * Check customer eligibility (optional)
   * @param customer - Customer to check
   * @param eventTypeId - Optional event type for specific check
   * @returns Eligibility result
   */
  checkEligibility?(customer: BookingCustomer, eventTypeId?: string): Promise<EligibilityResult>;
  
  /**
   * Add customer to waitlist (optional)
   * @param slot - The full slot to waitlist for
   * @param customer - Customer information
   * @returns Waitlist result
   */
  addToWaitlist?(slot: TimeSlot, customer: BookingCustomer): Promise<BookingResult>;
  
  /**
   * Get customer's email address (optional)
   * Used for magic link verification - email provided must match customer record
   * @param customer - Customer to get email for
   * @returns Email address or null if not available
   */
  getCustomerEmail?(customer: BookingCustomer): string | null;
}

// =============================================================================
// BOOKING STATE (for UI)
// =============================================================================

/**
 * Booking flow step
 */
export type BookingStep = 
  | 'lookup'      // Customer lookup
  | 'eligibility' // Eligibility check
  | 'select'      // Select time slot
  | 'confirm'     // Confirm booking
  | 'success'     // Booking complete
  | 'error';      // Error state

/**
 * Booking wizard state
 */
export interface BookingState {
  /** Current step */
  step: BookingStep;
  /** Provider capabilities (determines which steps show) */
  capabilities: BookingProviderCapabilities;
  /** Customer info (populated after lookup) */
  customer: BookingCustomer | null;
  /** Eligibility info (populated after check) */
  eligibility: EligibilityResult | null;
  /** Available slots (populated after availability fetch) */
  slots: TimeSlot[];
  /** Selected slot */
  selectedSlot: TimeSlot | null;
  /** Booking result */
  result: BookingResult | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Initial booking state
 */
export const initialBookingState: BookingState = {
  step: 'lookup',
  capabilities: {
    requiresCustomerLookup: false,
    requiresEligibilityCheck: false,
    supportsWaitlist: false,
  },
  customer: null,
  eligibility: null,
  slots: [],
  selectedSlot: null,
  result: null,
  loading: false,
  error: null,
};

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Lookup request body
 */
export interface LookupRequest {
  clientId: string;
  identifier: string;
}

/**
 * Eligibility request body
 */
export interface EligibilityRequest {
  clientId: string;
  customerId: string;
  eventTypeId?: string;
}

/**
 * Availability request params
 */
export interface AvailabilityRequest {
  clientId: string;
  startDate: string;
  endDate: string;
  eventTypeId?: string;
  staffId?: string;
}

/**
 * Create booking request body
 */
export interface CreateBookingRequest {
  clientId: string;
  slotId: string;
  customerId: string;
  /** Full slot data for providers that need it */
  slot?: TimeSlot;
  /** Full customer data for providers that need it */
  customer?: BookingCustomer;
}
