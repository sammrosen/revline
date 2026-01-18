# Setup Guide

Get the RevOps MVP running locally and deploy to production.

---

## Prerequisites

- Node.js 20+
- Postgres database (cloud or local)
- Existing `.env.local` with your current secrets (for migration)

---

## Local Development Setup

### Step 1: Database

Choose a Postgres provider:

**Cloud (Recommended)**
- [Supabase](https://supabase.com) - Free tier, easy setup
- [Neon](https://neon.tech) - Serverless Postgres
- [Railway](https://railway.app) - Simple deployment

**Local**
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  --name revops-db \
  postgres:16
```

Copy the connection string (should end with `?sslmode=require` for cloud).

---

### Step 2: Environment Variables

Copy the example file:
```bash
cp env.example .env.local
```

Generate encryption keys:
```bash
node -e "console.log('SRB_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env.local`:
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
SRB_ENCRYPTION_KEY=<generated above>
CRON_SECRET=<generated above>
RESEND_API_KEY=re_xxxx  # Get from resend.com
ADMIN_ALERT_EMAIL=your@email.com

# Legacy (for migration only)
MAILERLITE_API_KEY=<your current key>
STRIPE_API_KEY=<your current key>
MAILERLITE_GROUP_ID_SAM=<your current group>
MAILERLITE_CUSTOMER_GROUP_SAM=<your current group>
STRIPE_WEBHOOK_SECRET_SAM=<your current secret>
```

---

### Step 3: Run Migrations

```bash
npm install
npm run db:migrate
```

When prompted for migration name: `init_revops_mvp`

---

### Step 4: Seed Initial Data

**Option A: Using prisma seed (may have Windows issues)**
```bash
npm run db:seed
# Follow prompts for admin password
```

**Option B: Via browser console (recommended on Windows)**

Start dev server:
```bash
npm run dev
```

Open browser console (F12) at http://localhost:3000 and run:

```javascript
// Create admin account
await fetch('http://localhost:3000/api/v1/setup', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({password: 'YourSecurePassword'})
}).then(r => r.json()).then(console.log)

// Migrate your client data
await fetch('http://localhost:3000/api/v1/auth/seed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    adminPassword: 'YourSecurePassword',
    clientName: 'Your Name',
    clientSlug: 'yourslug'  // Used in ?source= parameter
  })
}).then(r => r.json()).then(console.log)
```

**Important:** Delete the temporary seed endpoints after use:
```bash
rm app/api/v1/setup/route.ts
rm app/api/v1/seed/route.ts
```

---

### Step 5: Access Admin Dashboard

1. Go to http://localhost:3000/login
2. Enter your password
3. You should see your client with MailerLite + Stripe integrations already configured

---

## Production Deployment (Vercel)

### Step 1: Push to Git

```bash
git add .
git commit -m "RevOps MVP implementation"
git push origin main
```

### Step 2: Deploy to Vercel

1. Import repository in [Vercel Dashboard](https://vercel.com)
2. Add environment variables:
   - `DATABASE_URL` (production Postgres connection string)
   - `SRB_ENCRYPTION_KEY` (same as local)
   - `CRON_SECRET` (same as local)
   - `RESEND_API_KEY`
   - `ADMIN_ALERT_EMAIL`
3. Deploy

**Do NOT add the legacy variables** (`MAILERLITE_API_KEY`, etc.) to production - those are for local migration only.

### Step 3: Update Stripe Webhooks

For each client, update their Stripe webhook URL to production:

1. Stripe Dashboard → Developers → Webhooks
2. Click your webhook
3. Update URL to: `https://yourdomain.com/api/stripe-webhook?source=clientslug`
4. Test with a real payment

### Step 4: Verify Health Checks

The cron job runs automatically via `vercel.json`. Test it:

```bash
curl https://yourdomain.com/api/v1/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

You should get a JSON response with health check results.

---

## Verification

Test the full flow:

```bash
# Test subscribe endpoint
curl -X POST https://yourdomain.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"yourslug"}'
```

Then check:
1. MailerLite - Email should be in your lead group
2. Admin dashboard - Event should be logged
3. Email - Welcome automation should send

---

## Troubleshooting

### "Cannot connect to database"
- Verify `DATABASE_URL` format includes `?sslmode=require`
- Check database allows connections from your IP
- Test connection: `npx prisma db push`

### "SRB_ENCRYPTION_KEY not set or invalid"
- Must be exactly 64 hex characters (32 bytes)
- Generate fresh: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Password not working"
- Use browser console method to avoid shell escaping issues
- Password is case-sensitive
- Check terminal logs for `[LOGIN] Password valid: false`

### Prisma errors on Windows
- Use the browser console seed method instead of CLI
- The tsx runtime can have issues with Prisma engine on Windows

### Health check not running
- Only works in Vercel production (not localhost)
- Check Vercel Dashboard → Deployments → Functions for cron logs
- Test manually with curl + `Authorization: Bearer` header

---

## Next Steps

Once setup is complete:
- Read [Operations Guide](./OPERATIONS.md) for daily usage
- Read [Architecture](./ARCHITECTURE.md) to understand the system
- Start onboarding clients!





