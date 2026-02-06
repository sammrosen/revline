'use client';

/**
 * Step Indicator Component
 * 
 * Circle-based step indicator with connecting lines.
 * Shows completed (checkmark), current (filled), and upcoming (outlined) steps.
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
  return (
    <div className="py-3 bg-white border-b" style={{ borderColor: brand.border }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.number);
            const isCurrent = step.number === currentStep;
            
            // Get custom title from copy if available
            const stepTitle = copy.stepTitles[step.number] || step.label;
            
            return (
              <div key={step.key} className="flex items-center">
                {/* Step circle with label */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 text-white"
                    style={{
                      backgroundColor: isCompleted ? brand.primary : '#18181b',
                    }}
                  >
                    {isCompleted ? (
                      <svg 
                        className="w-4 h-4" 
                        fill="none" 
                        stroke="white" 
                        viewBox="0 0 24 24" 
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  
                  {/* Step label - hidden on mobile */}
                  <span 
                    className="hidden sm:block mt-2 text-xs font-medium whitespace-nowrap"
                    style={{
                      color: isCompleted ? brand.primary : isCurrent ? brand.text : brand.textMuted,
                    }}
                  >
                    {stepTitle}
                  </span>
                </div>
                
                {/* Connecting line (not after last step) */}
                {index < steps.length - 1 && (
                  <div 
                    className="w-8 sm:w-12 h-0.5 mx-1 sm:mx-2"
                    style={{
                      backgroundColor: isCompleted ? brand.primary : '#d4d4d8',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
