/**
 * Signup Agreement Creation
 *
 * POST /api/v1/signup/[slug]
 *
 * Receives validated signup form data + PayPage transaction ID,
 * fetches a fresh planValidationHash from ABC, and calls Create Agreement.
 * Card/bank numbers never reach this server — only opaque PayPage tokens.
 *
 * STANDARDS:
 * - Workspace-scoped via slug lookup
 * - Zod validation on all user input
 * - Events emitted for success/failure (never breaks main flow)
 * - Rate limited with RATE_LIMITS.SUBSCRIBE
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { validateBody } from '@/app/_lib/utils/validation';
import { getActiveWorkspace } from '@/app/_lib/client-gate';
import { AbcIgniteAdapter } from '@/app/_lib/integrations/abc-ignite.adapter';
import type { AbcPayPageBillingInfo } from '@/app/_lib/integrations/abc-ignite.adapter';
import { WorkspaceConfigService } from '@/app/_lib/config';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import {
  rateLimitByIP,
  getClientIP,
  RATE_LIMITS,
} from '@/app/_lib/middleware';

// ---------------------------------------------------------------------------
// Zod schema for signup submission
// ---------------------------------------------------------------------------

const SignupSubmissionSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().min(1).max(60),
    email: z.string().email().max(120),
    phone: z.string().max(20).optional(),
    dateOfBirth: z.string().max(20).optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
  }),
  addressInfo: z.object({
    address: z.string().max(200).optional(),
    city: z.string().max(60).optional(),
    state: z.string().max(10).optional(),
    zip: z.string().max(10).optional(),
  }).optional(),
  planId: z.string().min(1).max(60),
  payPageTransactionId: z.string().min(1).max(200),
  payPagePaymentType: z.enum(['creditcard', 'eft']),
  smsConsent: z.boolean().optional(),
  termsAccepted: z.boolean(),
  paymentAuthorized: z.boolean(),
  promoCode: z.string().max(30).optional(),
});

type SignupSubmission = z.infer<typeof SignupSubmissionSchema>;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // 1. Rate limit
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  // 2. Validate body
  const validation = await validateBody(request, SignupSubmissionSchema);
  if (!validation.success) return validation.response;
  const data: SignupSubmission = validation.data;

  // 3. Consent checks
  if (!data.termsAccepted || !data.paymentAuthorized) {
    return ApiResponse.error(
      'Terms and payment authorization must be accepted',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  try {
    // 4. Workspace lookup
    const workspace = await getActiveWorkspace(slug);
    if (!workspace) {
      return ApiResponse.error('Workspace not found or inactive', 404);
    }

    // 5. Load ABC adapter
    const adapter = await AbcIgniteAdapter.forClient(workspace.id);
    if (!adapter) {
      return ApiResponse.error(
        'Payment integration not configured. Please contact the front desk.',
        503
      );
    }

    // 6. Find the selected plan's ABC payment plan ID
    const signupConfig = await WorkspaceConfigService.resolveForSignup(workspace.id);
    const selectedPlan = signupConfig.plans.find((p) => p.id === data.planId);
    if (!selectedPlan) {
      return ApiResponse.error('Selected plan not found', 400, ErrorCodes.INVALID_INPUT);
    }
    if (!selectedPlan.abcPaymentPlanId) {
      return ApiResponse.error(
        'Selected plan is not linked to a payment plan. Please contact the front desk.',
        400,
        ErrorCodes.INVALID_INPUT
      );
    }

    // 7. Fetch fresh planValidationHash (changes daily for some plans)
    const planDetails = await adapter.getPlanDetails(selectedPlan.abcPaymentPlanId);
    if (!planDetails.success || !planDetails.data) {
      try {
        await emitEvent({
          workspaceId: workspace.id,
          system: EventSystem.ABC_IGNITE,
          eventType: 'signup_agreement_failed',
          success: false,
          errorMessage: planDetails.error || 'Plan validation hash fetch failed',
          metadata: {
            planId: data.planId,
            abcPaymentPlanId: selectedPlan.abcPaymentPlanId,
            stage: 'plan_validation',
          },
        });
      } catch { /* event logging must never break */ }

      return ApiResponse.error(
        'Unable to validate payment plan. Please try again.',
        502
      );
    }

    // 8. Build PayPage billing info based on payment type
    const billingInfo: AbcPayPageBillingInfo = {};
    if (data.payPagePaymentType === 'creditcard') {
      billingInfo.payPageDraftCreditCard = data.payPageTransactionId;
      billingInfo.payPageDueTodayCreditCard = data.payPageTransactionId;
    } else {
      billingInfo.payPageDraftBankAccount = data.payPageTransactionId;
    }

    // 9. Determine sendAgreementEmail from adapter config
    const sendEmail = adapter.getSendAgreementEmail() ? 'true' : 'false';

    // 10. Call Create Agreement API
    const agreementResult = await adapter.createAgreement({
      agreementContactInfo: {
        firstName: data.personalInfo.firstName,
        lastName: data.personalInfo.lastName,
        email: data.personalInfo.email,
        phone: data.personalInfo.phone,
        gender: data.personalInfo.gender,
        dateOfBirth: data.personalInfo.dateOfBirth,
      },
      agreementAddressInfo: data.addressInfo ? {
        addressLine1: data.addressInfo.address,
        city: data.addressInfo.city,
        state: data.addressInfo.state,
        postalCode: data.addressInfo.zip,
        countryCode: 'US',
      } : undefined,
      agreementSalesInfo: {
        paymentPlanId: selectedPlan.abcPaymentPlanId,
        planValidationHash: planDetails.data.planValidationHash,
        sendAgreementEmail: sendEmail,
      },
      payPageBillingInfo: billingInfo,
    });

    if (!agreementResult.success) {
      // Emit failure event (never breaks main flow)
      try {
        await emitEvent({
          workspaceId: workspace.id,
          system: EventSystem.ABC_IGNITE,
          eventType: 'signup_agreement_failed',
          success: false,
          errorMessage: agreementResult.error,
          metadata: {
            planId: data.planId,
            abcPaymentPlanId: selectedPlan.abcPaymentPlanId,
            email: data.personalInfo.email,
          },
        });
      } catch { /* event logging must never break */ }

      return ApiResponse.error(
        'Failed to create membership agreement. Please try again or contact the front desk.',
        502
      );
    }

    // 11. Emit success event
    try {
      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.ABC_IGNITE,
        eventType: 'signup_agreement_created',
        success: true,
        metadata: {
          agreementNumber: agreementResult.data?.agreementNumber,
          memberId: agreementResult.data?.memberId,
          planId: data.planId,
          abcPaymentPlanId: selectedPlan.abcPaymentPlanId,
          email: data.personalInfo.email,
        },
      });
    } catch { /* event logging must never break */ }

    // 12. Return success
    return ApiResponse.success({
      agreementNumber: agreementResult.data?.agreementNumber,
      memberId: agreementResult.data?.memberId,
    });

  } catch (error) {
    console.error('Signup agreement error:', {
      slug,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return ApiResponse.error(
      'An unexpected error occurred. Please try again or contact the front desk.',
      500
    );
  }
}
