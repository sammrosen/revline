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
   MAILERLITE_GROUP_ID=your_default_group_id_here
   
   # Add group IDs for each source/client (optional)
   MAILERLITE_GROUP_ID_DEMO=demo_group_id_here
   MAILERLITE_GROUP_ID_FIT1=fit1_group_id_here
   # Add more as needed: MAILERLITE_GROUP_ID_CLIENTNAME=group_id
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
import EmailCapture from '@/app/_components/EmailCapture';

// Simple inline form (uses default group)
<EmailCapture 
  buttonText="Get Early Access"
  placeholder="Enter your email"
/>

// Stacked form with name collection and custom source
<EmailCapture 
  buttonText="Join Waitlist"
  placeholder="Your email address"
  collectName={true}
  namePlaceholder="Your name"
  source="demo"
  inline={false}
/>
```

**Props:**
- `buttonText` (optional) - CTA button text, default: "Subscribe"
- `placeholder` (optional) - Email input placeholder, default: "Enter your email"
- `collectName` (optional) - Show name field, default: false
- `namePlaceholder` (optional) - Name input placeholder, default: "Your name"
- `source` (optional) - Source identifier (e.g., "demo", "fit1") for segmentation, defaults to "DEFAULT"
- `inline` (optional) - Horizontal layout (true) or stacked (false), default: true
- `className` (optional) - Additional CSS classes for the container

The component handles:
- Email validation
- Loading states
- Success/error messages
- Duplicate subscriber detection
- Auto-reset after 5 seconds

**Adding New Sources/Clients:**

To add a new source for email segmentation:

1. Create a new group in MailerLite (e.g., "Client - NewClient")
2. Add the group ID to your `.env.local`:
   ```bash
   MAILERLITE_GROUP_ID_NEWCLIENT=new_client_group_id
   ```
3. Add the mapping to `app/_config/mailerlite.ts`:
   ```typescript
   export const GROUP_ID_MAP: Record<string, string | undefined> = {
     DEFAULT: process.env.MAILERLITE_GROUP_ID,
     DEMO: process.env.MAILERLITE_GROUP_ID_DEMO,
     FIT1: process.env.MAILERLITE_GROUP_ID_FIT1,
     NEWCLIENT: process.env.MAILERLITE_GROUP_ID_NEWCLIENT, // Add this line
   };
   ```
4. Use in your landing page:
   ```tsx
   <EmailCapture source="newclient" buttonText="Subscribe" />
   ```

The source identifier is case-insensitive and mapped server-side, keeping your group IDs secure.

### Stripe (Payments & Webhooks)

This project includes a Stripe webhook integration that automatically adds paying customers to MailerLite groups, triggering onboarding automations.

**Key Feature:** Support for multiple products per Stripe account using metadata-based routing.

---

#### Quick Start: Single Product Setup

**1. Create Stripe Payment Link**
- Go to [Stripe Dashboard → Payment Links](https://dashboard.stripe.com/payment-links)
- Click "Create payment link"
- Configure your product and pricing
- Click "Create link"

**2. Configure Webhook**
In Stripe Dashboard:
- Navigate to: **Developers → Webhooks → Add endpoint**
- Webhook URL: `https://yourdomain.com/api/stripe-webhook?source=sam`
  - Replace `sam` with your unique source identifier
- Events to send: Select **`checkout.session.completed`**
- Click "Add endpoint"
- **Copy the webhook signing secret** (starts with `whsec_`)

**3. Add Environment Variables**

Add to `.env.local`:
```bash
MAILERLITE_API_KEY=your_mailerlite_api_key
MAILERLITE_CUSTOMER_GROUP_SAM=your_customer_group_id
STRIPE_WEBHOOK_SECRET_SAM=whsec_your_signing_secret
```

**4. Update Config File**

Add to `app/_config/mailerlite.ts`:
```typescript
export const CUSTOMER_GROUP_MAP: Record<string, string | undefined> = {
  SAM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM,
  // Add more as needed
};
```

**5. Create MailerLite Automation**
- In MailerLite → Automations → Create new
- Trigger: **"Subscriber joins a group"**
- Select your customer group (e.g., "Customer - Sam")
- Add email sequence for onboarding

**6. Use on Landing Page**
```tsx
<a href="https://buy.stripe.com/your-link-here">Buy Now</a>
```

✅ Done! When someone purchases, they'll automatically be added to MailerLite and receive your onboarding emails.

---

#### Advanced: Multiple Products Per Stripe Account

If you have multiple products/programs in one Stripe account (e.g., FIT1, Premium, Demo), use **Stripe metadata** to route customers to different MailerLite groups.

**Scenario:** You're Sam and offer 3 programs:
- FIT1 Program
- Premium Coaching
- Demo/Trial

Each should trigger different onboarding emails in MailerLite.

**Step 1: Add Metadata to Stripe Payment Links**

When creating each Payment Link in Stripe:

1. Scroll to **"Additional options"** or **"Metadata"** section
2. Add custom field:
   - Key: `program`
   - Value: `fit1` (or `premium`, `demo`, etc.)

Repeat for each product with its unique program identifier.

**Step 2: Create MailerLite Groups for Each Program**

Create separate groups:
- "Customer - Sam - FIT1"
- "Customer - Sam - Premium"
- "Customer - Sam - Demo"

Note each group ID.

**Step 3: Configure Environment Variables**

```bash
# General catch-all (optional fallback)
MAILERLITE_CUSTOMER_GROUP_SAM=general_customer_group_id

# Program-specific groups
MAILERLITE_CUSTOMER_GROUP_SAM_FIT1=fit1_group_id
MAILERLITE_CUSTOMER_GROUP_SAM_PREMIUM=premium_group_id
MAILERLITE_CUSTOMER_GROUP_SAM_DEMO=demo_group_id

# Webhook secret (same for all products from this Stripe account)
STRIPE_WEBHOOK_SECRET_SAM=whsec_your_secret
```

**Step 4: Update Config File**

Add to `app/_config/mailerlite.ts`:
```typescript
export const CUSTOMER_GROUP_MAP: Record<string, string | undefined> = {
  SAM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM,           // Fallback
  SAM_FIT1: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_FIT1,      // Program-specific
  SAM_PREMIUM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_PREMIUM,
  SAM_DEMO: process.env.MAILERLITE_CUSTOMER_GROUP_SAM_DEMO,
};
```

**Step 5: Configure Webhook (Same as Before)**
- URL: `https://yourdomain.com/api/stripe-webhook?source=sam`
- Event: `checkout.session.completed`
- One webhook handles all products!

**How It Works:**

```
Customer buys "FIT1 Program" (metadata: program=fit1)
    ↓
Stripe webhook → /api/stripe-webhook?source=sam
    ↓
System reads: source=sam + metadata.program=fit1
    ↓
Maps to: MAILERLITE_CUSTOMER_GROUP_SAM_FIT1
    ↓
Adds to "Customer - Sam - FIT1" group
    ↓
FIT1-specific automation triggers
    ↓
Customer receives FIT1 onboarding emails
```

**Fallback Behavior:**
- If `program` metadata exists → uses `SOURCE_PROGRAM` group
- If that group doesn't exist → falls back to `SOURCE` group
- If neither exist → returns error (check your config)

---

#### Multi-Trainer Setup (Each Trainer = Separate Stripe Account)

When working with multiple trainers who each have their own Stripe account:

**For Each Trainer:**

1. **Create MailerLite Groups:**
   ```
   - "Customer - TrainerName"
   - "Customer - TrainerName - FIT1" (if multiple products)
   ```

2. **Add Environment Variables:**
   ```bash
   MAILERLITE_CUSTOMER_GROUP_TRAINERNAME=trainer_customer_group_id
   MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_FIT1=trainer_fit1_group_id
   STRIPE_WEBHOOK_SECRET_TRAINERNAME=whsec_from_trainer_stripe
   ```

3. **Update Config:**
   ```typescript
   export const CUSTOMER_GROUP_MAP: Record<string, string | undefined> = {
     TRAINERNAME: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINERNAME,
     TRAINERNAME_FIT1: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_FIT1,
   };
   ```

4. **Trainer Configures Webhook in Their Stripe:**
   - URL: `https://yourdomain.com/api/stripe-webhook?source=trainername`
   - Event: `checkout.session.completed`
   - Trainer gives you their webhook signing secret

5. **Create Trainer-Specific MailerLite Automations**

---

#### Testing Your Stripe Integration

##### Option 1: Stripe CLI (Local Testing)

Install [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# Login to Stripe
stripe login

# Forward webhooks to your local dev server
stripe listen --forward-to localhost:3000/api/stripe-webhook?source=sam

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

**With Metadata:**
```bash
stripe trigger checkout.session.completed --override metadata.program=fit1
```

Watch your terminal for webhook logs!

##### Option 2: Test Mode Payment Links

1. Create a **test mode** Payment Link in Stripe
2. Add metadata: `program=fit1` (for testing program routing)
3. Complete a purchase using [Stripe test card](https://stripe.com/docs/testing):
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. Check MailerLite to confirm the subscriber was added to the correct group

##### Option 3: Production Testing

1. Create a $0.50 or $1 product for testing
2. Add metadata for program routing
3. Complete real purchase
4. Verify in MailerLite
5. Check MailerLite automation triggered

---

#### Troubleshooting

**"Webhook Error: Invalid signature"**
- ✅ Double-check your `STRIPE_WEBHOOK_SECRET_SOURCE` matches Stripe Dashboard
- ✅ Ensure secret starts with `whsec_`
- ✅ Verify the source parameter matches: `?source=sam` → `STRIPE_WEBHOOK_SECRET_SAM`

**"No group ID configured for source"**
- ✅ Check `app/_config/mailerlite.ts` includes your source
- ✅ Verify environment variable exists and is spelled correctly
- ✅ Restart dev server after adding new env vars

**Customer not appearing in MailerLite**
- ✅ Check webhook logs in terminal for errors
- ✅ Verify `MAILERLITE_API_KEY` is correct
- ✅ Confirm customer group ID is correct in MailerLite
- ✅ Check Stripe webhook delivery status in Dashboard

**Program-specific routing not working**
- ✅ Verify metadata key is exactly `program` (lowercase)
- ✅ Check config has `SOURCE_PROGRAM` format: `SAM_FIT1`
- ✅ Environment variable format: `MAILERLITE_CUSTOMER_GROUP_SAM_FIT1`
- ✅ Watch webhook logs - they show which group was selected

**Automation not triggering in MailerLite**
- ✅ Confirm subscriber was added to correct group (check MailerLite)
- ✅ Verify automation is "Active" in MailerLite
- ✅ Check automation trigger is set to "Subscriber joins group"
- ✅ Ensure correct group is selected in automation settings

---

#### Webhook Logs

The webhook handler logs detailed information to help with debugging:

```
Processing checkout for customer@example.com from: sam/fit1
Using program-specific group: SAM_FIT1
Successfully added customer@example.com to MailerLite group for sam/fit1
```

Watch your terminal (or Vercel logs in production) for these messages.

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
# MailerLite API Configuration
MAILERLITE_API_KEY=your_mailerlite_api_key

# MailerLite Lead Capture Groups (for email forms)
MAILERLITE_GROUP_ID=your_default_lead_group_id
MAILERLITE_GROUP_ID_DEMO=demo_lead_group_id
MAILERLITE_GROUP_ID_FIT1=fit1_lead_group_id

# MailerLite Customer Groups (for Stripe purchases)
# Source-level groups
MAILERLITE_CUSTOMER_GROUP_SAM=sam_customer_group_id
MAILERLITE_CUSTOMER_GROUP_DEMO=demo_customer_group_id

# Program-specific groups (for multiple products per source)
MAILERLITE_CUSTOMER_GROUP_SAM_FIT1=sam_fit1_customer_group_id
MAILERLITE_CUSTOMER_GROUP_SAM_PREMIUM=sam_premium_customer_group_id
MAILERLITE_CUSTOMER_GROUP_SAM_DEMO=sam_demo_customer_group_id

# Stripe Webhook Secrets (one per trainer/source)
STRIPE_WEBHOOK_SECRET_SAM=whsec_your_signing_secret
STRIPE_WEBHOOK_SECRET_DEMO=whsec_demo_signing_secret
STRIPE_WEBHOOK_SECRET_FIT1=whsec_fit1_signing_secret
```

**Naming Conventions:**
- **Lead Capture Groups:** `MAILERLITE_GROUP_ID_{SOURCE}` - for people who sign up via email forms
- **Customer Groups:** `MAILERLITE_CUSTOMER_GROUP_{SOURCE}` - for people who complete a purchase
- **Webhook Secrets:** `STRIPE_WEBHOOK_SECRET_{SOURCE}` - for verifying Stripe webhooks

The source identifier is converted to uppercase server-side, so `source="sam"` maps to `MAILERLITE_CUSTOMER_GROUP_SAM`.

**Security Best Practices:**

- **Never commit** `.env.local` to git (already in `.gitignore`)
- **Server-side only:** API keys and webhook secrets are never exposed to the client
- API routes run serverless functions on Vercel - fully secure
- Use separate API keys for dev/staging/production environments
- Set IP restrictions on production API keys for extra security
- Stripe webhook signatures are verified using official Stripe SDK

**Vercel Deployment:**
Add environment variables in Project Settings → Environment Variables

**Rate Limiting:**
- MailerLite allows 120 requests/minute
- Our API route monitors rate limit headers
- Logs warnings when approaching limits
- Returns clear error messages if limit exceeded

## Webhook Architecture

### Flow Overview

```
Customer completes purchase
    ↓
Stripe sends webhook event
    ↓
POST /api/stripe-webhook?source=trainername
    ↓
System verifies webhook signature (Stripe SDK)
    ↓
Extracts customer email from checkout.session.completed
    ↓
Maps source → MailerLite customer group ID (server-side)
    ↓
Adds customer to MailerLite group
    ↓
MailerLite automation triggers (configured in MailerLite UI)
    ↓
Customer receives onboarding emails
```

### Key Components

**1. Webhook Endpoint:** `/api/stripe-webhook/route.ts`
- Accepts Stripe webhook events
- Verifies signature using Stripe SDK
- Extracts source from query parameter
- Maps to correct MailerLite group
- Adds customer to group

**2. MailerLite Helper:** `/app/_lib/mailerlite.ts`
- Reusable functions for MailerLite API
- Handles rate limiting
- Manages duplicate subscribers
- Error handling and logging

**3. Configuration:** `/app/_config/mailerlite.ts`
- Server-side mapping of sources to group IDs
- Two separate maps: lead capture and customers
- Type-safe exports

### Scaling to Multiple Trainers

When adding a new trainer:

1. **Create MailerLite groups:**
   - Lead Group: "Leads - TrainerName" (for email signups)
   - Customer Group: "Customer - TrainerName" (for all purchases)
   - Program Groups (optional): "Customer - TrainerName - FIT1", etc.

2. **Add environment variables:**
   ```bash
   # Lead capture
   MAILERLITE_GROUP_ID_TRAINERNAME=lead_group_id
   
   # Customer groups
   MAILERLITE_CUSTOMER_GROUP_TRAINERNAME=customer_group_id
   MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_FIT1=fit1_customer_group_id
   MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_PREMIUM=premium_customer_group_id
   
   # Webhook secret
   STRIPE_WEBHOOK_SECRET_TRAINERNAME=whsec_xxx
   ```

3. **Update config file** (`app/_config/mailerlite.ts`):
   ```typescript
   export const GROUP_ID_MAP = {
     TRAINERNAME: process.env.MAILERLITE_GROUP_ID_TRAINERNAME,
   };
   
   export const CUSTOMER_GROUP_MAP = {
     TRAINERNAME: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINERNAME,
     TRAINERNAME_FIT1: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_FIT1,
     TRAINERNAME_PREMIUM: process.env.MAILERLITE_CUSTOMER_GROUP_TRAINERNAME_PREMIUM,
   };
   ```

4. **Trainer configures webhook** in their Stripe Dashboard:
   - URL: `https://yourdomain.com/api/stripe-webhook?source=trainername`
   - Event: `checkout.session.completed`
   - Adds metadata (`program=fit1`) to their Payment Links for product routing

5. **Create MailerLite automations** that trigger when subscriber joins each group

**No code changes needed** - fully configuration-based scaling!

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
