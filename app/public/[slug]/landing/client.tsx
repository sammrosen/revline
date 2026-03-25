'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { ResolvedBranding, ResolvedThemeMapping, ResolvedTypography, ResolvedFeatures, ResolvedLandingCopy, ResolvedLandingFormField } from '@/app/_lib/config';
import type { HeaderStyle } from '@/app/_lib/types';
import { DEFAULT_THEME_MAPPING } from '@/app/_lib/config';
import { WebchatWidget } from '@/app/_components/WebchatWidget';

// =============================================================================
// TYPES
// =============================================================================

interface DerivedBrand {
  primary: string;
  primaryHover: string;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  header: string;
}

export interface LandingClientProps {
  workspaceSlug: string;
  workspaceName: string;
  branding: ResolvedBranding;
  theme?: ResolvedThemeMapping;
  headerStyle?: HeaderStyle;
  typography?: ResolvedTypography;
  copy: ResolvedLandingCopy;
  features: ResolvedFeatures;
  webchat?: {
    agentId: string;
    enabled: boolean;
    collectEmail?: boolean;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

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
  };
}

const FONT_FAMILY_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const SIZE_MAP: Record<string, string> = {
  xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem',
  xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem',
};

const WEIGHT_MAP: Record<string, number> = {
  normal: 400, medium: 500, semibold: 600, bold: 700,
};

function typoStyle(role?: { size?: string; weight?: string }): React.CSSProperties {
  if (!role) return {};
  return {
    ...(role.size && SIZE_MAP[role.size] ? { fontSize: SIZE_MAP[role.size] } : {}),
    ...(role.weight && WEIGHT_MAP[role.weight] ? { fontWeight: WEIGHT_MAP[role.weight] } : {}),
  };
}

const KNOWN_FIELDS = new Set(['name', 'email', 'phone']);

// =============================================================================
// COMPONENT
// =============================================================================

export function LandingClient({
  workspaceSlug,
  workspaceName,
  branding,
  theme,
  headerStyle,
  typography,
  copy,
  features,
  webchat,
}: LandingClientProps) {
  const resolvedTheme = theme || DEFAULT_THEME_MAPPING;
  const brand = useMemo(() => deriveBrandColors(branding, resolvedTheme), [branding, resolvedTheme]);
  const fontFamily = FONT_FAMILY_MAP[branding.fontFamily] || FONT_FAMILY_MAP.system;

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const updateField = useCallback((id: string, value: string) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailField = copy.formFields.find(f => f.type === 'email');
    const emailValue = emailField ? formValues[emailField.id] : formValues['email'];
    if (!emailValue) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const metadata: Record<string, string> = {};
      for (const field of copy.formFields) {
        if (!KNOWN_FIELDS.has(field.id) && formValues[field.id]) {
          metadata[field.id] = formValues[field.id];
        }
      }

      const res = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailValue,
          name: formValues['name'] || undefined,
          phone: formValues['phone'] || undefined,
          source: workspaceSlug,
          ...(Object.keys(metadata).length > 0 && { metadata }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Something went wrong');
      }

      setFormSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setFormSubmitting(false);
    }
  };

  const hasBackgroundImage = !!copy.heroBackgroundImage;
  const sections = copy.sections ?? { hero: true, services: true, gallery: true, footer: true };

  const hs = headerStyle || {};
  const hsSizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[hs.size || 'base'] || 'text-base';
  const hsWeightClass = (hs.bold ?? true) ? 'font-bold' : 'font-normal';
  const hsItalicClass = hs.italic ? 'italic' : '';
  const hsVariant = hs.variant || 'plain';

  return (
    <div style={{ fontFamily }} className="min-h-screen">
      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: brand.header,
          boxShadow: scrolled ? '0 1px 3px rgba(0,0,0,.25)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {branding.logo ? (
              <img
                src={branding.logo}
                alt={workspaceName}
                className="h-8 sm:h-10 w-auto object-contain shrink-0"
              />
            ) : hsVariant === 'pill' ? (
              <div className="bg-white px-3 py-2 rounded shrink-0">
                <span className={`text-zinc-800 ${hsSizeClass} ${hsWeightClass} ${hsItalicClass}`}>{workspaceName.toUpperCase()}</span>
              </div>
            ) : (
              <span className={`text-white ${hsSizeClass} ${hsWeightClass} ${hsItalicClass} truncate`}>{workspaceName}</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {copy.phoneNumber && (
              <a
                href={`tel:${copy.phoneNumber.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-2 border border-white/40 text-white text-sm font-medium p-2.5 sm:px-4 sm:py-2.5 rounded hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="hidden sm:inline">{copy.phoneNumber}</span>
              </a>
            )}
            <a
              href={copy.heroCtaLink}
              style={{ backgroundColor: brand.primary }}
              className="text-white text-xs sm:text-sm font-bold px-3 py-2 sm:px-5 sm:py-2.5 rounded hover:opacity-90 transition-opacity uppercase tracking-wide"
            >
              {copy.heroCtaText}
            </a>
          </div>
        </div>
      </header>

      {/* Hero -- split layout: text left, form right */}
      {sections.hero !== false && (
        <section
          className="relative min-h-dvh flex items-center"
          style={{ backgroundColor: hasBackgroundImage ? '#111' : brand.header }}
        >
          {hasBackgroundImage && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${copy.heroBackgroundImage})`,
                backgroundPosition: copy.heroBackgroundPosition || 'center',
                backgroundSize: copy.heroBackgroundSize || 'cover',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className="absolute inset-0 bg-black/60" />
            </div>
          )}

          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-20 pt-24 sm:pt-28">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Left: headline + description */}
              <div className="order-2 md:order-1 text-center md:text-left">
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 sm:mb-6"
                  style={typoStyle(typography?.pageTitle)}
                >
                  {copy.heroHeadline}
                </h1>
                <p
                  className="text-base sm:text-lg md:text-xl text-white/80 leading-relaxed max-w-lg mx-auto md:mx-0"
                  style={typoStyle(typography?.body)}
                >
                  {copy.heroSubhead}
                </p>
              </div>

              {/* Right: form card */}
              <div className="order-1 md:order-2 bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-full sm:max-w-md mx-auto md:ml-auto">
                {formSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-800 text-lg font-medium">
                      {copy.contactSuccessMessage}
                    </p>
                  </div>
                ) : (
                  <>
                    {branding.logo && (
                      <div className="flex justify-center mb-4">
                        <img src={branding.logo} alt="" className="h-14 w-auto object-contain" />
                      </div>
                    )}
                    <h2
                      style={{ color: brand.header, ...typoStyle(typography?.sectionHeader) }}
                      className="text-xl font-bold text-center mb-6 uppercase tracking-wide"
                    >
                      {copy.contactTitle}
                    </h2>

                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      {copy.formFields.map((field: ResolvedLandingFormField) => (
                        <div key={field.id}>
                          <label
                            className="block text-sm font-semibold text-gray-700 mb-1"
                            style={typoStyle(typography?.label)}
                          >
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={formValues[field.id] || ''}
                              onChange={(e) => updateField(field.id, e.target.value)}
                              placeholder={field.placeholder}
                              required={field.required}
                              rows={3}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors resize-none"
                              style={{ '--tw-ring-color': brand.primary + '40' } as React.CSSProperties}
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={formValues[field.id] || ''}
                              onChange={(e) => updateField(field.id, e.target.value)}
                              placeholder={field.placeholder}
                              required={field.required}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                              style={{ '--tw-ring-color': brand.primary + '40' } as React.CSSProperties}
                            />
                          )}
                        </div>
                      ))}

                      {copy.consentText && (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                            className="mt-1 rounded border-gray-300"
                            style={{ accentColor: brand.primary }}
                            required
                          />
                          <span className="text-xs text-gray-500 leading-relaxed">
                            {copy.consentText}
                          </span>
                        </label>
                      )}

                      {formError && (
                        <p className="text-sm text-red-500">{formError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={formSubmitting}
                        style={{ backgroundColor: brand.primary }}
                        className="w-full text-white font-bold py-3.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 uppercase tracking-wide text-sm"
                      >
                        {formSubmitting ? 'Sending...' : copy.contactSubmitText}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      {sections.services !== false && copy.services.length > 0 && (
        <section className="py-12 sm:py-16 px-4 sm:px-6" style={{ backgroundColor: brand.background }}>
          <div className="max-w-6xl mx-auto">
            <h2
              style={{ color: brand.text, ...typoStyle(typography?.sectionHeader) }}
              className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12"
            >
              {copy.servicesTitle}
            </h2>
            <div className={`grid gap-4 ${
              copy.services.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' :
              copy.services.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto' :
              copy.services.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {copy.services.map((service, i) => (
                service.image ? (
                  <div
                    key={i}
                    className="group relative rounded-xl overflow-hidden"
                    style={{ aspectRatio: '4/3' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={service.image}
                      alt={service.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6">
                      <p className="text-white text-sm sm:text-base text-center leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                      <h3 className="text-white font-bold text-lg sm:text-xl uppercase tracking-wide drop-shadow-lg">
                        {service.title}
                      </h3>
                      <a
                        href={service.ctaLink || '#contact'}
                        onClick={(e) => {
                          const href = service.ctaLink || '#contact';
                          if (href.startsWith('#')) {
                            e.preventDefault();
                            document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: brand.primary }}
                        aria-label={`Go to ${service.title}`}
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{ backgroundColor: brand.card, borderColor: brand.border }}
                    className="rounded-xl p-6 sm:p-8 border"
                  >
                    <div
                      style={{ backgroundColor: brand.primary + '15' }}
                      className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    >
                      <svg className="w-6 h-6" style={{ color: brand.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 style={{ color: brand.text }} className="text-xl font-semibold mb-2">
                      {service.title}
                    </h3>
                    <p style={{ color: brand.textMuted }} className="leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                )
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Images */}
      {sections.gallery !== false && copy.images.length > 0 && (
        <section className="py-10 sm:py-12 px-4 sm:px-6" style={{ backgroundColor: brand.background }}>
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-4 ${
              copy.images.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
              copy.images.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {copy.images.map((img, i) => (
                <div key={i} className="overflow-hidden rounded-xl aspect-video">
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ objectPosition: img.position || 'center' }}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {sections.footer !== false && (
        <footer style={{ backgroundColor: brand.header }} className="py-6 sm:py-8 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto text-center">
            {features.showPoweredBy && copy.footerText && (
              <p className="text-white/70 text-sm">{copy.footerText}</p>
            )}
            {copy.footerEmail && (
              <a href={`mailto:${copy.footerEmail}`} className="text-white/80 text-sm hover:text-white transition-colors">
                {copy.footerEmail}
              </a>
            )}
          </div>
        </footer>
      )}

      {/* Webchat Widget */}
      {webchat?.enabled && webchat.agentId && (
        <WebchatWidget
          workspaceSlug={workspaceSlug}
          agentId={webchat.agentId}
          brandColor={brand.primary}
          agentName={workspaceName}
          collectEmail={webchat.collectEmail}
        />
      )}
    </div>
  );
}
