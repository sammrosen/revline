'use client';

/**
 * ConfirmationStep Component
 * 
 * Final step before booking - shows summary and confirms the booking.
 */

import { useState } from 'react';
import { TimeSlot, BookingCustomer, EligibilityResult, BookingResult } from '../types';

interface ConfirmationStepProps {
  clientSlug: string;
  slot: TimeSlot;
  customer: BookingCustomer | null;
  eligibility: EligibilityResult | null;
  supportsWaitlist: boolean;
  onConfirm: (result: BookingResult) => void;
  onError: (error: string) => void;
  onBack: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function ConfirmationStep({
  clientSlug,
  slot,
  customer,
  eligibility,
  supportsWaitlist,
  onConfirm,
  onError,
  onBack,
  loading,
  setLoading,
}: ConfirmationStepProps) {
  const [useWaitlist, setUseWaitlist] = useState(false);
  
  const isFull = slot.spotsAvailable === 0;
  const showWaitlistOption = isFull && supportsWaitlist;
  
  const startTime = new Date(slot.startTime);
  const endTime = new Date(slot.endTime);

  const handleConfirm = async () => {
    if (isFull && !useWaitlist) {
      onError('This slot is full. Please select a different time or join the waitlist.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSlug,
          slot,
          customer: customer || { id: 'guest', name: 'Guest' },
          useWaitlist: isFull && useWaitlist,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.error || 'Failed to create booking');
        return;
      }

      onConfirm(data.data.result);
    } catch {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Confirm Your Booking</h2>
        <p className="text-zinc-400">Review the details below</p>
      </div>

      {/* Booking details card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-6">
        {/* Event info */}
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">{slot.title}</h3>
          
          <div className="space-y-3">
            {/* Date */}
            <div className="flex items-center gap-3 text-zinc-300">
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>
                {startTime.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            
            {/* Time */}
            <div className="flex items-center gap-3 text-zinc-300">
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                {' - '}
                {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                <span className="text-zinc-500 ml-1">({slot.duration} min)</span>
              </span>
            </div>
            
            {/* Staff */}
            {slot.staffName && (
              <div className="flex items-center gap-3 text-zinc-300">
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>with {slot.staffName}</span>
              </div>
            )}
            
            {/* Location */}
            {slot.location && (
              <div className="flex items-center gap-3 text-zinc-300">
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{slot.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Customer info (if present) */}
        {customer && (
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
            <p className="text-sm text-zinc-500 mb-1">Booking for</p>
            <p className="text-white font-medium">{customer.name}</p>
            {eligibility?.balance && !eligibility.balance.unlimited && (
              <p className="text-xs text-zinc-500 mt-1">
                1 session will be used • {eligibility.balance.remaining - 1} remaining after booking
              </p>
            )}
          </div>
        )}

        {/* Availability status */}
        <div className="p-4 bg-zinc-950">
          {isFull ? (
            <div className="flex items-center gap-2 text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm">This slot is currently full</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">
                {slot.spotsAvailable !== undefined 
                  ? `${slot.spotsAvailable} spot${slot.spotsAvailable !== 1 ? 's' : ''} available`
                  : 'Available'
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Waitlist option */}
      {showWaitlistOption && (
        <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useWaitlist}
              onChange={(e) => setUseWaitlist(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
            />
            <div>
              <p className="text-white font-medium">Join the waitlist</p>
              <p className="text-sm text-zinc-400">
                You&apos;ll be notified if a spot opens up
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || (isFull && !useWaitlist)}
          className="flex-1 py-3 bg-amber-500 text-black font-semibold rounded hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{isFull && useWaitlist ? 'Joining waitlist...' : 'Booking...'}</span>
            </>
          ) : (
            isFull && useWaitlist ? 'Join Waitlist' : 'Confirm Booking'
          )}
        </button>
      </div>
    </div>
  );
}
