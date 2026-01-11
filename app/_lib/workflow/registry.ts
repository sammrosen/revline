/**
 * Workflow Adapter Registry
 *
 * Defines all available adapters and their capabilities.
 * Each adapter declares what triggers it can emit and what actions it can execute.
 */

import { z } from 'zod';
import {
  AdapterDefinition,
  OperationDefinition,
  BookingPayloadSchema,
  PaymentPayloadSchema,
  CapturePayloadSchema,
  CommonPayloadSchema,
  LeadStageSchema,
} from './types';

// =============================================================================
// ADAPTER DEFINITIONS
// =============================================================================

/**
 * Calendly Adapter
 * Handles booking webhooks
 */
export const CALENDLY_ADAPTER: AdapterDefinition = {
  id: 'calendly',
  name: 'Calendly',
  requiresIntegration: true,
  requirements: {
    secrets: ['Webhook Secret'], // Matches UI form naming
  },
  triggers: {
    booking_created: {
      name: 'booking_created',
      label: 'Booking Created',
      description: 'Fires when someone books a call',
      payloadSchema: BookingPayloadSchema,
    },
    booking_canceled: {
      name: 'booking_canceled',
      label: 'Booking Canceled',
      description: 'Fires when a booking is canceled',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        reason: z.string().optional(),
      }),
    },
  },
  actions: {},
};

/**
 * Stripe Adapter
 * Handles payment webhooks
 */
export const STRIPE_ADAPTER: AdapterDefinition = {
  id: 'stripe',
  name: 'Stripe',
  requiresIntegration: true,
  requirements: {
    secrets: ['Webhook Secret'], // API Key only needed for actions (none exist yet)
  },
  triggers: {
    payment_succeeded: {
      name: 'payment_succeeded',
      label: 'Payment Succeeded',
      description: 'Fires when a one-time payment completes',
      payloadSchema: PaymentPayloadSchema,
    },
    subscription_created: {
      name: 'subscription_created',
      label: 'Subscription Created',
      description: 'Fires when a new subscription starts',
      payloadSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        amount: z.number(),
        currency: z.string(),
        product: z.string().optional(),
        interval: z.enum(['month', 'year']),
      }),
    },
    subscription_canceled: {
      name: 'subscription_canceled',
      label: 'Subscription Canceled',
      description: 'Fires when a subscription is canceled',
      payloadSchema: z.object({
        email: z.string().email(),
        product: z.string().optional(),
        canceledAt: z.string(),
      }),
    },
  },
  actions: {},
};

/**
 * MailerLite Adapter
 * Handles email list management
 */
export const MAILERLITE_ADAPTER: AdapterDefinition = {
  id: 'mailerlite',
  name: 'MailerLite',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['groups'],
  },
  triggers: {},
  actions: {
    add_to_group: {
      name: 'add_to_group',
      label: 'Add to Group',
      description: 'Add subscriber to a MailerLite group',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        group: z.string().describe('Group key from client config'),
      }),
      paramRequirements: {
        group: 'meta.groups', // params.group must be a key in meta.groups
      },
    },
    remove_from_group: {
      name: 'remove_from_group',
      label: 'Remove from Group',
      description: 'Remove subscriber from a MailerLite group',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        group: z.string().describe('Group key from client config'),
      }),
      paramRequirements: {
        group: 'meta.groups',
      },
    },
    add_tag: {
      name: 'add_tag',
      label: 'Add Tag',
      description: 'Add a tag to a subscriber',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        tag: z.string().describe('Tag name to add'),
      }),
    },
  },
};

/**
 * RevLine Adapter (Internal)
 * Handles lead management, event logging, and form submissions
 */
export const REVLINE_ADAPTER: AdapterDefinition = {
  id: 'revline',
  name: 'RevLine',
  requiresIntegration: false, // Always available
  triggers: {
    email_captured: {
      name: 'email_captured',
      label: 'Email Captured',
      description: 'Fires when a lead submits email on a landing page',
      payloadSchema: CapturePayloadSchema,
    },
    form_submitted: {
      name: 'form_submitted',
      label: 'Form Submitted',
      description: 'Fires when any form is submitted',
      payloadSchema: z.object({
        formId: z.string(),
        email: z.string().email().optional(),
        source: z.string(),
      }).passthrough(), // Allow any additional form fields
    },
  },
  actions: {
    create_lead: {
      name: 'create_lead',
      label: 'Create/Update Lead',
      description: 'Create or update a lead record',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        source: z.string().optional().describe('Lead source identifier'),
      }),
    },
    update_lead_stage: {
      name: 'update_lead_stage',
      label: 'Update Lead Stage',
      description: 'Update the stage of a lead',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        stage: LeadStageSchema.describe('New stage for the lead'),
      }),
    },
    emit_event: {
      name: 'emit_event',
      label: 'Log Custom Event',
      description: 'Emit a custom event to the event log',
      payloadSchema: z.object({}),
      paramsSchema: z.object({
        eventType: z.string().describe('Event type name'),
        success: z.boolean().default(true).describe('Whether the event is a success'),
      }),
    },
  },
};

/**
 * ManyChat Adapter (Future)
 * Handles Instagram DM automation
 */
export const MANYCHAT_ADAPTER: AdapterDefinition = {
  id: 'manychat',
  name: 'ManyChat',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['flows'],
  },
  triggers: {
    dm_received: {
      name: 'dm_received',
      label: 'DM Received',
      description: 'Fires when a DM is received matching a keyword',
      payloadSchema: z.object({
        igUsername: z.string(),
        email: z.string().email().optional(),
        keyword: z.string(),
      }),
    },
  },
  actions: {
    trigger_flow: {
      name: 'trigger_flow',
      label: 'Trigger Flow',
      description: 'Trigger a ManyChat flow for a subscriber',
      payloadSchema: z.object({
        igUsername: z.string().optional(),
        email: z.string().email().optional(),
      }),
      paramsSchema: z.object({
        flowId: z.string().describe('ManyChat flow ID'),
      }),
      paramRequirements: {
        flowId: 'meta.flows', // params.flowId must be a key in meta.flows
      },
    },
    add_tag: {
      name: 'add_tag',
      label: 'Add Tag',
      description: 'Add a tag to a ManyChat subscriber',
      payloadSchema: z.object({
        igUsername: z.string().optional(),
        email: z.string().email().optional(),
      }),
      paramsSchema: z.object({
        tag: z.string().describe('Tag name'),
      }),
    },
  },
};

/**
 * ABC Ignite member identifier schema
 * Supports either direct memberId or barcode lookup
 */
const AbcIgniteMemberSchema = z.object({
  email: z.string().email().optional(),
  memberId: z.string().optional(),
  barcode: z.string().optional(),
}).refine(
  data => data.memberId || data.barcode,
  { message: 'Either memberId or barcode is required' }
);

/**
 * ABC Ignite Adapter
 * Handles calendar/appointment booking for gym members.
 * Works for both appointments (1:1) and events (classes) - same endpoints.
 */
export const ABC_IGNITE_ADAPTER: AdapterDefinition = {
  id: 'abc_ignite',
  name: 'ABC Ignite',
  requiresIntegration: true,
  requirements: {
    secrets: ['App ID', 'App Key'],
    metaKeys: ['clubNumber'],
  },
  triggers: {}, // No triggers for now - will add if ABC Ignite supports webhooks
  actions: {
    // =========================================================================
    // MEMBER LOOKUP
    // =========================================================================
    lookup_member: {
      name: 'lookup_member',
      label: 'Lookup Member',
      description: 'Find a member by barcode and return their memberId',
      payloadSchema: z.object({
        barcode: z.string(),
      }),
      paramsSchema: z.object({}),
    },

    // =========================================================================
    // AVAILABILITY & BALANCE CHECKS
    // =========================================================================
    check_availability: {
      name: 'check_availability',
      label: 'Check Availability',
      description: 'Check employee availability for an event type',
      payloadSchema: z.object({
        employeeId: z.string().optional(),
        eventTypeId: z.string().optional(),
      }),
      paramsSchema: z.object({
        employeeId: z.string().optional().describe('Employee ID (uses default if not provided)'),
        eventTypeId: z.string().optional().describe('Event type ID (uses default if not provided)'),
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      }),
    },
    check_session_balance: {
      name: 'check_session_balance',
      label: 'Check Session Balance',
      description: 'Check if member has session credits for an event type',
      payloadSchema: AbcIgniteMemberSchema,
      paramsSchema: z.object({
        eventTypeId: z.string().optional().describe('Event type ID (uses default if not provided)'),
      }),
    },

    // =========================================================================
    // ENROLLMENT ACTIONS
    // =========================================================================
    enroll_member: {
      name: 'enroll_member',
      label: 'Enroll Member',
      description: 'Book a member into a calendar event (appointment or class)',
      payloadSchema: AbcIgniteMemberSchema,
      paramsSchema: z.object({
        eventId: z.string().describe('ABC Ignite event ID'),
        validateServiceRestriction: z.boolean().optional().describe('Validate service restrictions'),
        allowUnfunded: z.boolean().optional().describe('Allow booking even if member has no funding'),
        checkBalance: z.boolean().optional().describe('Check session balance before enrolling'),
      }),
    },
    unenroll_member: {
      name: 'unenroll_member',
      label: 'Unenroll Member',
      description: 'Cancel a member booking from a calendar event',
      payloadSchema: AbcIgniteMemberSchema,
      paramsSchema: z.object({
        eventId: z.string().describe('ABC Ignite event ID'),
      }),
    },

    // =========================================================================
    // WAITLIST ACTIONS
    // =========================================================================
    add_to_waitlist: {
      name: 'add_to_waitlist',
      label: 'Add to Waitlist',
      description: 'Add a member to event waitlist',
      payloadSchema: AbcIgniteMemberSchema,
      paramsSchema: z.object({
        eventId: z.string().describe('ABC Ignite event ID'),
      }),
    },
    remove_from_waitlist: {
      name: 'remove_from_waitlist',
      label: 'Remove from Waitlist',
      description: 'Remove a member from event waitlist',
      payloadSchema: AbcIgniteMemberSchema,
      paramsSchema: z.object({
        eventId: z.string().describe('ABC Ignite event ID'),
      }),
    },
  },
};

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * All registered adapters
 */
export const ADAPTER_REGISTRY: Record<string, AdapterDefinition> = {
  calendly: CALENDLY_ADAPTER,
  stripe: STRIPE_ADAPTER,
  mailerlite: MAILERLITE_ADAPTER,
  revline: REVLINE_ADAPTER,
  manychat: MANYCHAT_ADAPTER,
  abc_ignite: ABC_IGNITE_ADAPTER,
};

// =============================================================================
// REGISTRY FUNCTIONS
// =============================================================================

/**
 * Get an adapter by ID
 */
export function getAdapter(id: string): AdapterDefinition | null {
  return ADAPTER_REGISTRY[id] ?? null;
}

/**
 * Get a trigger operation from an adapter
 */
export function getTrigger(
  adapterId: string,
  operationId: string
): OperationDefinition | null {
  const adapter = getAdapter(adapterId);
  return adapter?.triggers[operationId] ?? null;
}

/**
 * Get an action operation from an adapter
 */
export function getAction(
  adapterId: string,
  operationId: string
): OperationDefinition | null {
  const adapter = getAdapter(adapterId);
  return adapter?.actions[operationId] ?? null;
}

/**
 * Get all available triggers across all adapters
 */
export function getAllTriggers(): Array<{
  adapter: AdapterDefinition;
  operation: OperationDefinition;
}> {
  return Object.values(ADAPTER_REGISTRY).flatMap((adapter) =>
    Object.values(adapter.triggers).map((operation) => ({
      adapter,
      operation,
    }))
  );
}

/**
 * Get all available actions across all adapters
 */
export function getAllActions(): Array<{
  adapter: AdapterDefinition;
  operation: OperationDefinition;
}> {
  return Object.values(ADAPTER_REGISTRY).flatMap((adapter) =>
    Object.values(adapter.actions).map((operation) => ({
      adapter,
      operation,
    }))
  );
}

/**
 * Get adapters that have triggers (for trigger selector UI)
 */
export function getTriggersForUI(): Array<{
  adapterId: string;
  adapterName: string;
  triggers: Array<{ name: string; label: string; description?: string }>;
}> {
  return Object.values(ADAPTER_REGISTRY)
    .filter((adapter) => Object.keys(adapter.triggers).length > 0)
    .map((adapter) => ({
      adapterId: adapter.id,
      adapterName: adapter.name,
      triggers: Object.values(adapter.triggers).map((t) => ({
        name: t.name,
        label: t.label,
        description: t.description,
      })),
    }));
}

/**
 * Get adapters that have actions (for action selector UI)
 */
export function getActionsForUI(): Array<{
  adapterId: string;
  adapterName: string;
  requiresIntegration: boolean;
  actions: Array<{ name: string; label: string; description?: string }>;
}> {
  return Object.values(ADAPTER_REGISTRY)
    .filter((adapter) => Object.keys(adapter.actions).length > 0)
    .map((adapter) => ({
      adapterId: adapter.id,
      adapterName: adapter.name,
      requiresIntegration: adapter.requiresIntegration,
      actions: Object.values(adapter.actions).map((a) => ({
        name: a.name,
        label: a.label,
        description: a.description,
      })),
    }));
}


