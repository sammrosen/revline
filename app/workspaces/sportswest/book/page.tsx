/**
 * Sports West Athletic Club - Booking Page
 * 
 * Custom styled booking page matching Sports West branding.
 * Light theme with burgundy accents.
 * 
 * Uses Magic Link flow:
 * 1. User selects time slot
 * 2. Enters barcode + email
 * 3. Receives email with confirmation link
 * 4. Clicks link to finalize booking
 * 
 * This page uses formId-based workspace lookup:
 * 1. Developer sets FORM_ID below
 * 2. Admin enables this formId in workspace's RevLine config
 * 3. Page automatically connects to the right workspace
 */

import { notFound } from 'next/navigation';
import { 
  getWorkspaceByFormId, 
  getBookingCapabilities, 
  hasBookingProvider 
} from '@/app/_lib/booking';
import { MagicLinkBookingClient } from './magic-link-client';

// Form ID - enable this in the workspace's RevLine config to connect
const FORM_ID = 'sportswest-booking';

// Error messages for confirmation redirects
const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'This booking link is invalid or has already been used.',
  expired: 'This booking link has expired. Please request a new booking.',
  failed: 'Unable to complete your booking. Please try again or contact the front desk.',
};

export default async function SportsWestBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; error?: string }>;
}) {
  // Get URL params
  const params = await searchParams;
  const initialBarcode = params.barcode || null;
  const errorCode = params.error;
  
  // Find workspace by formId (configured in RevLine integration)
  let workspace;
  try {
    workspace = await getWorkspaceByFormId(FORM_ID);
  } catch (error) {
    // Multiple workspaces have this formId - configuration error
    console.error('FormId configuration error:', error);
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Configuration Error</h1>
          <p className="text-gray-600">This form has a configuration issue. Please contact support.</p>
        </div>
      </div>
    );
  }

  // No workspace has this formId enabled
  if (!workspace) {
    notFound();
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
        initialBarcode={initialBarcode}
      />
    </>
  );
}

export const metadata = {
  title: 'Book a Session - Sports West Athletic Club',
  description: 'Schedule your personal training session at Sports West Athletic Club.',
};
