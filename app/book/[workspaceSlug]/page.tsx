/**
 * Booking Page
 * 
 * /book/[clientSlug]
 * 
 * Self-serve booking page for clients with booking integrations.
 */

import { notFound } from 'next/navigation';
import { WorkspaceStatus } from '@prisma/client';
import { getBookingCapabilities, hasBookingProvider } from '@/app/_lib/booking';
import { getWorkspaceBySlug } from '@/app/_lib/public-page';
import { logStructured } from '@/app/_lib/reliability/types';
import { BookingPageClient } from './client';

interface BookingPageProps {
  params: Promise<{
    clientSlug: string;
  }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { clientSlug } = await params;
  
  const client = await getWorkspaceBySlug(clientSlug);

  if (!client) {
    notFound();
  }

  if (client.status !== WorkspaceStatus.ACTIVE) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Booking Unavailable</h1>
          <p className="text-zinc-400">Online booking is temporarily unavailable. Please contact us directly.</p>
        </div>
      </div>
    );
  }

  const hasProvider = await hasBookingProvider(client.id);
  
  if (!hasProvider) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Booking Not Configured</h1>
          <p className="text-zinc-400">Online booking is not set up for this location.</p>
        </div>
      </div>
    );
  }

  const capabilities = await getBookingCapabilities(client.id);
  
  if (!capabilities) {
    logStructured({
      correlationId: client.id,
      event: 'booking_provider_init_failed',
      workspaceId: client.id,
      success: false,
      metadata: { reason: 'hasBookingProvider=true but getBookingCapabilities=null' },
    });
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Configuration Error</h1>
          <p className="text-zinc-400">Unable to load booking configuration. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <BookingPageClient
      clientSlug={client.slug}
      clientName={client.name}
      capabilities={capabilities}
    />
  );
}

export async function generateMetadata({ params }: BookingPageProps) {
  const { clientSlug } = await params;
  
  const client = await getWorkspaceBySlug(clientSlug);

  if (!client) {
    return { title: 'Booking Not Found' };
  }

  if (client.status !== WorkspaceStatus.ACTIVE) {
    return {
      title: `Book an Appointment - ${client.name}`,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Book an Appointment - ${client.name}`,
    description: `Schedule your appointment with ${client.name}. Easy online booking.`,
  };
}
