# Environment Variables

This document lists all environment variables required for the RevLine platform.

## 🔴 Required (Cannot run without these)

### Database

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```
- **What:** PostgreSQL connection string
- **Used for:** All database operations (clients, integrations, leads, events)
- **Local dev:** Use a local Postgres instance or Railway/Supabase
- **Production:** Railway Postgres recommended

### Encryption

```bash
SRB_ENCRYPTION_KEY=436831a9fac534b8a92626d72dfb0576ad5d701f9a89946e4d50647fa89ca5be
```
- **What:** 32-byte hex key for AES-256-GCM encryption
- **Used for:** Encrypting client API keys/secrets in the database
- **Generate with:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Important:** 
  - Use DIFFERENT keys in dev vs production
  - If you change the key, you cannot decrypt existing secrets
  - Keep this secret VERY secure (it unlocks all client credentials)

### Payment Processing

```bash
STRIPE_API_KEY=sk_test_xxxxx
```
- **What:** Stripe secret key (test or live)
- **Used for:** Verifying webhook signatures in `/api/stripe-webhook`
- **Get from:** https://dashboard.stripe.com/apikeys
- **Note:** Use `sk_test_` for development, `sk_live_` for production

## 🟡 Required for Production Features

### Health Monitoring & Alerts

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
ADMIN_ALERT_EMAIL=your@email.com
CRON_SECRET=ee2b99f3d87aecfd196f67f773e00c51a3bae73cd19d08b37dfb126b966fa31d
```

**`RESEND_API_KEY`**
- **What:** Resend.com API key for sending emails
- **Used for:** Health check alerts via `/api/cron/health-check`
- **Get from:** https://resend.com/api-keys
- **Optional for dev:** Can skip if you don't need alert emails

**`ADMIN_ALERT_EMAIL`**
- **What:** Email address to receive health check alerts
- **Used for:** Sending notifications when integrations fail
- **Example:** `ops@yourcompany.com`

**`CRON_SECRET`**
- **What:** Secret token for authenticating cron job requests
- **Used for:** Securing `/api/cron/health-check` endpoint
- **Generate with:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Setup:** Add to Railway cron job as header `Authorization: Bearer {CRON_SECRET}`

## 🟢 Optional

### Application URL

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```
- **What:** Your deployed application URL
- **Used for:** Health checks that need to call back to your own API
- **Default:** `http://localhost:3000` (auto-detected in dev)
- **Production:** Set to your actual domain

### Node Environment

```bash
NODE_ENV=production
```
- **What:** Runtime environment
- **Used for:** 
  - Enabling secure cookies in production
  - Adjusting logging levels
  - Framework optimizations
- **Auto-set:** Railway/Vercel set this automatically
- **Values:** `development`, `production`, `test`

## ❌ NOT Needed (Legacy - Removed)

These variables were used before we moved to database-driven configuration:

```bash
# ❌ DEPRECATED - Don't use these
MAILERLITE_API_KEY=
MAILERLITE_GROUP_ID=
MAILERLITE_GROUP_ID_DEMO=
MAILERLITE_GROUP_ID_FIT1=
MAILERLITE_CUSTOMER_GROUP_SAM=
# ... etc
```

**Why removed?** 
- All client-specific secrets are now encrypted in the database
- MailerLite API keys are stored per-client in `ClientIntegration` table
- Group IDs are stored in integration `meta` JSON field
- Allows onboarding clients without redeploying

**Migration:** 
- Old env vars are read once during `db:seed` to populate initial clients
- After seeding, they're no longer used
- Safe to remove from `.env` file

## 📋 Quick Setup Checklist

### Local Development

```bash
# 1. Copy example file
cp env.example .env

# 2. Generate encryption keys
node -e "console.log('SRB_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 3. Add to .env:
DATABASE_URL=postgresql://localhost:5432/revline_dev
SRB_ENCRYPTION_KEY=<generated_key>
STRIPE_API_KEY=sk_test_<your_test_key>
CRON_SECRET=<generated_secret>

# 4. Optional (for alerts):
RESEND_API_KEY=re_<your_key>
ADMIN_ALERT_EMAIL=you@email.com

# 5. Run migrations
npm run db:migrate
npm run db:seed

# 6. Start dev server
npm run dev
```

### Production (Railway)

```bash
# Required
DATABASE_URL=<railway_postgres_url>
SRB_ENCRYPTION_KEY=<unique_production_key>
STRIPE_API_KEY=sk_live_<your_live_key>
RESEND_API_KEY=re_<your_key>
ADMIN_ALERT_EMAIL=ops@yourcompany.com
CRON_SECRET=<unique_production_secret>
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Auto-set by Railway
NODE_ENV=production
```

## 🔒 Security Best Practices

1. **Never commit `.env` to git** (already in `.gitignore`)
2. **Use different keys in dev vs production**
3. **Rotate `SRB_ENCRYPTION_KEY` if compromised** (requires re-encrypting all secrets)
4. **Keep `CRON_SECRET` secret** (protects your health check endpoint)
5. **Use Stripe test keys in development** (avoids accidental real charges)
6. **Store production secrets in Railway/Vercel UI** (not in code)

## 🐛 Troubleshooting

### "SRB_ENCRYPTION_KEY environment variable is not set"
- Make sure `.env` file exists in project root
- Check that the key is exactly 64 hex characters (32 bytes)
- Restart your dev server after adding it

### "Prisma Client could not find the Query Engine"
- Run `npx prisma generate` 
- Make sure `DATABASE_URL` is set before running `npm install`

### "Cannot decrypt secret"
- Encryption key changed after secrets were stored
- If in dev: clear DB and run `db:seed` again with new key
- If in prod: Use the original encryption key

### Health check alerts not sending
- Check `RESEND_API_KEY` is valid
- Verify `ADMIN_ALERT_EMAIL` is correct
- Ensure `CRON_SECRET` matches Railway cron config

## 📚 Related Documentation

- [Setup Guide](./SETUP.md) - Initial setup and deployment
- [Architecture](./ARCHITECTURE.md) - How encryption works
- [Operations](./OPERATIONS.md) - Adding clients and integrations

