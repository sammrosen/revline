/**
 * Zod validation schema for RevlineMeta (pagesConfig).
 *
 * Used at write time (PATCH /pages-config) so invalid data is rejected
 * before it reaches the DB — not silently dropped at read time.
 *
 * Every sub-schema uses .passthrough() so unrecognized keys don't cause
 * hard rejections (forward-compat with new fields).
 */

import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

const httpsOrDataUrl = (maxDataLen: number) =>
  z.string().refine(
    (v) => {
      if (!v) return true;
      if (v.startsWith('data:image/')) return v.length <= maxDataLen;
      try { return new URL(v).protocol === 'https:'; } catch { return false; }
    },
    { message: `Must be an https URL or a data URL under ${Math.round(maxDataLen / 1000)}KB` },
  );

const logoUrl = httpsOrDataUrl(500_000);
const imageUrl = httpsOrDataUrl(2_000_000);

const fontFamily = z.enum(['inter', 'poppins', 'roboto', 'system']);

const BrandingSchema = z.object({
  color1: hexColor.optional(),
  color2: hexColor.optional(),
  color3: hexColor.optional(),
  color4: hexColor.optional(),
  color5: hexColor.optional(),
  logo: logoUrl.optional(),
  fontFamily: fontFamily.optional(),
}).passthrough().optional();

const ThemeMappingSchema = z.object({
  primary: z.number().int().min(1).max(5).optional(),
  primaryHover: z.number().int().min(1).max(5).optional(),
  background: z.number().int().min(1).max(5).optional(),
  card: z.number().int().min(1).max(5).optional(),
  text: z.number().int().min(1).max(5).optional(),
  header: z.number().int().min(1).max(5).optional(),
}).passthrough().optional();

const HeaderStyleSchema = z.object({
  variant: z.enum(['pill', 'plain']).optional(),
  size: z.enum(['sm', 'base', 'lg', 'xl']).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  textSize: z.enum(['xs', 'sm', 'base', 'lg']).optional(),
  textWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
}).passthrough().optional();

const TextRoleStyleSchema = z.object({
  size: z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']).optional(),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
}).passthrough().optional();

const TypographySchema = z.object({
  sectionHeader: TextRoleStyleSchema,
  pageTitle: TextRoleStyleSchema,
  body: TextRoleStyleSchema,
  label: TextRoleStyleSchema,
  caption: TextRoleStyleSchema,
}).passthrough().optional();

const PageStyleOverridesSchema = z.object({
  typography: TypographySchema,
  headerStyle: HeaderStyleSchema,
  logoSize: z.number().min(0.5).max(2).optional(),
}).passthrough().optional();

const LandingFormFieldSchema = z.object({
  id: z.string().min(1).max(30),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'email', 'tel', 'textarea']),
  required: z.boolean().optional(),
  placeholder: z.string().max(80).optional(),
}).passthrough();

const LandingSectionsSchema = z.object({
  hero: z.boolean().optional(),
  services: z.boolean().optional(),
  gallery: z.boolean().optional(),
  footer: z.boolean().optional(),
}).passthrough().optional();

const ServiceSchema = z.object({
  title: z.string().max(60),
  description: z.string().max(200),
  image: imageUrl.optional(),
  ctaLink: z.string().max(200).optional(),
}).passthrough();

const GalleryImageSchema = z.union([
  z.string(),
  z.object({ url: z.string(), position: z.string().optional() }).passthrough(),
]);

const LandingCopySchema = z.object({
  heroHeadline: z.string().max(80).optional(),
  heroSubhead: z.string().max(160).optional(),
  heroCtaText: z.string().max(30).optional(),
  heroCtaLink: z.string().max(200).optional(),
  heroBackgroundImage: imageUrl.optional(),
  heroBackgroundPosition: z.string().max(30).optional(),
  heroBackgroundSize: z.enum(['cover', 'contain']).optional(),
  phoneNumber: z.string().max(20).optional(),
  servicesTitle: z.string().max(60).optional(),
  services: z.array(ServiceSchema).max(12).optional(),
  images: z.array(GalleryImageSchema).max(9).optional(),
  contactTitle: z.string().max(60).optional(),
  contactSubhead: z.string().max(120).optional(),
  contactSubmitText: z.string().max(30).optional(),
  contactSuccessMessage: z.string().max(160).optional(),
  consentText: z.string().max(500).optional(),
  formFields: z.array(LandingFormFieldSchema).max(20).optional(),
  footerText: z.string().max(80).optional(),
  footerEmail: z.string().max(120).optional(),
  sections: LandingSectionsSchema,
}).passthrough().optional();

const BookingCopySchema = z.object({
  headline: z.string().max(80).optional(),
  subhead: z.string().max(160).optional(),
  submitButton: z.string().max(30).optional(),
  successTitle: z.string().max(80).optional(),
  successMessage: z.string().max(200).optional(),
  footerText: z.string().max(80).optional(),
  footerEmail: z.string().max(120).optional(),
}).passthrough().optional();

const SignupCopySchema = z.object({
  stepTitles: z.record(z.string(), z.string().max(60)).optional(),
  smsConsent: z.string().max(500).optional(),
  disclaimer: z.string().max(500).optional(),
  submitButton: z.string().max(30).optional(),
  successTitle: z.string().max(80).optional(),
  successMessage: z.string().max(200).optional(),
  footerText: z.string().max(80).optional(),
  footerEmail: z.string().max(120).optional(),
  headerText: z.string().max(60).optional(),
  headerLink: z.string().max(200).optional(),
}).passthrough().optional();

const PricingDetailSchema = z.object({
  label: z.string().max(60),
  value: z.string().max(30),
  strikethrough: z.string().max(30).optional(),
}).passthrough();

const PaymentDetailsSchema = z.object({
  dueToday: z.number().min(0),
  recurring: z.number().min(0),
  fees: z.number().min(0),
}).passthrough();

const SignupPlanSchema = z.object({
  id: z.string().min(1).max(60),
  abcPaymentPlanId: z.string().max(60).optional(),
  name: z.string().min(1).max(80),
  price: z.number().min(0),
  period: z.enum(['month', 'year']),
  image: imageUrl.optional(),
  benefits: z.array(z.string().max(120)).max(20),
  pricingDetails: z.array(PricingDetailSchema).max(10),
  promoNote: z.string().max(120).optional(),
  disclaimer: z.string().max(500).optional(),
  paymentDetails: PaymentDetailsSchema,
}).passthrough();

const SignupPoliciesSchema = z.object({
  privacy: z.string().max(200).optional(),
  accessibility: z.string().max(200).optional(),
  cancellation: z.string().max(200).optional(),
  terms: z.string().max(200).optional(),
}).passthrough().optional();

const SignupFeaturesSchema = z.object({
  showPromoCode: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
  requireSmsConsent: z.boolean().optional(),
}).passthrough().optional();

const SignupClubSchema = z.object({
  name: z.string().max(80),
  address: z.string().max(120),
  city: z.string().max(60),
  state: z.string().max(10),
  zip: z.string().max(10),
}).passthrough().optional();

const SignupConfigSchema = z.object({
  enabled: z.boolean().optional(),
  club: SignupClubSchema,
  plans: z.array(SignupPlanSchema).max(10).optional(),
  copy: SignupCopySchema,
  policies: SignupPoliciesSchema,
  features: SignupFeaturesSchema,
}).passthrough().optional();

const CopySchema = z.object({
  booking: BookingCopySchema,
  signup: SignupCopySchema,
  landing: LandingCopySchema,
}).passthrough().optional();

const WebchatSchema = z.object({
  agentId: z.string().min(1),
  enabled: z.boolean(),
  collectEmail: z.boolean().optional(),
}).passthrough().optional();

/**
 * Top-level RevlineMeta validation schema.
 * Uses .passthrough() so unknown keys (forms, settings, etc.) are preserved.
 */
export const RevlineMetaSchema = z.object({
  branding: BrandingSchema,
  theme: ThemeMappingSchema,
  headerStyle: HeaderStyleSchema,
  typography: TypographySchema,
  pageStyles: z.record(z.string(), PageStyleOverridesSchema).optional(),
  copy: CopySchema,
  features: z.object({
    showPoweredBy: z.boolean().optional(),
  }).passthrough().optional(),
  signup: SignupConfigSchema,
  webchat: WebchatSchema,
}).passthrough();

/**
 * Estimate the total size of inline data URLs in a pagesConfig blob.
 * Returns bytes (string length, which is close enough for base64).
 */
export function estimateDataUrlBytes(obj: unknown): number {
  if (typeof obj === 'string') {
    return obj.startsWith('data:image/') ? obj.length : 0;
  }
  if (Array.isArray(obj)) {
    return obj.reduce((sum, v) => sum + estimateDataUrlBytes(v), 0);
  }
  if (obj && typeof obj === 'object') {
    return Object.values(obj).reduce((sum: number, v) => sum + estimateDataUrlBytes(v), 0);
  }
  return 0;
}

const MAX_TOTAL_DATA_URL_BYTES = 10_000_000;

/**
 * Validate a pagesConfig payload at write time.
 * Returns { success, data, errors } where errors are field-level messages.
 */
export function validatePagesConfig(raw: unknown): {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: Array<{ path: string; message: string }>;
} {
  if (raw === null) return { success: true, data: undefined };

  const result = RevlineMetaSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const totalBytes = estimateDataUrlBytes(raw);
  if (totalBytes > MAX_TOTAL_DATA_URL_BYTES) {
    return {
      success: false,
      errors: [{
        path: '_images',
        message: `Total image data (${Math.round(totalBytes / 1_000_000)}MB) exceeds ${Math.round(MAX_TOTAL_DATA_URL_BYTES / 1_000_000)}MB limit. Use smaller images or external URLs.`,
      }],
    };
  }

  return { success: true, data: result.data as Record<string, unknown> };
}
