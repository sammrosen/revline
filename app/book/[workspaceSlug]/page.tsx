/**
 * Booking Page
 * 
 * /book/[clientSlug]
 * 
 * Self-serve booking page for clients with booking integrations.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import { WorkspaceStatus } from '@prisma/client';
import { getBookingCapabilities, hasBookingProvider } from '@/app/_lib/booking';
import { BookingPageClient } from './client';

interface BookingPageProps {
  params: Promise<{
    clientSlug: string;
  }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { clientSlug } = await params;
  
  // Get client
  const client = await prisma.workspace.findUnique({
    where: { slug: clientSlug.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });

  // 404 if not found
  if (!client) {
    notFound();
  }

  // Show paused message if client is paused
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

  // Check if client has booking provider
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

  // Get provider capabilities
  const capabilities = await getBookingCapabilities(client.id);
  
  if (!capabilities) {
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

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: BookingPageProps) {
  const { clientSlug } = await params;
  
  const client = await prisma.workspace.findUnique({
    where: { slug: clientSlug.toLowerCase() },
    select: { name: true },
  });

  if (!client) {
    return {
      title: 'Booking Not Found',
    };
  }

  return {
    title: `Book an Appointment - ${client.name}`,
    description: `Schedule your appointment with ${client.name}. Easy online booking.`,
  };
}
