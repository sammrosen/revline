'use client';

/**
 * CustomerLookupStep Component
 * 
 * First step in booking flow for providers that require customer verification.
 * Looks up customer by barcode, email, or other identifier.
 */

import { useState, FormEvent } from 'react';
import { BookingCustomer } from '../types';
import { BookingApi } from '@/app/_lib/api-paths';

interface CustomerLookupStepProps {
  clientSlug: string;
  identifierType: 'barcode' | 'email' | 'phone' | 'memberId';
  identifierLabel: string;
  onCustomerFound: (customer: BookingCustomer) => void;
  onError: (error: string) => void;
  onBack?: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function CustomerLookupStep({
  clientSlug,
  identifierType,
  identifierLabel,
  onCustomerFound,
  onError,
  onBack,
  loading,
  setLoading,
}: CustomerLookupStepProps) {
  const [identifier, setIdentifier] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const getPlaceholder = () => {
    switch (identifierType) {
      case 'barcode': return 'Enter your member barcode';
      case 'email': return 'Enter your email address';
      case 'phone': return 'Enter your phone number';
      case 'memberId': return 'Enter your member ID';
      default: return 'Enter your identifier';
    }
  };

  const getInputType = () => {
    switch (identifierType) {
      case 'email': return 'email';
      case 'phone': return 'tel';
      default: return 'text';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier.trim()) {
      setLocalError(`Please enter your ${identifierLabel.toLowerCase()}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(BookingApi.lookup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSlug,
          identifier: identifier.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setLocalError('Member not found. Please check your barcode and try again.');
        } else {
          setLocalError(data.error || 'Failed to look up member');
        }
        return;
      }

      onCustomerFound(data.data.customer);
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Almost There!</h2>
        <p className="text-zinc-400">
          Enter your {identifierLabel.toLowerCase()} to complete your booking
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label 
            htmlFor="identifier" 
            className="block text-sm font-medium text-zinc-300 mb-2"
          >
            {identifierLabel}
          </label>
          <input
            id="identifier"
            type={getInputType()}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={getPlaceholder()}
            disabled={loading}
            autoFocus
            className={`
              w-full px-4 py-3
              bg-zinc-900 border text-zinc-50 text-lg
              placeholder-zinc-500
              focus:outline-none focus:border-amber-500/50
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${localError ? 'border-red-500' : 'border-zinc-800'}
            `}
          />
          {localError && (
            <p className="mt-2 text-sm text-red-400">{localError}</p>
          )}
        </div>

        <div className="flex gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="px-6 py-4 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="flex-1 py-4 bg-amber-500 text-black font-semibold text-lg rounded hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Looking up...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>

      {/* Help text */}
      <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <p className="text-sm text-zinc-500">
          <span className="text-zinc-400 font-medium">Can&apos;t find your {identifierLabel.toLowerCase()}?</span>
          {' '}Check the back of your membership card or contact the front desk for assistance.
        </p>
      </div>
    </div>
  );
}
