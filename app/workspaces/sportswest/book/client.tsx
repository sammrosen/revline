'use client';

/**
 * Sports West Athletic Club - Booking Client Component
 * 
 * Light themed booking UI matching Sports West branding.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  BookingState,
  BookingStep,
  BookingProviderCapabilities,
  BookingCustomer,
  TimeSlot,
  EligibilityResult,
  BookingResult,
  initialBookingState,
} from '@/app/_lib/booking';
import { BookingApi } from '@/app/_lib/api-paths';

// Sports West brand colors
const BRAND = {
  primary: '#8B2346',      // Burgundy
  primaryHover: '#6d1c37',
  background: '#f3f4f6',   // Light gray
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

interface SportsWestBookingClientProps {
  workspaceSlug: string;
  workspaceName: string;
  capabilities: BookingProviderCapabilities;
}

export function SportsWestBookingClient({
  workspaceSlug,
  workspaceName: _workspaceName,
  capabilities,
}: SportsWestBookingClientProps) {
  const [state, setState] = useState<BookingState>({
    ...initialBookingState,
    capabilities,
    step: 'select',
  });

  const steps = getStepsForCapabilities(capabilities);
  const currentStepIndex = steps.indexOf(state.step);

  // Navigation
  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setState(s => ({ ...s, step: steps[nextIndex], error: null }));
    }
  }, [currentStepIndex, steps]);

  const goToPreviousStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setState(s => ({ ...s, step: steps[prevIndex], error: null }));
    }
  }, [currentStepIndex, steps]);

  // Handlers
  const handleSlotSelected = useCallback((slot: TimeSlot) => {
    setState(s => ({ ...s, selectedSlot: slot, error: null }));
    goToNextStep();
  }, [goToNextStep]);

  const handleCustomerFound = useCallback((customer: BookingCustomer) => {
    setState(s => ({ ...s, customer, error: null }));
    goToNextStep();
  }, [goToNextStep]);

  const handleEligibilityResult = useCallback((eligibility: EligibilityResult) => {
    setState(s => ({ ...s, eligibility, error: null }));
    if (eligibility.eligible) {
      goToNextStep();
    }
  }, [goToNextStep]);

  const handleBookingResult = useCallback((result: BookingResult) => {
    setState(s => ({ 
      ...s, 
      result, 
      step: result.success ? 'success' : 'error',
      error: result.success ? null : result.error || null,
    }));
  }, []);

  const handleError = useCallback((error: string) => {
    setState(s => ({ ...s, error, loading: false }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(s => ({ ...s, loading }));
  }, []);

  const setSlots = useCallback((slots: TimeSlot[]) => {
    setState(s => ({ ...s, slots }));
  }, []);

  const reset = useCallback(() => {
    setState({
      ...initialBookingState,
      capabilities,
      step: 'select',
    });
  }, [capabilities]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.background }}>
      {/* Header */}
      <header className="bg-zinc-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo placeholder - replace with actual Sports West logo */}
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-bold text-zinc-800 text-sm">SPORTS WEST</span>
              <div className="text-[10px] text-zinc-600">ATHLETIC CLUB</div>
            </div>
          </div>
          <span className="text-sm text-zinc-400">Online Booking</span>
        </div>
        
        {/* Step indicator */}
        {state.step !== 'success' && state.step !== 'error' && (
          <div className="bg-zinc-700">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className={`flex-1 py-3 text-center text-sm font-medium border-b-2 transition-colors ${
                      index === currentStepIndex
                        ? 'border-white text-white'
                        : index < currentStepIndex
                          ? 'border-zinc-500 text-zinc-400'
                          : 'border-transparent text-zinc-500'
                    }`}
                  >
                    {getStepLabel(step)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error banner */}
        {state.error && state.step !== 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        {/* Steps */}
        {state.step === 'select' && (
          <TimeSlotStep
            workspaceSlug={workspaceSlug}
            slots={state.slots}
            setSlots={setSlots}
            onSlotSelected={handleSlotSelected}
            onError={handleError}
            loading={state.loading}
            setLoading={setLoading}
          />
        )}

        {state.step === 'lookup' && (
          <MemberLookupStep
            workspaceSlug={workspaceSlug}
            selectedSlot={state.selectedSlot}
            identifierLabel={capabilities.customerIdentifierLabel || 'Member Barcode'}
            onCustomerFound={handleCustomerFound}
            onError={handleError}
            onBack={goToPreviousStep}
            loading={state.loading}
            setLoading={setLoading}
          />
        )}

        {state.step === 'eligibility' && state.customer && (
          <EligibilityStep
            workspaceSlug={workspaceSlug}
            customer={state.customer}
            selectedSlot={state.selectedSlot}
            onEligibilityResult={handleEligibilityResult}
            onError={handleError}
            onBack={goToPreviousStep}
            loading={state.loading}
            setLoading={setLoading}
          />
        )}

        {state.step === 'confirm' && state.selectedSlot && (
          <ConfirmStep
            workspaceSlug={workspaceSlug}
            slot={state.selectedSlot}
            customer={state.customer}
            eligibility={state.eligibility}
            onConfirm={handleBookingResult}
            onError={handleError}
            onBack={goToPreviousStep}
            loading={state.loading}
            setLoading={setLoading}
          />
        )}

        {state.step === 'success' && state.result && (
          <SuccessStep
            result={state.result}
            slot={state.selectedSlot!}
            customer={state.customer}
            onBookAnother={reset}
          />
        )}

        {state.step === 'error' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Failed</h2>
            <p className="text-gray-600 mb-6">{state.error || 'An unexpected error occurred'}</p>
            <button
              onClick={reset}
              className="px-6 py-3 text-white font-medium rounded transition-colors"
              style={{ backgroundColor: BRAND.primary }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = BRAND.primaryHover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = BRAND.primary}
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// TIME SLOT STEP
// =============================================================================

function TimeSlotStep({
  workspaceSlug,
  slots,
  setSlots,
  onSlotSelected,
  onError,
  loading,
  setLoading,
}: {
  workspaceSlug: string;
  slots: TimeSlot[];
  setSlots: (slots: TimeSlot[]) => void;
  onSlotSelected: (slot: TimeSlot) => void;
  onError: (error: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [fetched, setFetched] = useState(false);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setFetched(true);

    try {
      const start = new Date(selectedDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const params = new URLSearchParams({
        workspaceSlug,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });

      const response = await fetch(`${BookingApi.availability}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        onError(data.error || 'Failed to load availability');
        return;
      }

      setSlots(data.data.slots);
    } catch {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, selectedDate, onError, setLoading, setSlots]);

  // Fetch on mount
  useEffect(() => {
    fetchAvailability();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group slots by date
  const slotsByDate: Record<string, TimeSlot[]> = {};
  for (const slot of slots) {
    const date = slot.startTime.split('T')[0];
    if (!slotsByDate[date]) slotsByDate[date] = [];
    slotsByDate[date].push(slot);
  }
  const dates = Object.keys(slotsByDate).sort();

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b" style={{ borderColor: BRAND.border }}>
        <h2 className="text-xl font-semibold" style={{ color: BRAND.text }}>
          Select a Time
        </h2>
        <p style={{ color: BRAND.textMuted }}>
          Choose an available session that works for you.
        </p>
      </div>

      {/* Date navigation */}
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: BRAND.border, backgroundColor: '#f9fafb' }}>
        <button
          onClick={() => {
            const date = new Date(selectedDate);
            date.setDate(date.getDate() - 7);
            setSelectedDate(date.toISOString().split('T')[0]);
            setFetched(false);
          }}
          disabled={new Date(selectedDate) <= new Date()}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <span className="font-medium" style={{ color: BRAND.text }}>
          {formatDateRange(selectedDate)}
        </span>
        
        <button
          onClick={() => {
            const date = new Date(selectedDate);
            date.setDate(date.getDate() + 7);
            setSelectedDate(date.toISOString().split('T')[0]);
            setFetched(false);
          }}
          className="p-2 rounded hover:bg-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-current rounded-full mx-auto mb-4" style={{ borderTopColor: BRAND.primary }} />
          <p style={{ color: BRAND.textMuted }}>Loading available times...</p>
        </div>
      )}

      {/* No slots */}
      {!loading && fetched && slots.length === 0 && (
        <div className="p-12 text-center">
          <p style={{ color: BRAND.textMuted }}>No available times for this week.</p>
          <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>Try selecting a different week.</p>
        </div>
      )}

      {/* Slots */}
      {!loading && slots.length > 0 && (
        <div className="divide-y" style={{ borderColor: BRAND.border }}>
          {dates.map(date => (
            <div key={date} className="p-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: BRAND.textMuted }}>
                {formatDate(date)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {slotsByDate[date].map(slot => {
                  const startTime = new Date(slot.startTime);
                  const isFull = slot.spotsAvailable === 0;
                  
                  return (
                    <button
                      key={slot.id}
                      onClick={() => onSlotSelected(slot)}
                      disabled={isFull}
                      className={`p-3 rounded border text-left transition-all ${
                        isFull 
                          ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                          : 'hover:border-current hover:shadow-sm'
                      }`}
                      style={{ 
                        borderColor: isFull ? BRAND.border : BRAND.primary,
                        color: BRAND.primary,
                      }}
                    >
                      <div className="font-medium" style={{ color: BRAND.text }}>
                        {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                      <div className="text-sm" style={{ color: BRAND.textMuted }}>
                        {slot.title}
                      </div>
                      {slot.staffName && (
                        <div className="text-xs mt-1" style={{ color: BRAND.textMuted }}>
                          with {slot.staffName}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MEMBER LOOKUP STEP
// =============================================================================

function MemberLookupStep({
  workspaceSlug,
  selectedSlot,
  identifierLabel,
  onCustomerFound,
  onError,
  onBack,
  loading,
  setLoading,
}: {
  workspaceSlug: string;
  selectedSlot: TimeSlot | null;
  identifierLabel: string;
  onCustomerFound: (customer: BookingCustomer) => void;
  onError: (error: string) => void;
  onBack: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier.trim()) {
      setLocalError(`Please enter your ${identifierLabel.toLowerCase()}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug, identifier: identifier.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLocalError(response.status === 404 
          ? 'Member not found. Please check your barcode and try again.'
          : data.error || 'Failed to look up member'
        );
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
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b" style={{ borderColor: BRAND.border }}>
        <h2 className="text-xl font-semibold" style={{ color: BRAND.text }}>
          Verify Membership
        </h2>
        <p style={{ color: BRAND.textMuted }}>
          Enter your member barcode to continue.
        </p>
      </div>

      {/* Selected slot summary */}
      {selectedSlot && (
        <div className="p-4 border-b" style={{ borderColor: BRAND.border, backgroundColor: '#f9fafb' }}>
          <div className="text-sm" style={{ color: BRAND.textMuted }}>Selected session:</div>
          <div className="font-medium" style={{ color: BRAND.text }}>
            {selectedSlot.title} - {new Date(selectedSlot.startTime).toLocaleDateString('en-US', { 
              weekday: 'short', month: 'short', day: 'numeric' 
            })} at {new Date(selectedSlot.startTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', minute: '2-digit', hour12: true 
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: BRAND.text }}>
            {identifierLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your barcode"
            disabled={loading}
            className={`w-full px-4 py-3 border rounded focus:outline-none focus:ring-2 ${
              localError ? 'border-red-500' : ''
            }`}
            style={{ 
              borderColor: localError ? undefined : BRAND.border,
              '--tw-ring-color': BRAND.primary,
            } as React.CSSProperties}
          />
          {localError && (
            <p className="mt-2 text-sm text-red-600">{localError}</p>
          )}
          <p className="mt-2 text-sm" style={{ color: BRAND.textMuted }}>
            Find this on the back of your membership card.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="px-6 py-3 border rounded font-medium hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: BRAND.border, color: BRAND.text }}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="flex-1 py-3 text-white font-medium rounded disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: BRAND.primary }}
          >
            {loading ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Looking up...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// =============================================================================
// ELIGIBILITY STEP
// =============================================================================

function EligibilityStep({
  workspaceSlug,
  customer,
  selectedSlot: _selectedSlot,
  onEligibilityResult,
  onError,
  onBack,
  loading,
  setLoading,
}: {
  workspaceSlug: string;
  customer: BookingCustomer;
  selectedSlot: TimeSlot | null; // Reserved for future use (event-specific eligibility)
  onEligibilityResult: (result: EligibilityResult) => void;
  onError: (error: string) => void;
  onBack: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [checked, setChecked] = useState(false);

  // Check eligibility on mount
  useEffect(() => {
    if (checked) return;
    
    const check = async () => {
      setLoading(true);
      setChecked(true);

      try {
        const response = await fetch(BookingApi.eligibility, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceSlug, customer }),
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

    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !eligibility) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-current rounded-full mx-auto mb-4" style={{ borderTopColor: BRAND.primary }} />
        <p style={{ color: BRAND.textMuted }}>Checking your session balance...</p>
      </div>
    );
  }

  if (!eligibility.eligible) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: BRAND.text }}>Unable to Book</h2>
        <p className="mb-6" style={{ color: BRAND.textMuted }}>
          {eligibility.reason || 'You are not currently eligible to book this service.'}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 border rounded font-medium hover:bg-gray-50"
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b" style={{ borderColor: BRAND.border }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BRAND.text }}>
              Welcome, {customer.name}!
            </h2>
            <p style={{ color: BRAND.textMuted }}>You&apos;re eligible to book.</p>
          </div>
        </div>
      </div>

      {eligibility.balance && (
        <div className="p-6 border-b" style={{ borderColor: BRAND.border, backgroundColor: '#f9fafb' }}>
          <div className="text-sm" style={{ color: BRAND.textMuted }}>Session Balance</div>
          <div className="text-2xl font-bold" style={{ color: BRAND.text }}>
            {eligibility.balance.unlimited ? 'Unlimited' : eligibility.balance.remaining}
          </div>
        </div>
      )}

      <div className="p-6 flex gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 border rounded font-medium hover:bg-gray-50"
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        >
          Back
        </button>
        <button
          onClick={() => onEligibilityResult(eligibility)}
          className="flex-1 py-3 text-white font-medium rounded"
          style={{ backgroundColor: BRAND.primary }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// CONFIRM STEP
// =============================================================================

function ConfirmStep({
  workspaceSlug,
  slot,
  customer,
  eligibility,
  onConfirm,
  onError,
  onBack,
  loading,
  setLoading,
}: {
  workspaceSlug: string;
  slot: TimeSlot;
  customer: BookingCustomer | null;
  eligibility: EligibilityResult | null;
  onConfirm: (result: BookingResult) => void;
  onError: (error: string) => void;
  onBack: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const startTime = new Date(slot.startTime);
  const endTime = new Date(slot.endTime);

  const handleConfirm = async () => {
    setLoading(true);

    try {
      const response = await fetch(BookingApi.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug,
          slot,
          customer: customer || { id: 'guest', name: 'Guest' },
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
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b" style={{ borderColor: BRAND.border }}>
        <h2 className="text-xl font-semibold" style={{ color: BRAND.text }}>
          Review & Confirm
        </h2>
        <p style={{ color: BRAND.textMuted }}>
          Please review your booking details.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <div className="font-medium" style={{ color: BRAND.text }}>{slot.title}</div>
            <div style={{ color: BRAND.textMuted }}>
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ color: BRAND.textMuted }}>
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>

        {slot.staffName && (
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" style={{ color: BRAND.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span style={{ color: BRAND.text }}>with {slot.staffName}</span>
          </div>
        )}

        {customer && (
          <div className="pt-4 border-t" style={{ borderColor: BRAND.border }}>
            <div className="text-sm" style={{ color: BRAND.textMuted }}>Booking for</div>
            <div className="font-medium" style={{ color: BRAND.text }}>{customer.name}</div>
            {eligibility?.balance && !eligibility.balance.unlimited && (
              <div className="text-sm" style={{ color: BRAND.textMuted }}>
                1 session will be used • {eligibility.balance.remaining - 1} remaining
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 border-t flex gap-4" style={{ borderColor: BRAND.border, backgroundColor: '#f9fafb' }}>
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 border rounded font-medium hover:bg-white disabled:opacity-50"
          style={{ borderColor: BRAND.border, color: BRAND.text }}
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 py-3 text-white font-medium rounded disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: BRAND.primary }}
        >
          {loading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Booking...</span>
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SUCCESS STEP
// =============================================================================

function SuccessStep({
  result,
  slot,
  customer: _customer,
  onBookAnother,
}: {
  result: BookingResult;
  slot: TimeSlot;
  customer: BookingCustomer | null; // Reserved for personalized messages
  onBookAnother: () => void;
}) {
  const startTime = new Date(slot.startTime);

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold mb-2" style={{ color: BRAND.text }}>
        Booking Confirmed!
      </h2>
      <p className="mb-8" style={{ color: BRAND.textMuted }}>
        You&apos;re all set for your session.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 text-left mb-8 max-w-sm mx-auto">
        <div className="font-medium mb-2" style={{ color: BRAND.text }}>{slot.title}</div>
        <div style={{ color: BRAND.textMuted }}>
          {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div style={{ color: BRAND.textMuted }}>
          {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
        {slot.staffName && (
          <div className="mt-2 text-sm" style={{ color: BRAND.textMuted }}>with {slot.staffName}</div>
        )}
        {result.bookingId && (
          <div className="mt-4 pt-4 border-t text-xs" style={{ borderColor: BRAND.border, color: BRAND.textMuted }}>
            Confirmation: {result.bookingId}
          </div>
        )}
      </div>

      <button
        onClick={onBookAnother}
        className="px-6 py-3 border rounded font-medium hover:bg-gray-50"
        style={{ borderColor: BRAND.border, color: BRAND.text }}
      >
        Book Another Session
      </button>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getStepsForCapabilities(capabilities: BookingProviderCapabilities): BookingStep[] {
  const steps: BookingStep[] = ['select'];
  if (capabilities.requiresCustomerLookup) steps.push('lookup');
  if (capabilities.requiresEligibilityCheck) steps.push('eligibility');
  steps.push('confirm');
  return steps;
}

function getStepLabel(step: BookingStep): string {
  switch (step) {
    case 'select': return 'SELECT TIME';
    case 'lookup': return 'VERIFY';
    case 'eligibility': return 'ELIGIBILITY';
    case 'confirm': return 'CONFIRM';
    default: return '';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDateRange(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}
