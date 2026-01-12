/**
 * Form Registry
 * 
 * Lists all available bespoke form IDs.
 * When creating a new bespoke form, add its ID here.
 * 
 * The admin UI uses this to validate form IDs and show warnings
 * if an unrecognized form ID is entered.
 */

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
  type: 'booking' | 'intake' | 'contact' | 'survey' | 'other';
}

/**
 * Registry of all available bespoke forms.
 * 
 * To add a new form:
 * 1. Create your form page (e.g., app/clients/acme/book/page.tsx)
 * 2. Set FORM_ID in the page
 * 3. Add an entry here with the same ID
 */
export const FORM_REGISTRY: FormRegistryEntry[] = [
  {
    id: 'sportswest-booking',
    name: 'Sports West Booking',
    description: 'Personal training session booking for Sports West Athletic Club',
    path: '/clients/sportswest/book',
    type: 'booking',
  },
  // Add new forms here as you build them:
  // {
  //   id: 'acme-intake',
  //   name: 'ACME Prospect Intake',
  //   description: 'Lead capture form for ACME Corp',
  //   path: '/clients/acme/intake',
  //   type: 'intake',
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
