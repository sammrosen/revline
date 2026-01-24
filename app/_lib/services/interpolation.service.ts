/**
 * Interpolation Service
 * 
 * Generic template processor for {{variable}} syntax.
 * Used for emails, magic links, and form pre-fills.
 * 
 * STANDARDS:
 * - HTML escape by default (XSS prevention)
 * - Raw output with {{{var}}} syntax (use sparingly)
 * - Missing variables → empty string (fail-safe)
 * - No code execution, pure interpolation
 * 
 * @example
 * const result = interpolate('Hello {{lead.name}}, your barcode is {{lead.custom.barcode}}', {
 *   lead: { id: '...', email: 'test@example.com', stage: 'CAPTURED', source: null, custom: { barcode: '12345' } }
 * });
 * // Result: 'Hello , your barcode is 12345'
 */

import {
  InterpolationContext,
  InterpolationOptions,
  TemplateParseResult,
} from '@/app/_lib/types/custom-fields';

// =============================================================================
// REGEX PATTERNS
// =============================================================================

/**
 * Match escaped variables (HTML-escaped output): {{path.to.value}}
 */
const ESCAPED_VAR_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Match raw variables (no escaping): {{{path.to.value}}}
 */
const RAW_VAR_REGEX = /\{\{\{([^{}]+)\}\}\}/g;

/**
 * Match any variable pattern for parsing
 */
const ANY_VAR_REGEX = /\{\{\{?([^{}]+)\}\}\}?/g;

// =============================================================================
// HTML ESCAPING
// =============================================================================

/**
 * HTML special character escapes
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] || char);
}

// =============================================================================
// VALUE RESOLUTION
// =============================================================================

/**
 * Get a value from an object by dot-notation path
 * 
 * @example
 * getValueByPath({ lead: { custom: { barcode: '123' } } }, 'lead.custom.barcode')
 * // Returns: '123'
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Convert a value to string for template output
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // For objects/arrays, JSON stringify
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Interpolate a template string with context values
 * 
 * Syntax:
 * - {{path.to.value}} - HTML-escaped output (default, safe)
 * - {{{path.to.value}}} - Raw output (use sparingly for trusted content)
 * 
 * Supported paths:
 * - lead.email, lead.stage, lead.source
 * - lead.custom.fieldKey
 * - workspace.id, workspace.name, workspace.slug
 * - trigger.adapter, trigger.operation, trigger.payload.fieldName
 * - extra.fieldName
 * 
 * @param template - Template string with {{variable}} placeholders
 * @param context - Context object with values to interpolate
 * @param options - Interpolation options
 * @returns Interpolated string
 */
export function interpolate(
  template: string,
  context: InterpolationContext,
  options: InterpolationOptions = {}
): string {
  const {
    escapeHtml: shouldEscape = true,
    missingValue = '',
    preserveUnresolved = false,
  } = options;

  // Build flat context for path resolution
  const flatContext: Record<string, unknown> = {
    lead: context.lead,
    workspace: context.workspace,
    trigger: context.trigger,
    extra: context.extra,
  };

  let result = template;

  // First, replace raw variables {{{var}}} (no escaping)
  result = result.replace(RAW_VAR_REGEX, (match, path: string) => {
    const trimmedPath = path.trim();
    const value = getValueByPath(flatContext, trimmedPath);
    
    if (value === undefined) {
      return preserveUnresolved ? match : missingValue;
    }
    
    return valueToString(value);
  });

  // Then, replace escaped variables {{var}} (with HTML escaping)
  result = result.replace(ESCAPED_VAR_REGEX, (match, path: string) => {
    const trimmedPath = path.trim();
    const value = getValueByPath(flatContext, trimmedPath);
    
    if (value === undefined) {
      return preserveUnresolved ? match : missingValue;
    }
    
    const stringValue = valueToString(value);
    return shouldEscape ? escapeHtml(stringValue) : stringValue;
  });

  return result;
}

/**
 * Parse a template to extract variable paths
 * 
 * @param template - Template string
 * @returns Parse result with variables and flags
 */
export function parseTemplate(template: string): TemplateParseResult {
  const variables: string[] = [];
  let hasRawVariables = false;

  // Find all variable patterns
  let match;
  const regex = new RegExp(ANY_VAR_REGEX.source, 'g');
  
  while ((match = regex.exec(template)) !== null) {
    const fullMatch = match[0];
    const path = match[1].trim();
    
    // Check if it's a raw variable
    if (fullMatch.startsWith('{{{') && fullMatch.endsWith('}}}')) {
      hasRawVariables = true;
    }
    
    // Add unique paths
    if (!variables.includes(path)) {
      variables.push(path);
    }
  }

  return {
    variables,
    hasRawVariables,
  };
}

/**
 * Get all available variable paths for a context
 * Useful for autocomplete/documentation
 * 
 * @param context - Partial context to inspect
 * @returns List of available variable paths
 */
export function getAvailablePaths(context: Partial<InterpolationContext>): string[] {
  const paths: string[] = [];

  // Lead paths
  if (context.lead) {
    paths.push('lead.id', 'lead.email', 'lead.stage', 'lead.source');
    if (context.lead.custom) {
      for (const key of Object.keys(context.lead.custom)) {
        paths.push(`lead.custom.${key}`);
      }
    }
  }

  // Workspace paths
  if (context.workspace) {
    paths.push('workspace.id', 'workspace.name', 'workspace.slug');
  }

  // Trigger paths
  if (context.trigger) {
    paths.push('trigger.adapter', 'trigger.operation');
    if (context.trigger.payload) {
      for (const key of Object.keys(context.trigger.payload)) {
        paths.push(`trigger.payload.${key}`);
      }
    }
  }

  // Extra paths
  if (context.extra) {
    for (const key of Object.keys(context.extra)) {
      paths.push(`extra.${key}`);
    }
  }

  return paths;
}

/**
 * Validate that all variables in a template can be resolved
 * 
 * @param template - Template string
 * @param context - Context to validate against
 * @returns List of unresolved variable paths
 */
export function validateTemplate(
  template: string,
  context: InterpolationContext
): string[] {
  const { variables } = parseTemplate(template);
  const availablePaths = getAvailablePaths(context);
  const availableSet = new Set(availablePaths);

  // Also check if the path actually resolves to a value
  const flatContext: Record<string, unknown> = {
    lead: context.lead,
    workspace: context.workspace,
    trigger: context.trigger,
    extra: context.extra,
  };

  const unresolved: string[] = [];
  
  for (const variable of variables) {
    // Check if the base path is known
    const basePath = variable.split('.').slice(0, 2).join('.');
    const isKnownBase = availablePaths.some(p => p.startsWith(basePath));
    
    if (!isKnownBase) {
      unresolved.push(variable);
      continue;
    }

    // Check if value exists
    const value = getValueByPath(flatContext, variable);
    if (value === undefined) {
      unresolved.push(variable);
    }
  }

  return unresolved;
}

// =============================================================================
// EXPORT SERVICE OBJECT
// =============================================================================

export const InterpolationService = {
  interpolate,
  parseTemplate,
  getAvailablePaths,
  validateTemplate,
  escapeHtml,
};
