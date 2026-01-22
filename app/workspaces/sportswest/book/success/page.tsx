'use client';

/**
 * Sports West Athletic Club - Booking Success Page
 * 
 * Displayed after a user confirms their booking via magic link.
 * Shows booking details and next steps.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Sports West brand colors
const BRAND = {
  primary: '#8B2346',
  background: '#f3f4f6',
  text: '#111827',
  textMuted: '#6b7280',
  success: '#059669',
  border: '#e5e7eb',
};

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SuccessContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.background }}>
      <div className="animate-spin w-8 h-8 border-4 rounded-full" style={{ borderColor: `${BRAND.border} ${BRAND.border} ${BRAND.primary} ${BRAND.primary}` }} />
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const staffName = searchParams.get('staffName');
  const serviceName = searchParams.get('serviceName');
  const time = searchParams.get('time');

  // Format the session time if provided
  let formattedTime = '';
  if (time) {
    try {
      const date = new Date(time);
      formattedTime = date.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      formattedTime = time;
    }
  }
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.background }}>
      {/* Header */}
      <header className="bg-zinc-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-bold text-zinc-800 text-sm">SPORTS WEST</span>
              <div className="text-[10px] text-zinc-600">ATHLETIC CLUB</div>
            </div>
          </div>
          <span className="text-sm text-zinc-400">Booking Confirmed</span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Success header */}
          <div className="p-8 text-center border-b" style={{ borderColor: BRAND.border }}>
            {/* Success icon */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: `${BRAND.success}20` }}
            >
              <svg
                className="w-10 h-10"
                style={{ color: BRAND.success }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-semibold mb-2" style={{ color: BRAND.text }}>
              You&apos;re All Set!
            </h1>
            <p className="text-lg" style={{ color: BRAND.textMuted }}>
              Your session has been confirmed.
            </p>
          </div>

          {/* Booking details */}
          <div className="p-8">
            <h2 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: BRAND.textMuted }}>
              Session Details
            </h2>

            <div className="space-y-4">
              {/* Service name */}
              {serviceName && (
                <div className="flex items-start gap-4">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <div>
                    <div className="text-sm" style={{ color: BRAND.textMuted }}>Session Type</div>
                    <div className="font-medium" style={{ color: BRAND.text }}>{serviceName}</div>
                  </div>
                </div>
              )}

              {/* Date/time */}
              {formattedTime && (
                <div className="flex items-start gap-4">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <div className="text-sm" style={{ color: BRAND.textMuted }}>Date & Time</div>
                    <div className="font-medium" style={{ color: BRAND.text }}>{formattedTime}</div>
                  </div>
                </div>
              )}

              {/* Trainer */}
              {staffName && (
                <div className="flex items-start gap-4">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <div className="text-sm" style={{ color: BRAND.textMuted }}>Trainer</div>
                    <div className="font-medium" style={{ color: BRAND.text }}>{staffName}</div>
                  </div>
                </div>
              )}

              {/* Confirmation number */}
              {bookingId && (
                <div className="flex items-start gap-4">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <div>
                    <div className="text-sm" style={{ color: BRAND.textMuted }}>Confirmation #</div>
                    <div className="font-mono text-sm" style={{ color: BRAND.text }}>{bookingId}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Next steps */}
          <div className="p-8 border-t" style={{ borderColor: BRAND.border, backgroundColor: '#f9fafb' }}>
            <h2 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: BRAND.textMuted }}>
              What&apos;s Next
            </h2>
            <ul className="space-y-3 text-sm" style={{ color: BRAND.text }}>
              <li className="flex items-start gap-3">
                <span style={{ color: BRAND.success }}>✓</span>
                <span>Arrive 10 minutes before your session</span>
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: BRAND.success }}>✓</span>
                <span>Bring your membership card or ID</span>
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: BRAND.success }}>✓</span>
                <span>Wear comfortable workout attire</span>
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: BRAND.success }}>✓</span>
                <span>To cancel or reschedule, contact the front desk</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="p-8 border-t flex flex-col sm:flex-row gap-4" style={{ borderColor: BRAND.border }}>
            <Link
              href="/workspaces/sportswest/book"
              className="flex-1 py-3 text-center rounded font-medium transition-colors"
              style={{ 
                backgroundColor: BRAND.primary, 
                color: 'white',
              }}
            >
              Book Another Session
            </Link>
            <button
              onClick={handlePrint}
              className="flex-1 py-3 text-center border rounded font-medium hover:bg-white transition-colors"
              style={{ borderColor: BRAND.border, color: BRAND.text }}
            >
              Print Confirmation
            </button>
          </div>
        </div>
      </main>

      {/* RevLine Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-gray-400">Powered by RevLine</p>
        <a href="mailto:hi@revlineops.com" className="text-xs text-gray-400 hover:text-gray-500">
          hi@revlineops.com
        </a>
      </footer>
    </div>
  );
}
