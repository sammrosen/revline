# Marketing Site & Landing Pages

This is a Next.js marketing site built for hosting multiple landing pages over time. Features clean, minimal design aesthetics for different business offerings.

## What This Is

A centralized repo for marketing pages and landing pages. Built with Next.js 16, React 19, and Tailwind CSS v4.

**Current Pages:**
- `/` - Sam Rosen Business (automation systems for small businesses)
  - Ultra-minimal James Smith-style aesthetic
  - Pure black/white with minimal accents
  - Lots of negative space
  - Bold, large typography
  - "Engineered, not hype" vibe
  
- `/fit1` - FIT1 coaching program (elite training + app hybrid)
  - Dark premium fitness aesthetic
  - Zinc color palette
  - Detailed sections with clear hierarchy
  - Testimonials, pricing, FAQ structure

## How to Create Multiple Landing Pages

This repo uses Next.js App Router, where each route is defined by folder structure:

### Adding a New Landing Page

1. Create a new folder in `app/`:
   ```
   app/summer-promo/page.tsx  → accessible at /summer-promo
   app/fit2/page.tsx          → accessible at /fit2
   app/challenge/page.tsx     → accessible at /challenge
   ```

2. Copy the structure from `app/page.tsx` as a starting point
3. Customize the content for your new offer
4. Deploy and share the specific URL

### Future Modularity

Right now, pages are self-contained for quick iteration. When you're ready to make it more modular:

- Extract common sections (Hero, CTA, FAQ, Testimonials) into `app/components/`
- Create reusable component props for different content
- Build a section library you can mix and match

## Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS v4** - Utility-first styling
- **TypeScript** - Type safety

## Integrations

This project includes serverless integrations for email capture, payments, and booking that can be used across any landing page.

### MailerLite (Email Capture)

**Setup:**

1. Get your API key from [MailerLite Dashboard](https://dashboard.mailerlite.com/integrations/api)
   - Navigate to Integrations → MailerLite API → Generate new token
   - Give it a descriptive name (e.g., "Landing Page Dev")
   - **Optional but recommended:** Set IP restrictions for added security
   - Store the key securely - it won't be shown again

2. Find your Group/List ID in your MailerLite dashboard under Groups
   - The Group ID is visible in the URL when viewing a group
   - Example: `https://dashboard.mailerlite.com/groups/123456789` → ID is `123456789`

3. Add to `.env.local`:
   ```bash
   MAILERLITE_API_KEY=your_api_key_here
   MAILERLITE_GROUP_ID=your_group_id_here
   ```

**Development & Testing Best Practices:**

MailerLite doesn't have a sandbox/test mode, so follow these practices:

- **Create a Test Group:** Make a dedicated "Test" or "Development" group in MailerLite for development
- **Use Test Emails:** Use your own email addresses or test emails during development
- **Monitor Rate Limits:** API allows 120 requests/minute - our implementation logs warnings
- **Local Testing:** API works on `localhost` - just add your keys to `.env.local` and restart dev server
- **Clean Up:** Regularly clean test subscribers from your development group

**Usage:**

Import and use the `EmailCapture` component anywhere on your landing pages:

```tsx
import EmailCapture from '@/app/components/EmailCapture';

// Simple inline form
<EmailCapture 
  buttonText="Get Early Access"
  placeholder="Enter your email"
/>

// Stacked form with name collection
<EmailCapture 
  buttonText="Join Waitlist"
  placeholder="Your email address"
  collectName={true}
  namePlaceholder="Your name"
  listId="custom_list_id"
  inline={false}
/>
```

**Props:**
- `buttonText` (optional) - CTA button text, default: "Subscribe"
- `placeholder` (optional) - Email input placeholder, default: "Enter your email"
- `collectName` (optional) - Show name field, default: false
- `namePlaceholder` (optional) - Name input placeholder, default: "Your name"
- `listId` (optional) - Override default MailerLite group ID
- `inline` (optional) - Horizontal layout (true) or stacked (false), default: true
- `className` (optional) - Additional CSS classes for the container

The component handles:
- Email validation
- Loading states
- Success/error messages
- Duplicate subscriber detection
- Auto-reset after 5 seconds

### Stripe (Payments)

**Setup:**

1. Create a [Stripe Payment Link](https://dashboard.stripe.com/payment-links) or Checkout Session
2. Copy the URL

**Usage:**

Simply replace the `href="#"` in any button/link with your Stripe URL:

```tsx
// Before (TODO)
<a href="#">Buy Now</a>

// After
<a href="https://buy.stripe.com/your-link-here">Buy Now</a>
```

For test mode, use test payment links. For production, use live payment links.

### Calendly (Booking)

**Setup:**

1. Get your Calendly scheduling link from [Calendly Dashboard](https://calendly.com/)
2. Copy the URL (e.g., `https://calendly.com/yourname/30min`)

**Usage:**

Replace the `href="#"` in any booking button with your Calendly URL:

```tsx
// Before (TODO)
<a href="#">Book a Call</a>

// After
<a href="https://calendly.com/yourname/30min">Book a Call</a>
```

**Advanced:** For embedded Calendly widgets, add the [Calendly embed script](https://help.calendly.com/hc/en-us/articles/223147027-Embed-options-overview) to your page.

### Environment Variables

Required for production deployment:

```bash
MAILERLITE_API_KEY=your_mailerlite_api_key
MAILERLITE_GROUP_ID=your_mailerlite_group_id
```

**Security Best Practices:**

- **Never commit** `.env.local` to git (already in `.gitignore`)
- **Server-side only:** API keys are never exposed to the client
- API routes run serverless functions on Vercel - fully secure
- Use separate API keys for dev/staging/production environments
- Set IP restrictions on production API keys for extra security

**Vercel Deployment:**
Add environment variables in Project Settings → Environment Variables

**Rate Limiting:**
- MailerLite allows 120 requests/minute
- Our API route monitors rate limit headers
- Logs warnings when approaching limits
- Returns clear error messages if limit exceeded

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site.

The page auto-updates as you edit files.

## TODO Items in Code

Search for `TODO` comments in the code to find places that need updating:

**Root Page (/) - Automation Business:**
- Replace `/demo` with actual demo page route (when built)
- Replace `href="#"` with Calendly booking link for "Work With Me" button
- Add real client testimonials when available

**FIT1 Page (/fit1) - Coaching:**
- Replace `href="#"` with actual Calendly booking link
- Replace `href="#"` with checkout/payment link
- Update email address from `coach@example.com`
- Add real testimonials and coach bio
- Update pricing if needed

## Deployment

Deploy to Vercel:

```bash
npm run build
```

Or push to GitHub and connect to Vercel for automatic deployments.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more options.
