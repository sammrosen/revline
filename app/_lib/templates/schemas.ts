/**
 * Template Copy Schemas
 * 
 * Defines the copy schema for each template type.
 * Used by the config editor to dynamically generate form fields.
 * 
 * Each field includes:
 * - key: The field key in the copy config
 * - label: Display label for the form field
 * - description: Help text for the field
 * - default: Default value
 * - maxLength: Maximum character length
 * - placeholder: Input placeholder text
 */

import { DEFAULT_BOOKING_COPY, DEFAULT_SIGNUP_COPY } from '@/app/_lib/config/defaults';

// =============================================================================
// SCHEMA TYPES
// =============================================================================

/**
 * Schema for a single copy field
 */
export interface CopyFieldSchema {
  key: string;
  label: string;
  description: string;
  default: string;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
}

/**
 * Schema for a template's copy configuration
 */
export interface TemplateCopySchema {
  templateId: string;
  templateName: string;
  fields: CopyFieldSchema[];
}

// =============================================================================
// BOOKING TEMPLATE SCHEMA
// =============================================================================

/**
 * Copy schema for the magic link booking template
 */
export const BOOKING_COPY_SCHEMA: TemplateCopySchema = {
  templateId: 'booking',
  templateName: 'Booking Form',
  fields: [
    {
      key: 'headline',
      label: 'Page Headline',
      description: 'Main heading displayed at the top of the booking page',
      default: DEFAULT_BOOKING_COPY.headline,
      maxLength: 60,
      placeholder: 'e.g., Book Your Training Session',
    },
    {
      key: 'subhead',
      label: 'Subheadline',
      description: 'Optional text below the headline',
      default: DEFAULT_BOOKING_COPY.subhead,
      maxLength: 120,
      placeholder: 'e.g., Schedule a session with our certified trainers',
    },
    {
      key: 'submitButton',
      label: 'Submit Button Text',
      description: 'Text shown on the submit button',
      default: DEFAULT_BOOKING_COPY.submitButton,
      maxLength: 30,
      placeholder: 'e.g., Book Now',
    },
    {
      key: 'successTitle',
      label: 'Success Page Title',
      description: 'Title shown after successful submission',
      default: DEFAULT_BOOKING_COPY.successTitle,
      maxLength: 60,
      placeholder: 'e.g., Booking Requested!',
    },
    {
      key: 'successMessage',
      label: 'Success Message',
      description: 'Message shown on the success page',
      default: DEFAULT_BOOKING_COPY.successMessage,
      maxLength: 200,
      placeholder: 'e.g., Check your email for confirmation',
      multiline: true,
    },
    {
      key: 'footerText',
      label: 'Footer Text',
      description: 'Text shown in the page footer',
      default: DEFAULT_BOOKING_COPY.footerText,
      maxLength: 50,
      placeholder: 'e.g., Powered by Your Company',
    },
    {
      key: 'footerEmail',
      label: 'Footer Email',
      description: 'Contact email shown in the page footer',
      default: DEFAULT_BOOKING_COPY.footerEmail,
      maxLength: 100,
      placeholder: 'e.g., support@yourcompany.com',
    },
  ],
};

// =============================================================================
// SIGNUP TEMPLATE SCHEMA
// =============================================================================

/**
 * Copy schema for the membership signup template
 */
export const SIGNUP_COPY_SCHEMA: TemplateCopySchema = {
  templateId: 'signup',
  templateName: 'Membership Signup',
  fields: [
    {
      key: 'smsConsent',
      label: 'SMS Consent Text',
      description: 'Marketing consent checkbox text',
      default: DEFAULT_SIGNUP_COPY.smsConsent,
      maxLength: 300,
      placeholder: 'I agree to receive marketing messages...',
      multiline: true,
    },
    {
      key: 'disclaimer',
      label: 'Page Disclaimer',
      description: 'Disclaimer text shown at bottom of page',
      default: DEFAULT_SIGNUP_COPY.disclaimer,
      maxLength: 200,
      placeholder: 'Results may vary...',
    },
    {
      key: 'submitButton',
      label: 'Submit Button Text',
      description: 'Text on the final submit button',
      default: DEFAULT_SIGNUP_COPY.submitButton,
      maxLength: 30,
      placeholder: 'e.g., Complete Enrollment',
    },
    {
      key: 'successTitle',
      label: 'Success Page Title',
      description: 'Title shown after successful enrollment',
      default: DEFAULT_SIGNUP_COPY.successTitle,
      maxLength: 60,
      placeholder: 'e.g., Welcome!',
    },
    {
      key: 'successMessage',
      label: 'Success Message',
      description: 'Message shown on the confirmation page',
      default: DEFAULT_SIGNUP_COPY.successMessage,
      maxLength: 200,
      placeholder: 'Your membership is now active...',
      multiline: true,
    },
  ],
};

// =============================================================================
// BRANDING SCHEMA
// =============================================================================

/**
 * Schema for a single branding field
 */
export interface BrandingFieldSchema {
  key: string;
  label: string;
  description: string;
  type: 'color' | 'url' | 'select';
  default: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

/**
 * Schema for branding configuration
 */
export const BRANDING_SCHEMA: BrandingFieldSchema[] = [
  {
    key: 'primaryColor',
    label: 'Primary Color',
    description: 'Main brand color used for buttons and accents',
    type: 'color',
    default: '#3B82F6',
  },
  {
    key: 'secondaryColor',
    label: 'Secondary Color',
    description: 'Secondary color for hover states and highlights',
    type: 'color',
    default: '#1E40AF',
  },
  {
    key: 'backgroundColor',
    label: 'Background Color',
    description: 'Page background color',
    type: 'color',
    default: '#F9FAFB',
  },
  {
    key: 'logo',
    label: 'Logo URL',
    description: 'URL to your logo image (https only)',
    type: 'url',
    default: '',
    placeholder: 'https://example.com/logo.png',
  },
  {
    key: 'fontFamily',
    label: 'Font Family',
    description: 'Font used throughout the template',
    type: 'select',
    default: 'inter',
    options: [
      { value: 'inter', label: 'Inter (Modern, Clean)' },
      { value: 'poppins', label: 'Poppins (Friendly, Round)' },
      { value: 'roboto', label: 'Roboto (Classic, Neutral)' },
      { value: 'system', label: 'System Default' },
    ],
  },
];

// =============================================================================
// SCHEMA REGISTRY
// =============================================================================

/**
 * Registry of all template copy schemas
 * Key is the template ID (matches form ID in Revline config)
 */
export const TEMPLATE_COPY_SCHEMAS: Record<string, TemplateCopySchema> = {
  booking: BOOKING_COPY_SCHEMA,
  signup: SIGNUP_COPY_SCHEMA,
};

/**
 * Get copy schema for a template
 */
export function getTemplateCopySchema(templateId: string): TemplateCopySchema | null {
  return TEMPLATE_COPY_SCHEMAS[templateId] || null;
}
