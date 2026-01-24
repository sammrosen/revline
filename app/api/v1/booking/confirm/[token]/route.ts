/**
 * GET /api/v1/booking/confirm/[token]
 * 
 * Magic link confirmation endpoint.
 * Validates token, re-verifies eligibility, creates booking, and redirects.
 * 
 * Security:
 * - Token is hashed for database lookup
 * - Single-use enforcement via status check
 * - Expiry check before processing
 * - Re-verification with provider before booking
 * 
 * SYNC WORKFLOW EXECUTION:
 * First attempts to use sync workflow (booking.create_booking trigger).
 * Falls back to direct provider call if no workflow is configured.
 * 
 * STANDARDS:
 * - Provider-agnostic (works with any BookingProvider)
 * - Redirects (not JSON) for browser experience
 * - Generic error messages (no enumeration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getBookingProvider } from '@/app/_lib/booking/get-provider';
import { hashToken, isTokenExpired } from '@/app/_lib/booking/magic-link';
import { BookingCustomer, TimeSlot } from '@/app/_lib/booking/types';
import { PendingBookingStatus } from '@prisma/client';
import { executeWorkflowSync } from '@/app/_lib/workflow';

/**
 * Build workspace-specific redirect URL
 * Redirects to public booking pages at /public/[slug]/book
 */
function buildRedirectUrl(
  workspaceSlug: string | null, 
  path: 'success' | 'error',
  params?: Record<string, string>
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Build path based on type - use /public/[slug]/book for public-facing pages
  let pagePath: string;
  if (path === 'success') {
    // Success page - public path
    pagePath = workspaceSlug 
      ? `/public/${workspaceSlug}/book/success`
      : '/book/success';
  } else {
    // Error - redirect back to booking page with error param
    pagePath = workspaceSlug 
      ? `/public/${workspaceSlug}/book`
      : '/book';
  }
  
  const url = new URL(pagePath, baseUrl);
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  
  return url.toString();
}

/**
 * GET /api/v1/booking/confirm/[token]
 * 
 * Confirm a pending booking via magic link.
 * Validates, re-verifies, creates booking, and redirects to success/error page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params;
  
  try {
    // Hash the token for lookup
    const tokenHash = hashToken(token);
    
    // Find pending booking by token hash
    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { tokenHash },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });
    
    // Token not found
    if (!pendingBooking) {
      await emitEvent({
        workspaceId: 'unknown',
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_invalid_token',
        success: false,
      });
      return NextResponse.redirect(buildRedirectUrl(null, 'error', { error: 'invalid' }));
    }
    
    const workspaceId = pendingBooking.workspaceId;
    const workspaceSlug = pendingBooking.workspace.slug;
    
    // Check if already processed
    if (pendingBooking.status !== PendingBookingStatus.PENDING) {
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_already_processed',
        success: false,
        errorMessage: `Status: ${pendingBooking.status}`,
      });
      
      // If already confirmed, redirect to success with existing booking ID
      if (pendingBooking.status === PendingBookingStatus.CONFIRMED && pendingBooking.externalId) {
        return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'success', {
          bookingId: pendingBooking.externalId,
          staffName: pendingBooking.staffName || '',
          serviceName: pendingBooking.serviceName || '',
          time: pendingBooking.scheduledAt.toISOString(),
        }));
      }
      
      return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'invalid' }));
    }
    
    // Check if expired
    if (isTokenExpired(pendingBooking.expiresAt)) {
      await prisma.pendingBooking.update({
        where: { id: pendingBooking.id },
        data: { status: PendingBookingStatus.EXPIRED },
      });
      
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_expired',
        success: false,
      });
      
      return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'expired' }));
    }
    
    // Check workspace is active
    if (pendingBooking.workspace.status !== 'ACTIVE') {
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_workspace_inactive',
        success: false,
      });
      return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'failed' }));
    }
    
    // Load booking provider
    const provider = await getBookingProvider(workspaceId);
    
    if (!provider) {
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_no_provider',
        success: false,
      });
      return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'failed' }));
    }
    
    // Re-verify customer exists
    let customer: BookingCustomer | null = null;
    if (provider.lookupCustomer) {
      // We need the original identifier - it's stored in providerData.barcode for ABC
      const barcode = (pendingBooking.providerData as Record<string, unknown>)?.barcode as string;
      if (barcode) {
        customer = await provider.lookupCustomer(barcode);
      }
    }
    
    // If we couldn't verify customer, use stored data
    if (!customer) {
      customer = {
        id: pendingBooking.customerId,
        name: pendingBooking.customerName || 'Customer',
        email: pendingBooking.customerEmail,
        providerData: pendingBooking.providerData as Record<string, unknown>,
      };
    }
    
    // Re-check eligibility (if provider supports it)
    if (provider.checkEligibility) {
      const eligibility = await provider.checkEligibility(customer, pendingBooking.serviceId || undefined);
      if (!eligibility.eligible) {
        await prisma.pendingBooking.update({
          where: { id: pendingBooking.id },
          data: { 
            status: PendingBookingStatus.FAILED,
            failureReason: eligibility.reason || 'No longer eligible',
          },
        });
        
        await emitEvent({
          workspaceId,
          system: EventSystem.BACKEND,
          eventType: 'booking_confirmation_not_eligible',
          success: false,
          errorMessage: eligibility.reason,
        });
        
        return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'failed' }));
      }
    }
    
    // Execute the booking
    // Priority: 1. Sync workflow, 2. Provider executeBookingPayload, 3. Provider createBooking
    const bookingResult = await executeBookingWithWorkflowOrProvider(
      workspaceId,
      pendingBooking,
      provider,
      customer
    );
    
    if (!bookingResult.success) {
      await prisma.pendingBooking.update({
        where: { id: pendingBooking.id },
        data: { 
          status: PendingBookingStatus.FAILED,
          failureReason: bookingResult.error || 'Booking creation failed',
        },
      });
      
      await emitEvent({
        workspaceId,
        system: EventSystem.BACKEND,
        eventType: 'booking_confirmation_failed',
        success: false,
        errorMessage: bookingResult.error,
      });
      
      return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'error', { error: 'failed' }));
    }
    
    // Mark as confirmed
    await prisma.pendingBooking.update({
      where: { id: pendingBooking.id },
      data: { 
        status: PendingBookingStatus.CONFIRMED,
        confirmedAt: new Date(),
        externalId: bookingResult.bookingId,
      },
    });
    
    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'booking_confirmed',
      success: true,
    });
    
    // Redirect to success page with booking details
    return NextResponse.redirect(buildRedirectUrl(workspaceSlug, 'success', {
      bookingId: bookingResult.bookingId || '',
      staffName: pendingBooking.staffName || '',
      serviceName: pendingBooking.serviceName || '',
      time: pendingBooking.scheduledAt.toISOString(),
    }));
    
  } catch (error) {
    console.error('Booking confirmation error:', error);
    
    await emitEvent({
      workspaceId: 'unknown',
      system: EventSystem.BACKEND,
      eventType: 'booking_confirmation_error',
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Can't determine workspace in catch block, use generic error page
    return NextResponse.redirect(buildRedirectUrl(null, 'error', { error: 'failed' }));
  }
}

/**
 * Execute booking via sync workflow or fallback to direct provider
 */
async function executeBookingWithWorkflowOrProvider(
  workspaceId: string,
  pendingBooking: {
    id: string;
    customerId: string;
    staffId: string;
    serviceId: string | null;
    staffName: string | null;
    serviceName: string | null;
    scheduledAt: Date;
    providerPayload: unknown;
    providerData: unknown;
  },
  provider: Awaited<ReturnType<typeof getBookingProvider>>,
  customer: BookingCustomer
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  const storedPayload = pendingBooking.providerPayload as Record<string, unknown> | null;
  const providerData = pendingBooking.providerData as Record<string, unknown> | null;

  // Try sync workflow first if we have the required data
  if (storedPayload) {
    // The stored payload contains ABC-specific fields
    const employeeId = storedPayload.employeeId as string;
    const eventTypeId = storedPayload.eventTypeId as string;
    const startTime = storedPayload.startTime as string;
    const memberId = storedPayload.memberId as string;
    const levelId = storedPayload.levelId as string | undefined;

    if (employeeId && eventTypeId && startTime && memberId) {
      const workflowResult = await executeWorkflowSync(
        workspaceId,
        { adapter: 'booking', operation: 'create_booking' },
        {
          slotId: pendingBooking.id,
          employeeId,
          eventTypeId,
          levelId,
          startTime,
          memberId,
          customerEmail: customer.email,
          customerName: customer.name,
        },
        { allowNoWorkflow: true }
      );

      // If workflow executed successfully (not just "no workflow found")
      if (workflowResult.success && !workflowResult.data?.noWorkflow) {
        return {
          success: true,
          bookingId: (workflowResult.data?.bookingId || workflowResult.data?.eventId) as string | undefined,
        };
      }

      // If workflow failed (not "no workflow"), return the error
      if (!workflowResult.success && !workflowResult.error?.includes('No workflow configured')) {
        return {
          success: false,
          error: workflowResult.error,
        };
      }
    }
  }

  // Fallback to provider
  if (!provider) {
    return {
      success: false,
      error: 'No booking provider configured',
    };
  }

  // Try executeBookingPayload first (new approach with stored payload)
  if (storedPayload && provider.executeBookingPayload) {
    const result = await provider.executeBookingPayload(storedPayload);
    return {
      success: result.success,
      bookingId: result.bookingId,
      error: result.error,
    };
  }

  // Legacy fallback: Build slot and use createBooking
  let resolvedEmployeeId = pendingBooking.staffId;
  if (provider.resolveEmployeeId && pendingBooking.staffId) {
    const resolved = provider.resolveEmployeeId(pendingBooking.staffId);
    if (resolved) {
      resolvedEmployeeId = resolved;
    }
  }

  const slot: TimeSlot = {
    id: providerData?.slotId as string || `pending-${pendingBooking.id}`,
    startTime: pendingBooking.scheduledAt.toISOString(),
    endTime: new Date(pendingBooking.scheduledAt.getTime() + 60 * 60 * 1000).toISOString(),
    duration: (providerData?.duration as number) || 60,
    title: pendingBooking.serviceName || 'Session',
    staffName: pendingBooking.staffName || undefined,
    providerData: {
      ...providerData,
      employeeId: resolvedEmployeeId,
      eventTypeId: pendingBooking.serviceId,
      isAvailabilitySlot: providerData?.isAvailabilitySlot ?? true,
    },
  };

  const result = await provider.createBooking(slot, customer);
  return {
    success: result.success,
    bookingId: result.bookingId,
    error: result.error,
  };
}
