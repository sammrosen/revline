'use client';

/**
 * Step 5: Payment
 * 
 * Collects payment information:
 * - Payment method selection
 * - Card details (name, number, expiry, CVV, zip)
 * - Payment authorization checkbox
 * - Terms & conditions checkbox with policy links
 * 
 * Layout: Form on left, sidebar summary on right
 */

import type { SignupPlan } from '@/app/_lib/types';
import type { SignupFormState, DerivedBrand, TextClasses } from '../client';
import type { ResolvedSignupClub, ResolvedSignupPolicies, ResolvedSignupCopy } from '@/app/_lib/config';
import { SidebarSummary } from './sidebar-summary';

// Expiry months
const EXP_MONTHS = [
  { value: '', label: 'Month' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1).padStart(2, '0'),
  })),
];

// Expiry years (current year + 10)
const currentYear = new Date().getFullYear();
const EXP_YEARS = [
  { value: '', label: 'Year' },
  ...Array.from({ length: 11 }, (_, i) => ({
    value: String(currentYear + i),
    label: String(currentYear + i),
  })),
];

interface PaymentStepProps {
  formState: SignupFormState;
  updateForm: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  brand: DerivedBrand;
  typo: TextClasses;
  club: ResolvedSignupClub;
  selectedPlan: SignupPlan;
  policies: ResolvedSignupPolicies;
  copy: ResolvedSignupCopy;
}

export function PaymentStep({
  formState,
  updateForm,
  onSubmit,
  onBack,
  loading,
  brand,
  typo,
  club,
  selectedPlan,
  policies,
  copy,
}: PaymentStepProps) {
  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const parts = digits.match(/.{1,4}/g) || [];
    return parts.join(' ');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Payment method card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6" style={{ backgroundColor: brand.primary }}>
            <h2 className={`${typo.sectionHeader} uppercase tracking-wide text-white`}>
              Recurring Payment
            </h2>
          </div>
          
          <div className="p-8 space-y-6">
            {/* Payment method */}
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                Payment Method
              </label>
              <select
                value={formState.paymentMethod}
                onChange={(e) => updateForm('paymentMethod', e.target.value as 'card' | 'bank')}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                disabled={loading}
              >
                <option value="card">Credit Card</option>
                <option value="bank">Bank Account</option>
              </select>
            </div>
            
            {/* Cardholder name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Cardholder&apos;s First Name *
                </label>
                <input
                  type="text"
                  value={formState.cardFirstName}
                  onChange={(e) => updateForm('cardFirstName', e.target.value)}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  placeholder="John"
                  disabled={loading}
                />
              </div>
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Cardholder&apos;s Last Name *
                </label>
                <input
                  type="text"
                  value={formState.cardLastName}
                  onChange={(e) => updateForm('cardLastName', e.target.value)}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  placeholder="Smith"
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Card number */}
            <div>
              <label className={`block ${typo.label} text-gray-600 mb-2`}>
                Credit Card Number *
              </label>
              <input
                type="text"
                value={formState.cardNumber}
                onChange={(e) => updateForm('cardNumber', formatCardNumber(e.target.value))}
                className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors font-mono"
                style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                disabled={loading}
              />
            </div>
            
            {/* Expiry and CVV */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Exp. Month *
                </label>
                <select
                  value={formState.cardExpMonth}
                  onChange={(e) => updateForm('cardExpMonth', e.target.value)}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  disabled={loading}
                >
                  {EXP_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Exp. Year *
                </label>
                <select
                  value={formState.cardExpYear}
                  onChange={(e) => updateForm('cardExpYear', e.target.value)}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  disabled={loading}
                >
                  {EXP_YEARS.map((y) => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Security Code *
                </label>
                <input
                  type="text"
                  value={formState.cardCvv}
                  onChange={(e) => updateForm('cardCvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors font-mono"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  placeholder="123"
                  maxLength={4}
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Billing ZIP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Zip/Postal Code *
                </label>
                <input
                  type="text"
                  value={formState.cardZip}
                  onChange={(e) => updateForm('cardZip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  placeholder="12345"
                  maxLength={5}
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Payment authorization */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.agreeToPayment}
                  onChange={(e) => updateForm('agreeToPayment', e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: brand.primary }}
                  disabled={loading}
                />
                <span className="text-sm" style={{ color: brand.text }}>
                  I will pay today using this Credit Card
                  <span className="text-red-500 ml-1">*</span>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Terms & Conditions card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6" style={{ backgroundColor: brand.primary }}>
            <h2 className={`${typo.sectionHeader} uppercase tracking-wide text-white`}>
              Terms & Conditions
            </h2>
          </div>
          
          <div className="p-8 space-y-4">
            {/* Terms checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.agreeToTerms}
                onChange={(e) => updateForm('agreeToTerms', e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 focus:ring-2"
                style={{ accentColor: brand.primary }}
                disabled={loading}
              />
              <span className="text-sm" style={{ color: brand.text }}>
                I have read and agree to the{' '}
                {policies.terms ? (
                  <a 
                    href={policies.terms} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: brand.primary }}
                  >
                    Terms and Conditions
                  </a>
                ) : (
                  <span style={{ color: brand.primary }}>Terms and Conditions</span>
                )}
                {policies.privacy && (
                  <>
                    {' '}and the{' '}
                    <a 
                      href={policies.privacy} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: brand.primary }}
                    >
                      Privacy Policy
                    </a>
                  </>
                )}
                {', and give consent to store my payment information for this agreement.'}
                <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={onBack}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
            style={{ color: brand.text }}
          >
            Back
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="px-8 py-4 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-lg"
            style={{ backgroundColor: brand.primary }}
          >
            {loading ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Processing...</span>
              </>
            ) : (
              copy.submitButton
            )}
          </button>
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <SidebarSummary
          club={club}
          selectedPlan={selectedPlan}
          brand={brand}
        />
      </div>
    </div>
  );
}
