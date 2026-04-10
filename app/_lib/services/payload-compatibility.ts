/**
 * Payload Compatibility Service
 * 
 * Agnostic utility that compares any trigger's Zod payload schema against
 * a workspace's leadPropertySchema and reports what fields are mapped,
 * what fields are available, and suggests definitions for missing ones.
 * 
 * Also provides reverse-lookup: given a set of property keys, which
 * triggers across ALL adapters can populate each one.
 * 
 * Works with ANY integration trigger — ABC Ignite, Calendly, Stripe, etc.
 * 
 * STANDARDS:
 * - Integration-agnostic: operates on Zod schemas, not specific adapters
 * - Pure functions: no side effects, no database calls
 * - Returns structured results, never throws
 * 
 * NOTE: Uses Zod v4 introspection API (_zod.def) for schema analysis.
 */

import { z } from 'zod';
import { getTrigger, ADAPTER_REGISTRY } from '@/app/_lib/workflow/registry';
import type { LeadPropertyDefinition, LeadPropertyType, LandingFormField } from '@/app/_lib/types';

// =============================================================================
// TYPES
// =============================================================================

export interface CompatibilityResult {
  /** Fields from the payload that have a matching lead property definition */
  matched: { key: string; label: string; type: LeadPropertyType }[];
  /** Fields from the payload that could be captured but aren't in the schema */
  available: { key: string; suggestion: LeadPropertyDefinition }[];
  /** Total non-email fields in the payload schema */
  totalPayloadFields: number;
  /** Number of matched fields */
  totalMatched: number;
}

export interface PropertySource {
  adapter: string;
  adapterName: string;
  trigger: string;
  triggerLabel: string;
}

export type PropertySourceMap = Record<string, PropertySource[]>;

// =============================================================================
// ZOD V4 INTROSPECTION
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZod = any;

/**
 * Extract field names and types from a Zod schema.
 * Works with z.object() and unwraps common wrappers (Zod v4 compatible).
 */
function getZodObjectShape(schema: AnyZod): Record<string, AnyZod> | null {
  if (!schema) return null;

  // Direct z.object() — has .shape
  if (schema instanceof z.ZodObject) {
    return schema.shape;
  }

  // Unwrap optional/nullable/default via _zod.def.innerType
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    const inner = schema._zod?.def?.innerType;
    if (inner) return getZodObjectShape(inner);
  }

  // z.intersection (from .and)
  if (schema instanceof z.ZodIntersection) {
    const left = getZodObjectShape(schema._zod?.def?.left);
    const right = getZodObjectShape(schema._zod?.def?.right);
    if (left && right) return { ...left, ...right };
    return left ?? right;
  }

  // z.pipe (from .pipe or .transform)
  if (schema instanceof z.ZodPipe) {
    const inner = schema._zod?.def?.in;
    if (inner) return getZodObjectShape(inner);
  }

  return null;
}

/**
 * Infer LeadPropertyType from a Zod field schema (Zod v4 compatible).
 */
function inferPropertyType(fieldSchema: AnyZod): LeadPropertyType {
  if (!fieldSchema) return 'string';

  // Unwrap optional/nullable/default
  let inner = fieldSchema;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodNullable ||
    inner instanceof z.ZodDefault
  ) {
    const next = inner._zod?.def?.innerType;
    if (!next) break;
    inner = next;
  }

  if (inner instanceof z.ZodNumber) return 'number';
  if (inner instanceof z.ZodBoolean) return 'boolean';

  if (inner instanceof z.ZodString) {
    // Check for email/url format in Zod v4 checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checks: any[] = (inner as AnyZod)._zod?.def?.checks ?? [];
    for (const check of checks) {
      const format = check?.def?.format;
      if (format === 'email') return 'email';
      if (format === 'url') return 'url';
    }
    return 'string';
  }

  // Default to string for anything else
  return 'string';
}

/**
 * Convert a snake_case key to a display label.
 * "first_name" -> "First Name"
 */
function keyToLabel(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract non-email field keys from a Zod payload schema.
 */
function extractPayloadKeys(payloadSchema: z.ZodSchema): string[] {
  const shape = getZodObjectShape(payloadSchema);
  if (!shape) return [];
  return Object.keys(shape).filter(k => k !== 'email');
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Compare a trigger's payload schema against a workspace's lead property schema.
 */
export function getPayloadCompatibility(
  payloadSchema: z.ZodSchema,
  leadPropertySchema: LeadPropertyDefinition[]
): CompatibilityResult {
  const shape = getZodObjectShape(payloadSchema);
  if (!shape) {
    return { matched: [], available: [], totalPayloadFields: 0, totalMatched: 0 };
  }

  const existingKeys = new Set(leadPropertySchema.map(d => d.key));
  const existingDefs = new Map(leadPropertySchema.map(d => [d.key, d]));

  // Skip 'email' — it's always the lead identifier, not a property
  const payloadKeys = Object.keys(shape).filter(k => k !== 'email');

  const matched: CompatibilityResult['matched'] = [];
  const available: CompatibilityResult['available'] = [];

  for (const key of payloadKeys) {
    if (existingKeys.has(key)) {
      const def = existingDefs.get(key)!;
      matched.push({ key, label: def.label, type: def.type });
    } else {
      const inferredType = inferPropertyType(shape[key]);
      available.push({
        key,
        suggestion: {
          key,
          label: keyToLabel(key),
          type: inferredType,
          required: false,
        },
      });
    }
  }

  return {
    matched,
    available,
    totalPayloadFields: payloadKeys.length,
    totalMatched: matched.length,
  };
}

/**
 * Get the payload schema for a specific trigger by adapter and operation ID.
 */
export function getTriggerPayloadSchema(
  adapter: string,
  operation: string
): z.ZodSchema | null {
  const trigger = getTrigger(adapter, operation);
  return trigger?.payloadSchema ?? null;
}

/**
 * Convenience: check compatibility for a specific trigger against a workspace schema.
 */
export function checkTriggerCompatibility(
  adapter: string,
  operation: string,
  leadPropertySchema: LeadPropertyDefinition[]
): CompatibilityResult | null {
  const schema = getTriggerPayloadSchema(adapter, operation);
  if (!schema) return null;
  return getPayloadCompatibility(schema, leadPropertySchema);
}

// Known fields handled by the static schema — mirrors KNOWN_FIELDS in client.tsx:85
const STATIC_PAYLOAD_KEYS = new Set(['email', 'name', 'phone', 'source']);

/**
 * Extract custom form fields from workspace pagesConfig.
 * Filters out fields already covered by the static payload schema.
 */
export function extractCustomFormFields(pagesConfig: unknown): LandingFormField[] {
  if (!pagesConfig || typeof pagesConfig !== 'object') return [];
  const copy = (pagesConfig as Record<string, unknown>).copy;
  if (!copy || typeof copy !== 'object') return [];
  const landing = (copy as Record<string, unknown>).landing;
  if (!landing || typeof landing !== 'object') return [];
  const formFields = (landing as Record<string, unknown>).formFields;
  if (!Array.isArray(formFields)) return [];
  return formFields.filter(
    (f): f is LandingFormField =>
      typeof f === 'object' && f !== null &&
      typeof f.id === 'string' && typeof f.label === 'string' &&
      typeof f.type === 'string' && !STATIC_PAYLOAD_KEYS.has(f.id)
  );
}

function formFieldTypeToPropertyType(type: string): LeadPropertyType {
  if (type === 'email') return 'email';
  return 'string';
}

/**
 * Like checkTriggerCompatibility, but augments the result with dynamic
 * form fields from the workspace's pagesConfig. This surfaces custom
 * form fields that aren't in the static Zod schema.
 */
export function checkTriggerCompatibilityWithDynamicFields(
  adapter: string,
  operation: string,
  leadPropertySchema: LeadPropertyDefinition[],
  dynamicFields: LandingFormField[]
): CompatibilityResult | null {
  const baseResult = checkTriggerCompatibility(adapter, operation, leadPropertySchema);
  if (!baseResult) return null;
  if (dynamicFields.length === 0) return baseResult;

  const existingKeys = new Set(leadPropertySchema.map(d => d.key));
  const existingDefs = new Map(leadPropertySchema.map(d => [d.key, d]));
  // Track keys already in the base result to avoid duplicates
  const alreadyCovered = new Set([
    ...baseResult.matched.map(m => m.key),
    ...baseResult.available.map(a => a.key),
  ]);

  const matched = [...baseResult.matched];
  const available = [...baseResult.available];

  for (const field of dynamicFields) {
    if (alreadyCovered.has(field.id)) continue;

    if (existingKeys.has(field.id)) {
      const def = existingDefs.get(field.id)!;
      matched.push({ key: field.id, label: def.label, type: def.type });
    } else {
      available.push({
        key: field.id,
        suggestion: {
          key: field.id,
          label: field.label,
          type: formFieldTypeToPropertyType(field.type),
          required: false,
        },
      });
    }
  }

  return {
    matched,
    available,
    totalPayloadFields: baseResult.totalPayloadFields + dynamicFields.length,
    totalMatched: matched.length,
  };
}

/**
 * Reverse-lookup: for each property key, find which triggers across
 * ALL adapters can provide that field.
 *
 * Scans every trigger's payloadSchema in the registry and builds a map:
 *   propertyKey -> [{ adapter, adapterName, trigger, triggerLabel }]
 *
 * NOTE: RevLine custom form fields are workspace-specific and resolved
 * at the per-workspace compatibility endpoint, not here.
 */
export function getPropertySources(): PropertySourceMap {
  const sources: PropertySourceMap = {};

  for (const adapter of Object.values(ADAPTER_REGISTRY)) {
    for (const trigger of Object.values(adapter.triggers)) {
      const keys = extractPayloadKeys(trigger.payloadSchema);
      for (const key of keys) {
        if (!sources[key]) sources[key] = [];
        sources[key].push({
          adapter: adapter.id,
          adapterName: adapter.name,
          trigger: trigger.name,
          triggerLabel: trigger.label,
        });
      }
    }
  }

  return sources;
}
