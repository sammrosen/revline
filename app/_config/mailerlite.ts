// MailerLite group ID mappings for lead capture (email forms)
// Maps source identifiers to environment variables
export const GROUP_ID_MAP: Record<string, string | undefined> = {
  DEFAULT: process.env.MAILERLITE_GROUP_ID,
  DEMO: process.env.MAILERLITE_GROUP_ID_DEMO,
  FIT1: process.env.MAILERLITE_GROUP_ID_FIT1,
  // Add more sources as needed: SOURCE_NAME: process.env.MAILERLITE_GROUP_ID_SOURCE_NAME
};

// MailerLite group ID mappings for paying customers (Stripe webhooks)
// Maps source identifiers to customer group environment variables
// 
// Supports two patterns:
// 1. SOURCE only: SAM → MAILERLITE_CUSTOMER_GROUP_SAM
// 2. SOURCE_PROGRAM: SAM_FIT1 → MAILERLITE_CUSTOMER_GROUP_SAM_FIT1
//
// When a webhook includes metadata.program, it will try SOURCE_PROGRAM first,
// then fall back to SOURCE if program-specific group is not configured.
export const CUSTOMER_GROUP_MAP: Record<string, string | undefined> = {
  // Source-level groups (all products go here if no program specified)
  SAM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM,
  DEMO: process.env.MAILERLITE_CUSTOMER_GROUP_DEMO,
  FIT1: process.env.MAILERLITE_CUSTOMER_GROUP_FIT1,
  
  // Program-specific groups (optional, for multiple products per source)
  // Format: SOURCE_PROGRAM
  SAM_FIT1: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_FIT1,
  SAM_DEMO: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_DEMO,
  SAM_PREMIUM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_PREMIUM,
  
  // Add more trainers: TRAINER_NAME: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINER_NAME
  // Add program-specific: TRAINER_PROGRAM: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINER_PROGRAM
};

// Optional: Export types for type safety
export type MailerliteSource = keyof typeof GROUP_ID_MAP;
export type MailerliteCustomerSource = keyof typeof CUSTOMER_GROUP_MAP;

