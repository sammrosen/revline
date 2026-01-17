/**
 * Sports West Athletic Club - Booking Page
 * 
 * Custom styled booking page matching Sports West branding.
 * Light theme with burgundy accents.
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
import { SportsWestBookingClient } from './client';

// Form ID - enable this in the workspace's RevLine config to connect
const FORM_ID = 'sportswest-booking';

export default async function SportsWestBookingPage() {
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

  return (
    <SportsWestBookingClient
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      capabilities={capabilities}
    />
  );
}

export const metadata = {
  title: 'Book a Session - Sports West Athletic Club',
  description: 'Schedule your personal training session at Sports West Athletic Club.',
};
