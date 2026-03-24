'use client';

import type { SignupConfig, BookingCopyConfig, LandingCopyConfig } from '@/app/_lib/types';
import { MagicLinkBookingClient } from '@/app/public/[slug]/book/client';
import { SignupClient } from '@/app/public/[slug]/signup/client';
import { LandingClient } from '@/app/public/[slug]/landing/client';
import type { ResolvedBranding, ResolvedThemeMapping, ResolvedTypography, ResolvedBookingCopy, ResolvedFeatures, ResolvedLandingCopy } from '@/app/_lib/config';
import {
  DEFAULT_BRANDING,
  DEFAULT_THEME_MAPPING,
  DEFAULT_HEADER_STYLE,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_BOOKING_COPY,
  DEFAULT_LANDING_COPY,
  DEFAULT_FEATURES,
  DEFAULT_SIGNUP_COPY,
  DEFAULT_SIGNUP_CLUB,
  DEFAULT_SIGNUP_FEATURES,
  DEFAULT_SIGNUP_POLICIES,
  EXAMPLE_SIGNUP_PLAN,
} from '@/app/_lib/config';

// =============================================================================
// TYPES
// =============================================================================

interface BrandingConfig {
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
  logo?: string;
  fontFamily?: 'inter' | 'poppins' | 'roboto' | 'system';
}

interface ThemeMapping {
  primary?: number;
  primaryHover?: number;
  background?: number;
  card?: number;
  text?: number;
  header?: number;
}

interface HeaderStyleConfig {
  variant?: 'pill' | 'plain';
  size?: 'sm' | 'base' | 'lg' | 'xl';
  bold?: boolean;
  italic?: boolean;
  textSize?: 'xs' | 'sm' | 'base' | 'lg';
  textWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

interface TextRoleStyle {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

interface TypographyConfig {
  sectionHeader?: TextRoleStyle;
  pageTitle?: TextRoleStyle;
  body?: TextRoleStyle;
  label?: TextRoleStyle;
  caption?: TextRoleStyle;
}

interface MockPreviewProps {
  branding?: BrandingConfig;
  theme?: ThemeMapping;
  headerStyle?: HeaderStyleConfig;
  typography?: TypographyConfig;
  copy?: BookingCopyConfig;
  landingCopy?: LandingCopyConfig;
  workspaceName: string;
  formType: 'booking' | 'signup' | 'landing';
  signupConfig?: SignupConfig;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FormPreviewMock({
  branding,
  theme,
  headerStyle,
  typography,
  copy,
  landingCopy,
  workspaceName,
  formType,
  signupConfig,
}: MockPreviewProps) {
  // Resolve branding with defaults (shared by both form types)
  const resolvedBranding: ResolvedBranding = {
    color1: branding?.color1 || DEFAULT_BRANDING.color1,
    color2: branding?.color2 || DEFAULT_BRANDING.color2,
    color3: branding?.color3 || DEFAULT_BRANDING.color3,
    color4: branding?.color4 || DEFAULT_BRANDING.color4,
    color5: branding?.color5 || DEFAULT_BRANDING.color5,
    logo: branding?.logo || '',
    fontFamily: branding?.fontFamily || 'inter',
  };

  const resolvedTheme: ResolvedThemeMapping = {
    primary: theme?.primary ?? DEFAULT_THEME_MAPPING.primary,
    primaryHover: theme?.primaryHover ?? DEFAULT_THEME_MAPPING.primaryHover,
    background: theme?.background ?? DEFAULT_THEME_MAPPING.background,
    card: theme?.card ?? DEFAULT_THEME_MAPPING.card,
    text: theme?.text ?? DEFAULT_THEME_MAPPING.text,
    header: theme?.header ?? DEFAULT_THEME_MAPPING.header,
  };

  const resolvedHeaderStyle = {
    variant: headerStyle?.variant || DEFAULT_HEADER_STYLE.variant,
    size: headerStyle?.size || DEFAULT_HEADER_STYLE.size,
    bold: headerStyle?.bold ?? DEFAULT_HEADER_STYLE.bold,
    italic: headerStyle?.italic ?? DEFAULT_HEADER_STYLE.italic,
    textSize: headerStyle?.textSize || DEFAULT_HEADER_STYLE.textSize,
    textWeight: headerStyle?.textWeight || DEFAULT_HEADER_STYLE.textWeight,
  };

  const resolvedTypography: ResolvedTypography = {
    sectionHeader: {
      size: typography?.sectionHeader?.size || DEFAULT_TYPOGRAPHY.sectionHeader.size,
      weight: typography?.sectionHeader?.weight || DEFAULT_TYPOGRAPHY.sectionHeader.weight,
    },
    pageTitle: {
      size: typography?.pageTitle?.size || DEFAULT_TYPOGRAPHY.pageTitle.size,
      weight: typography?.pageTitle?.weight || DEFAULT_TYPOGRAPHY.pageTitle.weight,
    },
    body: {
      size: typography?.body?.size || DEFAULT_TYPOGRAPHY.body.size,
      weight: typography?.body?.weight || DEFAULT_TYPOGRAPHY.body.weight,
    },
    label: {
      size: typography?.label?.size || DEFAULT_TYPOGRAPHY.label.size,
      weight: typography?.label?.weight || DEFAULT_TYPOGRAPHY.label.weight,
    },
    caption: {
      size: typography?.caption?.size || DEFAULT_TYPOGRAPHY.caption.size,
      weight: typography?.caption?.weight || DEFAULT_TYPOGRAPHY.caption.weight,
    },
  };

  if (formType === 'landing') {
    const resolvedLandingCopy: ResolvedLandingCopy = {
      heroHeadline: landingCopy?.heroHeadline || DEFAULT_LANDING_COPY.heroHeadline,
      heroSubhead: landingCopy?.heroSubhead || DEFAULT_LANDING_COPY.heroSubhead,
      heroCtaText: landingCopy?.heroCtaText || DEFAULT_LANDING_COPY.heroCtaText,
      heroCtaLink: landingCopy?.heroCtaLink || DEFAULT_LANDING_COPY.heroCtaLink,
      servicesTitle: landingCopy?.servicesTitle || DEFAULT_LANDING_COPY.servicesTitle,
      services: landingCopy?.services?.length ? landingCopy.services : DEFAULT_LANDING_COPY.services,
      images: landingCopy?.images?.length ? landingCopy.images : DEFAULT_LANDING_COPY.images,
      contactTitle: landingCopy?.contactTitle || DEFAULT_LANDING_COPY.contactTitle,
      contactSubhead: landingCopy?.contactSubhead || DEFAULT_LANDING_COPY.contactSubhead,
      contactSubmitText: landingCopy?.contactSubmitText || DEFAULT_LANDING_COPY.contactSubmitText,
      contactSuccessMessage: landingCopy?.contactSuccessMessage || DEFAULT_LANDING_COPY.contactSuccessMessage,
      footerText: landingCopy?.footerText || DEFAULT_LANDING_COPY.footerText,
      footerEmail: landingCopy?.footerEmail || DEFAULT_LANDING_COPY.footerEmail,
    };

    return (
      <LandingClient
        workspaceSlug={workspaceName}
        workspaceName={workspaceName}
        branding={resolvedBranding}
        theme={resolvedTheme}
        headerStyle={resolvedHeaderStyle}
        typography={resolvedTypography}
        copy={resolvedLandingCopy}
        features={DEFAULT_FEATURES}
      />
    );
  }

  if (formType === 'signup') {
    const plans = signupConfig?.plans?.length ? signupConfig.plans : [EXAMPLE_SIGNUP_PLAN];

    return (
      <SignupClient
        workspaceSlug={workspaceName}
        workspaceName={signupConfig?.club?.name || workspaceName}
        initialStep={2}
        previewMode={true}
        branding={resolvedBranding}
        theme={resolvedTheme}
        headerStyle={resolvedHeaderStyle}
        typography={resolvedTypography}
        club={{
          name: signupConfig?.club?.name || DEFAULT_SIGNUP_CLUB.name,
          address: signupConfig?.club?.address || DEFAULT_SIGNUP_CLUB.address,
          city: signupConfig?.club?.city || DEFAULT_SIGNUP_CLUB.city,
          state: signupConfig?.club?.state || DEFAULT_SIGNUP_CLUB.state,
          zip: signupConfig?.club?.zip || DEFAULT_SIGNUP_CLUB.zip,
        }}
        plans={plans}
        copy={{
          stepTitles: (signupConfig?.copy?.stepTitles || DEFAULT_SIGNUP_COPY.stepTitles) as Record<number, string>,
          smsConsent: signupConfig?.copy?.smsConsent || DEFAULT_SIGNUP_COPY.smsConsent,
          disclaimer: signupConfig?.copy?.disclaimer || DEFAULT_SIGNUP_COPY.disclaimer,
          submitButton: signupConfig?.copy?.submitButton || DEFAULT_SIGNUP_COPY.submitButton,
          successTitle: signupConfig?.copy?.successTitle || DEFAULT_SIGNUP_COPY.successTitle,
          successMessage: signupConfig?.copy?.successMessage || DEFAULT_SIGNUP_COPY.successMessage,
          footerText: signupConfig?.copy?.footerText || DEFAULT_SIGNUP_COPY.footerText,
          footerEmail: signupConfig?.copy?.footerEmail || DEFAULT_SIGNUP_COPY.footerEmail,
          headerText: signupConfig?.copy?.headerText || DEFAULT_SIGNUP_COPY.headerText,
          headerLink: signupConfig?.copy?.headerLink || DEFAULT_SIGNUP_COPY.headerLink,
        }}
        policies={{
          privacy: signupConfig?.policies?.privacy || DEFAULT_SIGNUP_POLICIES.privacy,
          accessibility: signupConfig?.policies?.accessibility || DEFAULT_SIGNUP_POLICIES.accessibility,
          cancellation: signupConfig?.policies?.cancellation || DEFAULT_SIGNUP_POLICIES.cancellation,
          terms: signupConfig?.policies?.terms || DEFAULT_SIGNUP_POLICIES.terms,
        }}
        features={DEFAULT_FEATURES}
        signupFeatures={{
          showPromoCode: signupConfig?.features?.showPromoCode ?? DEFAULT_SIGNUP_FEATURES.showPromoCode,
          showPoweredBy: signupConfig?.features?.showPoweredBy ?? DEFAULT_SIGNUP_FEATURES.showPoweredBy,
          requireSmsConsent: signupConfig?.features?.requireSmsConsent ?? DEFAULT_SIGNUP_FEATURES.requireSmsConsent,
        }}
      />
    );
  }

  // Booking form — render real component with previewMode
  const resolvedCopy: ResolvedBookingCopy = {
    headline: copy?.headline || DEFAULT_BOOKING_COPY.headline,
    subhead: copy?.subhead || DEFAULT_BOOKING_COPY.subhead,
    submitButton: copy?.submitButton || DEFAULT_BOOKING_COPY.submitButton,
    successTitle: copy?.successTitle || DEFAULT_BOOKING_COPY.successTitle,
    successMessage: copy?.successMessage || DEFAULT_BOOKING_COPY.successMessage,
    footerText: copy?.footerText || DEFAULT_BOOKING_COPY.footerText,
    footerEmail: copy?.footerEmail || DEFAULT_BOOKING_COPY.footerEmail,
  };

  const resolvedFeatures: ResolvedFeatures = {
    showPoweredBy: true,
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
      theme={resolvedTheme}
      headerStyle={resolvedHeaderStyle}
      typography={resolvedTypography}
      copy={resolvedCopy}
      features={resolvedFeatures}
      previewMode={true}
    />
  );
}

export default FormPreviewMock;
