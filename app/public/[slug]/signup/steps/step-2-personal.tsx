'use client';

/**
 * Step 2: Personal Info (About You)
 * 
 * Collects basic contact information:
 * - First Name, Last Name
 * - Email, Mobile Phone
 * - SMS consent checkbox
 */

import type { SignupFormState, DerivedBrand, TextClasses } from '../client';
import type { ResolvedSignupCopy } from '@/app/_lib/config';

interface PersonalInfoStepProps {
  formState: SignupFormState;
  updateForm: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  onNext: () => void;
  loading: boolean;
  brand: DerivedBrand;
  typo: TextClasses;
  copy: ResolvedSignupCopy;
  requireSmsConsent: boolean;
}

export function PersonalInfoStep({
  formState,
  updateForm,
  onNext,
  loading,
  brand,
  typo,
  copy,
  requireSmsConsent,
}: PersonalInfoStepProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6" style={{ backgroundColor: brand.primary }}>
          <h2 className={`${typo.sectionHeader} uppercase tracking-wide text-white`}>
            Personal Info
          </h2>
        </div>
        
        <div className="p-8 space-y-6">
          {/* Name row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                First Name *
              </label>
              <input
                type="text"
                value={formState.firstName}
                onChange={(e) => updateForm('firstName', e.target.value)}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                placeholder="John"
                disabled={loading}
              />
            </div>
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                Last Name *
              </label>
              <input
                type="text"
                value={formState.lastName}
                onChange={(e) => updateForm('lastName', e.target.value)}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                placeholder="Smith"
                disabled={loading}
              />
            </div>
          </div>
          
          {/* Contact row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                Email *
              </label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => updateForm('email', e.target.value)}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                placeholder="john@example.com"
                disabled={loading}
              />
            </div>
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                Mobile Phone *
              </label>
              <input
                type="tel"
                value={formState.phone}
                onChange={(e) => {
                  // Format phone number
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = digits;
                  if (digits.length > 6) {
                    formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                  } else if (digits.length > 3) {
                    formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                  } else if (digits.length > 0) {
                    formatted = `(${digits}`;
                  }
                  updateForm('phone', formatted);
                }}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                placeholder="(555) 123-4567"
                disabled={loading}
              />
            </div>
          </div>
          
          {/* SMS Consent */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.smsConsent}
                onChange={(e) => updateForm('smsConsent', e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 focus:ring-2"
                style={{ accentColor: brand.primary }}
                disabled={loading}
              />
              <span className="text-sm" style={{ color: brand.textMuted }}>
                {copy.smsConsent}
                {requireSmsConsent && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-8 py-6 border-t" style={{ borderColor: brand.border, backgroundColor: '#f9fafb' }}>
          <button
            onClick={onNext}
            disabled={loading}
            className="w-full py-4 text-white font-semibold rounded-lg disabled:opacity-50 transition-all hover:shadow-lg"
            style={{ backgroundColor: brand.primary }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
