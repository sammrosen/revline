/**
 * Scheduling Tools
 *
 * Agent tools for appointment scheduling. Thin wrappers around the
 * existing BookingProvider interface, fully provider-agnostic.
 *
 * STANDARDS:
 * - Workspace-scoped: resolves booking provider per workspace
 * - Agnostic: works with ABC Ignite, Calendly, or any future provider
 * - Fail-safe: returns structured errors, never throws
 */

import { registerTool } from '../tool-registry';
import type { ToolExecutionContext, ToolResult } from '../tool-registry';
import { getBookingProvider } from '@/app/_lib/booking/get-provider';

// =============================================================================
// check_availability
// =============================================================================

registerTool({
  name: 'check_availability',
  label: 'Check Availability',
  description:
    'Check available appointment time slots for a given date range. ' +
    'Returns a list of bookable slots with times, staff, and availability. ' +
    'Use this when the contact asks about scheduling, availability, or open times.',
  category: 'scheduling',
  parameters: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date for availability search (YYYY-MM-DD format)',
      },
      endDate: {
        type: 'string',
        description: 'End date for availability search (YYYY-MM-DD format). Defaults to startDate if not provided.',
      },
      staffId: {
        type: 'string',
        description: 'Optional staff/employee key to filter availability by a specific person',
      },
    },
    required: ['startDate'],
  },
  execute: checkAvailability,
});

async function checkAvailability(ctx: ToolExecutionContext): Promise<ToolResult> {
  const provider = await getBookingProvider(ctx.workspaceId);
  if (!provider) {
    return { success: false, error: 'No booking provider configured for this workspace' };
  }

  const startDate = ctx.args.startDate as string;
  const endDate = (ctx.args.endDate as string) || startDate;
  const staffId = ctx.args.staffId as string | undefined;

  try {
    const slots = await provider.getAvailability({
      startDate,
      endDate,
      staffId,
    });

    const formatted = slots.map((slot) => ({
      id: slot.id,
      date: slot.startTime.split('T')[0],
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration,
      title: slot.title,
      staffName: slot.staffName || null,
      location: slot.location || null,
      spotsAvailable: slot.spotsAvailable ?? null,
    }));

    return {
      success: true,
      data: {
        slotCount: formatted.length,
        slots: formatted,
        dateRange: { startDate, endDate },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check availability',
    };
  }
}

// =============================================================================
// book_appointment
// =============================================================================

registerTool({
  name: 'book_appointment',
  label: 'Book Appointment',
  description:
    'Book an appointment for the contact. Requires a slot ID from check_availability ' +
    'and a customer identifier (name, phone, or barcode depending on the provider). ' +
    'Use this after the contact has confirmed they want a specific time slot.',
  category: 'scheduling',
  parameters: {
    type: 'object',
    properties: {
      slotId: {
        type: 'string',
        description: 'The slot ID from a previous check_availability result',
      },
      customerName: {
        type: 'string',
        description: 'The customer/contact name for the booking',
      },
      customerIdentifier: {
        type: 'string',
        description: 'Customer identifier for lookup (barcode, email, or phone depending on provider)',
      },
    },
    required: ['slotId'],
  },
  execute: bookAppointment,
});

async function bookAppointment(ctx: ToolExecutionContext): Promise<ToolResult> {
  const provider = await getBookingProvider(ctx.workspaceId);
  if (!provider) {
    return { success: false, error: 'No booking provider configured for this workspace' };
  }

  const slotId = ctx.args.slotId as string;
  const customerName = (ctx.args.customerName as string) || 'Contact';
  const customerIdentifier = ctx.args.customerIdentifier as string | undefined;

  try {
    // If provider requires customer lookup, try to resolve customer first
    let customer = { id: '', name: customerName };

    if (provider.capabilities.requiresCustomerLookup && customerIdentifier && provider.lookupCustomer) {
      const found = await provider.lookupCustomer(customerIdentifier);
      if (!found) {
        return {
          success: false,
          error: `Could not find customer with identifier: ${customerIdentifier}. Please verify the information and try again.`,
        };
      }
      customer = found;
    }

    // Fetch availability to get the full slot object by ID
    // (the AI only has the slot ID from a previous check_availability call)
    const allSlots = await provider.getAvailability({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const slot = allSlots.find((s) => s.id === slotId);
    if (!slot) {
      return {
        success: false,
        error: `Slot ${slotId} not found or no longer available. Please check availability again.`,
      };
    }

    const result = await provider.createBooking(slot, customer);

    if (!result.success) {
      return { success: false, error: result.error || result.message };
    }

    return {
      success: true,
      data: {
        bookingId: result.bookingId,
        message: result.message,
        booking: result.booking,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to book appointment',
    };
  }
}

// =============================================================================
// lookup_customer
// =============================================================================

registerTool({
  name: 'lookup_customer',
  label: 'Lookup Customer',
  description:
    'Look up a customer/member by their identifier (barcode, email, or phone). ' +
    'Use this when you need to verify a customer before booking or when the contact ' +
    'provides their member information.',
  category: 'scheduling',
  parameters: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Customer identifier (barcode, email, or phone number depending on provider)',
      },
    },
    required: ['identifier'],
  },
  execute: lookupCustomer,
});

async function lookupCustomer(ctx: ToolExecutionContext): Promise<ToolResult> {
  const provider = await getBookingProvider(ctx.workspaceId);
  if (!provider) {
    return { success: false, error: 'No booking provider configured for this workspace' };
  }

  if (!provider.lookupCustomer) {
    return { success: false, error: 'Customer lookup not supported by this booking provider' };
  }

  const identifier = ctx.args.identifier as string;

  try {
    const customer = await provider.lookupCustomer(identifier);
    if (!customer) {
      return {
        success: true,
        data: { found: false, message: 'No customer found with that identifier' },
      };
    }

    return {
      success: true,
      data: {
        found: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email || null,
          phone: customer.phone || null,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to lookup customer',
    };
  }
}
