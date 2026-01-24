/**
 * Custom Fields Type Definitions
 * 
 * Types for workspace-scoped custom field definitions and per-lead custom data.
 * Used for variable interpolation in emails, magic links, and forms.
 * 
 * STANDARDS:
 * - Validation rules defined per field type
 * - Workspace isolation enforced at type level
 * - HTML escaping by default in interpolation
 */

import { z } from 'zod';

// =============================================================================
// FIELD TYPES
// =============================================================================

/**
 * Supported custom field types
 * TEXT: Free-form text (max 1000 chars)
 * NUMBER: Numeric values (integers or decimals)
 * DATE: ISO 8601 date strings
 */
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE';

/**
 * Valid characters for field keys
 * Must start with a letter, followed by alphanumeric or underscore
 * Max 63 characters (64 with null terminator for VARCHAR(64))
 */
export const FIELD_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;

/**
 * Maximum length for text field values
 */
export const TEXT_MAX_LENGTH = 1000;

/**
 * Maximum number of custom field definitions per workspace
 */
export const MAX_FIELDS_PER_WORKSPACE = 100;

/**
 * Maximum total size of custom data JSON per lead (10KB)
 */
export const MAX_CUSTOM_DATA_SIZE = 10 * 1024;

// =============================================================================
// FIELD DEFINITION TYPES
// =============================================================================

/**
 * Custom field definition (workspace-scoped)
 * Defines what fields can exist on leads for a workspace
 */
export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  description: string | null;
  defaultValue: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new custom field definition
 */
export interface CreateFieldDefinitionInput {
  key: string;
  label: string;
  fieldType?: CustomFieldType;
  required?: boolean;
  description?: string;
  defaultValue?: string;
  displayOrder?: number;
}

/**
 * Input for updating an existing custom field definition
 * Note: key and fieldType cannot be changed after creation
 */
export interface UpdateFieldDefinitionInput {
  label?: string;
  required?: boolean;
  description?: string | null;
  defaultValue?: string | null;
  displayOrder?: number;
}

/**
 * Summary of a field definition for API responses
 */
export interface FieldDefinitionSummary {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  description: string | null;
  defaultValue: string | null;
  displayOrder: number;
}

// =============================================================================
// CUSTOM DATA TYPES
// =============================================================================

/**
 * Custom data stored on a lead
 * Keys should match field definitions, but undefined keys are allowed (observational)
 */
export type LeadCustomData = Record<string, unknown>;

/**
 * Options for setting custom data
 */
export interface SetCustomDataOptions {
  /** If true, validate against field definitions (default: true) */
  validate?: boolean;
  /** If true, merge with existing data (default: true) */
  merge?: boolean;
  /** Transaction client for atomic operations */
  tx?: unknown;
}

/**
 * Options for getting custom data
 */
export interface GetCustomDataOptions {
  /** If true, only return defined fields (default: false) */
  definedOnly?: boolean;
}

/**
 * Result of custom data validation
 */
export interface CustomDataValidationResult {
  valid: boolean;
  errors: CustomDataValidationError[];
  warnings: CustomDataValidationWarning[];
}

/**
 * Validation error for custom data
 */
export interface CustomDataValidationError {
  field: string;
  message: string;
  code: 'INVALID_TYPE' | 'REQUIRED' | 'TOO_LONG' | 'INVALID_FORMAT';
}

/**
 * Validation warning for custom data (non-blocking)
 */
export interface CustomDataValidationWarning {
  field: string;
  message: string;
  code: 'UNDEFINED_FIELD';
}

// =============================================================================
// INTERPOLATION TYPES
// =============================================================================

/**
 * Lead data available for interpolation
 */
export interface InterpolationLead {
  id: string;
  email: string;
  stage: string;
  source: string | null;
  custom: LeadCustomData;
}

/**
 * Workspace data available for interpolation
 */
export interface InterpolationWorkspace {
  id: string;
  name: string;
  slug: string;
}

/**
 * Trigger data available for interpolation
 */
export interface InterpolationTrigger {
  adapter: string;
  operation: string;
  payload: Record<string, unknown>;
}

/**
 * Full context for variable interpolation
 * Used by InterpolationService to resolve {{variable}} syntax
 */
export interface InterpolationContext {
  lead?: InterpolationLead;
  workspace?: InterpolationWorkspace;
  trigger?: InterpolationTrigger;
  /** Additional context data (e.g., from workflow actions) */
  extra?: Record<string, unknown>;
}

/**
 * Options for interpolation
 */
export interface InterpolationOptions {
  /** If true, HTML-escape all values (default: true) */
  escapeHtml?: boolean;
  /** Value to use for missing variables (default: '') */
  missingValue?: string;
  /** If true, preserve unresolved variables (default: false) */
  preserveUnresolved?: boolean;
}

/**
 * Result of parsing a template for variables
 */
export interface TemplateParseResult {
  /** List of variable paths found (e.g., ['lead.email', 'lead.custom.barcode']) */
  variables: string[];
  /** Whether the template contains any raw (unescaped) variables */
  hasRawVariables: boolean;
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Zod schema for field key validation
 */
export const FieldKeySchema = z
  .string()
  .min(1, 'Key is required')
  .max(64, 'Key must be 64 characters or less')
  .regex(FIELD_KEY_REGEX, 'Key must start with a letter and contain only alphanumeric characters and underscores');

/**
 * Zod schema for field type validation
 */
export const FieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'DATE']);

/**
 * Zod schema for creating a field definition
 */
export const CreateFieldDefinitionSchema = z.object({
  key: FieldKeySchema,
  label: z.string().min(1, 'Label is required').max(128, 'Label must be 128 characters or less'),
  fieldType: FieldTypeSchema.optional().default('TEXT'),
  required: z.boolean().optional().default(false),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  defaultValue: z.string().max(TEXT_MAX_LENGTH, 'Default value too long').optional(),
  displayOrder: z.number().int().min(0).optional().default(0),
});

/**
 * Zod schema for updating a field definition
 */
export const UpdateFieldDefinitionSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  required: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
  defaultValue: z.string().max(TEXT_MAX_LENGTH).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

/**
 * Zod schema for custom data values (basic validation)
 */
export const CustomDataValueSchema = z.union([
  z.string().max(TEXT_MAX_LENGTH),
  z.number(),
  z.null(),
]);

/**
 * Zod schema for custom data object
 */
export const CustomDataSchema = z.record(
  z.string().regex(FIELD_KEY_REGEX),
  CustomDataValueSchema
);

// =============================================================================
// FORM FIELD MAPPING TYPES
// =============================================================================

/**
 * Mapping from form field to custom field
 */
export interface FormFieldMapping {
  /** Field name in form submission data */
  formField: string;
  /** Custom field key to store value in */
  customFieldKey: string;
  /** Optional transform to apply */
  transform?: 'uppercase' | 'lowercase' | 'trim';
}

/**
 * Extended RevLine form config with field mappings
 */
export interface RevlineFormConfigWithMappings {
  formId: string;
  enabled: boolean;
  /** Optional field mappings for custom data */
  fieldMappings?: FormFieldMapping[];
}
