'use client';

/**
 * Step Indicator Component
 * 
 * Displays the multi-step progress indicator with numbered steps.
 * Shows completed, current, and upcoming steps with appropriate styling.
 */

import type { DerivedBrand } from '../client';
import type { ResolvedSignupCopy } from '@/app/_lib/config';

interface Step {
  number: number;
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  brand: DerivedBrand;
  copy: ResolvedSignupCopy;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  brand,
  copy,
}: StepIndicatorProps) {
  // Brand colors available for future custom step indicator styling
  void brand;
  return (
    <div className="bg-zinc-700">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.number);
            const isCurrent = step.number === currentStep;
            
            // Get custom title from copy if available
            const stepTitle = copy.stepTitles[step.number] || step.label;
            
            return (
              <div
                key={step.key}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  isCurrent
                    ? 'border-white text-white'
                    : isCompleted
                      ? 'border-zinc-500 text-zinc-400'
                      : 'border-transparent text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {/* Step circle */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCompleted
                        ? 'bg-zinc-500 text-white'
                        : isCurrent
                          ? 'bg-white text-zinc-800'
                          : 'bg-zinc-600 text-zinc-400'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </span>
                  
                  {/* Step label - hidden on mobile */}
                  <span className="hidden sm:inline text-sm font-medium">
                    {stepTitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
