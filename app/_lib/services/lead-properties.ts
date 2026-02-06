/**
 * Lead Property Validation Service
 * 
 * Central logic for validating, extracting, and merging custom lead properties.
 * Properties are validated against the workspace's leadPropertySchema.
 * 
 * STANDARDS:
 * - All validation uses dynamically built Zod schemas
 * - Never trusts external input -- always validate against workspace schema
 * - Returns structured results, never throws
 */

import { z } from 'zod';
import {
  LeadPropertyDefinition,
  LeadPropertyType,
  LEAD_PROPERTY_KEY_REGEX,
  MAX_LEAD_PROPERTIES,
} from '@/app/_lib/types';

// =============================================================================
// SCHEMA VALIDATION (for workspace-level property definitions)
// =============================================================================

/**
 * Zod schema for validating a single LeadPropertyDefinition.
 */
export const LeadPropertyDefinitionSchema = z.object({
  key: z.string()
    .min(1, 'Property key is required')
    .max(50, 'Property key too long')
    .regex(LEAD_PROPERTY_KEY_REGEX, 'Key must start with a letter and contain only lowercase letters, numbers, and underscores'),
  label: z.string()
    .min(1, 'Property label is required')
    .max(100, 'Property label too long'),
  type: z.enum(['string', 'number', 'boolean', 'email', 'url'] as const),
  required: z.boolean(),
});

/**
 * Zod schema for validating the full leadPropertySchema array.
 */
export const LeadPropertySchemaDefinition = z.array(LeadPropertyDefinitionSchema)
  .max(MAX_LEAD_PROPERTIES, `Maximum ${MAX_LEAD_PROPERTIES} custom properties allowed`)
  .refine(
    (defs) => {
      const keys = defs.map(d => d.key);
      return new Set(keys).size === keys.length;
    },
    { message: 'Property keys must be unique' }
  );

// =============================================================================
// PROPERTY VALUE VALIDATION
// =============================================================================

/**
 * Build a Zod schema for a single property value based on its type definition.
 */
function buildValueSchema(type: LeadPropertyType): z.ZodTypeAny {
  switch (type) {
    case 'string':
      return z.string().max(1000, 'Value too long');
    case 'number':
      return z.number().finite();
    case 'boolean':
      return z.boolean();
    case 'email':
      return z.string().email('Invalid email format').max(254);
    case 'url':
      return z.string().url('Invalid URL format').max(2048);
    default:
      return z.string().max(1000);
  }
}

/**
 * Coerce a raw value to the expected type.
 * Form data often arrives as strings -- this converts "123" to 123 for number types, etc.
 */
function coerceValue(value: unknown, type: LeadPropertyType): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  switch (type) {
    case 'number':
      if (typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      return value;
    case 'boolean':
      if (typeof value === 'string') {
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
      }
      return value;
    default:
      // string, email, url -- keep as-is (already strings from forms)
      return typeof value === 'string' ? value.trim() : value;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Result of property validation.
 */
export interface ValidatePropertiesResult {
  success: boolean;
  /** Cleaned and type-coerced properties (only set on success). */
  data?: Record<string, unknown>;
  /** Validation errors keyed by property key. */
  errors?: Record<string, string>;
}

/**
 * Validate property values against a workspace's property schema.
 * 
 * - Type-coerces values (e.g., string "123" → number 123)
 * - Validates required fields
 * - Strips unknown properties not in the schema
 * - Returns cleaned values or structured errors
 * 
 * @param schema - The workspace's leadPropertySchema definitions
 * @param properties - Raw property values to validate
 * @param requireRequired - If true, enforce required fields (use false for partial updates)
 */
export function validateProperties(
  schema: LeadPropertyDefinition[],
  properties: Record<string, unknown>,
  requireRequired = true
): ValidatePropertiesResult {
  if (!schema || schema.length === 0) {
    // No schema defined -- reject all properties
    return { success: true, data: {} };
  }

  const schemaMap = new Map(schema.map(def => [def.key, def]));
  const cleaned: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  // Validate each schema-defined property
  for (const def of schema) {
    const rawValue = properties[def.key];
    const coerced = coerceValue(rawValue, def.type);

    // Check required
    if (coerced === undefined) {
      if (def.required && requireRequired) {
        errors[def.key] = `${def.label} is required`;
      }
      continue;
    }

    // Type validate
    const valueSchema = buildValueSchema(def.type);
    const result = valueSchema.safeParse(coerced);

    if (!result.success) {
      const issue = result.error.issues[0];
      errors[def.key] = `${def.label}: ${issue?.message || 'Invalid value'}`;
    } else {
      cleaned[def.key] = result.data;
    }
  }

  // Warn about (but silently strip) unknown properties not in schema
  // This is intentional -- we don't store data outside the schema

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: cleaned };
}

/**
 * Extract lead properties from a workflow trigger payload.
 * 
 * Matches payload fields against the workspace's property schema by key.
 * Only extracts fields that are defined in the schema.
 * Validates and coerces extracted values.
 * 
 * @param schema - The workspace's leadPropertySchema definitions
 * @param payload - Raw trigger payload (e.g., from form submission)
 */
export function extractPropertiesFromPayload(
  schema: LeadPropertyDefinition[],
  payload: Record<string, unknown>
): ValidatePropertiesResult {
  if (!schema || schema.length === 0) {
    return { success: true, data: {} };
  }

  // Collect values from payload that match schema keys
  const extracted: Record<string, unknown> = {};
  for (const def of schema) {
    if (def.key in payload) {
      extracted[def.key] = payload[def.key];
    }
  }

  // Validate but don't require required fields -- payload may be partial
  return validateProperties(schema, extracted, false);
}

/**
 * Merge incoming properties into existing properties.
 * Shallow merge: incoming values overwrite existing ones.
 * Undefined/null incoming values are skipped (don't erase existing).
 * 
 * @param existing - Current lead properties (may be null)
 * @param incoming - New properties to merge in
 */
export function mergeProperties(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const base = existing ?? {};
  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Validate a workspace's leadPropertySchema definition.
 * Used when admins create/update the schema via API.
 * 
 * @param schema - Raw schema array to validate
 */
export function validatePropertySchema(
  schema: unknown
): { success: true; data: LeadPropertyDefinition[] } | { success: false; error: string } {
  const result = LeadPropertySchemaDefinition.safeParse(schema);

  if (!result.success) {
    const message = result.error.issues
      .map(i => i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message)
      .join(', ');
    return { success: false, error: message };
  }

  return { success: true, data: result.data };
}
