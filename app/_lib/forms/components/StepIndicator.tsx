'use client';

import { Check } from 'lucide-react';

interface Step {
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 1-indexed
  primaryColor?: string;
  className?: string;
}

/**
 * Circle-based step indicator with connecting lines
 * 
 * Visual design:
 *    ✓ ───── ● ───── ○ ───── ○
 *  Step 1  Step 2  Step 3  Step 4
 * 
 * - Checkmark for completed steps
 * - Filled circle for current step
 * - Outlined circle for upcoming steps
 * - Brand color for completed/active states
 */
export function StepIndicator({ 
  steps, 
  currentStep, 
  primaryColor = '#7f1d1d', // default maroon
  className = '' 
}: StepIndicatorProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div key={index} className="flex items-center">
              {/* Step circle - ALL are dark with white text */}
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 text-white"
                  style={{
                    backgroundColor: isCompleted ? primaryColor : '#18181b',
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  ) : (
                    stepNumber
                  )}
                </div>
                
                {/* Step label - hidden on mobile */}
                <span 
                  className="hidden sm:block mt-2 text-xs font-medium whitespace-nowrap"
                  style={{
                    color: isCompleted ? primaryColor : isCurrent ? '#18181b' : '#a1a1aa',
                  }}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connecting line (not after last step) */}
              {index < steps.length - 1 && (
                <div 
                  className="w-12 sm:w-16 h-0.5 mx-2"
                  style={{
                    backgroundColor: isCompleted ? primaryColor : '#d4d4d8',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
