/**
 * Capture Service
 * 
 * Handles form capture validation, processing, and embed code generation.
 * Supports browser mode (public with rate limiting) and server mode (HMAC auth).
 * 
 * STANDARDS:
 * - Workspace isolation enforced
 * - Event-driven debugging (all operations logged)
 * - Fail-safe defaults (browser mode never breaks client flow)
 * - Defense in depth (denylists + allowlists)
 */

import { prisma } from '@/app/_lib/db';
import { emitEvent, upsertLead } from '@/app/_lib/event-logger';
import { EventSystem } from '@prisma/client';
import { setLeadCustomData, getFieldDefinitions } from './custom-field.service';
import { emitTrigger } from '@/app/_lib/workflow/engine';
import { decryptSecret, CURRENT_KEY_VERSION } from '@/app/_lib/crypto';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import {
  FormSecurity,
  FormSecuritySchema,
  CapturePayloadSchema,
  CaptureValidationResult,
  CaptureProcessResult,
  LEAD_FIELDS,
  LeadField,
  isDenylistedTarget,
  hasSensitiveValuePattern,
  MAX_FIELD_LENGTH,
  SIGNATURE_WINDOW_SECONDS,
  SERVER_SIGNATURE_HEADER,
  SERVER_TIMESTAMP_HEADER,
  DEFAULT_FORM_SECURITY,
} from '@/app/_lib/types/capture';

// =============================================================================
// FORM LOADING
// =============================================================================

export interface LoadedForm {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  security: FormSecurity;
  allowedTargets: string[];
  triggerName: string;
}

/**
 * Load a form by ID
 */
export async function getFormById(formId: string): Promise<LoadedForm | null> {
  const form = await prisma.workspaceForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    return null;
  }

  // Parse security with defaults
  let security: FormSecurity;
  try {
    security = FormSecuritySchema.parse(form.security);
  } catch {
    security = DEFAULT_FORM_SECURITY;
  }

  // Parse allowed targets
  let allowedTargets: string[];
  try {
    allowedTargets = Array.isArray(form.allowedTargets) 
      ? form.allowedTargets as string[]
      : ['email'];
  } catch {
    allowedTargets = ['email'];
  }

  return {
    id: form.id,
    workspaceId: form.workspaceId,
    name: form.name,
    enabled: form.enabled,
    security,
    allowedTargets,
    triggerName: form.triggerName,
  };
}

// =============================================================================
// CAPTURE VALIDATION
// =============================================================================

/**
 * Validate a capture request
 * Returns validation result with mode determination and sanitized payload
 */
export async function validateCaptureRequest(
  form: LoadedForm,
  rawPayload: unknown,
  headers: {
    origin?: string | null;
    signature?: string | null;
    timestamp?: string | null;
  }
): Promise<CaptureValidationResult> {
  const errors: string[] = [];

  // 1. Check if form is enabled
  if (!form.enabled) {
    return { valid: false, mode: null, errors: ['Form is disabled'] };
  }

  // 2. Determine capture mode
  const hasSignature = !!headers.signature && !!headers.timestamp;
  const security = form.security;
  let mode: 'browser' | 'server' | null = null;

  if (hasSignature) {
    // Server mode requested
    if (security.mode === 'browser') {
      return { valid: false, mode: null, errors: ['Server mode not enabled for this form'] };
    }
    mode = 'server';
  } else {
    // Browser mode requested
    if (security.mode === 'server') {
      return { valid: false, mode: null, errors: ['Browser mode not enabled for this form'] };
    }
    mode = 'browser';
  }

  // 3. Mode-specific validation
  if (mode === 'browser') {
    // Validate origin if allowedOrigins is configured
    if (security.allowedOrigins.length > 0 && headers.origin) {
      const originAllowed = security.allowedOrigins.some(allowed => {
        // Support exact match or wildcard subdomain
        if (allowed === headers.origin) return true;
        // Support *.example.com pattern
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return headers.origin?.endsWith(domain) || headers.origin === `https://${domain}`;
        }
        return false;
      });

      if (!originAllowed) {
        errors.push(`Origin not allowed: ${headers.origin}`);
      }
    }
  } else if (mode === 'server') {
    // Validate HMAC signature
    if (!security.signingSecret) {
      return { valid: false, mode: 'server', errors: ['Signing secret not configured'] };
    }

    const signatureResult = verifyServerSignature(
      JSON.stringify(rawPayload),
      headers.signature!,
      headers.timestamp!,
      security.signingSecret
    );

    if (!signatureResult.valid) {
      return { valid: false, mode: 'server', errors: [signatureResult.error || 'Invalid signature'] };
    }
  }

  // 4. Validate and sanitize payload
  const payloadResult = CapturePayloadSchema.safeParse(rawPayload);
  if (!payloadResult.success) {
    const firstError = payloadResult.error.issues[0];
    errors.push(`Invalid payload: ${firstError.path.join('.')}: ${firstError.message}`);
    return { valid: false, mode, errors };
  }

  // 5. Filter and sanitize fields
  const sanitizedPayload: Record<string, unknown> = {};
  const payload = payloadResult.data as Record<string, unknown>;

  for (const [key, value] of Object.entries(payload)) {
    // Check if target is allowed
    if (!form.allowedTargets.includes(key)) {
      // Skip non-allowed fields silently
      continue;
    }

    // Check denylist
    if (isDenylistedTarget(key)) {
      errors.push(`Denylisted field: ${key}`);
      continue;
    }

    // Sanitize value
    if (typeof value === 'string') {
      // Check for sensitive value patterns
      if (hasSensitiveValuePattern(value)) {
        errors.push(`Sensitive value pattern detected in field: ${key}`);
        continue;
      }

      // Trim and cap length
      const sanitized = sanitizeValue(value);
      sanitizedPayload[key] = sanitized;
    } else if (value !== null && value !== undefined) {
      sanitizedPayload[key] = value;
    }
  }

  // 6. OBSERVATIONAL: Email is optional
  // Capture accepts any data. If email is present, a lead will be created.
  // If no email, trigger still fires with payload data.
  // Workflows decide what to do with incomplete data.

  return {
    valid: errors.length === 0,
    mode,
    errors,
    sanitizedPayload: errors.length === 0 ? sanitizedPayload : undefined,
  };
}

/**
 * Sanitize a string value
 */
function sanitizeValue(value: string): string {
  return value
    .trim()
    .substring(0, MAX_FIELD_LENGTH)
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Strip control characters
}

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify server mode HMAC signature
 */
function verifyServerSignature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  signingSecret: string
): { valid: boolean; error?: string } {
  // 1. Parse signature header (format: sha256=hexstring)
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return { valid: false, error: 'Invalid signature format' };
  }
  const providedSig = parts[1];

  // 2. Parse and validate timestamp
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_WINDOW_SECONDS) {
    return { valid: false, error: 'Timestamp expired' };
  }

  // 3. Decrypt signing secret
  // NOTE: Using CURRENT_KEY_VERSION as the security schema stores just the
  // encrypted value without a separate keyVersion field. All secrets are
  // encrypted with the current key version at creation time.
  let secret: string;
  try {
    secret = decryptSecret(signingSecret, CURRENT_KEY_VERSION);
  } catch {
    return { valid: false, error: 'Failed to decrypt signing secret' };
  }

  // 4. Compute expected signature
  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // 5. Timing-safe comparison
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(providedSig, 'hex');

    if (expectedBuf.length !== providedBuf.length) {
      return { valid: false, error: 'Invalid signature' };
    }

    if (!timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: false, error: 'Invalid signature' };
    }
  } catch {
    return { valid: false, error: 'Invalid signature format' };
  }

  return { valid: true };
}

// =============================================================================
// CAPTURE PROCESSING
// =============================================================================

/**
 * Process a validated capture payload
 * 
 * OBSERVATIONAL: Accepts any data.
 * - If email present: Creates/updates lead, sets custom data, triggers workflow
 * - If no email: Still triggers workflow with payload data, skips lead creation
 * 
 * Workflows decide what to do with incomplete data.
 */
export async function processCapturePayload(
  form: LoadedForm,
  payload: Record<string, unknown>,
  mode: 'browser' | 'server',
  metadata: {
    origin?: string | null;
    ipHash?: string;
  }
): Promise<CaptureProcessResult> {
  const captureId = `cap_${randomUUID().split('-')[0]}`;

  try {
    // 1. Extract lead fields and custom fields
    const email = payload.email as string | undefined;
    const leadFields: Record<string, string> = {};
    const customFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (key === 'email') continue;

      if (LEAD_FIELDS.includes(key as LeadField)) {
        leadFields[key] = String(value);
      } else if (key.startsWith('custom.')) {
        const customKey = key.slice(7); // Remove 'custom.' prefix
        customFields[customKey] = value;
      }
    }

    // 2. Lead creation is conditional on email presence
    let leadId: string | undefined;
    let isNewLead = false;

    if (email) {
      // Upsert lead only if email is present
      leadId = await upsertLead({
        workspaceId: form.workspaceId,
        email: email.toLowerCase().trim(),
        source: leadFields.source || 'capture',
      });

      // Check if this is a new lead (by checking if lastEventAt equals createdAt)
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { createdAt: true, lastEventAt: true },
      });
      isNewLead = lead ? lead.createdAt.getTime() === lead.lastEventAt.getTime() : false;

      // 3. Set custom data if any (only if we have a lead)
      if (Object.keys(customFields).length > 0) {
        // Validate custom fields exist for this workspace
        const definitions = await getFieldDefinitions(form.workspaceId);
        const definedKeys = new Set(definitions.map(d => d.key));

        const validCustomFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(customFields)) {
          if (definedKeys.has(key)) {
            validCustomFields[key] = value;
          }
        }

        if (Object.keys(validCustomFields).length > 0) {
          const result = await setLeadCustomData(leadId, validCustomFields, {
            validate: true,
            merge: true,
          });

          if (result.success) {
            await emitEvent({
              workspaceId: form.workspaceId,
              leadId,
              system: EventSystem.BACKEND,
              eventType: 'capture_custom_data_set',
              success: true,
            });
          }
        }
      }
    }

    // 4. Update capture stats (always)
    await prisma.workspaceForm.update({
      where: { id: form.id },
      data: {
        captureCount: { increment: 1 },
        lastCaptureAt: new Date(),
      },
    });

    // 5. Emit workflow trigger (always - with or without lead)
    await emitTrigger(
      form.workspaceId,
      { adapter: 'capture', operation: form.triggerName },
      {
        formId: form.id,
        formName: form.name,
        email,           // May be undefined
        leadId,          // May be undefined
        isNewLead,
        captureId,
        mode,
        ...leadFields,
        customFields,
      }
    );

    // 6. Log success event
    if (leadId) {
      await emitEvent({
        workspaceId: form.workspaceId,
        leadId,
        system: EventSystem.BACKEND,
        eventType: isNewLead ? 'capture_lead_created' : 'capture_lead_updated',
        success: true,
      });
    } else {
      // No lead created (no email) - still log the capture
      await emitEvent({
        workspaceId: form.workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'capture_processed_no_email',
        success: true,
      });
    }

    return {
      success: true,
      leadId,
      isNewLead,
      captureId,
    };
  } catch (error) {
    // Log error event
    await emitEvent({
      workspaceId: form.workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'capture_processing_failed',
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: 'Processing failed',
      captureId,
    };
  }
}

// =============================================================================
// SERVER-SIDE CAPTURE SDK
// =============================================================================

/**
 * Submit to capture from server-side code.
 * Used by bespoke forms that need custom logic before capture.
 * 
 * OBSERVATIONAL: Never throws, always returns result.
 * Email is optional - capture accepts any data.
 * 
 * @param formId - The WorkspaceForm ID to submit to
 * @param payload - The data to capture (email optional, custom fields use 'custom.' prefix)
 * @param options - Optional configuration
 * @returns CaptureProcessResult with success status
 * 
 * @example
 * // After booking is confirmed
 * const result = await submitToCapture('form-uuid-here', {
 *   email: customer.email,           // Optional
 *   firstName: customer.name,
 *   'custom.bookingId': bookingId,
 *   'custom.slotTime': slot.startTime,
 * });
 */
export async function submitToCapture(
  formId: string,
  payload: Record<string, unknown>,
  options?: {
    /** Override workspace ID lookup (for when formId might not be a UUID) */
    workspaceId?: string;
    /** Source mode for logging */
    mode?: 'internal' | 'server';
  }
): Promise<CaptureProcessResult> {
  const captureId = `cap_${randomUUID().split('-')[0]}`;
  
  try {
    // 1. Load form configuration
    const form = await getFormById(formId);
    
    if (!form) {
      // If form not found and workspaceId provided, log event but don't throw
      if (options?.workspaceId) {
        await emitEvent({
          workspaceId: options.workspaceId,
          system: EventSystem.BACKEND,
          eventType: 'capture_sdk_form_not_found',
          success: false,
          errorMessage: `Form ${formId} not found`,
        });
      }
      return {
        success: false,
        error: 'Form not found',
        captureId,
      };
    }
    
    if (!form.enabled) {
      await emitEvent({
        workspaceId: form.workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'capture_sdk_form_disabled',
        success: false,
      });
      return {
        success: false,
        error: 'Form is disabled',
        captureId,
      };
    }
    
    // 2. Filter payload to only allowed targets (but don't validate strictly for SDK)
    const filteredPayload: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(payload)) {
      // For SDK mode, we're more lenient - accept all fields that aren't denylisted
      if (isDenylistedTarget(key)) {
        continue;
      }
      
      // Sanitize string values
      if (typeof value === 'string') {
        if (hasSensitiveValuePattern(value)) {
          continue;
        }
        filteredPayload[key] = value.trim().substring(0, MAX_FIELD_LENGTH);
      } else if (value !== null && value !== undefined) {
        filteredPayload[key] = value;
      }
    }
    
    // 3. Process the capture
    const result = await processCapturePayload(
      form,
      filteredPayload,
      options?.mode === 'server' ? 'server' : 'browser', // Use browser mode for internal
      { origin: 'sdk' }
    );
    
    return result;
    
  } catch (error) {
    // Log but don't throw - capture is observational
    console.error('submitToCapture error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      captureId,
    };
  }
}

/**
 * Submit capture by trigger name (convenience method).
 * Looks up the WorkspaceForm by triggerName for a workspace.
 * 
 * @param workspaceId - The workspace ID
 * @param triggerName - The trigger name configured on the form
 * @param payload - The data to capture
 */
export async function submitCaptureTrigger(
  workspaceId: string,
  triggerName: string,
  payload: Record<string, unknown>
): Promise<CaptureProcessResult> {
  const captureId = `cap_${randomUUID().split('-')[0]}`;
  
  try {
    // Find form by trigger name
    const form = await prisma.workspaceForm.findFirst({
      where: {
        workspaceId,
        triggerName,
        enabled: true,
      },
    });
    
    if (!form) {
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'capture_sdk_trigger_not_found',
        success: false,
        errorMessage: `No enabled form with trigger "${triggerName}"`,
      });
      return {
        success: false,
        error: `No enabled form with trigger "${triggerName}"`,
        captureId,
      };
    }
    
    // Submit using the form ID
    return submitToCapture(form.id, payload, { workspaceId, mode: 'internal' });
    
  } catch (error) {
    console.error('submitCaptureTrigger error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      captureId,
    };
  }
}

// =============================================================================
// EMBED CODE GENERATION
// =============================================================================

/**
 * Generate embed code for a capture form
 */
export function generateEmbedCode(
  form: LoadedForm,
  options: {
    endpoint?: string;
    formSelector: string;
    fieldMappings: Array<{ source: string; target: string }>;
  }
): string {
  const endpoint = options.endpoint || 'https://revline.app/api/v1/capture/';
  
  // Build field mappings string: "source:target,source:target"
  const fieldMappingsStr = options.fieldMappings
    .map(m => `${m.source}:${m.target}`)
    .join(',');

  return `<!-- RevLine Form Capture -->
<script
  src="${endpoint.replace('/api/v1/capture/', '/capture.js')}"
  data-form-id="${form.id}"
  data-form-selector="${escapeHtml(options.formSelector)}"
  data-fields="${escapeHtml(fieldMappingsStr)}"
  data-endpoint="${endpoint}"
  async
></script>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// FORM MANAGEMENT
// =============================================================================

/**
 * List forms for a workspace
 */
export async function listForms(workspaceId: string): Promise<LoadedForm[]> {
  const forms = await prisma.workspaceForm.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  return forms.map(form => {
    let security: FormSecurity;
    try {
      security = FormSecuritySchema.parse(form.security);
    } catch {
      security = DEFAULT_FORM_SECURITY;
    }

    let allowedTargets: string[];
    try {
      allowedTargets = Array.isArray(form.allowedTargets)
        ? form.allowedTargets as string[]
        : ['email'];
    } catch {
      allowedTargets = ['email'];
    }

    return {
      id: form.id,
      workspaceId: form.workspaceId,
      name: form.name,
      enabled: form.enabled,
      security,
      allowedTargets,
      triggerName: form.triggerName,
    };
  });
}

/**
 * Get form stats
 */
export async function getFormStats(formId: string): Promise<{
  captureCount: number;
  lastCaptureAt: Date | null;
} | null> {
  const form = await prisma.workspaceForm.findUnique({
    where: { id: formId },
    select: { captureCount: true, lastCaptureAt: true },
  });

  return form;
}
