'use client';

/**
 * Membership Signup Client Component
 * 
 * Multi-step signup flow with:
 * 1. Location (if multi-location) - skipped for single location
 * 2. About You - basic contact info
 * 3. Select Plan - membership selection
 * 4. Member Info - detailed info + sidebar
 * 5. Payment - card form + T&C
 * 6. Confirmation - success state
 * 
 * Features:
 * - Client-side step navigation with URL updates
 * - Form state persisted across steps
 * - Mock submission (no real API calls yet)
 * - Configurable branding, copy, plans, policies
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SignupPlan, HeaderStyle } from '@/app/_lib/types';
import type { 
  ResolvedBranding, 
  ResolvedThemeMapping,
  ResolvedTypography,
  ResolvedSignupCopy, 
  ResolvedSignupClub, 
  ResolvedSignupFeatures, 
  ResolvedSignupPolicies,
  ResolvedFeatures,
} from '@/app/_lib/config';
import { DEFAULT_THEME_MAPPING, DEFAULT_TYPOGRAPHY } from '@/app/_lib/config';

// Import step components
import { StepIndicator } from './steps/step-indicator';
import { PersonalInfoStep } from './steps/step-2-personal';
import { SelectPlanStep } from './steps/step-3-plans';
import { MemberInfoStep } from './steps/step-4-member-info';
import { PaymentStep } from './steps/step-5-payment';
import { ConfirmationStep } from './steps/step-6-confirmation';

// =============================================================================
// TYPES
// =============================================================================

import { buildTextClasses, typoClass, type TextClasses } from '@/app/_lib/forms/styles';
export type { TextClasses };

export interface DerivedBrand {
  primary: string;
  primaryHover: string;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  header: string;
  success: string;
  error: string;
}

/**
 * Form state across all steps
 */
export interface SignupFormState {
  // Step 2: Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  
  // Step 3: Plan Selection
  selectedPlanId: string | null;
  promoCode: string;
  
  // Step 4: Member Info
  address: string;
  city: string;
  state: string;
  zipCode: string;
  birthMonth: string;
  birthDay: string;
  birthYear: string;
  gender: string;
  homePhone: string;
  
  // Step 5: Payment
  paymentMethod: 'card' | 'bank';
  cardFirstName: string;
  cardLastName: string;
  cardNumber: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardCvv: string;
  cardZip: string;
  agreeToPayment: boolean;
  agreeToTerms: boolean;
}

interface SignupClientProps {
  workspaceSlug: string;
  workspaceName: string;
  initialStep: number;
  branding: ResolvedBranding;
  theme?: ResolvedThemeMapping;
  headerStyle?: HeaderStyle;
  typography?: ResolvedTypography;
  club: ResolvedSignupClub;
  plans: SignupPlan[];
  copy: ResolvedSignupCopy;
  policies: ResolvedSignupPolicies;
  logoSize?: number;
  features: ResolvedFeatures;
  signupFeatures: ResolvedSignupFeatures;
  previewMode?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Derive full brand colors from primary color
 */
function deriveBrandColors(branding: ResolvedBranding, theme: ResolvedThemeMapping): DerivedBrand {
  const palette = [branding.color1, branding.color2, branding.color3, branding.color4, branding.color5];
  const pick = (slot: number) => palette[slot - 1] || palette[0];

  return {
    primary: pick(theme.primary),
    primaryHover: pick(theme.primaryHover),
    background: pick(theme.background),
    card: pick(theme.card),
    text: pick(theme.text),
    textMuted: pick(theme.text) + '80',
    border: pick(theme.text) + '26',
    header: pick(theme.header),
    success: '#059669',
    error: '#dc2626',
  };
}


const FONT_FAMILY_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  system: "system-ui, -apple-system, sans-serif",
};

const initialFormState: SignupFormState = {
  // Step 2
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  smsConsent: false,
  
  // Step 3
  selectedPlanId: null,
  promoCode: '',
  
  // Step 4
  address: '',
  city: '',
  state: '',
  zipCode: '',
  birthMonth: '',
  birthDay: '',
  birthYear: '',
  gender: '',
  homePhone: '',
  
  // Step 5
  paymentMethod: 'card',
  cardFirstName: '',
  cardLastName: '',
  cardNumber: '',
  cardExpMonth: '',
  cardExpYear: '',
  cardCvv: '',
  cardZip: '',
  agreeToPayment: false,
  agreeToTerms: false,
};

// Step definitions (skipping step 1 for single location)
const STEPS = [
  { number: 1, key: 'location', label: 'Location', skippable: true },
  { number: 2, key: 'personal', label: 'About You', skippable: false },
  { number: 3, key: 'plan', label: 'Select Plan', skippable: false },
  { number: 4, key: 'member', label: 'Member Info', skippable: false },
  { number: 5, key: 'payment', label: 'Payment', skippable: false },
  { number: 6, key: 'confirmation', label: 'Confirmation', skippable: false },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SignupClient({
  workspaceSlug,
  workspaceName,
  initialStep,
  branding,
  theme,
  headerStyle,
  typography,
  club,
  plans,
  copy,
  policies,
  logoSize = 1,
  features,
  signupFeatures,
  previewMode = false,
}: SignupClientProps) {
  // features.showPoweredBy available for global branding; signupFeatures.showPoweredBy used for signup-specific
  void features;
  const router = useRouter();
  
  // Skip step 1 (location) for now - single location
  const effectiveInitialStep = Math.max(2, initialStep);
  
  const [currentStep, setCurrentStep] = useState(effectiveInitialStep);
  const [formState, setFormState] = useState<SignupFormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Derive brand colors
  const resolvedTheme = theme ?? DEFAULT_THEME_MAPPING;
  const brand = useMemo(() => deriveBrandColors(branding, resolvedTheme), [branding, resolvedTheme]);

  // Build typography class strings
  const resolvedTypo = typography ?? DEFAULT_TYPOGRAPHY;
  const typo = useMemo(() => buildTextClasses(resolvedTypo), [resolvedTypo]);
  const fontFamily = FONT_FAMILY_MAP[branding.fontFamily] || FONT_FAMILY_MAP.inter;
  
  // Get selected plan details
  const selectedPlan = useMemo(() => {
    if (!formState.selectedPlanId) return null;
    return plans.find(p => p.id === formState.selectedPlanId) || null;
  }, [formState.selectedPlanId, plans]);
  
  // Steps to display (skip step 1 for single location)
  const displaySteps = useMemo(() => {
    return STEPS.filter(s => s.number >= 2);
  }, []);
  
  // Update form state helper
  const updateForm = useCallback(<K extends keyof SignupFormState>(
    field: K,
    value: SignupFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);
  
  // Navigate to a step
  const goToStep = useCallback((step: number) => {
    if (step < 2 || step > 6) return;
    setCurrentStep(step);
    setError(null);
    // Skip URL updates in preview mode — no router navigation
    if (!previewMode) {
      router.push(`/public/${workspaceSlug}/signup/step/${step}`, { scroll: false });
    }
  }, [router, workspaceSlug, previewMode]);
  
  // Validate current step and proceed
  const handleNext = useCallback(() => {
    // In preview mode, skip all validation and advance freely
    if (previewMode) {
      if (currentStep < 6) goToStep(currentStep + 1);
      return;
    }

    // Validate based on current step
    switch (currentStep) {
      case 2: // Personal Info
        if (!formState.firstName.trim()) {
          setError('Please enter your first name');
          return;
        }
        if (!formState.lastName.trim()) {
          setError('Please enter your last name');
          return;
        }
        if (!formState.email.trim() || !formState.email.includes('@')) {
          setError('Please enter a valid email address');
          return;
        }
        if (!formState.phone.trim() || formState.phone.replace(/\D/g, '').length < 10) {
          setError('Please enter a valid phone number');
          return;
        }
        if (signupFeatures.requireSmsConsent && !formState.smsConsent) {
          setError('Please agree to receive messages to continue');
          return;
        }
        break;
        
      case 3: // Plan Selection
        if (!formState.selectedPlanId) {
          setError('Please select a membership plan');
          return;
        }
        break;
        
      case 4: // Member Info
        if (!formState.address.trim()) {
          setError('Please enter your address');
          return;
        }
        if (!formState.city.trim()) {
          setError('Please enter your city');
          return;
        }
        if (!formState.state.trim()) {
          setError('Please select your state');
          return;
        }
        if (!formState.zipCode.trim()) {
          setError('Please enter your ZIP code');
          return;
        }
        if (!formState.birthMonth || !formState.birthDay || !formState.birthYear) {
          setError('Please enter your date of birth');
          return;
        }
        break;
        
      case 5: // Payment - mock submission
        if (!formState.cardFirstName.trim() || !formState.cardLastName.trim()) {
          setError('Please enter the cardholder name');
          return;
        }
        if (!formState.cardNumber.trim() || formState.cardNumber.replace(/\D/g, '').length < 15) {
          setError('Please enter a valid card number');
          return;
        }
        if (!formState.cardExpMonth || !formState.cardExpYear) {
          setError('Please enter the card expiration date');
          return;
        }
        if (!formState.cardCvv.trim() || formState.cardCvv.length < 3) {
          setError('Please enter the security code');
          return;
        }
        if (!formState.agreeToPayment) {
          setError('Please confirm your payment authorization');
          return;
        }
        if (!formState.agreeToTerms) {
          setError('Please agree to the terms and conditions');
          return;
        }
        
        // Mock submission
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
          goToStep(6);
        }, 2000);
        return;
    }
    
    // Proceed to next step
    goToStep(currentStep + 1);
  }, [currentStep, formState, signupFeatures.requireSmsConsent, goToStep, previewMode]);
  
  // Go back to previous step
  const handleBack = useCallback(() => {
    if (currentStep > 2) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);
  
  // Reset form and start over
  const handleReset = useCallback(() => {
    setFormState(initialFormState);
    setError(null);
    goToStep(2);
  }, [goToStep]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: brand.background, fontFamily }}>
      {/* Header */}
      <header className="text-white" style={{ backgroundColor: brand.header }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt={workspaceName} 
                className="object-contain"
                style={{ height: `${2 * logoSize}rem`, margin: `${-(logoSize - 1)}rem 0` }}
              />
            ) : (() => {
              const hs = headerStyle || {};
              const sizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[hs.size || 'sm'];
              const weightClass = (hs.bold ?? true) ? 'font-bold' : 'font-normal';
              const italicClass = hs.italic ? 'italic' : '';
              const variant = hs.variant || 'pill';
              return variant === 'pill' ? (
                <div className="bg-white px-3 py-2 rounded">
                  <span className={`text-zinc-800 ${sizeClass} ${weightClass} ${italicClass}`}>{workspaceName.toUpperCase()}</span>
                </div>
              ) : (
                <span className={`text-white ${sizeClass} ${weightClass} ${italicClass}`}>{workspaceName.toUpperCase()}</span>
              );
            })()}
          </div>
          {(() => {
            const htClass = typoClass(headerStyle?.textSize || 'sm', headerStyle?.textWeight || 'normal');
            const label = copy.headerText || `Join ${workspaceName}`;
            return copy.headerLink ? (
              <a href={copy.headerLink} className={`${htClass} text-zinc-400 hover:text-white transition-colors`}>
                {label}
              </a>
            ) : (
              <span className={`${htClass} text-zinc-400`}>{label}</span>
            );
          })()}
        </div>
        
        {/* Step indicator (not on confirmation) */}
        {currentStep < 6 && (
          <StepIndicator
            steps={displaySteps}
            currentStep={currentStep}
            completedSteps={Array.from({ length: currentStep - 2 }, (_, i) => i + 2)}
            brand={brand}
            copy={copy}
          />
        )}
      </header>

      {/* Step title bar */}
      {currentStep < 6 && (
        <div style={{ backgroundColor: brand.primary }} className="py-3">
          <div className="max-w-6xl mx-auto px-4">
            <h1 className={`text-white ${typo.sectionHeader} tracking-wide uppercase`}>
              {copy.stepTitles[currentStep] || displaySteps.find(s => s.number === currentStep)?.label}
            </h1>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error banner */}
        {error && currentStep < 6 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step 2: Personal Info */}
        {currentStep === 2 && (
          <PersonalInfoStep
            formState={formState}
            updateForm={updateForm}
            onNext={handleNext}
            loading={loading}
            brand={brand}
            typo={typo}
            copy={copy}
            requireSmsConsent={signupFeatures.requireSmsConsent}
          />
        )}

        {/* Step 3: Plan Selection */}
        {currentStep === 3 && (
          <SelectPlanStep
            plans={plans}
            selectedPlanId={formState.selectedPlanId}
            promoCode={formState.promoCode}
            onSelectPlan={(id) => updateForm('selectedPlanId', id)}
            onPromoCodeChange={(code) => updateForm('promoCode', code)}
            onNext={handleNext}
            onBack={handleBack}
            loading={loading}
            brand={brand}
            typo={typo}
            showPromoCode={signupFeatures.showPromoCode}
          />
        )}

        {/* Step 4: Member Info */}
        {currentStep === 4 && selectedPlan && (
          <MemberInfoStep
            formState={formState}
            updateForm={updateForm}
            onNext={handleNext}
            onBack={handleBack}
            loading={loading}
            brand={brand}
            typo={typo}
            club={club}
            selectedPlan={selectedPlan}
          />
        )}

        {/* Step 5: Payment */}
        {currentStep === 5 && selectedPlan && (
          <PaymentStep
            formState={formState}
            updateForm={updateForm}
            onSubmit={handleNext}
            onBack={handleBack}
            loading={loading}
            brand={brand}
            typo={typo}
            club={club}
            selectedPlan={selectedPlan}
            policies={policies}
            copy={copy}
          />
        )}

        {/* Step 6: Confirmation */}
        {currentStep === 6 && selectedPlan && (
          <ConfirmationStep
            formState={formState}
            selectedPlan={selectedPlan}
            club={club}
            onReset={handleReset}
            brand={brand}
            typo={typo}
            copy={copy}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t" style={{ borderColor: brand.border }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {branding.logo ? (
                <img 
                  src={branding.logo} 
                  alt={workspaceName} 
                  className="object-contain opacity-60"
                  style={{ height: `${1.5 * logoSize}rem` }}
                />
              ) : (
                <span className="text-sm font-semibold" style={{ color: brand.textMuted }}>
                  {workspaceName}
                </span>
              )}
            </div>
            
            {/* Policy links */}
            <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: brand.textMuted }}>
              {policies.privacy && (
                <a href={policies.privacy} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Privacy Policy
                </a>
              )}
              {policies.accessibility && (
                <a href={policies.accessibility} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Accessibility
                </a>
              )}
              {policies.cancellation && (
                <a href={policies.cancellation} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Cancellation
                </a>
              )}
              {policies.terms && (
                <a href={policies.terms} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Terms
                </a>
              )}
            </div>
          </div>
          
          {/* Footer text + email */}
          {(copy.footerText || copy.footerEmail) && (
            <div className="text-center mt-4">
              {copy.footerText && (
                <p className="text-xs" style={{ color: brand.textMuted }}>{copy.footerText}</p>
              )}
              {copy.footerEmail && (
                <a href={`mailto:${copy.footerEmail}`} className="text-xs hover:underline" style={{ color: brand.textMuted }}>
                  {copy.footerEmail}
                </a>
              )}
            </div>
          )}

          {/* Powered by */}
          {signupFeatures.showPoweredBy && (
            <div className="text-center mt-4">
              <p className="text-xs" style={{ color: brand.textMuted }}>
                Powered by RevLine
              </p>
            </div>
          )}
          
          {/* Disclaimer */}
          {copy.disclaimer && (
            <p className="text-xs text-center mt-4" style={{ color: brand.textMuted }}>
              *{copy.disclaimer}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
