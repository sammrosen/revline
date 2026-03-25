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
  phone?: string;
  source: string;
  metadata?: Record<string, string>;
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

  // Validate phone (optional, basic sanitization)
  let phone: string | undefined;
  if (input.phone && typeof input.phone === 'string') {
    const trimmed = input.phone.trim().slice(0, 20);
    if (trimmed) phone = trimmed;
  }

  // Validate source (use 'default' if not provided)
  const sourceInput = input.source || 'default';
  const sourceResult = validateSlug(sourceInput);
  if (!sourceResult.success) {
    return { success: false, error: sourceResult.error, field: sourceResult.field };
  }

  // Validate metadata (optional, string values only, capped)
  let metadata: Record<string, string> | undefined;
  if (input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)) {
    metadata = {};
    const entries = Object.entries(input.metadata as Record<string, unknown>).slice(0, 20);
    for (const [key, val] of entries) {
      if (typeof val === 'string') {
        metadata[key.slice(0, 50).replace(/[<>]/g, '')] = val.slice(0, 1000).replace(/[<>]/g, '');
      }
    }
    if (Object.keys(metadata).length === 0) metadata = undefined;
  }

  return {
    success: true,
    data: {
      email: emailResult.data!,
      name: nameResult.data,
      phone,
      source: sourceResult.data!,
      metadata,
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

// =============================================================================
// ZOD-BASED VALIDATION (Recommended for new code)
// =============================================================================

import { z, ZodSchema } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from './api-response';

/**
 * Result type for validateBody
 */
export type ValidateBodyResult<T> = 
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Validate request body against a Zod schema
 * 
 * Use this for type-safe validation in API routes:
 * 
 * @example
 * ```typescript
 * const LoginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(1),
 * });
 * 
 * export async function POST(request: NextRequest) {
 *   const validation = await validateBody(request, LoginSchema);
 *   if (!validation.success) return validation.response;
 *   
 *   const { email, password } = validation.data;
 *   // Now type-safe and validated
 * }
 * ```
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidateBodyResult<T>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      const errorMessages = result.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }).join(', ');
      
      return {
        success: false,
        response: ApiResponse.error(errorMessages, 400),
      };
    }
    
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: ApiResponse.error('Invalid JSON body', 400),
    };
  }
}

/**
 * Common Zod schemas for reuse
 */
export const CommonSchemas = {
  email: z.string().email('Invalid email format').max(254, 'Email too long'),
  password: z.string().min(1, 'Password is required'),
  uuid: z.string().uuid('Invalid ID format'),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50, 'Slug too long')
    .regex(/^[a-z][a-z0-9_]*$/, 'Slug must start with a letter and contain only lowercase letters, numbers, and underscores'),
};

/**
 * Mask a contact address for log output. Preserves first 2 and last 4 chars.
 * '+15551234567' -> '+1***4567'
 */
export function maskContact(address: string): string {
  if (!address || address.length <= 6) return '***';
  return address.slice(0, 2) + '***' + address.slice(-4);
}

