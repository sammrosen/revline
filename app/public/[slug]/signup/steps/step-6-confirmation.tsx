'use client';

/**
 * Step 6: Confirmation
 * 
 * Success state showing:
 * - Success icon and message
 * - Membership summary
 * - Next steps
 * - Option to start over
 */

import type { SignupPlan } from '@/app/_lib/types';
import type { SignupFormState, DerivedBrand, TextClasses } from '../client';
import type { ResolvedSignupClub, ResolvedSignupCopy } from '@/app/_lib/config';

interface ConfirmationStepProps {
  formState: SignupFormState;
  selectedPlan: SignupPlan;
  club: ResolvedSignupClub;
  onReset: () => void;
  brand: DerivedBrand;
  typo: TextClasses;
  copy: ResolvedSignupCopy;
}

export function ConfirmationStep({
  formState,
  selectedPlan,
  club,
  onReset,
  brand,
  typo,
  copy,
}: ConfirmationStepProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center">
        <div className="p-8">
          {/* Success icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${brand.success}20` }}
          >
            <svg
              className="w-10 h-10"
              style={{ color: brand.success }}
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

          {/* Success title */}
          <h2 className={`${typo.pageTitle} mb-3`} style={{ color: brand.text }}>
            {copy.successTitle}
          </h2>

          {/* Success message */}
          <p className="text-lg mb-6" style={{ color: brand.textMuted }}>
            {copy.successMessage}
          </p>

          {/* Member summary */}
          <div
            className="p-6 rounded-lg text-left mb-6"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <h3 className="font-semibold mb-4" style={{ color: brand.text }}>
              Membership Summary
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span style={{ color: brand.textMuted }}>Member Name</span>
                <span className="font-medium" style={{ color: brand.text }}>
                  {formState.firstName} {formState.lastName}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span style={{ color: brand.textMuted }}>Email</span>
                <span className="font-medium" style={{ color: brand.text }}>
                  {formState.email}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span style={{ color: brand.textMuted }}>Plan</span>
                <span className="font-medium" style={{ color: brand.text }}>
                  {selectedPlan.name}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span style={{ color: brand.textMuted }}>Monthly Rate</span>
                <span className="font-medium" style={{ color: brand.primary }}>
                  ${selectedPlan.price.toFixed(2)}/mo
                </span>
              </div>
              
              <div className="flex justify-between border-t pt-3" style={{ borderColor: brand.border }}>
                <span style={{ color: brand.textMuted }}>Amount Charged Today</span>
                <span className="font-bold" style={{ color: brand.primary }}>
                  ${selectedPlan.paymentDetails.dueToday.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Club info */}
          <div
            className="p-4 rounded-lg mb-6"
            style={{ backgroundColor: brand.primary + '10' }}
          >
            <h4 className="font-semibold mb-2" style={{ color: brand.primary }}>
              Your Gym
            </h4>
            <p className="text-sm" style={{ color: brand.text }}>
              {club.name}
            </p>
            <p className="text-sm" style={{ color: brand.textMuted }}>
              {club.address}, {club.city}, {club.state} {club.zip}
            </p>
          </div>

          {/* Next steps */}
          <div
            className="p-4 rounded-lg text-left mb-6"
            style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
          >
            <p className="font-medium mb-2">What&apos;s Next?</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Check your email for a confirmation receipt</li>
              <li>Your membership is active immediately</li>
              <li>Visit the front desk to get your member card</li>
              <li>Download our mobile app to manage your account</li>
            </ul>
          </div>

          {/* Reset button */}
          <button
            onClick={onReset}
            className="px-6 py-2 border rounded-lg font-medium hover:bg-zinc-50 transition-colors"
            style={{ borderColor: brand.border, color: brand.text }}
          >
            Sign Up Another Member
          </button>
        </div>
      </div>
    </div>
  );
}
