/**
 * Custom Validator Registry
 *
 * Optional custom validators for adapters that need validation beyond
 * the declarative requirements defined in the registry.
 *
 * Most adapters don't need custom validators - the declarative approach handles:
 * - Integration existence
 * - Required secrets
 * - Required meta keys
 * - Param references to meta values
 *
 * Use custom validators for:
 * - API-level validation (e.g., verify a MailerLite group exists in their account)
 * - Complex business rules
 * - Cross-field validation
 */

import { AdapterValidator, ValidationResult } from '../types';

// =============================================================================
// VALIDATOR REGISTRY
// =============================================================================

/**
 * Registry of custom validators by adapter ID
 * Validators are optional - if not registered, only declarative validation runs
 */
const VALIDATOR_REGISTRY: Map<string, AdapterValidator> = new Map();

/**
 * Register a custom validator for an adapter
 *
 * @param adapterId - The adapter ID (e.g., 'mailerlite')
 * @param validator - The validator implementation
 */
export function registerValidator(adapterId: string, validator: AdapterValidator): void {
  VALIDATOR_REGISTRY.set(adapterId.toLowerCase(), validator);
}

/**
 * Get a custom validator for an adapter
 *
 * @param adapterId - The adapter ID
 * @returns The validator if registered, null otherwise
 */
export function getValidator(adapterId: string): AdapterValidator | null {
  return VALIDATOR_REGISTRY.get(adapterId.toLowerCase()) ?? null;
}

/**
 * Check if a custom validator is registered for an adapter
 */
export function hasValidator(adapterId: string): boolean {
  return VALIDATOR_REGISTRY.has(adapterId.toLowerCase());
}

/**
 * Get all registered validator adapter IDs
 */
export function getRegisteredValidators(): string[] {
  return Array.from(VALIDATOR_REGISTRY.keys());
}

// =============================================================================
// HELPER: Create validation results
// =============================================================================

/**
 * Create a successful validation result
 */
export function validationSuccess(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Create a failed validation result
 */
export function validationFailure(
  code: string,
  message: string,
  details?: { adapter?: string; operation?: string; param?: string }
): ValidationResult {
  return {
    valid: false,
    errors: [{
      code: code as ValidationResult['errors'][0]['code'],
      message,
      ...details,
    }],
    warnings: [],
  };
}

/**
 * Create a validation result with warnings (but still valid)
 */
export function validationWarning(
  code: string,
  message: string,
  suggestion?: string
): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [{ code, message, suggestion }],
  };
}

// =============================================================================
// REGISTER DEFAULT VALIDATORS
// =============================================================================

// Note: We don't register any validators by default.
// Declarative validation in registry.ts handles most cases.
//
// To add a custom validator:
//
// 1. Create a file: validators/mailerlite.validator.ts
// 2. Implement AdapterValidator interface
// 3. Register it here:
//
// import { mailerliteValidator } from './mailerlite.validator';
// registerValidator('mailerlite', mailerliteValidator);

