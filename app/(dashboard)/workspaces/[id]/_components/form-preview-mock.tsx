'use client';

import type { SignupConfig, BookingCopyConfig } from '@/app/_lib/types';
import { MagicLinkBookingClient } from '@/app/public/[slug]/book/client';
import type { ResolvedBranding, ResolvedBookingCopy, ResolvedFeatures } from '@/app/_lib/config';

// =============================================================================
// TYPES
// =============================================================================

interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  logo?: string;
  fontFamily?: 'inter' | 'poppins' | 'roboto' | 'system';
}

interface MockPreviewProps {
  branding?: BrandingConfig;
  copy?: BookingCopyConfig;
  workspaceName: string;
  formType: 'booking' | 'signup';
  signupConfig?: SignupConfig;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_BRANDING: ResolvedBranding = {
  primaryColor: '#8B2346',
  secondaryColor: '#6B1D38',
  backgroundColor: '#f3f4f6',
  logo: '',
  fontFamily: 'inter',
};

const DEFAULT_COPY: ResolvedBookingCopy = {
  headline: 'Book a Session',
  subhead: '',
  submitButton: 'Request Booking',
  successTitle: 'Check Your Email',
  successMessage: 'We\'ve sent a confirmation link to your email.',
  footerText: 'Powered by RevLine',
  footerEmail: 'hi@revlineops.com',
};

const DEFAULT_FEATURES: ResolvedFeatures = {
  showPoweredBy: true,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FormPreviewMock({
  branding,
  copy,
  workspaceName,
  formType,
  signupConfig,
}: MockPreviewProps) {
  // For signup, show a placeholder for now (signup form preview coming later)
  if (formType === 'signup') {
    return (
      <SignupPlaceholderPreview
        branding={branding}
        signupConfig={signupConfig}
        workspaceName={workspaceName}
      />
    );
  }

  // For booking, render the actual form with previewMode
  const resolvedBranding: ResolvedBranding = {
    primaryColor: branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: branding?.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    backgroundColor: branding?.backgroundColor || DEFAULT_BRANDING.backgroundColor,
    logo: branding?.logo || '',
    fontFamily: branding?.fontFamily || 'inter',
  };

  const resolvedCopy: ResolvedBookingCopy = {
    headline: copy?.headline || DEFAULT_COPY.headline,
    subhead: copy?.subhead || DEFAULT_COPY.subhead,
    submitButton: copy?.submitButton || DEFAULT_COPY.submitButton,
    successTitle: copy?.successTitle || DEFAULT_COPY.successTitle,
    successMessage: copy?.successMessage || DEFAULT_COPY.successMessage,
    footerText: copy?.footerText || DEFAULT_COPY.footerText,
    footerEmail: copy?.footerEmail || DEFAULT_COPY.footerEmail,
  };

  return (
    <MagicLinkBookingClient
      workspaceSlug={workspaceName}
      workspaceName={workspaceName}
      capabilities={{
        requiresCustomerLookup: false,
        requiresEligibilityCheck: false,
        supportsWaitlist: false,
        supportsEmployeeSelection: true,
      }}
      branding={resolvedBranding}
      copy={resolvedCopy}
      features={DEFAULT_FEATURES}
      previewMode={true}
    />
  );
}

// =============================================================================
// SIGNUP PLACEHOLDER (until we add preview mode to signup form)
// =============================================================================

function SignupPlaceholderPreview({
  branding,
  signupConfig,
  workspaceName,
}: {
  branding?: BrandingConfig;
  signupConfig?: SignupConfig;
  workspaceName: string;
}) {
  const primaryColor = branding?.primaryColor || '#8B2346';
  const backgroundColor = branding?.backgroundColor || '#ffffff';
  const plans = signupConfig?.plans || [];
  const clubName = signupConfig?.club?.name || workspaceName;

  return (
    <div className="min-h-full font-sans" style={{ backgroundColor }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-center gap-3">
          {branding?.logo ? (
            <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logo} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm font-bold">
                {clubName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-white font-semibold">{clubName}</span>
        </div>
        <span className="text-white/80 text-sm">Join Today</span>
      </div>

      {/* Step Indicator */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === 1 ? 'text-white' : 'bg-zinc-200 text-zinc-500'
                }`}
                style={step === 1 ? { backgroundColor: primaryColor } : undefined}
              >
                {step}
              </div>
              {step < 5 && <div className="w-6 h-0.5 bg-zinc-200" />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-zinc-600 mt-2">Select Your Plan</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4 bg-zinc-50">
        {plans.length > 0 ? (
          plans.slice(0, 2).map((plan, i) => (
            <div
              key={plan.id}
              className="p-4 rounded-xl border-2 bg-white"
              style={{ borderColor: i === 0 ? primaryColor : '#e5e7eb' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-1" style={{ color: primaryColor }}>
                    ${plan.price}
                    <span className="text-sm font-normal text-zinc-500">
                      /{plan.period === 'month' ? 'mo' : 'yr'}
                    </span>
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={i === 0 ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: '#d1d5db' }}
                >
                  {i === 0 && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              {plan.promoNote && (
                <span
                  className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  {plan.promoNote}
                </span>
              )}
              <ul className="mt-3 space-y-1.5">
                {plan.benefits.slice(0, 3).map((benefit, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-zinc-600">
                    <svg className="w-4 h-4 shrink-0" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-xl border-2 bg-white border-zinc-200 text-center">
            <p className="text-zinc-500 text-sm">No plans configured yet</p>
            <p className="text-zinc-400 text-xs mt-1">Add plans in the Build tab</p>
          </div>
        )}

        {/* Continue Button */}
        <button
          className="w-full py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: primaryColor }}
        >
          Continue
        </button>

        {/* Footer */}
        {signupConfig?.features?.showPoweredBy !== false && (
          <p className="text-xs text-zinc-400 text-center">Powered by RevLine</p>
        )}
      </div>
    </div>
  );
}

export default FormPreviewMock;
