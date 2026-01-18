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

**Configure Webhook (for booking tracking):**
1. In Calendly, go to **Integrations** → **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/calendly-webhook`
3. Subscribe to events: `invitee.created`, `invitee.canceled`
4. Copy the webhook signing key
5. Add integration in admin dashboard with signing key

### 2.4 ManyChat Setup

**Configure Instagram Automation:**

ManyChat drives traffic from Instagram to your landing pages. See [ManyChat Setup Guide](./MANYCHAT-SETUP.md) for detailed instructions.

**Prerequisites:**
- Client has Instagram Business Account
- ManyChat Pro subscription ($15-25/month) - required for Instagram automation
- Landing page URL ready

**Key Configuration:**
1. Connect Instagram to ManyChat
2. Create comment automation with trigger keywords
3. Set up DM with landing page link
4. Include UTM parameters for tracking

### 2.5 RevLine Admin Setup

**Create Client in Admin Dashboard:**

1. Go to `/workspaces` → "Add Client"
2. Enter:
   - **Name**: "Acme Fitness"
   - **Slug**: `acme_fitness` (lowercase, underscores OK)
   - **Timezone**: `America/New_York` (for health check business hours)
3. Click "Create Client"

**Add Integrations:**

**MailerLite:**
```
Type: MAILERLITE
Secret: mlsk_xxxxxxxxxxxxx  (API key - encrypted on save)
Meta:
{
  "groupIds": {
    "lead": "123456",
    "customer": "789012"
  }
}
```

**Stripe:**
```
Type: STRIPE
Secret: whsec_xxxxxxxxxxxxx  (webhook secret - encrypted on save)
Meta: {}
```

**Calendly:**
```
Type: CALENDLY
Secret: your_signing_key  (webhook signing key - encrypted on save)
Meta:
{
  "schedulingUrls": {
    "discovery": "https://calendly.com/yourname/30min"
  }
}
```

---

## Phase 3: Landing Page Development (1-2 hours)

See [Landing Page Creation Workflow](./LANDING-PAGE-CREATION.md) for the detailed 15-minute workflow.

### 3.1 Choose Template
- Minimal/Bold: `app/page.tsx`
- Premium/Detailed: `app/fit1/page.tsx`

### 3.2 Create Page
```bash
mkdir app/clientname
cp app/page.tsx app/clientname/page.tsx
```

### 3.3 Customize Content
- Update metadata (title, description)
- Update headlines and copy
- Update CTAs (Calendly, Stripe links)
- Update EmailCapture source prop
- Update footer

---

## Phase 4: Testing The Full Flow (30-60 minutes)

### 4.1 Local Development Testing

```bash
npm run dev
```

### 4.2 Test Each Flow

**Email Capture:**
1. Navigate to landing page
2. Enter test email
3. Verify in MailerLite → correct group
4. Check for welcome email

**Stripe Payment:**
1. Click payment CTA
2. Use test card: `4242 4242 4242 4242`
3. Complete checkout
4. Verify in MailerLite → customer group
5. Check for onboarding email

**Calendly Booking:**
1. Click booking CTA
2. Complete booking
3. Check admin dashboard for `calendly_booking_created` event
4. Verify lead stage updated to BOOKED

**ManyChat (if configured):**
1. Comment on test IG post
2. Verify auto-reply
3. Check DM received
4. Click landing page link
5. Complete email capture

### 4.3 Testing Checklist

- [ ] Email capture → MailerLite lead group
- [ ] Payment → MailerLite customer group
- [ ] Booking → Lead stage BOOKED
- [ ] All events logged in admin dashboard
- [ ] Health check passes for client

---

## Phase 5: Deployment (20-30 minutes)

### 5.1 Pre-Deployment Checklist

- [ ] All placeholder content replaced
- [ ] All links updated (Calendly, Stripe)
- [ ] EmailCapture source matches client slug
- [ ] Footer updated (copyright, email)
- [ ] Build succeeds: `npm run build`
- [ ] No console errors

### 5.2 Deploy

```bash
git add .
git commit -m "Add landing page for ClientName"
git push origin main
```

### 5.3 Post-Deployment

- [ ] Update Stripe webhook to production URL
- [ ] Update Calendly webhook to production URL
- [ ] Test live flows end-to-end
- [ ] Verify events in admin dashboard

---

## Phase 6: Client Handoff (15-30 minutes)

### 6.1 Provide Client With

- [ ] Landing page URL
- [ ] MailerLite login (for viewing subscribers)
- [ ] Stripe dashboard access
- [ ] Calendly access
- [ ] How to check if things are working
- [ ] Your support contact

### 6.2 What Client Can/Cannot Touch

**Can edit:**
- MailerLite email sequences
- Calendly availability
- Stripe products/pricing
- Social media posting

**Cannot edit (you manage):**
- Landing page content/code
- Webhook URLs
- Integration secrets
- ManyChat flows

---

## Quick Reference Checklist

### New Client Onboarding Speedrun

**Pre-Development:**
- [ ] Consultation completed
- [ ] MailerLite groups created
- [ ] MailerLite automations built
- [ ] Stripe product + payment link created
- [ ] Stripe webhook configured
- [ ] Calendly link obtained
- [ ] Calendly webhook configured (optional)
- [ ] Client created in admin dashboard
- [ ] All integrations added

**Development:**
- [ ] Landing page created from template
- [ ] Content customized
- [ ] EmailCapture configured
- [ ] All CTAs updated
- [ ] Build succeeds

**Testing:**
- [ ] Email capture works
- [ ] Payment works
- [ ] Booking works (if Calendly webhook enabled)
- [ ] Events logged correctly
- [ ] Health check passes

**Deployment:**
- [ ] Code pushed
- [ ] Production webhooks updated
- [ ] Live testing complete
- [ ] Client handoff done

---

## Troubleshooting

See [Operations Guide](../OPERATIONS.md) for common issues and solutions.

**Quick fixes:**

| Issue | Solution |
|-------|----------|
| Email not captured | Check source prop matches client slug |
| Payment not tracked | Verify Stripe webhook URL has `?source=` |
| Booking not tracked | Check Calendly integration + signing key |
| Health check red | Review events in admin, check API keys |

---

*Last updated: January 2025*

