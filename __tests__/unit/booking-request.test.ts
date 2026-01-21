/**
 * Booking Request Flow Tests
 * 
 * Tests for the magic link booking request endpoint.
 * Verifies security guarantees and correct behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { testPrisma, createTestWorkspace, createAbcIgniteIntegration } from '../setup';

// Mock the booking provider
vi.mock('@/app/_lib/booking/get-provider', () => ({
  getBookingProvider: vi.fn(),
}));

// Mock the email service
vi.mock('@/app/_lib/email', () => ({
  EmailService: {
    sendBookingConfirmation: vi.fn().mockResolvedValue({ success: true, data: { messageId: 'test-id' } }),
  },
}));

// Mock rate limiting to allow all requests in tests
vi.mock('@/app/_lib/middleware/rate-limit', () => ({
  checkBookingRateLimit: vi.fn().mockReturnValue({ 
    allowed: true, 
    result: { allowed: true, remaining: 5, resetAt: Date.now() + 60000 } 
  }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

import { getBookingProvider } from '@/app/_lib/booking/get-provider';
import { EmailService } from '@/app/_lib/email';
import { checkBookingRateLimit } from '@/app/_lib/middleware/rate-limit';

describe('Booking Request Flow', () => {
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  
  beforeEach(async () => {
    // Create test workspace
    workspace = await createTestWorkspace({ slug: 'test-gym' });
    
    // Create ABC Ignite integration
    await createAbcIgniteIntegration(
      workspace.id,
      'test-app-id',
      'test-app-key',
      { clubNumber: '1234' }
    );
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  describe('Rate Limiting', () => {
    it('should check rate limits for booking requests', async () => {
      const mockProvider = {
        providerId: 'abc_ignite',
        providerName: 'ABC Ignite',
        lookupCustomer: vi.fn().mockResolvedValue(null),
      };
      (getBookingProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      
      // Import the route handler dynamically to use our mocks
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'test@example.com',
        }),
      });
      
      await POST(request);
      
      expect(checkBookingRateLimit).toHaveBeenCalledWith('12345', '127.0.0.1');
    });
    
    it('should return generic response when rate limited', async () => {
      (checkBookingRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: false,
        result: { allowed: false, remaining: 0, resetAt: Date.now() + 60000, retryAfter: 60 },
      });
      
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'test@example.com',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Even when rate limited, response should be generic
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
    });
  });
  
  describe('Security - No Enumeration', () => {
    it('should return same response when customer not found', async () => {
      const mockProvider = {
        providerId: 'abc_ignite',
        providerName: 'ABC Ignite',
        lookupCustomer: vi.fn().mockResolvedValue(null),
      };
      (getBookingProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: 'non-existent',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'test@example.com',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Same generic response
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
    });
    
    it('should return same response when email mismatches', async () => {
      const mockProvider = {
        providerId: 'abc_ignite',
        providerName: 'ABC Ignite',
        lookupCustomer: vi.fn().mockResolvedValue({
          id: 'member-1',
          name: 'Test User',
          email: 'real@example.com',
        }),
        getCustomerEmail: vi.fn().mockReturnValue('real@example.com'),
        checkEligibility: vi.fn().mockResolvedValue({ eligible: true }),
      };
      (getBookingProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'wrong@example.com', // Different from customer email
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Same generic response
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
      
      // Should NOT send email
      expect(EmailService.sendBookingConfirmation).not.toHaveBeenCalled();
    });
    
    it('should return same response for invalid workspace', async () => {
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'non-existent-workspace',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'test@example.com',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Same generic response
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
    });
  });
  
  describe('Successful Booking Request', () => {
    it('should create pending booking and send email', async () => {
      const mockProvider = {
        providerId: 'abc_ignite',
        providerName: 'ABC Ignite',
        lookupCustomer: vi.fn().mockResolvedValue({
          id: 'member-1',
          name: 'Test User',
          email: 'test@example.com',
          providerData: { barcode: '12345' },
        }),
        getCustomerEmail: vi.fn().mockReturnValue('test@example.com'),
        checkEligibility: vi.fn().mockResolvedValue({ eligible: true }),
      };
      (getBookingProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);
      
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const slotTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime,
          email: 'test@example.com',
          serviceName: 'Personal Training',
          staffName: 'John Trainer',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Verify response
      expect(data.success).toBe(true);
      
      // Verify pending booking created
      const pendingBooking = await testPrisma.pendingBooking.findFirst({
        where: { workspaceId: workspace.id },
      });
      
      expect(pendingBooking).not.toBeNull();
      expect(pendingBooking?.customerId).toBe('member-1');
      expect(pendingBooking?.customerEmail).toBe('test@example.com');
      expect(pendingBooking?.provider).toBe('abc_ignite');
      expect(pendingBooking?.status).toBe('PENDING');
      expect(pendingBooking?.tokenHash).toHaveLength(64); // SHA-256 hash
      
      // Verify email sent
      expect(EmailService.sendBookingConfirmation).toHaveBeenCalledTimes(1);
      expect(EmailService.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: workspace.id,
          to: 'test@example.com',
          staffName: 'John Trainer',
          serviceName: 'Personal Training',
        })
      );
    });
  });
  
  describe('Input Validation', () => {
    it('should handle missing required fields gracefully', async () => {
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing all required fields
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Should still return generic success (no validation error exposure)
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
    });
    
    it('should handle invalid email format gracefully', async () => {
      const { POST } = await import('@/app/api/v1/booking/request/route');
      
      const request = new NextRequest('http://localhost/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: 'test-gym',
          identifier: '12345',
          staffId: 'trainer-1',
          slotTime: new Date().toISOString(),
          email: 'not-an-email',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Should still return generic success
      expect(data.success).toBe(true);
      expect(data.message).toContain('confirmation email');
    });
  });
});
