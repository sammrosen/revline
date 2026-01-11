'use client';

/**
 * BookingWizard Component
 * 
 * Multi-step booking flow that adapts to provider capabilities.
 * Steps are dynamically shown/hidden based on what the provider supports.
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
} from '../types';
import { CustomerLookupStep } from './CustomerLookupStep';
import { EligibilityStep } from './EligibilityStep';
import { TimeSlotPicker } from './TimeSlotPicker';
import { ConfirmationStep } from './ConfirmationStep';
import { BookingSuccess } from './BookingSuccess';

interface BookingWizardProps {
  /** Client slug for API calls */
  clientSlug: string;
  /** Provider capabilities (determines which steps show) */
  capabilities: BookingProviderCapabilities;
  /** Optional event type to filter availability */
  eventTypeId?: string;
  /** Optional callback when booking completes */
  onComplete?: (result: BookingResult) => void;
  /** Optional callback on error */
  onError?: (error: string) => void;
}

export function BookingWizard({
  clientSlug,
  capabilities,
  eventTypeId,
  onComplete,
  onError,
}: BookingWizardProps) {
  const [state, setState] = useState<BookingState>({
    ...initialBookingState,
    capabilities,
    // Always start with slot selection - verify member at checkout
    step: 'select',
  });

  // Determine which steps to show
  const steps = getStepsForCapabilities(capabilities);
  const currentStepIndex = steps.indexOf(state.step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setState(s => ({ ...s, step: steps[nextIndex], error: null }));
    }
  }, [currentStepIndex, steps]);

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setState(s => ({ ...s, step: steps[prevIndex], error: null }));
    }
  }, [currentStepIndex, steps]);

  // Handle customer lookup result
  const handleCustomerFound = useCallback((customer: BookingCustomer) => {
    setState(s => ({ ...s, customer, error: null }));
    goToNextStep();
  }, [goToNextStep]);

  // Handle eligibility result
  const handleEligibilityResult = useCallback((eligibility: EligibilityResult) => {
    setState(s => ({ ...s, eligibility, error: null }));
    if (eligibility.eligible) {
      goToNextStep();
    }
  }, [goToNextStep]);

  // Handle slot selection
  const handleSlotSelected = useCallback((slot: TimeSlot) => {
    setState(s => ({ ...s, selectedSlot: slot, error: null }));
    goToNextStep();
  }, [goToNextStep]);

  // Handle booking result
  const handleBookingResult = useCallback((result: BookingResult) => {
    setState(s => ({ 
      ...s, 
      result, 
      step: result.success ? 'success' : 'error',
      error: result.success ? null : result.error || null,
    }));
    if (result.success) {
      onComplete?.(result);
    } else {
      onError?.(result.error || 'Booking failed');
    }
  }, [onComplete, onError]);

  // Handle error
  const handleError = useCallback((error: string) => {
    setState(s => ({ ...s, error, loading: false }));
    onError?.(error);
  }, [onError]);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setState(s => ({ ...s, loading }));
  }, []);

  // Update slots
  const setSlots = useCallback((slots: TimeSlot[]) => {
    setState(s => ({ ...s, slots }));
  }, []);

  // Reset wizard
  const reset = useCallback(() => {
    setState({
      ...initialBookingState,
      capabilities,
      step: 'select', // Always start with slot selection
    });
  }, [capabilities]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      {state.step !== 'success' && state.step !== 'error' && (
        <div className="mb-8">
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span>{getStepLabel(state.step)}</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error banner */}
      {state.error && state.step !== 'error' && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{state.error}</p>
        </div>
      )}

      {/* Steps */}
      {state.step === 'lookup' && (
        <CustomerLookupStep
          clientSlug={clientSlug}
          identifierType={capabilities.customerIdentifierType || 'barcode'}
          identifierLabel={capabilities.customerIdentifierLabel || 'Member ID'}
          onCustomerFound={handleCustomerFound}
          onError={handleError}
          onBack={goToPreviousStep}
          loading={state.loading}
          setLoading={setLoading}
        />
      )}

      {state.step === 'eligibility' && state.customer && (
        <EligibilityStep
          clientSlug={clientSlug}
          customer={state.customer}
          eventTypeId={eventTypeId}
          onEligibilityResult={handleEligibilityResult}
          onError={handleError}
          onBack={goToPreviousStep}
          loading={state.loading}
          setLoading={setLoading}
        />
      )}

      {state.step === 'select' && (
        <TimeSlotPicker
          clientSlug={clientSlug}
          eventTypeId={eventTypeId}
          slots={state.slots}
          setSlots={setSlots}
          onSlotSelected={handleSlotSelected}
          onError={handleError}
          onBack={undefined} // First step - no back button
          loading={state.loading}
          setLoading={setLoading}
        />
      )}

      {state.step === 'confirm' && state.selectedSlot && (
        <ConfirmationStep
          clientSlug={clientSlug}
          slot={state.selectedSlot}
          customer={state.customer}
          eligibility={state.eligibility}
          supportsWaitlist={capabilities.supportsWaitlist}
          onConfirm={handleBookingResult}
          onError={handleError}
          onBack={goToPreviousStep}
          loading={state.loading}
          setLoading={setLoading}
        />
      )}

      {state.step === 'success' && state.result && (
        <BookingSuccess
          result={state.result}
          slot={state.selectedSlot!}
          customer={state.customer}
          onBookAnother={reset}
        />
      )}

      {state.step === 'error' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Booking Failed</h2>
          <p className="text-zinc-400 mb-6">{state.error || 'An unexpected error occurred'}</p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-amber-500 text-black font-medium rounded hover:bg-amber-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Get the steps to show based on provider capabilities
 * Flow: Select time first → verify member → check eligibility → confirm
 */
function getStepsForCapabilities(capabilities: BookingProviderCapabilities): BookingStep[] {
  const steps: BookingStep[] = [];
  
  // Always start with slot selection
  steps.push('select');
  
  // Then verify member if required
  if (capabilities.requiresCustomerLookup) {
    steps.push('lookup');
  }
  
  // Then check eligibility if required
  if (capabilities.requiresEligibilityCheck) {
    steps.push('eligibility');
  }
  
  // Finally confirm
  steps.push('confirm');
  
  return steps;
}

/**
 * Get human-readable label for a step
 */
function getStepLabel(step: BookingStep): string {
  switch (step) {
    case 'select': return 'Select Time';
    case 'lookup': return 'Verify Member';
    case 'eligibility': return 'Check Eligibility';
    case 'confirm': return 'Confirm Booking';
    case 'success': return 'Complete';
    case 'error': return 'Error';
    default: return '';
  }
}
