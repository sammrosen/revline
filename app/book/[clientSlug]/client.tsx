'use client';

/**
 * Booking Page Client Component
 * 
 * Renders the booking wizard with client-side interactivity.
 */

import { BookingWizard, BookingProviderCapabilities } from '@/app/_lib/booking';

interface BookingPageClientProps {
  clientSlug: string;
  clientName: string;
  capabilities: BookingProviderCapabilities;
}

export function BookingPageClient({
  clientSlug,
  clientName,
  capabilities,
}: BookingPageClientProps) {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-xl font-semibold text-white">{clientName}</h1>
          <p className="text-sm text-zinc-500">Online Booking</p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <BookingWizard
          clientSlug={clientSlug}
          capabilities={capabilities}
          onComplete={(result) => {
            console.log('Booking complete:', result);
          }}
          onError={(error) => {
            console.error('Booking error:', error);
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-zinc-600">
            Powered by RevLine
          </p>
        </div>
      </footer>
    </div>
  );
}
