# Templates System Progress

> Session: February 3-4, 2026

## Overview

This session focused on building out the templatized frontend system for the multi-tenant agency platform. The goal is to allow rapid spin-up of white-labeled gym websites with configurable branding, copy, and features.

---

## Completed Work

### 1. Membership Signup Template

Created a complete multi-step membership signup flow at `/public/[slug]/signup`.

**Components Built:**
- `app/public/[slug]/signup/[[...step]]/page.tsx` - Server page with config resolution
- `app/public/[slug]/signup/client.tsx` - Main client component with step management
- `app/public/[slug]/signup/steps/step-indicator.tsx` - Progress bar component
- `app/public/[slug]/signup/steps/step-2-personal.tsx` - Personal info collection
- `app/public/[slug]/signup/steps/step-3-plans.tsx` - Plan selection with pricing cards
- `app/public/[slug]/signup/steps/step-4-member-info.tsx` - Address and demographics
- `app/public/[slug]/signup/steps/step-5-payment.tsx` - Payment and terms acceptance
- `app/public/[slug]/signup/steps/step-6-confirmation.tsx` - Success confirmation
- `app/public/[slug]/signup/steps/sidebar-summary.tsx` - Reusable order summary sidebar

**Features:**
- URL-based step navigation (`/signup/2`, `/signup/3`, etc.)
- Configurable plans with pricing, benefits, and promo notes
- Configurable policies with dynamic links
- SMS consent checkbox (feature flagged)
- Promo code input (feature flagged)
- Client-side form validation
- Mobile-responsive design matching booking form aesthetic

### 2. Signup Configuration System

**Types Added** (`app/_lib/types/index.ts`):
- `SignupConfig` - Root signup configuration
- `SignupPlan` - Individual plan definition
- `SignupCopyConfig` - All signup-specific copy
- `SignupClubInfo` - Club details for display
- `SignupPricingDetail` - Detailed pricing breakdown
- `SignupPaymentDetails` - Payment summary configuration
- `SignupPolicies` - Terms, privacy, billing links
- `SignupFeatures` - Feature toggles

**Defaults Added** (`app/_lib/config/defaults.ts`):
- `DEFAULT_SIGNUP_COPY`
- `DEFAULT_SIGNUP_CLUB`
- `DEFAULT_SIGNUP_FEATURES`
- `DEFAULT_SIGNUP_POLICIES`
- `EXAMPLE_SIGNUP_PLAN`
- `DEFAULT_SIGNUP_CONFIG`

**Config Service** (`app/_lib/config/workspace-config.service.ts`):
- Added `resolveForSignup()` method
- Merges workspace overrides with global defaults
- Returns fully resolved signup configuration

### 3. Form Registry Updates

Made the form registry generic and workspace-agnostic:

```typescript
// Before
{ id: 'sportswest-booking', name: 'Sports West Booking', ... }

// After
{ id: 'magic-link-booking', name: 'ABC Appointment Booking', ... }
{ id: 'membership-signup', name: 'Membership Signup', ... }
```

**Updated References:**
- `app/api/v1/booking/create/route.ts`
- `app/_lib/workflow/index.ts`
- `app/_lib/booking/get-provider.ts`

### 4. RevLine Config Editor Improvements

**Tab Reorganization:**
- Old: Settings | Forms | Branding | Copy | Signup
- New: Settings | Forms | Branding | Build

The "Build" tab now contains form-specific configuration:
- Dropdown to select which form to configure
- Booking forms show copy fields
- Signup forms show copy + full signup configuration

**Preview Enhancements:**
- Added form selector dropdown in preview panel header
- Preview only refreshes on explicit save (not on every keystroke)
- Added prominent "Unsaved changes" indicator with pulsing dot
- Preview auto-refreshes after successful save

**Technical Details:**
- `saveVersion` prop tracks successful saves
- `originalValueRef` tracks saved state for comparison
- Hydration-safe mounting pattern for dynamic styles

### 5. Template Copy Schemas

Added dynamic form field generation for signup copy in the config editor:

```typescript
// app/_lib/templates/schemas.ts
export const SIGNUP_COPY_SCHEMA: TemplateCopySchema = {
  templateId: 'membership-signup',
  fields: [
    { key: 'pageTitle', label: 'Page Title', ... },
    { key: 'pageSubtitle', label: 'Page Subtitle', ... },
    // ... all configurable copy fields
  ]
};
```

---

## Architecture Decisions

### Config Resolution Cascade
```
Global Defaults → Workspace Overrides → Resolved Config
```

Each template type has its own default set that gets merged with workspace-specific overrides stored in RevLine integration meta.

### Form Registry Pattern
Forms are registered centrally with:
- Unique ID (used as key in config)
- Display name and description
- URL path template
- Type classification (booking, signup, etc.)
- Associated workflow triggers

### Preview Refresh Strategy
- **Problem**: Preview was reloading on every keystroke, causing poor UX
- **Solution**: Track `saveVersion` that only increments on successful save; preview watches this to know when to refresh

---

## Files Modified

| File | Changes |
|------|---------|
| `app/_lib/types/index.ts` | Added signup types |
| `app/_lib/config/defaults.ts` | Added signup defaults |
| `app/_lib/config/workspace-config.service.ts` | Added `resolveForSignup()` |
| `app/_lib/config/index.ts` | Re-exported new types/defaults |
| `app/_lib/templates/schemas.ts` | Added `SIGNUP_COPY_SCHEMA` |
| `app/_lib/templates/index.ts` | Exported new schema |
| `app/_lib/forms/registry.ts` | Made generic, added signup form |
| `app/(dashboard)/workspaces/[id]/revline-config-editor.tsx` | Reorganized tabs, added save tracking |
| `app/(dashboard)/workspaces/[id]/integration-actions.tsx` | Added `saveVersion` state |
| `app/(dashboard)/workspaces/[id]/workspace-tabs.tsx` | Fixed hydration error |

---

## Next Steps

### Immediate
- [ ] Wire signup form to ABC Ignite API for actual member creation
- [ ] Add server-side validation for signup submissions
- [ ] Implement Stripe payment processing integration

### Future
- [ ] Full website template (landing pages, about, contact)
- [ ] Custom domain routing via `proxy.ts`
- [ ] Domain verification (TXT record)
- [ ] Image upload/hosting for logos
- [ ] Organization/team support for agency scaling

---

## Testing Notes

To test the signup flow:
1. Enable `membership-signup` form in RevLine config
2. Configure at least one plan in the signup config
3. Visit `/public/{workspace-slug}/signup`
4. Walk through all steps (currently mocked submission)

Preview in editor:
1. Open workspace → Integrations → RevLine → Configure
2. Go to Build tab, select "Membership Signup"
3. Use preview panel dropdown to switch between forms
4. Save to see changes reflected in preview
