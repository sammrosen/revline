# RevLine Pre-Launch Checklist

Complete all items before going live with client data.

---

## 🔐 Security

### Secrets & Encryption

- [ ] **Generate unique encryption key**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **Store `REVLINE_ENCRYPTION_KEY` securely**
  - Added to Railway environment variables
  - Backed up offline (password manager, secure note)
  - Never committed to git
- [ ] **Verify encryption works**
  - Add a test integration in admin
  - Confirm secret is encrypted in database
  - Confirm decryption works in API routes

### Authentication

- [ ] **Set strong admin password** (20+ characters, mixed case, numbers, symbols)
- [ ] **Test login/logout flow**
- [ ] **Verify session expiration** (14 days default)
- [ ] **Test session cookie security** (httpOnly, secure in production)

### API Security

- [ ] **CORS not needed** (API is same-origin or webhook-only)
- [ ] **Rate limiting configured** (see RATE_LIMITS in types)
- [ ] **Webhook signatures verified** (Stripe, Calendly)
- [ ] **No secrets in logs** (grep codebase for `console.log.*secret`)

### Infrastructure

- [ ] **HTTPS enforced** (Railway handles this)
- [ ] **Database SSL enabled** (`?sslmode=require` in DATABASE_URL)
- [ ] **No debug endpoints in production**
  - Remove `/api/v1/admin/setup` if exists
  - Remove `/api/v1/admin/seed` if exists
  - Remove `/api/v1/admin/debug-login` if exists

---

## 🗄️ Database

### Setup

- [ ] **Production database provisioned** (Railway Postgres recommended)
- [ ] **DATABASE_URL set in Railway** (not in .env files)
- [ ] **Migrations run successfully**
  ```bash
  npx prisma migrate deploy
  ```
- [ ] **Schema matches migrations** (no pending changes)

### Verification

- [ ] **Admin account created**
- [ ] **Test client created**
- [ ] **Test integration added**
- [ ] **Test event emitted**

### Backup Strategy

- [ ] **Automatic backups enabled** (Railway has this by default)
- [ ] **Know how to restore** from Railway dashboard
- [ ] **Encryption key backed up separately** (required to decrypt secrets)

---

## 🔗 Integrations

### MailerLite

- [ ] **API key generated** (production account)
- [ ] **Test groups created** for validation
- [ ] **Automations configured** in MailerLite dashboard
- [ ] **Test subscribe flow** end-to-end

### Stripe

- [ ] **Webhook endpoint configured** in Stripe dashboard
  - URL: `https://your-domain.railway.app/api/stripe-webhook?source=clientslug`
  - Event: `checkout.session.completed`
- [ ] **Webhook secret stored** (per-client in integration)
- [ ] **STRIPE_API_KEY set** in Railway environment
- [ ] **Test payment flow** with test card `4242 4242 4242 4242`

### Calendly (if using)

- [ ] **Webhook subscription created** via Calendly API
- [ ] **Signing key stored** in integration
- [ ] **Test booking flow** end-to-end

---

## 📊 Monitoring

### Health Checks

- [ ] **CRON_SECRET generated and set**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **External cron configured** (cron-job.org, EasyCron, or Railway cron)
  - URL: `https://your-domain.railway.app/api/v1/cron/health-check`
  - Method: GET
  - Header: `Authorization: Bearer YOUR_CRON_SECRET`
  - Schedule: `*/15 * * * *` (every 15 minutes)
- [ ] **Test health check manually**
  ```bash
  curl https://your-domain.railway.app/api/cron/health-check \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```

### Alerts

- [ ] **RESEND_API_KEY set** (from resend.com)
- [ ] **ADMIN_ALERT_EMAIL set** (your email)
- [ ] **Test alert delivery** (trigger health check with issues)
- [ ] **Email not going to spam** (check spam folder)

### Logging

- [ ] **Railway logs accessible** (dashboard → deployment → logs)
- [ ] **Error tracking considered** (Sentry optional but recommended)
- [ ] **Log retention understood** (Railway keeps ~7 days)

---

## 🚀 Deployment

### Railway Setup

- [ ] **Project created** in Railway dashboard
- [ ] **GitHub repo connected** (or deployed from CLI)
- [ ] **Dockerfile detected** and builds successfully
- [ ] **Environment variables set**:
  - `DATABASE_URL` (from Railway Postgres)
  - `REVLINE_ENCRYPTION_KEY`
  - `STRIPE_API_KEY`
  - `RESEND_API_KEY`
  - `ADMIN_ALERT_EMAIL`
  - `CRON_SECRET`
  - `NODE_ENV=production`
- [ ] **Custom domain configured** (optional but recommended)
- [ ] **SSL certificate active** (automatic with Railway)

### Verification

- [ ] **App starts without errors** (check Railway logs)
- [ ] **Home page loads** (if public landing pages exist)
- [ ] **Admin login works** (`/admin/login`)
- [ ] **API endpoints respond** (`/api/v1/subscribe` returns 503 without valid source)
- [ ] **Health check passes** (call with Authorization header)

### Performance

- [ ] **Build completes in reasonable time** (<5 minutes)
- [ ] **Cold start acceptable** (<3 seconds)
- [ ] **No memory warnings** in Railway logs

---

## 📋 Client Onboarding Ready

### First Client

- [ ] **Client record created** in admin dashboard
- [ ] **MailerLite integration added** with correct group IDs
- [ ] **Stripe integration added** with webhook secret
- [ ] **Test flow completed**:
  - Email capture → MailerLite lead group
  - Payment → MailerLite customer group
  - Events logged in admin dashboard
- [ ] **Client webhook URL documented**

### Handoff Materials

- [ ] **Webhook URL template** ready to share
- [ ] **Source parameter explained** to client
- [ ] **What they can/cannot change** documented
- [ ] **Support process defined** (how to report issues)

---

## 📝 Documentation

- [ ] **STANDARDS.md reviewed** by all contributors
- [ ] **OPERATIONS.md updated** with production URLs
- [ ] **ENV.md matches** actual environment variables
- [ ] **README.md accurate** for the project

---

## ✅ Final Checklist

Before accepting real client data:

- [ ] All security items completed
- [ ] Database backed up and restorable
- [ ] All integrations tested end-to-end
- [ ] Health monitoring active and alerting
- [ ] At least one full client flow tested
- [ ] Rollback plan documented (redeploy previous commit)

---

## Post-Launch Monitoring (First 48 Hours)

- [ ] Check Railway logs for errors (every few hours)
- [ ] Verify health check emails received (if issues found)
- [ ] Confirm events logging correctly in admin dashboard
- [ ] Test client webhook at least once
- [ ] Monitor database size (shouldn't grow rapidly)

---

## Emergency Contacts

| Issue | Action |
|-------|--------|
| Database down | Check Railway status, restore from backup |
| Integration failing | Pause client, check API status |
| Security breach | Rotate encryption key, reset admin password |
| Billing issue | Check Railway billing, upgrade if needed |

---

*Checklist version: 1.0*
*Last updated: January 2024*

