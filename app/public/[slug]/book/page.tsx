/**
 * Public Booking Page
 * 
 * /public/[slug]/book
 * 
 * Public-facing magic link booking page for any workspace.
 * Uses workspace slug for lookup.
 * 
 * Configuration:
 * - Loads branding and copy from workspace's Revline config
 * - Falls back to global defaults if not configured
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import { WorkspaceStatus } from '@prisma/client';
import { getBookingCapabilities, hasBookingProvider } from '@/app/_lib/booking';
import { WorkspaceConfigService } from '@/app/_lib/config';
import { MagicLinkBookingClient } from './client';

interface BookingPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    barcode?: string;
    error?: string;
  }>;
}

// Error messages for confirmation redirects
const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'This booking link is invalid or has already been used.',
  expired: 'This booking link has expired. Please request a new booking.',
  failed: 'Unable to complete your booking. Please try again or contact the front desk.',
};

export default async function PublicBookingPage({ params, searchParams }: BookingPageProps) {
  const { slug } = await params;
  const { barcode, error: errorCode } = await searchParams;
  
  // Find workspace by slug
  const workspace = await prisma.workspace.findUnique({
    where: { slug: slug.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });

  // 404 if workspace not found
  if (!workspace) {
    notFound();
  }

  // Show paused message if workspace is paused
  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Booking Unavailable</h1>
          <p className="text-gray-600">Online booking is temporarily unavailable. Please contact us directly.</p>
        </div>
      </div>
    );
  }

  // Check if workspace has a booking provider
  const hasProvider = await hasBookingProvider(workspace.id);
  
  if (!hasProvider) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Booking Not Configured</h1>
          <p className="text-gray-600">Online booking is not set up. Please contact the front desk.</p>
        </div>
      </div>
    );
  }

  // Get provider capabilities
  const capabilities = await getBookingCapabilities(workspace.id);
  
  if (!capabilities) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Configuration Error</h1>
          <p className="text-gray-600">Unable to load booking. Please try again later.</p>
        </div>
      </div>
    );
  }

  // Load workspace branding and copy configuration
  const config = await WorkspaceConfigService.resolveForBooking(workspace.id);

  // Show error message if redirected from confirm with error
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;

  return (
    <>
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}
      <MagicLinkBookingClient
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        capabilities={capabilities}
        initialBarcode={barcode || null}
        branding={config.branding}
        theme={config.theme}
        headerStyle={config.headerStyle}
        copy={config.copy}
        features={config.features}
      />
    </>
  );
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: BookingPageProps) {
  const { slug } = await params;
  
  const workspace = await prisma.workspace.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { name: true },
  });

  if (!workspace) {
    return {
      title: 'Booking Not Found',
    };
  }

  return {
    title: `Book a Session - ${workspace.name}`,
    description: `Schedule your session at ${workspace.name}. Easy online booking.`,
  };
}
