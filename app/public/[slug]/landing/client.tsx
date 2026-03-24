'use client';

import { useState, useMemo } from 'react';
import type { ResolvedBranding, ResolvedThemeMapping, ResolvedTypography, ResolvedFeatures, ResolvedLandingCopy } from '@/app/_lib/config';
import type { HeaderStyle } from '@/app/_lib/types';
import { DEFAULT_THEME_MAPPING, DEFAULT_TYPOGRAPHY } from '@/app/_lib/config';
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

interface LandingClientProps {
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

// =============================================================================
// COMPONENT
// =============================================================================

export function LandingClient({
  workspaceSlug,
  workspaceName,
  branding,
  theme,
  headerStyle,
  typography: _typography,
  copy,
  features,
  webchat,
}: LandingClientProps) {
  const resolvedTheme = theme || DEFAULT_THEME_MAPPING;
  const brand = useMemo(() => deriveBrandColors(branding, resolvedTheme), [branding, resolvedTheme]);
  const fontFamily = FONT_FAMILY_MAP[branding.fontFamily] || FONT_FAMILY_MAP.system;

  // Contact form state
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || undefined,
          phone: formData.phone || undefined,
          source: workspaceSlug,
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

  const headerVariant = headerStyle?.variant || 'pill';

  return (
    <div style={{ fontFamily, color: brand.text, backgroundColor: brand.background }} className="min-h-screen">
      {/* Header */}
      <header style={{ backgroundColor: brand.header }} className="py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo && (
              <img
                src={branding.logo}
                alt={workspaceName}
                className="h-10 w-auto object-contain"
              />
            )}
            {headerVariant === 'pill' ? (
              <span className="bg-white/90 text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
                {workspaceName}
              </span>
            ) : (
              <span className="text-white font-semibold text-lg">{workspaceName}</span>
            )}
          </div>
          <a
            href={copy.heroCtaLink}
            style={{ backgroundColor: brand.primary }}
            className="hidden sm:inline-block text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {copy.heroCtaText}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{ backgroundColor: brand.primary }}
        className="py-20 px-6 text-center"
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            {copy.heroHeadline}
          </h1>
          <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            {copy.heroSubhead}
          </p>
          <a
            href={copy.heroCtaLink}
            style={{ color: brand.primary }}
            className="inline-block bg-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-white/90 transition-colors"
          >
            {copy.heroCtaText}
          </a>
        </div>
      </section>

      {/* Services */}
      {copy.services.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <h2
              style={{ color: brand.text }}
              className="text-3xl font-bold text-center mb-12"
            >
              {copy.servicesTitle}
            </h2>
            <div className={`grid gap-8 ${
              copy.services.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' :
              copy.services.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {copy.services.map((service, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: brand.card, borderColor: brand.border }}
                  className="rounded-xl p-8 border"
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
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Images */}
      {copy.images.length > 0 && (
        <section className="py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-4 ${
              copy.images.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
              copy.images.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {copy.images.map((url, i) => (
                <div key={i} className="overflow-hidden rounded-xl aspect-video">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Form */}
      <section id="contact" className="py-16 px-6">
        <div className="max-w-xl mx-auto">
          <h2 style={{ color: brand.text }} className="text-3xl font-bold text-center mb-2">
            {copy.contactTitle}
          </h2>
          <p style={{ color: brand.textMuted }} className="text-center mb-8">
            {copy.contactSubhead}
          </p>

          {formSuccess ? (
            <div
              style={{ backgroundColor: brand.card, borderColor: brand.border }}
              className="rounded-xl p-8 text-center border"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p style={{ color: brand.text }} className="text-lg font-medium">
                {copy.contactSuccessMessage}
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label style={{ color: brand.textMuted }} className="block text-sm font-medium mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  style={{ backgroundColor: brand.card, borderColor: brand.border, color: brand.text }}
                  className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 transition-colors"
                />
              </div>
              <div>
                <label style={{ color: brand.textMuted }} className="block text-sm font-medium mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  style={{ backgroundColor: brand.card, borderColor: brand.border, color: brand.text }}
                  className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 transition-colors"
                />
              </div>
              <div>
                <label style={{ color: brand.textMuted }} className="block text-sm font-medium mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  style={{ backgroundColor: brand.card, borderColor: brand.border, color: brand.text }}
                  className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 transition-colors"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}

              <button
                type="submit"
                disabled={formSubmitting}
                style={{ backgroundColor: brand.primary }}
                className="w-full text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {formSubmitting ? 'Sending...' : copy.contactSubmitText}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: brand.header }} className="py-8 px-6">
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
