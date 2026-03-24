/**
 * Form Registry
 * 
 * Lists all available bespoke form IDs and their baked-in operations.
 * When creating a new bespoke form, add its ID here along with:
 * - operations: What integrations the form calls internally (ABC, Resend, etc.)
 * - triggers: What events the form emits for workflows to respond to
 * 
 * The admin UI uses this to validate form IDs, show warnings,
 * and the dependency graph uses it to visualize the complete business flow.
 */

export interface FormTrigger {
  /** Trigger ID - used as workflow triggerOperation */
  id: string;
  /** Human-readable label for the workflow editor */
  label: string;
  /** Optional description of when this trigger fires */
  description?: string;
}

/**
 * Represents an operation that a form performs internally.
 * These are "baked-in" operations that happen automatically when the form runs,
 * as opposed to workflow actions which are configurable.
 */
export interface FormOperation {
  /** Adapter that performs this operation (e.g., 'abc_ignite', 'resend') */
  adapter: string;
  /** Operation name (e.g., 'lookup_member', 'send_email') */
  operation: string;
  /** Human-readable label for display in the graph */
  label?: string;
  /** True if this operation only runs in some code paths (e.g., conditional checks) */
  conditional?: boolean;
  /** 
   * Phase relative to trigger emission:
   * - 'pre': Happens before the async gap (initial request phase)
   * - 'trigger': Happens when the trigger fires (confirmation phase)
   * Default: 'pre'
   */
  phase?: 'pre' | 'trigger';
  /** 
   * If true, can run in parallel with other parallel ops in the same phase.
   * Default: false (sequential execution)
   */
  parallel?: boolean;
}

export interface FormRegistryEntry {
  /** Unique form identifier - must match FORM_ID in the form page */
  id: string;
  /** Human-readable name for the admin UI */
  name: string;
  /** Brief description of what the form does */
  description: string;
  /** Path where the form is deployed (for reference) */
  path: string;
  /** Form type - helps categorize forms */
  type: 'booking' | 'signup' | 'intake' | 'contact' | 'survey' | 'landing' | 'other';
  /** 
   * Operations this form performs internally (baked-in workflow).
   * These are integration calls that happen automatically when the form runs.
   * Used by the dependency graph to show complete business process visibility.
   */
  operations?: FormOperation[];
  /** Triggers this form can emit - required, at least one */
  triggers: FormTrigger[];
}

/**
 * Registry of all available bespoke forms.
 * 
 * To add a new form:
 * 1. Create your form page (e.g., app/workspaces/acme/book/page.tsx)
 * 2. Set FORM_ID in the page
 * 3. Add an entry here with the same ID
 */
export const FORM_REGISTRY: FormRegistryEntry[] = [
  {
    id: 'magic-link-booking',
    name: 'ABC Appointment Booking',
    description: 'Magic link booking flow for personal training sessions via ABC Ignite',
    path: '/public/{slug}/book',
    type: 'booking',
    // Baked-in operations this form performs automatically
    operations: [
      // Pre phase: Request (POST /api/v1/booking/request) - before user clicks magic link
      { adapter: 'abc_ignite', operation: 'lookup_member', label: 'Find member by barcode', phase: 'pre' },
      { adapter: 'abc_ignite', operation: 'check_eligibility', label: 'Verify booking eligibility', phase: 'pre', conditional: true },
      { adapter: 'resend', operation: 'send_email', label: 'Send magic link email', phase: 'pre' },
      // Trigger phase: Confirm (GET /api/v1/booking/confirm/[token]) - when trigger fires
      { adapter: 'abc_ignite', operation: 'enroll_member', label: 'Book appointment', phase: 'trigger' },
    ],
    triggers: [
      {
        id: 'booking-confirmed',
        label: 'Booking Confirmed',
        description: 'Member successfully booked a session',
      },
      {
        id: 'booking-waitlisted',
        label: 'Booking Waitlisted',
        description: 'Member added to waitlist for a session',
      },
    ],
  },
  {
    id: 'membership-signup',
    name: 'Membership Signup',
    description: 'Multi-step membership signup with plan selection and payment',
    path: '/public/{slug}/signup',
    type: 'signup',
    // No baked-in operations currently - triggers only
    operations: [],
    triggers: [
      {
        id: 'signup-completed',
        label: 'Signup Completed',
        description: 'Member successfully completed signup and payment',
      },
      {
        id: 'signup-started',
        label: 'Signup Started',
        description: 'User started the signup process (reached step 2)',
      },
      {
        id: 'signup-abandoned',
        label: 'Signup Abandoned',
        description: 'User abandoned signup before completion',
      },
    ],
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Configurable business landing page with contact capture and optional webchat',
    path: '/public/{slug}/landing',
    type: 'landing',
    operations: [],
    triggers: [
      {
        id: 'contact-submitted',
        label: 'Contact Form Submitted',
        description: 'Visitor submitted the contact form (reuses revline.email_captured)',
      },
    ],
  },
  // Add new forms here as you build them:
  // {
  //   id: 'swac-class-booking',
  //   name: 'SWAC Class Booking',
  //   description: 'Drop-in class booking for SWAC members',
  //   path: '/public/{slug}/classes',
  //   type: 'booking',
  //   operations: [
  //     // Pre phase: setup and validation
  //     { adapter: 'abc_ignite', operation: 'lookup_member', phase: 'pre' },
  //     { adapter: 'abc_ignite', operation: 'check_availability', phase: 'pre' },
  //     // Trigger phase: when booking completes
  //     { adapter: 'abc_ignite', operation: 'enroll_member', phase: 'trigger' },
  //     { adapter: 'resend', operation: 'send_email', label: 'Confirmation email', phase: 'trigger' },
  //   ],
  //   triggers: [
  //     { id: 'class-booked', label: 'Class Booked' },
  //     { id: 'class-waitlisted', label: 'Added to Waitlist' },
  //   ],
  // },
];

/**
 * Get all registered form IDs
 */
export function getRegisteredFormIds(): string[] {
  return FORM_REGISTRY.map(f => f.id);
}

/**
 * Check if a form ID is registered
 */
export function isFormRegistered(formId: string): boolean {
  return FORM_REGISTRY.some(f => f.id === formId);
}

/**
 * Get form details by ID
 */
export function getFormById(formId: string): FormRegistryEntry | undefined {
  return FORM_REGISTRY.find(f => f.id === formId);
}

/**
 * Get all triggers declared for a form
 */
export function getFormTriggers(formId: string): FormTrigger[] {
  const form = getFormById(formId);
  if (!form?.triggers) return [];
  return form.triggers;
}

/**
 * Check if a trigger ID is valid for a given form
 */
export function isValidFormTrigger(formId: string, triggerId: string): boolean {
  const triggers = getFormTriggers(formId);
  return triggers.some(t => t.id === triggerId);
}

/**
 * Resolve a path template by replacing {slug} with actual workspace slug
 * 
 * @param pathTemplate - Path with {slug} placeholder (e.g., '/public/{slug}/book')
 * @param workspaceSlug - The workspace slug to substitute
 * @returns Resolved path (e.g., '/public/sportswest/book')
 */
export function resolveFormPath(pathTemplate: string, workspaceSlug: string): string {
  return pathTemplate.replace(/{slug}/g, workspaceSlug);
}

/**
 * Get all baked-in operations for a form
 */
export function getFormOperations(formId: string): FormOperation[] {
  const form = getFormById(formId);
  return form?.operations ?? [];
}

/**
 * Get all forms that use a specific adapter in their baked-in operations
 */
export function getFormsUsingAdapter(adapterId: string): FormRegistryEntry[] {
  return FORM_REGISTRY.filter(f => 
    f.operations?.some(op => op.adapter === adapterId)
  );
}

/**
 * Get the list of integration adapters a form depends on
 * (unique adapters from the form's operations)
 */
export function getFormIntegrationDependencies(formId: string): string[] {
  const ops = getFormOperations(formId);
  return [...new Set(ops.map(op => op.adapter))];
}
