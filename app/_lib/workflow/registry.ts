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
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'eventType', label: 'Event Type', type: 'text', required: false, placeholder: 'discovery-call' },
        { name: 'scheduledAt', label: 'Scheduled At', type: 'datetime', required: false },
      ],
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
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'reason', label: 'Cancellation Reason', type: 'text', required: false, placeholder: 'Schedule conflict' },
      ],
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
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'amount', label: 'Amount (cents)', type: 'number', required: true, default: 9900 },
        { name: 'currency', label: 'Currency', type: 'text', required: true, default: 'usd' },
        { name: 'product', label: 'Product', type: 'text', required: false, placeholder: 'fit1' },
      ],
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
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'amount', label: 'Amount (cents)', type: 'number', required: true, default: 4900 },
        { name: 'currency', label: 'Currency', type: 'text', required: true, default: 'usd' },
        { name: 'product', label: 'Product', type: 'text', required: false, placeholder: 'membership' },
        { name: 'interval', label: 'Interval', type: 'select', required: true, default: 'month', options: [
          { value: 'month', label: 'Monthly' },
          { value: 'year', label: 'Yearly' },
        ]},
      ],
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
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'product', label: 'Product', type: 'text', required: false, placeholder: 'membership' },
        { name: 'canceledAt', label: 'Canceled At', type: 'datetime', required: true },
      ],
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
 * 
 * TRIGGERS ARE DYNAMIC:
 * RevLine triggers are workspace-specific, generated from enabled forms.
 * The workflow registry API injects dynamic triggers based on workspace config.
 * Each enabled form becomes a trigger where formId = operation name.
 * 
 * See: app/api/v1/workflow-registry/route.ts
 */
export const REVLINE_ADAPTER: AdapterDefinition = {
  id: 'revline',
  name: 'RevLine',
  requiresIntegration: false, // Always available
  // Triggers are DYNAMIC - populated from workspace's enabled forms
  // The API injects workspace-specific form triggers at runtime
  triggers: {},
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
      testFields: [
        { name: 'igUsername', label: 'IG Username', type: 'text', required: true, placeholder: '@username' },
        { name: 'email', label: 'Email', type: 'email', required: false },
        { name: 'keyword', label: 'Keyword', type: 'text', required: true, default: 'START' },
      ],
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
    // check_session_balance: removed - requires /session-balance endpoint

    // =========================================================================
    // APPOINTMENT CREATION
    // =========================================================================
    create_appointment: {
      name: 'create_appointment',
      label: 'Create Appointment',
      description: 'Create a new appointment from employee availability',
      payloadSchema: z.object({
        employeeId: z.string().describe('ABC employee ID'),
        eventTypeId: z.string().describe('ABC event type ID'),
        startTime: z.string().describe('Appointment start time (local time: YYYY-MM-DD HH:MM:SS)'),
        memberId: z.string().describe('ABC member ID'),
        levelId: z.string().optional().describe('ABC level ID'),
      }),
      paramsSchema: z.object({
        employeeId: z.string().describe('ABC employee ID'),
        eventTypeId: z.string().describe('ABC event type ID'),
        startTime: z.string().describe('Appointment start time (local time: YYYY-MM-DD HH:MM:SS)'),
        memberId: z.string().describe('ABC member ID'),
        levelId: z.string().optional().describe('ABC level ID'),
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

/**
 * Resend Adapter
 * Handles transactional email sending via Resend
 */
export const RESEND_ADAPTER: AdapterDefinition = {
  id: 'resend',
  name: 'Resend',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['fromEmail'],
  },
  triggers: {}, // No inbound webhooks from Resend
  actions: {
    send_email: {
      name: 'send_email',
      label: 'Send Email',
      description: 'Send a transactional email via Resend',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email from trigger payload'),
      }),
      paramsSchema: z.object({
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body content (HTML supported)'),
        replyTo: z.string().email().optional().describe('Override reply-to address'),
      }),
    },
  },
};

/**
 * Capture Adapter
 * Universal form capture - accepts data from any source via /api/v1/capture/[formId]
 * 
 * OBSERVATIONAL: Capture never blocks the source form.
 * - Email is optional - accepts any data
 * - Triggers are DYNAMIC - populated from workspace's WorkspaceForms
 * - No actions - capture only emits triggers to workflows
 * 
 * See: app/api/v1/workflow-registry/route.ts for dynamic trigger building
 */
export const CAPTURE_ADAPTER: AdapterDefinition = {
  id: 'capture',
  name: 'Form Capture',
  requiresIntegration: false, // Always available - uses WorkspaceForm table
  // Triggers are DYNAMIC - populated from workspace's enabled WorkspaceForms
  // The workflow registry API injects workspace-specific form triggers at runtime
  // Each WorkspaceForm becomes a trigger where triggerName = operation name
  triggers: {},
  actions: {}, // No actions - capture only emits triggers
};

/**
 * Booking Adapter
 * 
 * Handles sync workflow triggers for the booking system.
 * These triggers are used with executeWorkflowSync() for user-facing flows
 * that need synchronous results (e.g., booking form returns success/failure).
 * 
 * Triggers:
 * - create_booking: Create a new appointment from employee availability
 * - add_to_waitlist: Add member to event waitlist
 */
export const BOOKING_ADAPTER: AdapterDefinition = {
  id: 'booking',
  name: 'Booking System',
  requiresIntegration: false, // Built-in system
  triggers: {
    create_booking: {
      name: 'create_booking',
      label: 'Create Booking',
      description: 'When a booking is requested (sync workflow)',
      payloadSchema: z.object({
        slotId: z.string().optional().describe('Slot identifier'),
        employeeId: z.string().describe('ABC employee ID'),
        eventTypeId: z.string().describe('ABC event type ID'),
        levelId: z.string().optional().describe('ABC level ID'),
        startTime: z.string().describe('Appointment start time (local time)'),
        memberId: z.string().describe('ABC member ID'),
        customerEmail: z.string().email().optional().describe('Customer email'),
        customerName: z.string().optional().describe('Customer name'),
      }),
      testFields: [
        { name: 'employeeId', label: 'Employee ID', type: 'text', required: true },
        { name: 'eventTypeId', label: 'Event Type ID', type: 'text', required: true },
        { name: 'startTime', label: 'Start Time', type: 'text', required: true, placeholder: '2026-01-24 09:00:00' },
        { name: 'memberId', label: 'Member ID', type: 'text', required: true },
      ],
    },
    add_to_waitlist: {
      name: 'add_to_waitlist',
      label: 'Add to Waitlist',
      description: 'When adding to event waitlist (sync workflow)',
      payloadSchema: z.object({
        eventId: z.string().describe('ABC event ID'),
        memberId: z.string().describe('ABC member ID'),
      }),
      testFields: [
        { name: 'eventId', label: 'Event ID', type: 'text', required: true },
        { name: 'memberId', label: 'Member ID', type: 'text', required: true },
      ],
    },
  },
  actions: {}, // Booking is trigger-only - actions are in ABC Ignite adapter
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
  resend: RESEND_ADAPTER,
  capture: CAPTURE_ADAPTER,
  booking: BOOKING_ADAPTER,
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
  triggers: Array<{ name: string; label: string; description?: string; testFields?: OperationDefinition['testFields'] }>;
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
        testFields: t.testFields,
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


