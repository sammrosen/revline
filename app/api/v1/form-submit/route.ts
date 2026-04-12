/**
 * Form Submission Endpoint
 * 
 * POST /api/v1/form-submit
 * 
 * Generic form submission handler for all RevLine forms.
 * Validates the form is enabled for the client, then triggers workflows.
 * 
 * STANDARDS:
 * - Persist first, then process
 * - Deduplication prevents double-submissions
 * - Business logic delegated to workflow engine
 * - Uses standardized validation and responses
 */

import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { emitFormTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { 
  rateLimitByIP, 
  getClientIP, 
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { RevlineAdapter } from '@/app/_lib/integrations/revline.adapter';
import { recordConsent, ConsentType, ConsentMethod } from '@/app/_lib/services/consent.service';

/**
 * Form submission request body
 */
interface FormSubmissionBody {
  formId: string;
  /** Trigger ID to emit - must be declared in form's triggers array */
  trigger: string;
  source: string;
  data: Record<string, unknown>;
  /** True when user checked the consent checkbox */
  consentGiven?: boolean;
  /** Verbatim consent text displayed to the user (regulatory: store what was presented) */
  consentText?: string;
}

/**
 * Validate form submission body structure
 */
function validateSubmissionBody(body: unknown): { 
  success: boolean; 
  data?: FormSubmissionBody; 
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }

  const { formId, trigger, source, data, consentGiven, consentText } = body as Record<string, unknown>;

  if (!formId || typeof formId !== 'string') {
    return { success: false, error: 'Missing or invalid formId' };
  }

  if (!trigger || typeof trigger !== 'string') {
    return { success: false, error: 'Missing or invalid trigger - must specify which trigger to emit' };
  }

  if (!source || typeof source !== 'string') {
    return { success: false, error: 'Missing or invalid source' };
  }

  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Missing or invalid data object' };
  }

  return {
    success: true,
    data: {
      formId,
      trigger,
      source,
      data: data as Record<string, unknown>,
      ...(consentGiven === true && typeof consentText === 'string'
          && consentText.length > 0 && consentText.length <= 2000
        ? { consentGiven: true, consentText }
        : {}),
    },
  };
}

export async function POST(request: NextRequest) {
  // 1. Rate limit check
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  // 2. Read raw body for storage
  const rawBody = await request.text();
  
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return ApiResponse.error(
      'Invalid JSON',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  try {
    // 3. Validate submission structure
    const validation = validateSubmissionBody(body);
    
    if (!validation.success || !validation.data) {
      return ApiResponse.error(
        validation.error || 'Invalid submission',
        400,
        ErrorCodes.INVALID_INPUT
      );
    }

    const { formId, trigger, source, data } = validation.data;

    // 4. Get active client
    const client = await getActiveClient(source);
    if (!client) {
      return ApiResponse.unavailable();
    }

    // 5. Load RevLine config and validate form is enabled
    const revline = await RevlineAdapter.forClient(client.id);
    if (!revline) {
      // RevLine not configured - still allow form submission
      // Just skip the form enablement check
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'form_submit_no_revline_config',
        workspaceId: client.id,
        provider: 'revline',
        metadata: { formId, source },
      });
    } else {
      // Validate form is enabled
      const formValidation = revline.validateForm(formId);
      if (!formValidation.success) {
        return ApiResponse.error(
          formValidation.error || 'Form not available',
          404,
          ErrorCodes.NOT_FOUND
        );
      }
    }

    // 6. Trigger validation happens in emitFormTrigger
    // It validates that the trigger is declared in the form's registry entry
    // This ensures intentionality and catches typos at runtime

    // 7. Generate unique event ID for deduplication
    // Use primary identifier (email/phone) + formId + minute timestamp
    const primaryId = (data.email as string) || (data.phone as string) || JSON.stringify(data);
    const minuteTimestamp = Math.floor(Date.now() / 60000);
    const providerEventId = `form-${formId}-${primaryId}-${minuteTimestamp}`;

    // 8. Register with WebhookProcessor for deduplication and audit
    const registration = await WebhookProcessor.register({
      workspaceId: client.id,
      provider: 'revline',
      providerEventId,
      rawBody,
    });

    // 9. If duplicate (same form data in same minute), still return success
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'form_submit_duplicate',
        workspaceId: client.id,
        provider: 'revline',
        metadata: { formId, source },
      });
      
      // Return success to user (they don't need to know about dedup)
      const response = ApiResponse.success({
        message: 'Form submitted successfully',
      });
      
      const headers = getRateLimitHeaders(rateLimit);
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }
      
      return response;
    }

    // 10. Claim for processing
    await WebhookProcessor.markProcessing(registration.id);

    // 10b. Record consent if granted (fire-and-forget, never blocks submission)
    if (validation.data.consentGiven && validation.data.consentText) {
      const consentTargets: Array<{ address: string; channel: string }> = [];

      const emailValue = typeof data.email === 'string' ? data.email : undefined;
      const rawPhone = data.phone ?? data.phoneNumber ?? data.mobile;
      const phoneValue = typeof rawPhone === 'string' ? rawPhone : undefined;

      if (emailValue) {
        consentTargets.push({ address: emailValue, channel: 'EMAIL' });
      }
      if (phoneValue) {
        consentTargets.push({ address: phoneValue, channel: 'SMS' });
      }

      for (const { address, channel } of consentTargets) {
        recordConsent({
          workspaceId: client.id,
          contactAddress: address,
          channel,
          consentType: ConsentType.MARKETING,
          method: ConsentMethod.WEB_FORM,
          languagePresented: validation.data.consentText,
          ipAddress: clientIP || undefined,
        }).catch(() => {}); // recordConsent logs failures internally
      }
    }

    // 11. Build payload - flatten form data into payload
    const payload = {
      source,
      ...data,
      correlationId: registration.correlationId,
      submittedAt: new Date().toISOString(),
    };

    // 12. Emit validated trigger to workflow engine
    // emitFormTrigger validates that trigger is declared in form registry
    const result = await emitFormTrigger(
      client.id,
      formId,
      trigger,
      payload
    );

    // 13. Check results
    const hasFailure = result.executions.some(e => e.status === 'failed');
    
    if (hasFailure) {
      const failures = result.executions
        .filter(e => e.status === 'failed')
        .map(e => e.error)
        .join('; ');
      
      logStructured({
        correlationId: registration.correlationId,
        event: 'form_submit_partial_failure',
        workspaceId: client.id,
        provider: 'revline',
        error: failures,
        metadata: { formId },
      });
      
      // Mark as processed anyway (partial success)
      await WebhookProcessor.markProcessed(registration.id);
    } else {
      await WebhookProcessor.markProcessed(registration.id);
    }

    logStructured({
      correlationId: registration.correlationId,
      event: 'form_submit_processed',
      workspaceId: client.id,
      provider: 'revline',
      success: true,
      metadata: { 
        formId, 
        source,
        trigger,
        workflowsExecuted: result.workflowsExecuted,
      },
    });

    // 14. Return success response
    const response = ApiResponse.success({
      message: result.workflowsExecuted > 0 
        ? 'Form submitted successfully' 
        : 'Form received (no workflows configured)',
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'form_submit_error',
      provider: 'revline',
      error: errorMessage,
    });
    
    return ApiResponse.internalError();
  }
}
