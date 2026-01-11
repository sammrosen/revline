'use client';

/**
 * BookingSuccess Component
 * 
 * Success state shown after booking is confirmed.
 */

import { TimeSlot, BookingCustomer, BookingResult } from '../types';

interface BookingSuccessProps {
  result: BookingResult;
  slot: TimeSlot;
  customer: BookingCustomer | null;
  onBookAnother?: () => void;
}

export function BookingSuccess({
  result,
  slot,
  customer,
  onBookAnother,
}: BookingSuccessProps) {
  const startTime = new Date(slot.startTime);
  const isWaitlist = result.message?.toLowerCase().includes('waitlist');

  return (
    <div className="text-center">
      {/* Success icon */}
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-semibold text-white mb-2">
        {isWaitlist ? 'Added to Waitlist!' : 'Booking Confirmed!'}
      </h2>
      <p className="text-zinc-400 mb-8">
        {isWaitlist 
          ? 'We\'ll notify you if a spot opens up'
          : 'You\'re all set for your appointment'
        }
      </p>

      {/* Booking details */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
        <h3 className="font-medium text-white mb-4">{slot.title}</h3>
        
        <div className="space-y-3 text-sm">
          {/* Date & Time */}
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-white">
                {startTime.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-zinc-400">
                {startTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                })}
              </p>
            </div>
          </div>

          {/* Staff */}
          {slot.staffName && (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-zinc-300">with {slot.staffName}</span>
            </div>
          )}

          {/* Location */}
          {slot.location && (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-zinc-300">{slot.location}</span>
            </div>
          )}

          {/* Customer */}
          {customer && (
            <div className="flex items-center gap-3 pt-3 mt-3 border-t border-zinc-800">
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
              <span className="text-zinc-300">{customer.name}</span>
            </div>
          )}
        </div>

        {/* Confirmation ID */}
        {result.bookingId && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              Confirmation: <span className="font-mono text-zinc-400">{result.bookingId}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-8 text-left max-w-md mx-auto">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">What&apos;s next?</h4>
        <ul className="text-sm text-zinc-500 space-y-1">
          <li>• Arrive 5-10 minutes early</li>
          <li>• Bring your membership card</li>
          {!isWaitlist && <li>• Cancel at least 24 hours in advance if needed</li>}
        </ul>
      </div>

      {/* Actions */}
      {onBookAnother && (
        <button
          onClick={onBookAnother}
          className="px-6 py-3 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors"
        >
          Book Another Session
        </button>
      )}
    </div>
  );
}
