/**
 * Input Validation Utilities
 * 
 * All external input MUST be validated before processing.
 * Use these validators in route handlers.
 * 
 * STANDARDS:
 * - Never trust external input
 * - Return structured validation results
 * - Include field names for better error messages
 */

import { ValidationResult, EMAIL_REGEX, SLUG_REGEX } from '@/app/_lib/types';

/**
 * Validate email address format
 */
export function validateEmail(email: unknown): ValidationResult<string> {
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'Email is required', field: 'email' };
  }

  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) {
    return { success: false, error: 'Email is required', field: 'email' };
  }

  if (trimmed.length > 254) {
    return { success: false, error: 'Email is too long', field: 'email' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { success: false, error: 'Invalid email format', field: 'email' };
  }

  return { success: true, data: trimmed };
}

/**
 * Validate client slug format
 */
export function validateSlug(slug: unknown): ValidationResult<string> {
  if (!slug || typeof slug !== 'string') {
    return { success: false, error: 'Source is required', field: 'source' };
  }

  const normalized = slug.trim().toLowerCase();
  
  if (normalized.length === 0) {
    return { success: false, error: 'Source is required', field: 'source' };
  }

  if (normalized.length > 50) {
    return { success: false, error: 'Source is too long', field: 'source' };
  }

  if (!SLUG_REGEX.test(normalized)) {
    return { 
      success: false, 
      error: 'Source must start with a letter and contain only lowercase letters, numbers, and underscores',
      field: 'source',
    };
  }

  return { success: true, data: normalized };
}

/**
 * Validate optional name field
 */
export function validateName(name: unknown): ValidationResult<string | undefined> {
  if (name === undefined || name === null || name === '') {
    return { success: true, data: undefined };
  }

  if (typeof name !== 'string') {
    return { success: false, error: 'Name must be a string', field: 'name' };
  }

  const trimmed = name.trim();

  if (trimmed.length > 100) {
    return { success: false, error: 'Name is too long', field: 'name' };
  }

  // Basic sanitization - remove any potentially dangerous characters
  const sanitized = trimmed.replace(/[<>]/g, '');

  return { success: true, data: sanitized };
}

/**
 * Capture endpoint input validation
 */
export interface CaptureInputValidation {
  email: string;
  name?: string;
  source: string;
}

export function validateCaptureInput(body: unknown): ValidationResult<CaptureInputValidation> {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }

  const input = body as Record<string, unknown>;

  // Validate email
  const emailResult = validateEmail(input.email);
  if (!emailResult.success) {
    return { success: false, error: emailResult.error, field: emailResult.field };
  }

  // Validate name (optional)
  const nameResult = validateName(input.name);
  if (!nameResult.success) {
    return { success: false, error: nameResult.error, field: nameResult.field };
  }

  // Validate source (use 'default' if not provided)
  const sourceInput = input.source || 'default';
  const sourceResult = validateSlug(sourceInput);
  if (!sourceResult.success) {
    return { success: false, error: sourceResult.error, field: sourceResult.field };
  }

  return {
    success: true,
    data: {
      email: emailResult.data!,
      name: nameResult.data,
      source: sourceResult.data!,
    },
  };
}

/**
 * Validate UUID format
 */
export function validateUUID(id: unknown): ValidationResult<string> {
  if (!id || typeof id !== 'string') {
    return { success: false, error: 'Invalid ID format' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return { success: false, error: 'Invalid ID format' };
  }

  return { success: true, data: id.toLowerCase() };
}

/**
 * Validate JSON object (for meta fields)
 */
export function validateJSON(value: unknown): ValidationResult<Record<string, unknown>> {
  if (value === undefined || value === null) {
    return { success: true, data: {} };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, error: 'Must be a JSON object' };
      }
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'Invalid JSON format' };
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return { success: true, data: value as Record<string, unknown> };
  }

  return { success: false, error: 'Must be a JSON object' };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

