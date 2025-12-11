# Client Onboarding Protocol
## Landing Page + Automation System Setup

This is the complete step-by-step protocol for onboarding a new client and building their automated landing page system.

---

## Phase 1: Discovery & Planning (30-60 minutes)

### 1.1 Initial Client Consultation

**Information to Collect:**
- [ ] Client name and business name
- [ ] Primary offer/service/product
- [ ] Target audience and pain points
- [ ] Existing brand colors, fonts, style preferences
- [ ] Existing marketing assets (logos, images, copy)
- [ ] Current tools they're using (if any)

**Business Model Questions:**
- [ ] How do they currently capture leads?
- [ ] How do they nurture leads (email, DM, phone)?
- [ ] How do they book calls/appointments?
- [ ] How do they collect payment?
- [ ] What does their onboarding process look like?

**Define Automation Goals:**
- [ ] Lead capture → Email list
- [ ] Automated nurture sequence
- [ ] Booking automation (Calendly)
- [ ] Payment automation (Stripe)
- [ ] Onboarding automation (email sequence)
- [ ] ManyChat integration (comment/DM capture)

**Project Deliverables Agreement:**
- [ ] Landing page design direction (minimal/bold or premium/detailed)
- [ ] Number of sections/pages needed
- [ ] Timeline expectations
- [ ] Launch date target

---

## Phase 2: Infrastructure Setup (30-45 minutes)

### 2.1 MailerLite Configuration

**Create Groups:**
1. Log into MailerLite dashboard
2. Navigate to **Groups** → **Create Group**
3. Create the following groups:

```
Format: [Type] - [Client Name] - [Optional: Program/Product]

Lead Capture Groups (for email forms):
- "Leads - ClientName"
- "Leads - ClientName - Demo" (if offering demo)
- "Leads - ClientName - Program1" (if multiple funnels)

Customer Groups (for Stripe purchases):
- "Customer - ClientName"
- "Customer - ClientName - Program1" (for specific products)
- "Customer - ClientName - Program2" (for additional products)
```

4. **Note the Group IDs** (visible in URL when viewing group):
   ```
   https://dashboard.mailerlite.com/groups/123456789
   Group ID = 123456789
   ```

**Create Automations:**
1. Navigate to **Automations** → **Create Workflow**

**For Lead Capture (Email Signups):**
- Trigger: "Subscriber joins a group" → Select: "Leads - ClientName"
- Add welcome email (introduce yourself/business)
- Add nurture sequence (2-5 emails over 7-14 days)
- Include clear CTA to book a call (Calendly link)
- Consider: Problem awareness → Solution → Social proof → CTA progression

**For Customers (Post-Purchase):**
- Trigger: "Subscriber joins a group" → Select: "Customer - ClientName"
- Send immediate onboarding email with:
  - Welcome message
  - What to expect next
  - Access credentials (if applicable)
  - Next steps / action items
  - Support contact info
- Add follow-up sequence (check-ins, resources, engagement)

**Tips:**
- Set automations to "Active" when ready to go live
- Test automations by manually adding yourself to groups
- Use merge tags: `{$name}`, `{$email}` for personalization
- Keep initial emails simple and action-oriented

### 2.2 Stripe Setup (If Payments Needed)

**Client's Stripe Account:**
1. Ensure client has Stripe account created
2. Get client to log into [Stripe Dashboard](https://dashboard.stripe.com/)

**Create Product & Payment Link:**
1. Navigate to **Products** → **Add Product**
2. Fill in product details:
   - Name: e.g., "FIT1 - 12 Week Program"
   - Description
   - Pricing: One-time or subscription
3. Navigate to **Payment Links** → **Create Payment Link**
4. Select the product
5. **Add Metadata** (IMPORTANT for multi-product routing):
   - Click "Additional Options" → "Add metadata"
   - Key: `program`
   - Value: `fit1` (or unique identifier for this product)
6. Customize success page message
7. **Copy the payment link** (e.g., `https://buy.stripe.com/test_xxxxx`)

**Configure Webhook:**
1. Navigate to **Developers** → **Webhooks** → **Add Endpoint**
2. Endpoint URL: `https://yourdomain.com/api/stripe-webhook?source=clientname`
   - Replace `clientname` with unique identifier (lowercase, no spaces)
   - Example: `?source=johnsmith` or `?source=fitcoach`
3. Events to send: Select **`checkout.session.completed`**
4. Click **Add Endpoint**
5. **Copy the Webhook Signing Secret** (starts with `whsec_`)
   - This is shown only once! Store it securely.

**Test Mode vs Live Mode:**
- Start with **Test Mode** for development
- Switch to **Live Mode** for production
- Each mode has separate webhook secrets
- Test with card: `4242 4242 4242 4242`, any future date, any CVC

### 2.3 Calendly Setup

**Get Booking Link:**
1. Client logs into [Calendly](https://calendly.com/)
2. Find or create event type (e.g., "30 Minute Discovery Call")
3. Copy the scheduling URL:
   ```
   https://calendly.com/clientname/30min
   ```
4. **Optional:** Configure Calendly integrations:
   - Email reminders (24hr, 1hr before)
   - Add to Google Calendar
   - Zoom/Google Meet auto-generation

### 2.4 Environment Variables Setup

**For Development (.env.local):**
```bash
# MailerLite Configuration
MAILERLITE_API_KEY=your_mailerlite_api_key_here

# Lead Capture Groups (email forms)
MAILERLITE_GROUP_ID_CLIENTNAME=lead_group_id_here
MAILERLITE_GROUP_ID_CLIENTNAME_DEMO=demo_lead_group_id_here

# Customer Groups (Stripe purchases)
MAILERLITE_CUSTOMER_GROUP_CLIENTNAME=customer_group_id_here
MAILERLITE_CUSTOMER_GROUP_CLIENTNAME_PROGRAM1=program1_customer_group_id_here

# Stripe Webhook Secrets
STRIPE_WEBHOOK_SECRET_CLIENTNAME=whsec_test_xxxxxx
```

**Naming Convention:**
- Client identifier: Lowercase, no spaces, underscores OK
- Examples: `johnsmith`, `fit_coach`, `sarah_wellness`
- Environment variable: Uppercase conversion happens automatically

**For Production (Vercel/Hosting):**
- Add same variables in deployment platform
- Use **Live Mode** credentials for Stripe
- Double-check all IDs match production values

---

## Phase 3: Landing Page Development (2-4 hours)

### 3.1 Create Landing Page Route

**Decide on URL Structure:**
```
Option 1: Root domain (primary offering)
app/page.tsx → https://clientdomain.com/

Option 2: Subdirectory (specific campaign)
app/fit1/page.tsx → https://clientdomain.com/fit1

Option 3: Subdomain (when you build it)
fit1.clientdomain.com → Vercel/DNS configuration required
```

### 3.2 Choose Design Template

**Two Main Styles Available:**

**Option A: Minimal/Bold (Sam Rosen Style)**
- Use `app/page.tsx` as reference
- Pure black/white aesthetic
- Large typography (5xl-8xl headings)
- Lots of negative space
- Subtle hover effects
- Best for: High-ticket services, consulting, automation, B2B

**Option B: Premium/Detailed (FIT1 Style)**
- Use `app/fit1/page.tsx` as reference
- Dark zinc palette with gradients
- Detailed feature sections
- Testimonials, FAQ, pricing tables
- Visual hierarchy with icons
- Best for: Coaching programs, courses, community products

### 3.3 Page Structure Checklist

**Essential Sections:**
- [x] **Hero Section**
  - Attention-grabbing headline
  - Clear value proposition
  - Primary CTA (Book Call / Start Demo / Buy Now)
  - Optional: Email capture

- [x] **Problem/Pain Section**
  - Address target audience pain points
  - Build empathy and awareness
  - 3-6 specific problems they face

- [x] **Solution Section**
  - How your system/product solves their problems
  - Key features/benefits (4-6 items)
  - Visual breakdown if applicable

- [x] **How It Works**
  - Step-by-step process (4-6 steps)
  - Clear, numbered flow
  - Removes uncertainty

- [x] **Social Proof** (if available)
  - Client testimonials
  - Results/metrics
  - Case studies
  - "Coming soon" placeholders OK initially

- [x] **About/Story Section**
  - Build credibility
  - Show expertise
  - Humanize the offer

- [x] **Demo Section** (optional but powerful)
  - Interactive demo or video
  - "Experience it yourself" angle
  - Lowers barrier to engagement

- [x] **Final CTA Section**
  - Recap value
  - Clear next step
  - Multiple CTA options (primary + secondary)

- [x] **Footer**
  - Copyright
  - Links (Privacy, Terms, Contact)
  - Social media (optional)

### 3.4 Copy & Content Guidelines

**Headlines:**
- Lead with transformation/outcome
- Use specific language (not generic)
- Examples:
  - ✅ "Stop running your business manually"
  - ✅ "Turn Instagram attention into booked calls — automatically"
  - ❌ "Welcome to my business"
  - ❌ "I can help you succeed"

**Body Copy:**
- Write like you're speaking to ONE person
- Short paragraphs (2-3 sentences max)
- Use "you" language
- Focus on benefits, not features
- Be specific about outcomes

**CTAs:**
- Action-oriented language
- Remove friction
- Examples:
  - "Run The Live Demo" (curiosity)
  - "Book Your Call" (direct)
  - "See How It Works" (low commitment)
  - "Start Now" (urgency)

### 3.5 Integrate Components

**Email Capture Component:**

Add import at top of page:
```tsx
import EmailCapture from '@/app/_components/EmailCapture';
```

Insert component where needed:
```tsx
{/* Hero email capture - inline style */}
<EmailCapture 
  buttonText="Get Early Access"
  placeholder="Enter your email"
  collectName={true}
  namePlaceholder="Your name"
  source="clientname"
  inline={true}
/>

{/* Pre-footer waitlist - stacked style */}
<EmailCapture 
  buttonText="Join Waitlist"
  placeholder="Your email address"
  collectName={true}
  namePlaceholder="Your name"
  source="clientname"
  inline={false}
  className="max-w-md mx-auto"
/>
```

**Book Call CTA:**
Replace placeholder with Calendly link:
```tsx
<a 
  href="https://calendly.com/clientname/30min"
  className="inline-flex items-center justify-center px-10 py-5 text-base font-medium text-zinc-50 border border-zinc-800 hover:border-zinc-700 transition-all duration-300"
>
  Book a Call
</a>
```

**Buy Now CTA:**
Replace with Stripe payment link:
```tsx
<a 
  href="https://buy.stripe.com/xxxxx"
  className="inline-flex items-center justify-center px-12 py-6 text-lg font-medium text-black bg-white hover:bg-zinc-100 transition-all duration-300"
>
  Get Started Now
</a>
```

### 3.6 Update Configuration Files

**Add Client to MailerLite Config:**

Edit `app/_config/mailerlite.ts`:

```typescript
export const GROUP_ID_MAP: Record<string, string | undefined> = {
  DEFAULT: process.env.MAILERLITE_GROUP_ID,
  DEMO: process.env.MAILERLITE_GROUP_ID_DEMO,
  CLIENTNAME: process.env.MAILERLITE_GROUP_ID_CLIENTNAME, // Add this
};

export const CUSTOMER_GROUP_MAP: Record<string, string | undefined> = {
  SAM: process.env.MAILERLITE_CUSTOMER_GROUP_SAM,
  CLIENTNAME: process.env.MAILERLITE_CUSTOMER_GROUP_CLIENTNAME, // Add this
  CLIENTNAME_PROGRAM1: process.env.MAILERLITE_CUSTOMER_GROUP_CLIENTNAME_PROGRAM1, // For multi-product
};
```

**Add Metadata Configuration:**

Edit `app/page.tsx` (or client's page):
```tsx
export const metadata: Metadata = {
  title: 'Client Business Name | Tagline',
  description: 'Clear description of what they offer - optimized for SEO',
};
```

---

## Phase 4: Testing The Full Flow (30-60 minutes)

### 4.1 Local Development Testing

**Start Dev Server:**
```bash
npm run dev
```

**Test Email Capture:**
1. Navigate to the landing page
2. Enter test email (use your own or `test+clientname@yourdomain.com`)
3. Submit form
4. Check terminal for success/error logs
5. **Verify in MailerLite:**
   - Go to Groups → "Leads - ClientName"
   - Confirm subscriber was added
6. Check your email for automation sequence
7. Test with duplicate email (should handle gracefully)

**Test Calendly Link:**
1. Click "Book a Call" CTA
2. Verify it opens Calendly
3. Complete a test booking
4. Confirm email confirmation received

**Test Stripe Payment (Test Mode):**
1. Click payment CTA
2. Use test card: `4242 4242 4242 4242`
3. Complete checkout
4. **Check webhook delivery:**
   - Stripe Dashboard → Developers → Webhooks
   - Click your webhook endpoint
   - View recent deliveries
   - Should show `checkout.session.completed` event
5. **Verify in MailerLite:**
   - Go to Groups → "Customer - ClientName"
   - Confirm customer was added
6. Check for onboarding automation email

### 4.2 Stripe Webhook Testing

**Option 1: Stripe CLI (Recommended)**
```bash
# Install Stripe CLI (first time only)
# Instructions: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local dev
stripe listen --forward-to localhost:3000/api/stripe-webhook?source=clientname

# In another terminal, trigger test event
stripe trigger checkout.session.completed

# With metadata (for program routing)
stripe trigger checkout.session.completed --override metadata.program=program1
```

**Option 2: Manual Test Purchase**
- Create $0.50 test product
- Complete test purchase
- Verify end-to-end flow

### 4.3 Automation Testing Checklist

**Lead Capture Flow:**
- [ ] Email form submits successfully
- [ ] Subscriber added to correct MailerLite group
- [ ] Welcome email received within 1-2 minutes
- [ ] Nurture sequence triggers on schedule
- [ ] Calendly link in emails works
- [ ] Error handling works (invalid email, duplicate)

**Purchase Flow:**
- [ ] Payment link opens Stripe checkout
- [ ] Test card completes successfully
- [ ] Webhook fires and is verified (check Stripe dashboard)
- [ ] Customer added to MailerLite customer group
- [ ] Onboarding email received immediately
- [ ] Customer removed from lead group (if desired - manual or automation)

**Edge Cases:**
- [ ] Already subscribed email (should show friendly message)
- [ ] Rate limiting (if hitting API limits)
- [ ] Failed payment (Stripe shows error, no MailerLite action)
- [ ] Invalid group ID (check terminal logs for errors)

---

## Phase 5: Deployment (20-30 minutes)

### 5.1 Pre-Deployment Checklist

**Code Review:**
- [ ] Replace all `TODO` comments with real content
- [ ] Update placeholder links (Calendly, Stripe, demo pages)
- [ ] Replace example email addresses
- [ ] Add real testimonials (or remove section)
- [ ] Update footer links and copyright
- [ ] Check all copy for typos/accuracy

**Environment Variables:**
- [ ] Production environment variables added to hosting platform
- [ ] All `_TEST` or test mode secrets replaced with live mode
- [ ] Group IDs match production MailerLite account
- [ ] Webhook secrets from **Live Mode** Stripe

**Final Checks:**
- [ ] Build succeeds locally: `npm run build`
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)
- [ ] Forms work correctly
- [ ] All links open correct destinations

### 5.2 Vercel Deployment (Recommended)

**Initial Setup:**
1. Push code to GitHub repository
2. Log into [Vercel](https://vercel.com/)
3. Click "Add New Project"
4. Import GitHub repository
5. Configure project:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `next build`
   - Output Directory: `.next`

**Environment Variables:**
1. In project settings → Environment Variables
2. Add all production variables:
   - `MAILERLITE_API_KEY`
   - `MAILERLITE_GROUP_ID_CLIENTNAME`
   - `MAILERLITE_CUSTOMER_GROUP_CLIENTNAME`
   - `STRIPE_WEBHOOK_SECRET_CLIENTNAME` (Live Mode)
3. Click "Deploy"

**Domain Setup:**
1. In project settings → Domains
2. Add custom domain: `clientdomain.com`
3. Follow DNS configuration instructions
4. Wait for SSL certificate (automatic)

### 5.3 Update Stripe Webhook URL

**IMPORTANT: Update webhook to production URL**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your webhook endpoint
3. Update URL to: `https://clientdomain.com/api/stripe-webhook?source=clientname`
4. Verify signing secret matches environment variable
5. Test webhook with live payment (small amount)

### 5.4 Switch Stripe to Live Mode

**When ready to accept real payments:**
1. Stripe Dashboard → Toggle "Test Mode" OFF (top right)
2. Verify products are created in Live Mode
3. Recreate payment links in Live Mode (test links don't work in live)
4. Update payment link URLs on landing page
5. **Get new webhook signing secret** (Live Mode is different from Test)
6. Update `STRIPE_WEBHOOK_SECRET_CLIENTNAME` in Vercel

---

## Phase 6: Client Handoff (15-30 minutes)

### 6.1 Walkthrough Demo

**Show Client:**
1. **Landing Page Tour**
   - Walk through each section
   - Show CTAs and links
   - Demonstrate mobile view

2. **Admin Tour:**
   - MailerLite dashboard overview
   - How to view subscribers
   - How to see automation performance
   - How to send manual broadcasts

3. **Stripe Dashboard:**
   - How to view payments
   - How to issue refunds (if needed)
   - Where to see customer info
   - Webhook delivery logs (for debugging)

4. **Calendly:**
   - How to manage bookings
   - How to reschedule
   - How to adjust availability

### 6.2 Documentation Handoff

**Provide Client With:**
- [ ] Login credentials (MailerLite, Stripe, Calendly, hosting)
- [ ] URL to live landing page
- [ ] Link to this onboarding document
- [ ] FAQ/troubleshooting guide
- [ ] Contact info for support

**Create Simple Client Guide:**
```markdown
# Your Landing Page - Quick Reference

## URLs
- Landing Page: https://yourdomain.com
- MailerLite: https://dashboard.mailerlite.com
- Stripe: https://dashboard.stripe.com
- Calendly: https://calendly.com

## How to View New Leads
1. Log into MailerLite
2. Go to Groups → "Leads - YourName"
3. See all new subscribers

## How to View Customers
1. Log into MailerLite
2. Go to Groups → "Customer - YourName"
3. OR check Stripe Dashboard for payments

## How to Edit Email Automations
1. Log into MailerLite
2. Go to Automations
3. Click on automation name
4. Edit emails, timing, or content
5. Save changes (they take effect immediately)

## How to Update Landing Page Content
Contact [Your Name] at [Your Email]

## Troubleshooting
- Subscribers not being added? Check MailerLite API status
- Webhooks not firing? Check Stripe webhook delivery logs
- Questions? Email [support@yourdomain.com]
```

### 6.3 Post-Launch Monitoring (First 48 Hours)

**Monitor:**
- [ ] First email signup (test the flow)
- [ ] First real purchase (verify webhook fires)
- [ ] First automation emails sent
- [ ] Stripe webhook delivery success rate
- [ ] Any error logs in Vercel

**Common Issues:**
- Webhook signature mismatch → Check secret matches
- Subscriber not added → Check group ID is correct
- Automation not triggering → Verify automation is "Active"
- Payment link broken → Ensure using Live Mode links

---

## Phase 7: Optimization & Iteration (Ongoing)

### 7.1 Week 1 Review

**Metrics to Check:**
- Landing page traffic (Vercel analytics)
- Email signup conversion rate
- Email open rates (MailerLite)
- Booking conversion rate (Calendly)
- Payment conversion rate (Stripe)

**Optimization Opportunities:**
- A/B test headlines
- Adjust CTA copy/placement
- Refine email sequence timing
- Add more social proof

### 7.2 Scaling Considerations

**When Client Wants to Add:**

**New Product/Program:**
1. Create new MailerLite group: "Customer - ClientName - NewProgram"
2. Add env var: `MAILERLITE_CUSTOMER_GROUP_CLIENTNAME_NEWPROGRAM`
3. Update config file mapping
4. Create Stripe payment link with metadata: `program=newprogram`
5. Build new landing page (optional) or add to existing
6. Create dedicated automation in MailerLite

**Multiple Landing Pages:**
- Follow structure in `app/` for new routes
- Example: `app/clientname/summer-promo/page.tsx`
- Reuse EmailCapture component with different `source` values
- Each page can have unique MailerLite group

**White Label for Multiple Clients:**
- Separate MailerLite groups per client
- Separate Stripe webhooks per client (different accounts)
- Unique `source` parameter for each client
- Centralized config makes this clean

---

## Quick Reference Checklist

### New Client Onboarding Speedrun

**Pre-Development (Infrastructure):**
- [ ] Client consultation completed
- [ ] MailerLite groups created (Lead + Customer)
- [ ] MailerLite automations built (Welcome + Nurture + Onboarding)
- [ ] Stripe product created
- [ ] Stripe payment link created with metadata
- [ ] Stripe webhook configured (test mode)
- [ ] Calendly link obtained
- [ ] Environment variables added to `.env.local`

**Development:**
- [ ] Created landing page route
- [ ] Chose design template
- [ ] Wrote copy for all sections
- [ ] Integrated EmailCapture component
- [ ] Added Calendly link to CTAs
- [ ] Added Stripe payment link to CTAs
- [ ] Updated `_config/mailerlite.ts` with client mappings
- [ ] Set page metadata (title, description)

**Testing:**
- [ ] Local email capture works
- [ ] MailerLite receives test subscriber
- [ ] Email automation triggers
- [ ] Stripe test payment works
- [ ] Webhook fires successfully
- [ ] Customer added to MailerLite
- [ ] Onboarding email received
- [ ] Calendly booking works

**Deployment:**
- [ ] Code pushed to GitHub
- [ ] Vercel project created and deployed
- [ ] Production environment variables added
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Stripe webhook URL updated to production
- [ ] Stripe switched to Live Mode (when ready)
- [ ] Live payment tested

**Handoff:**
- [ ] Client walkthrough completed
- [ ] Client documentation provided
- [ ] Credentials shared securely
- [ ] First 48hr monitoring complete
- [ ] No errors or issues detected

---

## Troubleshooting Guide

### Email Capture Issues

**Problem:** Form submits but subscriber doesn't appear in MailerLite

**Solutions:**
1. Check terminal/Vercel logs for API errors
2. Verify `MAILERLITE_API_KEY` is correct
3. Verify group ID matches MailerLite dashboard
4. Check MailerLite API status: https://status.mailerlite.com
5. Ensure subscriber isn't in "Unsubscribed" or "Bounced" state

**Problem:** Error: "Server configuration error"

**Solutions:**
1. Check environment variables are set correctly
2. Verify group ID for that source exists in config file
3. Restart dev server after adding new env vars
4. Check for typos in source name (case-insensitive but must match)

### Stripe Webhook Issues

**Problem:** "Invalid signature" error

**Solutions:**
1. Verify webhook secret starts with `whsec_`
2. Ensure correct environment (Test vs Live mode)
3. Check source parameter matches: `?source=clientname` → `STRIPE_WEBHOOK_SECRET_CLIENTNAME`
4. Regenerate webhook secret if needed (Stripe Dashboard)

**Problem:** Webhook fires but customer not added to MailerLite

**Solutions:**
1. Check Vercel function logs for errors
2. Verify customer group ID exists and is correct
3. Check email is valid in checkout session
4. Test MailerLite API directly (might be rate limited)
5. Verify `MAILERLITE_API_KEY` has permissions

**Problem:** Program-specific routing not working

**Solutions:**
1. Verify metadata key is exactly `program` (lowercase)
2. Check payment link has metadata configured
3. Ensure config has `SOURCE_PROGRAM` format: `CLIENTNAME_PROGRAM1`
4. Environment variable format: `MAILERLITE_CUSTOMER_GROUP_CLIENTNAME_PROGRAM1`
5. Check webhook logs to see which group was attempted

### Automation Issues

**Problem:** Automation not triggering after subscriber added

**Solutions:**
1. Check automation status is "Active" (not draft)
2. Verify trigger is "Subscriber joins a group"
3. Ensure correct group is selected in trigger
4. Check subscriber was actually added to that specific group
5. Allow 1-2 minutes for automation to process
6. Test by manually adding email to group

**Problem:** Emails going to spam

**Solutions:**
1. Client needs to verify domain in MailerLite
2. Set up SPF, DKIM records (MailerLite provides instructions)
3. Avoid spam trigger words in subject lines
4. Test with multiple email providers
5. Warm up sending domain gradually (don't blast immediately)

---

## Resources & Links

**Documentation:**
- MailerLite API: https://developers.mailerlite.com/docs
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Next.js: https://nextjs.org/docs
- Vercel Deployment: https://vercel.com/docs

**Tools:**
- Stripe CLI: https://stripe.com/docs/stripe-cli
- Stripe Test Cards: https://stripe.com/docs/testing

**Support:**
- Internal codebase README: `/README.md`
- MailerLite config: `/app/_config/mailerlite.ts`
- API routes: `/app/api/subscribe/` and `/app/api/stripe-webhook/`

---

## Version History

- **v1.0** - Initial protocol documentation (Nov 2024)

---

**Questions or issues?** Update this document as you discover new patterns and solutions!






