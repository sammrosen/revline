'use client';

/**
 * Step 5: Payment
 *
 * Embeds ABC's PayPage iframe for PCI-compliant payment tokenization.
 * Card/bank numbers never touch our servers — only opaque transaction tokens.
 *
 * Flow:
 * 1. PayPage iframe loads inside our branded UI
 * 2. Member enters payment info directly into ABC's hosted form
 * 3. ABC returns { transactionId, paymentType } via postMessage
 * 4. We store the token in form state and enable the submit button
 *
 * Also includes:
 * - Payment authorization checkbox
 * - Terms & conditions checkbox with policy links
 * - Sidebar summary
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SignupPlan } from '@/app/_lib/types';
import type { SignupFormState, DerivedBrand, TextClasses } from '../client';
import type { ResolvedSignupClub, ResolvedSignupPolicies, ResolvedSignupCopy } from '@/app/_lib/config';
import { SidebarSummary } from './sidebar-summary';

const PAYPAGE_ORIGIN = 'https://apipayservice.abcfinancial.net';

interface PaymentStepProps {
  formState: SignupFormState;
  updateForm: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  onSubmit: () => void;
  onBack: () => void;
  onPayPageSuccess: (transactionId: string, paymentType: string) => void;
  loading: boolean;
  brand: DerivedBrand;
  typo: TextClasses;
  club: ResolvedSignupClub;
  selectedPlan: SignupPlan;
  policies: ResolvedSignupPolicies;
  copy: ResolvedSignupCopy;
  ppsId: string | null;
}

export function PaymentStep({
  formState,
  updateForm,
  onSubmit,
  onBack,
  onPayPageSuccess,
  loading,
  brand,
  typo,
  club,
  selectedPlan,
  policies,
  copy,
  ppsId,
}: PaymentStepProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [payPageError, setPayPageError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for PayPage postMessage responses
  const handleMessage = useCallback((event: MessageEvent) => {
    // Validate origin — only trust messages from ABC's PayPage domain
    if (event.origin !== PAYPAGE_ORIGIN) return;

    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      if (data.transactionId) {
        setPayPageError(null);
        onPayPageSuccess(data.transactionId, data.paymentType || 'creditcard');
      } else if (data.error || data.errorMessage) {
        setPayPageError(data.error || data.errorMessage || 'Payment processing failed');
      }
    } catch {
      // Non-JSON message from iframe — ignore
    }
  }, [onPayPageSuccess]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const hasToken = !!formState.payPageTransactionId;
  const canSubmit = hasToken && formState.agreeToPayment && formState.agreeToTerms && !loading;

  // PayPage not configured
  if (!ppsId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">&#9888;</div>
            <h2 className={`${typo.sectionHeader} text-gray-900 mb-2`}>Payment System Not Configured</h2>
            <p className="text-gray-600">
              Online payment is not currently available. Please contact the front desk to complete your membership signup.
            </p>
            <button
              onClick={onBack}
              className="mt-6 px-6 py-3 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              style={{ color: brand.text }}
            >
              Back
            </button>
          </div>
        </div>
        <div className="lg:col-span-1">
          <SidebarSummary club={club} selectedPlan={selectedPlan} brand={brand} />
        </div>
      </div>
    );
  }

  const iframeSrc = `${PAYPAGE_ORIGIN}/ABC-API-CollectBillingPayPage.jsp?ppsId=${encodeURIComponent(ppsId)}&accountTypes=card,eft`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Payment info card with iframe */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6" style={{ backgroundColor: brand.primary }}>
            <h2 className={`${typo.sectionHeader} uppercase tracking-wide text-white`}>
              Payment Information
            </h2>
          </div>

          <div className="p-8">
            {/* PayPage iframe */}
            <div className="relative min-h-[400px]">
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div
                      className="animate-spin w-8 h-8 border-3 border-t-transparent rounded-full mx-auto mb-3"
                      style={{ borderColor: `${brand.primary}40`, borderTopColor: 'transparent' }}
                    />
                    <p className="text-sm text-gray-500">Loading secure payment form...</p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Secure Payment Form"
                className="w-full border-0 rounded-lg"
                style={{
                  minHeight: '400px',
                  opacity: iframeLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}
                onLoad={() => setIframeLoaded(true)}
              />
            </div>

            {/* Token success indicator */}
            {hasToken && (
              <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Payment method accepted</span>
              </div>
            )}

            {/* PayPage error */}
            {payPageError && (
              <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{payPageError}</span>
              </div>
            )}

            {/* Payment authorization */}
            <div className="mt-6 pt-4 border-t border-gray-100">
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
                  I authorize payment using the method provided above
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
            disabled={!canSubmit}
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
        <SidebarSummary club={club} selectedPlan={selectedPlan} brand={brand} />
      </div>
    </div>
  );
}
