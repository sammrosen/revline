'use client';

/**
 * EligibilityStep Component
 * 
 * Checks if the customer is eligible to book (e.g., has session credits).
 * Shows balance information and blocks booking if not eligible.
 */

import { useEffect, useState } from 'react';
import { BookingCustomer, EligibilityResult } from '../types';
import { BookingApi } from '@/app/_lib/api-paths';

interface EligibilityStepProps {
  clientSlug: string;
  customer: BookingCustomer;
  eventTypeId?: string;
  onEligibilityResult: (result: EligibilityResult) => void;
  onError: (error: string) => void;
  onBack: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function EligibilityStep({
  clientSlug,
  customer,
  eventTypeId,
  onEligibilityResult,
  onError,
  onBack,
  loading,
  setLoading,
}: EligibilityStepProps) {
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [checked, setChecked] = useState(false);

  // Check eligibility on mount
  useEffect(() => {
    if (checked) return;
    
    const checkEligibility = async () => {
      setLoading(true);
      setChecked(true);

      try {
        const response = await fetch(BookingApi.eligibility, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientSlug,
            customer,
            eventTypeId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          onError(data.error || 'Failed to check eligibility');
          return;
        }

        setEligibility(data.data.eligibility);
      } catch {
        onError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    checkEligibility();
  }, [clientSlug, customer, eventTypeId, onError, setLoading, checked]);

  // Handle continue
  const handleContinue = () => {
    if (eligibility) {
      onEligibilityResult(eligibility);
    }
  };

  // Loading state
  if (loading || !eligibility) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-amber-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Checking Eligibility</h2>
        <p className="text-zinc-400">Verifying your session balance...</p>
      </div>
    );
  }

  // Not eligible
  if (!eligibility.eligible) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Unable to Book</h2>
        <p className="text-zinc-400 mb-6">
          {eligibility.reason || 'You are not currently eligible to book this service.'}
        </p>
        
        {eligibility.balance && (
          <div className="inline-block p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-6">
            <p className="text-sm text-zinc-500 mb-1">Session Balance</p>
            <p className="text-2xl font-bold text-white">
              {eligibility.balance.unlimited ? 'Unlimited' : eligibility.balance.remaining}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors"
          >
            Go Back
          </button>
        </div>

        <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-left">
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-400 font-medium">Need more sessions?</span>
            {' '}Contact the front desk or check your membership options to purchase additional session credits.
          </p>
        </div>
      </div>
    );
  }

  // Eligible
  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">You&apos;re All Set!</h2>
        <p className="text-zinc-400">
          Welcome back, {customer.name}
        </p>
      </div>

      {/* Balance info */}
      {eligibility.balance && (
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Session Balance</p>
              <p className="text-3xl font-bold text-white">
                {eligibility.balance.unlimited ? (
                  <span className="text-amber-400">Unlimited</span>
                ) : (
                  <>
                    {eligibility.balance.remaining}
                    <span className="text-lg text-zinc-500 font-normal ml-1">sessions</span>
                  </>
                )}
              </p>
            </div>
            {!eligibility.balance.unlimited && eligibility.balance.remaining > 0 && (
              <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          {eligibility.balance.expiresAt && (
            <p className="text-sm text-zinc-500 mt-3">
              Expires: {new Date(eligibility.balance.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-3 bg-amber-500 text-black font-semibold rounded hover:bg-amber-400 transition-colors"
        >
          Continue to Select Time
        </button>
      </div>
    </div>
  );
}
