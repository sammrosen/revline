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
