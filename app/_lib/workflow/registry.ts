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
      description: 'Add subscriber to a MailerLite group. Optionally map lead properties to subscriber fields.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        group: z.string().describe('Group key from client config'),
        fields: z.record(z.string(), z.string()).optional().describe('Map MailerLite field names to lead property keys (e.g., { "barcode": "barcode" })'),
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
const ContactSubmittedPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
});

export const REVLINE_ADAPTER: AdapterDefinition = {
  id: 'revline',
  name: 'RevLine',
  requiresIntegration: false, // Always available
  // Triggers are DYNAMIC — the workflow registry API injects workspace-specific
  // form triggers at runtime. Static schemas below enable payload compatibility
  // checks even though the UI dropdown is populated dynamically.
  triggers: {
    'contact-submitted': {
      name: 'contact-submitted',
      label: 'Contact Form Submitted',
      description: 'Visitor submitted a contact form on the landing page',
      payloadSchema: ContactSubmittedPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'name', label: 'Name', type: 'text' as const, required: false },
        { name: 'phone', label: 'Phone', type: 'text' as const, required: false },
        { name: 'source', label: 'Source', type: 'text' as const, required: false },
      ],
    },
  },
  actions: {
    create_lead: {
      name: 'create_lead',
      label: 'Create/Update Lead',
      description: 'Create or update a lead record. Supports capturing custom properties from the trigger payload.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        source: z.string().optional().describe('Lead source identifier'),
        properties: z.record(z.string(), z.unknown()).optional().describe('Explicit property values to set (e.g., { barcode: "ABC123" })'),
        captureProperties: z.boolean().optional().describe('Auto-extract properties from trigger payload matching workspace schema'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'name', label: 'Name', type: 'text' as const, required: false },
        { name: 'source', label: 'Source', type: 'text' as const, required: false, placeholder: 'test-suite' },
      ],
    },
    update_lead_properties: {
      name: 'update_lead_properties',
      label: 'Update Lead Properties',
      description: 'Update custom properties on an existing lead. Merges with existing values.',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        properties: z.record(z.string(), z.unknown()).optional().describe('Explicit property values to set'),
        fromPayload: z.boolean().optional().describe('Auto-extract properties from trigger payload'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'properties', label: 'Properties (JSON)', type: 'text' as const, required: false, placeholder: '{"key": "value"}' },
      ],
    },
    update_lead_stage: {
      name: 'update_lead_stage',
      label: 'Update Lead Stage',
      description: 'Update the stage of a lead',
      payloadSchema: z.object({ email: z.string().email() }),
      paramsSchema: z.object({
        stage: LeadStageSchema.describe('New stage for the lead'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'stage', label: 'Stage', type: 'select' as const, required: true, default: 'CAPTURED', options: [
          { value: 'CAPTURED', label: 'Captured' },
          { value: 'BOOKED', label: 'Booked' },
          { value: 'PAID', label: 'Paid' },
          { value: 'DEAD', label: 'Dead' },
        ]},
      ],
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
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'eventType', label: 'Event Type', type: 'text' as const, required: true, placeholder: 'custom_event' },
        { name: 'success', label: 'Success', type: 'select' as const, required: false, default: 'true', options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ]},
      ],
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
  triggers: {
    new_member: {
      name: 'new_member',
      label: 'New Member Detected',
      description: 'Fires when a new member is detected via hourly sync — catches both direct signups and prospect-to-member conversions (requires Member Sync enabled in ABC config)',
      payloadSchema: z.object({
        email: z.string().email(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        barcode: z.string().optional(),
        member_id: z.string().optional(),
        member_status: z.string().optional(),
        home_club: z.string().optional(),
        gender: z.string().optional(),
        join_status: z.string().optional().describe('"Member" or "Prospect"'),
        is_converted_prospect: z.string().optional().describe('"true" if member was originally a prospect'),
        membership_type: z.string().optional().describe('Agreement membership type (e.g., "Monthly Premier")'),
        converted_date: z.string().optional().describe('ISO date when prospect was converted to member'),
        agreement_entry_source: z.string().optional().describe('How the agreement was created (e.g., "Web", "DataTrak EAE")'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true, default: 'test@example.com' },
        { name: 'name', label: 'Name', type: 'text' as const, required: false, default: 'Test Member' },
        { name: 'first_name', label: 'First Name', type: 'text' as const, required: false, default: 'Test' },
        { name: 'last_name', label: 'Last Name', type: 'text' as const, required: false, default: 'Member' },
        { name: 'phone', label: 'Phone', type: 'text' as const, required: false, default: '+15551234567' },
        { name: 'barcode', label: 'Barcode', type: 'text' as const, required: false, default: '12345' },
        { name: 'member_id', label: 'Member ID', type: 'text' as const, required: false },
        { name: 'member_status', label: 'Member Status', type: 'text' as const, required: false, default: 'Active' },
        { name: 'join_status', label: 'Join Status', type: 'select' as const, required: false, default: 'Member', options: [
          { value: 'Member', label: 'Member' },
          { value: 'Prospect', label: 'Prospect' },
        ]},
      ],
    },
  },
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
 * 
 * Two modes:
 * 1. Template mode: Use Resend's native template system with variable mapping from lead properties
 * 2. Inline mode: Raw HTML subject/body with {{lead.*}} variable resolution (backward compatible)
 */
export const RESEND_ADAPTER: AdapterDefinition = {
  id: 'resend',
  name: 'Resend',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['fromEmail'],
  },
  triggers: {
    email_bounced: {
      name: 'email_bounced',
      label: 'Email Bounced',
      description: 'Fires when a sent email permanently bounces. Use to remove invalid leads or flag for review.',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email that bounced'),
        error_state: z.string().optional().describe('Provider-prefixed error state (e.g., "resend.email_bounced")'),
        bounce_type: z.string().optional().describe('Bounce classification (e.g., "Permanent", "Temporary")'),
        bounce_message: z.string().optional().describe('Bounce reason from the mail server'),
        subject: z.string().optional().describe('Original email subject'),
      }),
    },
    email_complained: {
      name: 'email_complained',
      label: 'Email Complained (Spam)',
      description: 'Fires when a recipient marks the email as spam. Use to suppress future sends or remove from lists.',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email that reported spam'),
        error_state: z.string().optional().describe('Provider-prefixed error state (e.g., "resend.email_complained")'),
        subject: z.string().optional().describe('Original email subject'),
      }),
    },
    email_failed: {
      name: 'email_failed',
      label: 'Email Failed',
      description: 'Fires when an email fails to send. Use to retry or flag leads with delivery issues.',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email that failed'),
        error_state: z.string().optional().describe('Provider-prefixed error state (e.g., "resend.email_failed")'),
        subject: z.string().optional().describe('Original email subject'),
      }),
    },
    email_delivery_delayed: {
      name: 'email_delivery_delayed',
      label: 'Email Delivery Delayed',
      description: 'Fires when email delivery is temporarily delayed. Transient -- auto-clears when the email is eventually delivered.',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email with delayed delivery'),
        error_state: z.string().optional().describe('Provider-prefixed error state (e.g., "resend.delivery_delayed")'),
        subject: z.string().optional().describe('Original email subject'),
      }),
    },
    email_received: {
      name: 'email_received',
      label: 'Email Received',
      description: 'Fires when an inbound email arrives (via Resend inbound webhook). Use to route to an agent or start a workflow.',
      payloadSchema: z.object({
        from: z.string().email().describe('Sender email address'),
        to: z.string().email().describe('Recipient email address (your inbound address)'),
        body: z.string().describe('Plain text body of the email'),
        subject: z.string().optional().describe('Email subject line'),
      }),
      testFields: [
        { name: 'from', label: 'From Email', type: 'email' as const, required: true },
        { name: 'to', label: 'To Email', type: 'email' as const, required: true },
        { name: 'body', label: 'Body', type: 'text' as const, required: true, placeholder: 'Email body text' },
        { name: 'subject', label: 'Subject', type: 'text' as const, required: false, placeholder: 'Re: Hello' },
      ],
    },
  },
  actions: {
    send_email: {
      name: 'send_email',
      label: 'Send Email',
      description: 'Send a transactional email via Resend. Use a Resend template with lead variable mapping, or send inline HTML with {{lead.*}} template vars.',
      payloadSchema: CommonPayloadSchema.extend({
        email: z.string().email().describe('Recipient email from trigger payload'),
      }),
      paramsSchema: z.object({
        // Template mode (preferred)
        template: z.string().optional().describe('Template key from Resend config'),
        fields: z.record(z.string(), z.string()).optional()
          .describe('Map Resend variable names to lead property keys (e.g., { "BARCODE": "barcode" })'),
        // Inline mode (backward compatible)
        subject: z.string().optional().describe('Email subject line (inline mode, supports {{lead.*}}, {{payload.*}} template vars)'),
        body: z.string().optional().describe('Email body HTML (inline mode, supports {{lead.*}}, {{payload.*}} template vars)'),
        // Shared
        replyTo: z.string().email().optional().describe('Override reply-to address'),
      }),
      paramRequirements: {
        template: 'meta.templates', // params.template must be a key in meta.templates
      },
      testFields: [
        { name: 'email', label: 'To Email', type: 'email' as const, required: true },
        { name: 'subject', label: 'Subject', type: 'text' as const, required: false, placeholder: 'Test email subject' },
        { name: 'body', label: 'Body HTML', type: 'text' as const, required: false, placeholder: '<p>Hello {{lead.name}}!</p>' },
      ],
    },
  },
};

/**
 * Twilio Adapter
 * Handles SMS messaging via Twilio
 */
export const TWILIO_ADAPTER: AdapterDefinition = {
  id: 'twilio',
  name: 'Twilio',
  requiresIntegration: true,
  requirements: {
    secrets: ['Account SID', 'Auth Token'],
  },
  triggers: {
    sms_received: {
      name: 'sms_received',
      label: 'SMS Received',
      description: 'Fires when an inbound SMS arrives at the workspace phone number',
      payloadSchema: z.object({
        from: z.string().describe('Sender phone number (E.164)'),
        to: z.string().optional().describe('Recipient phone number'),
        body: z.string().describe('SMS message text'),
        messageSid: z.string().optional().describe('Twilio message SID'),
        numSegments: z.number().optional().describe('Number of SMS segments'),
      }),
      testFields: [
        { name: 'from', label: 'From Phone', type: 'text', required: true, placeholder: '+15551234567' },
        { name: 'body', label: 'Message Body', type: 'text', required: true, placeholder: 'Hello!' },
      ],
    },
    missed_call: {
      name: 'missed_call',
      label: 'Missed Call',
      description: 'Fires when a forwarded missed call is received at the workspace Twilio number',
      payloadSchema: z.object({
        from: z.string().describe('Caller phone number (E.164)'),
        to: z.string().describe('Twilio number that received the call (E.164)'),
        callSid: z.string().describe('Twilio call SID'),
        callerCity: z.string().optional(),
        callerState: z.string().optional(),
        callerCountry: z.string().optional(),
        phoneConfigId: z.string().optional(),
        mode: z.string().optional().describe('NOTIFICATION or AGENT'),
      }),
      testFields: [
        { name: 'from', label: 'Caller Phone', type: 'text', required: true, placeholder: '+15551234567' },
        { name: 'to', label: 'Twilio Number', type: 'text', required: true, placeholder: '+15559876543' },
      ],
    },
  },
  actions: {
    send_sms: {
      name: 'send_sms',
      label: 'Send SMS',
      description: 'Send an SMS message via Twilio. Supports {{lead.*}}, {{payload.*}} template variables in the body.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        to: z.string().optional().describe('Recipient phone number (defaults to trigger "from" for replies)'),
        body: z.string().describe('Message text (supports {{lead.*}}, {{payload.*}} template vars)'),
        phoneNumber: z.string().optional().describe('Phone number key from Twilio config (uses default if not provided)'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'to', label: 'To Phone', type: 'text' as const, required: false, placeholder: '+15551234567' },
        { name: 'body', label: 'Message Body', type: 'text' as const, required: true, placeholder: 'Hello {{lead.name}}!' },
      ],
    },
  },
};

/**
 * Handles AI text generation via OpenAI
 */
export const OPENAI_ADAPTER: AdapterDefinition = {
  id: 'openai',
  name: 'OpenAI',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['model'],
  },
  triggers: {},
  actions: {
    generate_text: {
      name: 'generate_text',
      label: 'Generate Text',
      description: 'Generate text using OpenAI Chat Completions. Supports {{lead.*}}, {{payload.*}} template variables in the prompt.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        prompt: z.string().describe('User prompt (supports {{lead.*}}, {{payload.*}} template vars)'),
        systemPrompt: z.string().optional().describe('Developer/system instructions for the AI'),
        model: z.string().optional().describe('Override model from integration config'),
        temperature: z.number().optional().describe('Override temperature (0-2)'),
        maxTokens: z.number().optional().describe('Override max tokens'),
      }),
    },
  },
};

/**
 * Handles AI text generation via Anthropic Claude
 */
export const ANTHROPIC_ADAPTER: AdapterDefinition = {
  id: 'anthropic',
  name: 'Anthropic',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Key'],
    metaKeys: ['model', 'maxTokens'],
  },
  triggers: {},
  actions: {
    generate_text: {
      name: 'generate_text',
      label: 'Generate Text',
      description: 'Generate text using Anthropic Claude Messages API. Supports {{lead.*}}, {{payload.*}} template variables in the prompt.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        prompt: z.string().describe('User prompt (supports {{lead.*}}, {{payload.*}} template vars)'),
        systemPrompt: z.string().optional().describe('System instructions for Claude'),
        model: z.string().optional().describe('Override model from integration config'),
        temperature: z.number().optional().describe('Override temperature (0-1)'),
        maxTokens: z.number().optional().describe('Override max tokens'),
      }),
    },
  },
};

/**
 * Agent Adapter (Internal)
 * Handles autonomous conversational loops between leads and AI.
 * Channel-agnostic and AI-agnostic -- configuration lives on the Agent model.
 */
export const AGENT_ADAPTER: AdapterDefinition = {
  id: 'agent',
  name: 'Agent',
  requiresIntegration: false,
  triggers: {
    conversation_started: {
      name: 'conversation_started',
      label: 'Conversation Started',
      description: 'Fires when a new agent conversation is created',
      payloadSchema: z.object({
        agentId: z.string(),
        conversationId: z.string(),
        contactAddress: z.string(),
        channel: z.string(),
        leadId: z.string().optional(),
      }),
    },
    escalation_requested: {
      name: 'escalation_requested',
      label: 'Escalation Requested',
      description: 'Fires when the bot cannot handle a request and needs human intervention',
      payloadSchema: z.object({
        agentId: z.string(),
        conversationId: z.string(),
        reason: z.string().optional(),
        leadId: z.string().optional(),
      }),
    },
    conversation_completed: {
      name: 'conversation_completed',
      label: 'Conversation Completed',
      description: 'Fires when a conversation ends (limit hit, timeout, or goal completed)',
      payloadSchema: z.object({
        agentId: z.string(),
        conversationId: z.string(),
        reason: z.string().optional(),
        leadId: z.string().optional(),
      }),
    },
    contact_opted_out: {
      name: 'contact_opted_out',
      label: 'Contact Opted Out',
      description: 'Fires when a contact sends STOP/UNSUBSCRIBE and opts out of messaging',
      payloadSchema: z.object({
        agentId: z.string(),
        contactAddress: z.string(),
        keyword: z.string(),
        conversationId: z.string().optional(),
      }),
    },
    bot_event: {
      name: 'bot_event',
      label: 'Bot Event',
      description: 'Generic event emitted by the bot via allowedEvents config',
      payloadSchema: z.object({
        agentId: z.string(),
        conversationId: z.string(),
        eventType: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
        leadId: z.string().optional(),
      }),
    },
  },
  actions: {
    route_to_agent: {
      name: 'route_to_agent',
      label: 'Route to Agent',
      description: 'Activate an agent for this lead/channel. The agent handles the reply autonomously.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        agentId: z.string().describe('ID of the agent to route to'),
        channelType: z.string().optional().describe('Which of the agent\'s channels to use (SMS, EMAIL, WEB_CHAT). Omit to infer from trigger.'),
        messageText: z.string().optional().describe('Override message for proactive outreach (supports lead variables)'),
      }),
      testFields: [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
        { name: 'agentId', label: 'Agent ID', type: 'text' as const, required: true, placeholder: 'Agent ID to route to' },
        { name: 'messageText', label: 'Message', type: 'text' as const, required: false, placeholder: 'Override initial message (optional)' },
      ],
    },
  },
};

/**
 * Shared payload schema for Pipedrive deal webhook triggers.
 * Pipedrive webhook v1/v2 shapes vary — use .passthrough() and coerce numeric IDs.
 */
const DealPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  pipedriveDealId: z.coerce.number(),
  pipedrivePersonId: z.coerce.number().optional(),
  pipelineId: z.coerce.number().optional(),
  stageId: z.coerce.number().optional(),
  status: z.string().optional(),
  title: z.string().optional(),
  value: z.coerce.number().optional(),
  currency: z.string().optional(),
}).passthrough();

/**
 * Pipedrive Adapter
 * CRM integration — person sync, field updates, deal management
 */
export const PIPEDRIVE_ADAPTER: AdapterDefinition = {
  id: 'pipedrive',
  name: 'Pipedrive',
  requiresIntegration: true,
  requirements: {
    secrets: ['API Token'],
  },
  triggers: {
    person_created: {
      name: 'person_created',
      label: 'Person Created',
      description: 'Fires when a person is created in Pipedrive (via webhook)',
      payloadSchema: CommonPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
        { name: 'phone', label: 'Phone', type: 'text', required: false },
      ],
    },
    person_updated: {
      name: 'person_updated',
      label: 'Person Updated',
      description: 'Fires when a Pipedrive person field changes (via webhook)',
      payloadSchema: CommonPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'field', label: 'Changed Field', type: 'text', required: false },
      ],
    },
    deal_added: {
      name: 'deal_added',
      label: 'Deal Added',
      description: 'Fires when a deal is created in Pipedrive (via webhook)',
      payloadSchema: DealPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'pipedriveDealId', label: 'Pipedrive Deal ID', type: 'number', required: true },
      ],
    },
    deal_updated: {
      name: 'deal_updated',
      label: 'Deal Updated',
      description: 'Fires when a deal is updated in Pipedrive (status did not transition to won/lost)',
      payloadSchema: DealPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'pipedriveDealId', label: 'Pipedrive Deal ID', type: 'number', required: true },
      ],
    },
    deal_won: {
      name: 'deal_won',
      label: 'Deal Won',
      description: 'Fires when a Pipedrive deal transitions to status=won',
      payloadSchema: DealPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'pipedriveDealId', label: 'Pipedrive Deal ID', type: 'number', required: true },
      ],
    },
    deal_lost: {
      name: 'deal_lost',
      label: 'Deal Lost',
      description: 'Fires when a Pipedrive deal transitions to status=lost',
      payloadSchema: DealPayloadSchema,
      testFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'pipedriveDealId', label: 'Pipedrive Deal ID', type: 'number', required: true },
      ],
    },
  },
  actions: {
    create_or_update_person: {
      name: 'create_or_update_person',
      label: 'Create or Update Person',
      description: 'Upsert a person in Pipedrive by email. Returns pipedrivePersonId for downstream actions.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        fields: z.record(z.string(), z.string()).optional(),
      }),
    },
    update_person_fields: {
      name: 'update_person_fields',
      label: 'Update Person Fields',
      description: 'Update specific fields on an existing Pipedrive person (requires pipedrivePersonId in context)',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        fields: z.record(z.string(), z.string()),
      }),
    },
    create_deal: {
      name: 'create_deal',
      label: 'Create Deal',
      description: 'Create a deal in Pipedrive linked to the person (requires pipedrivePersonId in context). Returns pipedriveDealId.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        title: z.string().optional(),
        value: z.coerce.number().optional(),
        currency: z.string().optional(),
        pipelineId: z.coerce.number().optional(),
        stageId: z.coerce.number().optional(),
        status: z.string().optional(),
      }),
    },
    update_deal: {
      name: 'update_deal',
      label: 'Update Deal',
      description: 'Update fields on an existing Pipedrive deal (requires pipedriveDealId in context).',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        title: z.string().optional(),
        value: z.coerce.number().optional(),
        currency: z.string().optional(),
        pipelineId: z.coerce.number().optional(),
        stageId: z.coerce.number().optional(),
        status: z.string().optional(),
      }),
    },
    move_deal_stage: {
      name: 'move_deal_stage',
      label: 'Move Deal Stage',
      description: 'Move a Pipedrive deal to a specific stage (requires pipedriveDealId in context).',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        stageId: z.coerce.number(),
      }),
    },
  },
};

// =============================================================================
// ACTIONFLOW
// =============================================================================

const ActionFlowCustomerPayloadSchema = z.object({
  email: z.string().email().optional(),
  name: z.string(),
  phone: z.string().optional(),
}).passthrough();

/**
 * ActionFlow Adapter
 * Countertop/stone fabrication ERP — customer and job management (outbound only)
 */
export const ACTIONFLOW_ADAPTER: AdapterDefinition = {
  id: 'actionflow',
  name: 'ActionFlow',
  requiresIntegration: true,
  requirements: {
    secrets: ['Client ID', 'Client Secret', 'Username', 'Password'],
    metaKeys: ['enterpriseId'],
  },
  triggers: {},
  actions: {
    create_customer_with_lead: {
      name: 'create_customer_with_lead',
      label: 'Create Customer with Lead',
      description: 'Create a customer in ActionFlow with a lead notification action that alerts ActionFlow users.',
      payloadSchema: ActionFlowCustomerPayloadSchema,
      paramsSchema: z.object({
        jobName: z.string().optional(),
        jobNotes: z.string().optional(),
        actionComment: z.string().optional(),
        street1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
      }),
      testFields: [
        { name: 'name', label: 'Customer Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: false },
        { name: 'phone', label: 'Phone', type: 'text', required: false },
      ],
    },
    create_customer: {
      name: 'create_customer',
      label: 'Create Customer',
      description: 'Create a customer in ActionFlow without a lead notification.',
      payloadSchema: ActionFlowCustomerPayloadSchema,
      paramsSchema: z.object({
        jobName: z.string().optional(),
        jobNotes: z.string().optional(),
        street1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
      }),
      testFields: [
        { name: 'name', label: 'Customer Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: false },
        { name: 'phone', label: 'Phone', type: 'text', required: false },
      ],
    },
    get_job: {
      name: 'get_job',
      label: 'Get Job',
      description: 'Read job details from ActionFlow for use in customer communications.',
      payloadSchema: CommonPayloadSchema,
      paramsSchema: z.object({
        jobId: z.coerce.number(),
        includeCompleted: z.coerce.boolean().optional(),
      }),
      testFields: [
        { name: 'jobId', label: 'ActionFlow Job ID', type: 'number', required: true },
      ],
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
  resend: RESEND_ADAPTER,
  twilio: TWILIO_ADAPTER,
  openai: OPENAI_ADAPTER,
  anthropic: ANTHROPIC_ADAPTER,
  agent: AGENT_ADAPTER,
  pipedrive: PIPEDRIVE_ADAPTER,
  actionflow: ACTIONFLOW_ADAPTER,
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
  actions: Array<{ name: string; label: string; description?: string; testFields?: OperationDefinition['testFields'] }>;
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
        testFields: a.testFields,
      })),
    }));
}


