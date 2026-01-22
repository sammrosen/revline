/**
 * POST /api/v1/booking/request
 * 
 * Magic link booking request endpoint.
 * Creates a pending booking and sends confirmation email.
 * 
 * Security:
 * - Same response for all outcomes (no enumeration)
 * - Rate limited by identifier + IP
 * - Timing normalized to prevent timing attacks
 * - No PII in logs or responses
 * 
 * STANDARDS:
 * - Provider-agnostic (works with any BookingProvider)
 * - All verification happens server-side
 * - Magic link token is hashed before storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getBookingProvider } from '@/app/_lib/booking/get-provider';
import { generateMagicLink, buildConfirmationUrl } from '@/app/_lib/booking/magic-link';
import { TimeSlot } from '@/app/_lib/booking/types';
import { EmailService } from '@/app/_lib/email';
import { checkBookingRateLimit, getClientIP, getRateLimitHeaders } from '@/app/_lib/middleware/rate-limit';

// Request validation schema
const BookingRequestSchema = z.object({
  workspaceSlug: z.string().min(1),
  identifier: z.string().min(1),      // Barcode, email, phone - provider determines type
  staffId: z.string().min(1),         // Generic: trainer, host, etc.
  slotTime: z.string().datetime(),    // ISO datetime
  email: z.string().email(),          // For magic link delivery
  // Optional provider-specific data
  serviceId: z.string().optional(),   // Event type/service ID
  serviceName: z.string().optional(), // Display name for email
  staffName: z.string().optional(),   // Display name for email
  // Slot provider data (from availability response)
  // Contains provider-specific IDs needed for booking (e.g., employeeId, levelId)
  slotProviderData: z.record(z.string(), z.any()).optional(),
});

type BookingRequest = z.infer<typeof BookingRequestSchema>;

// Generic success response (same for all outcomes)
const GENERIC_RESPONSE = {
  success: true,
  message: "If your information matches our records, you'll receive a confirmation email shortly.",
};

// Timing normalization range (ms)
const MIN_DELAY = 100;
const MAX_DELAY = 500;

/**
 * Normalize timing to prevent timing attacks
 * Adds random delay to make all responses take similar time
 */
async function normalizeResponseTime(startTime: number): Promise<void> {
  const elapsed = Date.now() - startTime;
  const targetDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  const remainingDelay = Math.max(0, targetDelay - elapsed);
  
  if (remainingDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingDelay));
  }
}

/**
 * POST /api/v1/booking/request
 * 
 * Create a pending booking and send magic link confirmation email.
 * Always returns same response to prevent enumeration.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = BookingRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      // Don't reveal validation errors - return generic response
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE);
    }
    
    const data: BookingRequest = parseResult.data;
    const { workspaceSlug, identifier, staffId, slotTime, email, serviceId, serviceName, staffName, slotProviderData } = data;
    
    // Rate limit check
    const ip = getClientIP(request.headers);
    const rateLimit = checkBookingRateLimit(identifier, ip);
    
    if (!rateLimit.allowed) {
      // Return generic response even when rate limited
      // But include rate limit headers for debugging
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE, {
        headers: getRateLimitHeaders(rateLimit.result),
      });
    }
    
    // Look up workspace
    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, name: true, status: true, timezone: true, slug: true },
    });
    
    if (!workspace || workspace.status !== 'ACTIVE') {
      await emitEvent({
        workspaceId: workspace?.id || 'unknown',
        system: EventSystem.BACKEND,
        eventType: 'booking_request_workspace_not_found',
        success: false,
      });
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE);
    }
    
    // Load booking provider for workspace
    const provider = await getBookingProvider(workspace.id);
    
    if (!provider) {
      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.BACKEND,
        eventType: 'booking_request_no_provider',
        success: false,
      });
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE);
    }
    
    // Lookup customer by identifier (barcode, email, etc.)
    if (!provider.lookupCustomer) {
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE);
    }
    
    const customer = await provider.lookupCustomer(identifier);
    
    if (!customer) {
      await emitEvent({
        workspaceId: workspace.id,
        system: EventSystem.BACKEND,
        eventType: 'booking_request_customer_not_found',
        success: false,
      });
      await normalizeResponseTime(startTime);
      return NextResponse.json(GENERIC_RESPONSE);
    }
    
    // Verify email matches customer record (if provider supports it)
    if (provider.getCustomerEmail) {
      const customerEmail = provider.getCustomerEmail(customer);
      if (customerEmail && customerEmail.toLowerCase() !== email.toLowerCase()) {
        await emitEvent({
          workspaceId: workspace.id,
          system: EventSystem.BACKEND,
          eventType: 'booking_request_email_mismatch',
          success: false,
        });
        await normalizeResponseTime(startTime);
        return NextResponse.json(GENERIC_RESPONSE);
      }
    }
    
    // Check eligibility (if provider supports it)
    if (provider.checkEligibility) {
      const eligibility = await provider.checkEligibility(customer, serviceId);
      if (!eligibility.eligible) {
        await emitEvent({
          workspaceId: workspace.id,
          system: EventSystem.BACKEND,
          eventType: 'booking_request_not_eligible',
          success: false,
          errorMessage: eligibility.reason,
        });
        await normalizeResponseTime(startTime);
        return NextResponse.json(GENERIC_RESPONSE);
      }
    }
    
    // Generate magic link token
    const { token, hash, expiresAt } = generateMagicLink(15); // 15 minute expiry
    
    // Build confirmation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const confirmUrl = buildConfirmationUrl(baseUrl, token);
    
    // Build the slot object for payload building
    const scheduledAt = new Date(slotTime);
    const slot: TimeSlot = {
      id: `pending-${Date.now()}`,
      startTime: slotTime,
      endTime: new Date(scheduledAt.getTime() + 60 * 60 * 1000).toISOString(), // Default 1 hour
      duration: 60,
      title: serviceName || 'Session',
      staffName: staffName || undefined,
      providerData: slotProviderData || {},
    };
    
    // Build provider-specific payload if provider supports it
    // This is the exact payload that will be sent to the provider API at confirm time
    let providerPayload: Prisma.InputJsonValue | undefined = undefined;
    
    if (provider.buildBookingPayload) {
      const payloadResult = await provider.buildBookingPayload(slot, customer);
      
      if (!payloadResult.success) {
        // Payload build failed - log but don't reveal to user
        await emitEvent({
          workspaceId: workspace.id,
          system: EventSystem.BACKEND,
          eventType: 'booking_request_payload_build_failed',
          success: false,
          errorMessage: payloadResult.error,
        });
        await normalizeResponseTime(startTime);
        return NextResponse.json(GENERIC_RESPONSE);
      }
      
      providerPayload = payloadResult.payload as Prisma.InputJsonValue;
    }
    
    // Create pending booking with the pre-built payload
    await prisma.pendingBooking.create({
      data: {
        workspaceId: workspace.id,
        provider: provider.providerId,
        customerId: customer.id,
        customerEmail: email,
        customerName: customer.name,
        staffId,
        staffName: staffName || null,
        serviceId: serviceId || null,
        serviceName: serviceName || null,
        scheduledAt,
        providerData: customer.providerData 
          ? (customer.providerData as unknown as Prisma.InputJsonValue) 
          : Prisma.JsonNull,
        providerPayload,
        tokenHash: hash,
        expiresAt,
      },
    });
    
    await emitEvent({
      workspaceId: workspace.id,
      system: EventSystem.BACKEND,
      eventType: 'booking_pending_created',
      success: true,
    });
    
    // Format session time for email using workspace timezone
    const sessionDate = new Date(slotTime);
    const formattedTime = sessionDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: workspace.timezone,
      timeZoneName: 'short',
    });
    
    // Send confirmation email
    const emailResult = await EmailService.sendBookingConfirmation({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      to: email,
      confirmUrl,
      staffName: staffName || 'Your trainer',
      serviceName: serviceName || 'Training Session',
      sessionTime: formattedTime,
      expiryMinutes: 15,
    });
    
    if (!emailResult.success) {
      // Email failed but we still created the pending booking
      // Log the error but don't tell the user
      console.error('Failed to send booking confirmation email:', {
        workspaceId: workspace.id,
        error: emailResult.error,
      });
    }
    
    // Success - but return same generic response
    await normalizeResponseTime(startTime);
    return NextResponse.json(GENERIC_RESPONSE, {
      headers: getRateLimitHeaders(rateLimit.result),
    });
    
  } catch (error) {
    console.error('Booking request error:', error);
    
    // Even on errors, return generic response
    await normalizeResponseTime(startTime);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
