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

/**
 * Build workspace-specific redirect URL
 * Redirects to workspace's booking pages for Sports West style
 */
function buildRedirectUrl(
  workspaceSlug: string | null, 
  path: 'success' | 'error',
  params?: Record<string, string>
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Build path based on type
  let pagePath: string;
  if (path === 'success') {
    // Success page - workspace specific
    pagePath = workspaceSlug 
      ? `/workspaces/${workspaceSlug}/book/success`
      : '/book/success';
  } else {
    // Error - redirect back to booking page with error param
    pagePath = workspaceSlug 
      ? `/workspaces/${workspaceSlug}/book`
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
    
    // Build time slot for booking
    // Use provider data if available, otherwise construct minimal slot
    const providerData = pendingBooking.providerData as Record<string, unknown> | null;
    
    const slot: TimeSlot = {
      id: providerData?.slotId as string || `pending-${pendingBooking.id}`,
      startTime: pendingBooking.scheduledAt.toISOString(),
      endTime: new Date(pendingBooking.scheduledAt.getTime() + 60 * 60 * 1000).toISOString(), // Default 1 hour
      duration: (providerData?.duration as number) || 60,
      title: pendingBooking.serviceName || 'Session',
      staffName: pendingBooking.staffName || undefined,
      providerData: {
        // Pass through all provider data for the booking
        ...providerData,
        employeeId: pendingBooking.staffId,
        eventTypeId: pendingBooking.serviceId,
        isAvailabilitySlot: providerData?.isAvailabilitySlot ?? true,
      },
    };
    
    // Create the actual booking
    const bookingResult = await provider.createBooking(slot, customer);
    
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
