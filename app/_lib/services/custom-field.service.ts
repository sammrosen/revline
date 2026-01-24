/**
 * Custom Field Service
 * 
 * Abstraction layer for custom field definitions and lead custom data.
 * Handles CRUD operations, validation, and event emission.
 * 
 * STANDARDS:
 * - All operations scoped to workspace (isolation)
 * - Events emitted for audit trail
 * - Validation before writes
 * - Fail-safe: validation errors don't crash, just return errors
 */

import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { Prisma } from '@prisma/client';
import {
  CustomFieldDefinition,
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
  FieldDefinitionSummary,
  LeadCustomData,
  SetCustomDataOptions,
  GetCustomDataOptions,
  CustomDataValidationResult,
  CustomDataValidationError,
  CustomDataValidationWarning,
  CustomFieldType,
  FIELD_KEY_REGEX,
  TEXT_MAX_LENGTH,
  MAX_FIELDS_PER_WORKSPACE,
  MAX_CUSTOM_DATA_SIZE,
  CreateFieldDefinitionSchema,
  UpdateFieldDefinitionSchema,
} from '@/app/_lib/types/custom-fields';

// =============================================================================
// FIELD DEFINITION OPERATIONS
// =============================================================================

/**
 * Create a new custom field definition for a workspace
 * 
 * @param workspaceId - Workspace ID
 * @param input - Field definition input
 * @returns Created field definition or error
 */
export async function defineField(
  workspaceId: string,
  input: CreateFieldDefinitionInput
): Promise<{ success: true; data: CustomFieldDefinition } | { success: false; error: string }> {
  // Validate input with Zod
  const validation = CreateFieldDefinitionSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` };
  }

  const validInput = validation.data;

  try {
    // Check workspace field limit
    const existingCount = await prisma.leadCustomFieldDefinition.count({
      where: { workspaceId },
    });

    if (existingCount >= MAX_FIELDS_PER_WORKSPACE) {
      return { 
        success: false, 
        error: `Maximum of ${MAX_FIELDS_PER_WORKSPACE} custom fields per workspace reached` 
      };
    }

    // Create the field definition
    const field = await prisma.leadCustomFieldDefinition.create({
      data: {
        workspaceId,
        key: validInput.key,
        label: validInput.label,
        fieldType: validInput.fieldType,
        required: validInput.required,
        description: validInput.description,
        defaultValue: validInput.defaultValue,
        displayOrder: validInput.displayOrder,
      },
    });

    // Emit event for audit trail
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'custom_field_defined',
      success: true,
    });

    return { success: true, data: mapToDefinition(field) };
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: `Field with key '${validInput.key}' already exists` };
    }

    console.error('Failed to define custom field:', error);
    return { success: false, error: 'Failed to create field definition' };
  }
}

/**
 * Get all custom field definitions for a workspace
 * 
 * @param workspaceId - Workspace ID
 * @returns List of field definitions
 */
export async function getFieldDefinitions(
  workspaceId: string
): Promise<FieldDefinitionSummary[]> {
  const fields = await prisma.leadCustomFieldDefinition.findMany({
    where: { workspaceId },
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return fields.map(mapToSummary);
}

/**
 * Get a single field definition by key
 * 
 * @param workspaceId - Workspace ID
 * @param key - Field key
 * @returns Field definition or null
 */
export async function getFieldDefinition(
  workspaceId: string,
  key: string
): Promise<FieldDefinitionSummary | null> {
  const field = await prisma.leadCustomFieldDefinition.findUnique({
    where: {
      workspaceId_key: { workspaceId, key },
    },
  });

  return field ? mapToSummary(field) : null;
}

/**
 * Update a custom field definition
 * Note: key and fieldType cannot be changed after creation
 * 
 * @param workspaceId - Workspace ID
 * @param key - Field key
 * @param input - Update input
 * @returns Updated field definition or error
 */
export async function updateFieldDefinition(
  workspaceId: string,
  key: string,
  input: UpdateFieldDefinitionInput
): Promise<{ success: true; data: FieldDefinitionSummary } | { success: false; error: string }> {
  // Validate input with Zod
  const validation = UpdateFieldDefinitionSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` };
  }

  try {
    const field = await prisma.leadCustomFieldDefinition.update({
      where: {
        workspaceId_key: { workspaceId, key },
      },
      data: {
        label: input.label,
        required: input.required,
        description: input.description,
        defaultValue: input.defaultValue,
        displayOrder: input.displayOrder,
      },
    });

    return { success: true, data: mapToSummary(field) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: `Field '${key}' not found` };
    }

    console.error('Failed to update custom field:', error);
    return { success: false, error: 'Failed to update field definition' };
  }
}

/**
 * Delete a custom field definition
 * Note: This does NOT delete existing values on leads (orphaned data is fine)
 * 
 * @param workspaceId - Workspace ID
 * @param key - Field key
 * @returns Success or error
 */
export async function deleteFieldDefinition(
  workspaceId: string,
  key: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.leadCustomFieldDefinition.delete({
      where: {
        workspaceId_key: { workspaceId, key },
      },
    });

    // Emit event for audit trail
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'custom_field_deleted',
      success: true,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: `Field '${key}' not found` };
    }

    console.error('Failed to delete custom field:', error);
    return { success: false, error: 'Failed to delete field definition' };
  }
}

// =============================================================================
// LEAD CUSTOM DATA OPERATIONS
// =============================================================================

/**
 * Set custom data on a lead
 * 
 * @param leadId - Lead ID
 * @param data - Custom data to set
 * @param options - Options for setting data
 * @returns Success or error
 */
export async function setLeadCustomData(
  leadId: string,
  data: LeadCustomData,
  options: SetCustomDataOptions = {}
): Promise<{ success: true } | { success: false; error: string }> {
  const { validate = true, merge = true, tx } = options;
  const db = tx || prisma;

  try {
    // Get the lead to find its workspace
    const lead = await (db as typeof prisma).lead.findUnique({
      where: { id: leadId },
      select: { workspaceId: true, customData: true },
    });

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Validate if requested
    if (validate) {
      const validation = await validateCustomData(lead.workspaceId, data);
      if (!validation.valid && validation.errors.length > 0) {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return { success: false, error: errorMessages };
      }
    }

    // Merge or replace
    let newData: LeadCustomData;
    if (merge && lead.customData) {
      newData = {
        ...(lead.customData as LeadCustomData),
        ...data,
      };
    } else {
      newData = data;
    }

    // Check size limit
    const serialized = JSON.stringify(newData);
    if (serialized.length > MAX_CUSTOM_DATA_SIZE) {
      return { success: false, error: `Custom data exceeds maximum size of ${MAX_CUSTOM_DATA_SIZE / 1024}KB` };
    }

    // Update the lead
    await (db as typeof prisma).lead.update({
      where: { id: leadId },
      data: {
        customData: newData as Prisma.InputJsonValue,
        lastEventAt: new Date(),
      },
    });

    // Emit event (only if not in transaction - caller handles event in transaction)
    if (!tx) {
      await emitEvent({
        workspaceId: lead.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: 'lead_custom_data_updated',
        success: true,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to set lead custom data:', error);
    return { success: false, error: 'Failed to update custom data' };
  }
}

/**
 * Get custom data for a lead
 * 
 * @param leadId - Lead ID
 * @param options - Options for getting data
 * @returns Custom data or null
 */
export async function getLeadCustomData(
  leadId: string,
  options: GetCustomDataOptions = {}
): Promise<LeadCustomData | null> {
  const { definedOnly = false } = options;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true, customData: true },
  });

  if (!lead || !lead.customData) {
    return null;
  }

  const customData = lead.customData as LeadCustomData;

  if (!definedOnly) {
    return customData;
  }

  // Filter to only defined fields
  const definitions = await getFieldDefinitions(lead.workspaceId);
  const definedKeys = new Set(definitions.map(d => d.key));

  const filteredData: LeadCustomData = {};
  for (const [key, value] of Object.entries(customData)) {
    if (definedKeys.has(key)) {
      filteredData[key] = value;
    }
  }

  return filteredData;
}

/**
 * Get custom data for a lead with workspace context (avoids extra lookup)
 * 
 * @param workspaceId - Workspace ID
 * @param email - Lead email
 * @returns Custom data or null
 */
export async function getLeadCustomDataByEmail(
  workspaceId: string,
  email: string
): Promise<LeadCustomData | null> {
  const lead = await prisma.lead.findUnique({
    where: {
      workspaceId_email: { workspaceId, email },
    },
    select: { customData: true },
  });

  return lead?.customData as LeadCustomData | null;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate custom data against field definitions
 * 
 * @param workspaceId - Workspace ID
 * @param data - Custom data to validate
 * @returns Validation result with errors and warnings
 */
export async function validateCustomData(
  workspaceId: string,
  data: LeadCustomData
): Promise<CustomDataValidationResult> {
  const errors: CustomDataValidationError[] = [];
  const warnings: CustomDataValidationWarning[] = [];

  // Get field definitions
  const definitions = await getFieldDefinitions(workspaceId);
  const definitionMap = new Map(definitions.map(d => [d.key, d]));

  // Validate each field in the data
  for (const [key, value] of Object.entries(data)) {
    // Check key format
    if (!FIELD_KEY_REGEX.test(key)) {
      errors.push({
        field: key,
        message: 'Invalid field key format',
        code: 'INVALID_FORMAT',
      });
      continue;
    }

    const definition = definitionMap.get(key);

    // Warn about undefined fields (observational - not an error)
    if (!definition) {
      warnings.push({
        field: key,
        message: 'Field is not defined in workspace schema',
        code: 'UNDEFINED_FIELD',
      });
      continue;
    }

    // Skip null/undefined values
    if (value === null || value === undefined) {
      if (definition.required) {
        errors.push({
          field: key,
          message: 'Required field cannot be null',
          code: 'REQUIRED',
        });
      }
      continue;
    }

    // Type-specific validation
    switch (definition.fieldType) {
      case 'TEXT':
        if (typeof value !== 'string') {
          errors.push({
            field: key,
            message: 'Expected string value',
            code: 'INVALID_TYPE',
          });
        } else if (value.length > TEXT_MAX_LENGTH) {
          errors.push({
            field: key,
            message: `Value exceeds maximum length of ${TEXT_MAX_LENGTH}`,
            code: 'TOO_LONG',
          });
        }
        break;

      case 'NUMBER':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field: key,
            message: 'Expected numeric value',
            code: 'INVALID_TYPE',
          });
        }
        break;

      case 'DATE':
        if (typeof value !== 'string') {
          errors.push({
            field: key,
            message: 'Expected date string',
            code: 'INVALID_TYPE',
          });
        } else {
          // Validate ISO 8601 format
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({
              field: key,
              message: 'Invalid date format (expected ISO 8601)',
              code: 'INVALID_FORMAT',
            });
          }
        }
        break;
    }
  }

  // Check for required fields not in data
  for (const definition of definitions) {
    if (definition.required && !(definition.key in data)) {
      errors.push({
        field: definition.key,
        message: 'Required field is missing',
        code: 'REQUIRED',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map database record to CustomFieldDefinition
 */
function mapToDefinition(record: {
  id: string;
  workspaceId: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  description: string | null;
  defaultValue: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): CustomFieldDefinition {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    key: record.key,
    label: record.label,
    fieldType: record.fieldType as CustomFieldType,
    required: record.required,
    description: record.description,
    defaultValue: record.defaultValue,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Map database record to FieldDefinitionSummary
 */
function mapToSummary(record: {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  description: string | null;
  defaultValue: string | null;
  displayOrder: number;
}): FieldDefinitionSummary {
  return {
    key: record.key,
    label: record.label,
    fieldType: record.fieldType as CustomFieldType,
    required: record.required,
    description: record.description,
    defaultValue: record.defaultValue,
    displayOrder: record.displayOrder,
  };
}

// =============================================================================
// EXPORT SERVICE OBJECT
// =============================================================================

export const CustomFieldService = {
  // Field definitions
  defineField,
  getFieldDefinitions,
  getFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  
  // Lead custom data
  setLeadCustomData,
  getLeadCustomData,
  getLeadCustomDataByEmail,
  
  // Validation
  validateCustomData,
};
