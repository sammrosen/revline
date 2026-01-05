# 15-Minute Landing Page Creation Workflow

## Overview

This workflow enables you to create a new client landing page in ~15 minutes using existing templates. Perfect for quickly onboarding new clients without starting from scratch.

**Prerequisites:**
- Client consultation completed
- Brand/style preference decided (Minimal vs Premium)
- Copy/messaging agreed upon
- MailerLite groups created
- Client added to admin dashboard

---

## Template Selection (1 minute)

Choose the appropriate template based on client's industry and style preference:

### Option A: Minimal/Bold Style
**Template:** `app/page.tsx` (Sam Rosen business automation style)

**Best for:**
- B2B services
- Consulting/coaching
- High-ticket offers ($2K+)
- Professional services
- Automation/tech services

**Characteristics:**
- Pure black/white
- Large typography (5xl-8xl)
- Lots of negative space
- Minimal animations
- "Engineered, not hype" vibe

### Option B: Premium/Detailed Style
**Template:** `app/fit1/page.tsx` (FIT1 coaching program style)

**Best for:**
- Coaching programs
- Fitness/wellness
- Courses/memberships
- Community products
- Transformation-based offers

**Characteristics:**
- Dark zinc palette
- Gradients and shadows
- Detailed feature sections
- Social proof heavy
- FAQ and pricing structures

---

## Step-by-Step Workflow

### Step 1: Copy Template File (2 minutes)

1. **Navigate to templates:**
   ```bash
   cd app/
   ```

2. **Copy chosen template:**
   ```bash
   # For minimal style
   cp page.tsx clientname/page.tsx
   
   # OR for premium style
   cp fit1/page.tsx clientname/page.tsx
   ```

3. **Create directory structure:**
   ```bash
   mkdir clientname
   mv clientname/page.tsx clientname/
   ```

   Result: `app/clientname/page.tsx`

### Step 2: Update Page Metadata (1 minute)

**Find and replace** at the top of the file:

```tsx
// BEFORE
export const metadata: Metadata = {
  title: 'Sam Rosen Business | Marketing Automation',
  description: 'Turn warm attention into revenue...',
};

// AFTER
export const metadata: Metadata = {
  title: 'Client Business Name | Their Tagline',
  description: 'Clear description of what they offer - optimized for SEO',
};
```

### Step 3: Update Main Headline (1 minute)

**Find:** Main hero headline (usually line 10-15)

**Replace with client's value proposition:**

```tsx
// BEFORE
<h1 className="text-6xl md:text-8xl font-bold tracking-tight...">
  Marketing automation<br />without the complexity
</h1>

// AFTER
<h1 className="text-6xl md:text-8xl font-bold tracking-tight...">
  [Client's Main Promise]<br />[In 1-2 Lines]
</h1>
```

### Step 4: Update Subheadline (1 minute)

**Find:** Subheadline below hero (usually line 18-22)

**Replace:**

```tsx
// BEFORE
<p className="text-xl md:text-2xl text-zinc-400...">
  Old subheadline text
</p>

// AFTER
<p className="text-xl md:text-2xl text-zinc-400...">
  [Client's supporting statement - what they do and for whom]
</p>
```

### Step 5: Update CTAs (2 minutes)

**Find all CTA buttons** and update:

1. **Calendly Links:**
   ```tsx
   // Find (usually 2-3 buttons):
   href="https://calendly.com/yourname/30min?utm_source=..."
   
   // Replace with:
   href="https://calendly.com/clientname/30min?utm_source=clientslug&utm_medium=landing_page"
   ```

2. **Stripe Payment Links** (if applicable):
   ```tsx
   // Find:
   href="#"
   
   // Replace with:
   href="https://buy.stripe.com/client_payment_link"
   ```

3. **Button Text:**
   - Update button copy to match client's language
   - Examples: "Book Discovery Call", "Start Your Transformation", "Get Your Quote"

### Step 6: Update EmailCapture Source (1 minute)

**Find:** EmailCapture component (if used)

```tsx
// BEFORE
<EmailCapture 
  source="demo"
  buttonText="Subscribe"
/>

// AFTER
<EmailCapture 
  source="clientslug"
  buttonText="Get Started"
  collectName={true}
/>
```

**Important:** `source` must match client's slug in admin dashboard!

### Step 7: Customize Body Content (5 minutes)

**Update key sections** with client-specific content:

1. **Problem/Pain Section:**
   - Replace 3-5 pain points with client's audience problems
   - Use client's language and terminology

2. **Solution/Features Section:**
   - Update 4-6 feature items with client's offering
   - Match features to pain points above

3. **How It Works Section:**
   - Update 4-6 process steps
   - Make it specific to their service delivery

4. **Social Proof** (if available):
   - Replace with client testimonials
   - Or comment out until testimonials are ready

5. **About/Story Section:**
   - Update with client's bio/story
   - Focus on credibility and expertise

**Pro Tip:** Use Find & Replace for common terms:
- Find: "automation" → Replace: "[client's service]"
- Find: "coach@example.com" → Replace: "client@email.com"

### Step 8: Update Footer (1 minute)

**Find:** Footer section (bottom of file)

```tsx
// BEFORE
<p>&copy; 2024 Sam Rosen Business</p>
<a href="mailto:sam@example.com">Contact</a>

// AFTER
<p>&copy; 2024 [Client Business Name]</p>
<a href="mailto:client@email.com">Contact</a>
```

Update:
- Copyright
- Contact email
- Social links (if applicable)
- Privacy/Terms links

### Step 9: Test Locally (1 minute)

```bash
npm run dev
```

**Verify:**
- [ ] Page loads at `http://localhost:3000/clientname`
- [ ] All images load (if any)
- [ ] Calendly links work
- [ ] EmailCapture component works
- [ ] No console errors
- [ ] Mobile responsive (test in browser DevTools)

### Step 10: Deploy (1 minute if automated)

**Option A: Railway Auto-Deploy (Recommended)**
```bash
git add app/clientname/
git commit -m "Add landing page for ClientName"
git push origin main
```

Railway auto-deploys in ~2 minutes.

**Option B: Manual Deploy**
```bash
npm run build
# Upload to your hosting provider
```

---

## Quick Reference Checklist

Use this checklist for each new client page:

- [ ] Copy template file to `app/clientname/page.tsx`
- [ ] Update page metadata (title, description)
- [ ] Update hero headline
- [ ] Update subheadline
- [ ] Update all Calendly links with UTM parameters
- [ ] Update Stripe payment links (if applicable)
- [ ] Update EmailCapture source prop
- [ ] Update button text (CTAs)
- [ ] Customize problem/pain points
- [ ] Customize solution/features
- [ ] Customize process steps
- [ ] Update/remove testimonials
- [ ] Update about/story section
- [ ] Update footer (copyright, email, links)
- [ ] Test locally (all links work, no errors)
- [ ] Deploy to production
- [ ] Test live site
- [ ] Verify EmailCapture works end-to-end

---

## Time-Saving Tips

### Use Find & Replace Efficiently

**Common replacements:**
1. `Ctrl+H` (VS Code) or `Cmd+H` (Mac)
2. Find: `Sam Rosen Business` → Replace: `[Client Name]`
3. Find: `automation` → Replace: `[their service]`
4. Find: `sam@example.com` → Replace: `client@email.com`
5. Find: `utm_source=sam` → Replace: `utm_source=clientslug`

### Keep a Copy Template Library

Create `_templates/` folder with proven versions:

```
app/_templates/
  ├── minimal-style.tsx     (Clean B2B template)
  ├── premium-style.tsx     (Detailed coaching template)
  └── ecommerce-style.tsx   (Product-focused template)
```

Copy from `_templates/` instead of live pages to avoid copying customizations.

### Pre-Fill Client Info Document

Before starting, gather in a doc:

```markdown
# Client: [Name]
- Business Name: [Full Name]
- Slug: [clientslug]
- Tagline: [One-liner]
- Headline: [Main promise]
- Subheadline: [Supporting statement]
- Calendly URL: https://calendly.com/...
- Stripe Link: https://buy.stripe.com/...
- Email: client@email.com
- Pain Points: [1, 2, 3]
- Solutions: [1, 2, 3]
- Process Steps: [1, 2, 3, 4]
```

Then copy-paste from this doc during workflow.

### Use VS Code Multi-Cursor

For updating similar sections:
1. `Ctrl+D` (or `Cmd+D`) to select next occurrence
2. Edit all at once
3. Saves time on repetitive updates

---

## Common Customizations

### Adding Email Capture in Hero

Uncomment and customize:

```tsx
<div className="pt-12">
  <EmailCapture 
    buttonText="Get Early Access"
    placeholder="Enter your email"
    collectName={true}
    namePlaceholder="Your name"
    source="clientslug"
    inline={true}
    className="max-w-md mx-auto"
  />
</div>
```

### Adding Testimonials

Use this structure:

```tsx
<div className="grid md:grid-cols-3 gap-8">
  {[1, 2, 3].map((i) => (
    <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <p className="text-zinc-400 mb-4">
        "Testimonial text here..."
      </p>
      <div>
        <p className="font-semibold text-zinc-50">Client Name</p>
        <p className="text-sm text-zinc-500">Their Role</p>
      </div>
    </div>
  ))}
</div>
```

### Adding FAQ Section

Copy from `app/fit1/page.tsx` FAQ section:

```tsx
<section className="py-20 px-6 border-t border-zinc-900/50">
  <div className="max-w-4xl mx-auto">
    <h2 className="text-4xl font-bold text-center mb-12">
      Frequently Asked Questions
    </h2>
    {/* FAQ items */}
  </div>
</section>
```

---

## Advanced: Component-Based Workflow (Future)

**For when you have 20+ clients:**

Create reusable components:

```
app/_components/sections/
  ├── Hero.tsx
  ├── Problem.tsx
  ├── Solution.tsx
  ├── Process.tsx
  ├── Testimonials.tsx
  ├── FAQ.tsx
  └── CTA.tsx
```

Then compose pages:

```tsx
export default function ClientPage() {
  return (
    <>
      <Hero 
        headline="Client's headline"
        subheadline="Client's subheadline"
        ctaText="Book Call"
        ctaUrl="..."
      />
      <Problem points={["Pain 1", "Pain 2", "Pain 3"]} />
      <Solution features={["Feature 1", "Feature 2"]} />
      {/* etc */}
    </>
  );
}
```

**Benefits:**
- Pages in 5 minutes
- Easier to maintain
- Consistent design

**When to build:** After 15-20 clients (not before).

---

## Troubleshooting

**Issue:** EmailCapture not working
- **Fix:** Verify `source` prop matches client slug in admin dashboard
- **Fix:** Check MailerLite integration is configured for client

**Issue:** Calendly link not opening
- **Fix:** Check URL is complete (starts with https://)
- **Fix:** Verify UTM parameters don't break the URL

**Issue:** Page not deploying
- **Fix:** Check for TypeScript errors: `npm run build`
- **Fix:** Verify file is in correct location: `app/clientname/page.tsx`

**Issue:** Styling looks broken
- **Fix:** Check you didn't accidentally delete className attributes
- **Fix:** Verify Tailwind classes are correct (no typos)

**Issue:** Mobile looks bad
- **Fix:** Test responsive classes (md:, lg: breakpoints)
- **Fix:** Check text sizes have mobile versions (text-xl md:text-3xl)

---

## Workflow Optimization

**Current:** ~15 minutes per page
**Target:** ~10 minutes per page (with practice)

**How to get faster:**
1. **Week 1-2:** Follow checklist religiously (15-20 min/page)
2. **Week 3-4:** Memorize common locations (12-15 min/page)
3. **Week 5+:** Muscle memory kicks in (10-12 min/page)

**Metrics to track:**
- Time per page
- Number of iterations needed
- Client feedback cycles

**Goal:** 3-4 pages per hour when scaling to 10+ clients/month.

---

## Next Steps

After creating the landing page:

1. **Add to admin dashboard** (if not done)
2. **Configure MailerLite groups** in admin
3. **Set up ManyChat automation** (if using IG)
4. **Test full flow** (IG/email → landing → MailerLite)
5. **Deploy to production**
6. **Share with client** for approval
7. **Go live** and monitor

**Handoff to client:**
- Landing page URL
- Expected metrics/KPIs
- How to check if automation is working
- Your support contact info

---

*Last updated: January 2025*

