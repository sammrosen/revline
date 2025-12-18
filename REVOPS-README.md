# SRB RevOps MVP

Internal-only infrastructure for managing multi-client RevOps operations.

## What This System Does

- **Database-backed secrets**: No more per-client env vars
- **Event logging**: All automation actions logged for debugging
- **Execution gating**: Pause clients instantly to block all automation
- **Health monitoring**: Detect failures before clients notice
- **Admin dashboard**: View events, manage clients, add integrations

---

## Local Development Setup

### 1. Database Setup

You need a Postgres database. Options:
- **Supabase** (recommended): https://supabase.com
- **Neon**: https://neon.tech
- **Railway**: https://railway.app
- **Local Docker**: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres`

### 2. Environment Variables

Create `.env.local` with:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SRB_ENCRYPTION_KEY=your_64_char_hex_key

# Monitoring
RESEND_API_KEY=re_xxxx
ADMIN_ALERT_EMAIL=your@email.com
CRON_SECRET=your_random_secret

# Legacy (will be removed after migration)
MAILERLITE_API_KEY=your_key
STRIPE_API_KEY=your_key
MAILERLITE_GROUP_ID_SAM=123456
MAILERLITE_CUSTOMER_GROUP_SAM=789012
STRIPE_WEBHOOK_SECRET_SAM=whsec_xxx
```

### 3. Run Migrations

```bash
npm run db:migrate
```

When prompted for migration name, use: `init_revops_mvp`

### 4. Seed Initial Data

Create admin account and migrate your existing secrets:

```bash
# In browser console (F12), run:
fetch('http://localhost:3000/api/admin/setup', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({password: 'YourSecurePassword'})
}).then(r => r.json()).then(console.log)

# Then seed your client data:
fetch('http://localhost:3000/api/admin/seed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    adminPassword: 'YourSecurePassword',
    clientName: 'Sam Rosen',
    clientSlug: 'sam'
  })
}).then(r => r.json()).then(console.log)
```

### 5. Access Admin

- **Login**: http://localhost:3000/admin/login
- **Dashboard**: http://localhost:3000/admin/clients

---

## Production Deployment (Vercel)

### 1. Push to GitHub

```bash
git add .
git commit -m "RevOps MVP implementation"
git push origin revops
```

### 2. Deploy to Vercel

- Import repository in Vercel dashboard
- Add environment variables (from `.env.local`)
- Deploy

### 3. Set Up Cron Job

Vercel automatically runs the health check every 15 minutes via `vercel.json` config.

---

## Architecture

### Database Tables

- `clients` - Your paying clients
- `client_integrations` - Per-client encrypted secrets + config
- `leads` - Lead tracking (ops state only, not a CRM)
- `events` - Append-only event ledger for debugging
- `admins` - Single admin account
- `admin_sessions` - Admin login sessions

### API Routes

**Public (used by clients):**
- `POST /api/subscribe?source={slug}` - Email capture
- `POST /api/stripe-webhook?source={slug}` - Payment webhooks

**Admin (internal only):**
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/clients` - List all clients
- `GET /api/admin/clients/[id]` - Client detail with events
- `PATCH /api/admin/clients/[id]` - Pause/unpause client
- `POST /api/admin/integrations` - Add encrypted integration

**Cron:**
- `GET /api/cron/health-check` - Health monitoring (runs every 15min)

---

## Usage

### Onboarding a New Client

1. Go to `/admin/clients` → "Add Client"
2. Enter name and slug (e.g., "Acme Fitness" → `acme_fitness`)
3. Click on the client → "Add Integration"
4. Add MailerLite integration:
   - Paste API key (encrypted on save, never shown again)
   - Add meta JSON:
     ```json
     {
       "groupIds": {
         "lead": "123456",
         "customer": "789012"
       }
     }
     ```
5. Add Stripe integration:
   - Paste webhook secret
   - Add meta with API key if needed

**Total time: <2 hours**

### Pausing a Client

Click "Pause" next to any client. This immediately blocks all automation execution.

### Viewing Events

Click on any client to see last 50 events, filterable by success/failure.

---

## Monitoring

The health check runs every 15 minutes and alerts you via email if:

1. **Integration silence**: No events in 4+ hours during business hours
2. **Consecutive failures**: 3+ failures in a row
3. **Stuck leads**: Leads captured but no progress in 24h

Health status per integration:
- 🟢 **GREEN**: All good
- 🟡 **YELLOW**: Silent/degraded
- 🔴 **RED**: Multiple failures

---

## Security

- Secrets encrypted with AES-256-GCM
- Master key stored in env var only
- Admin auth uses Argon2id password hashing
- Server-side sessions with HTTP-only cookies
- No client-facing dashboards

---

## Definition of Ready for Cold Email

✅ No per-client secrets in `.env`  
✅ All automations emit events  
✅ Failures visible in one place  
✅ Can pause a client instantly  
✅ Health monitoring runs every 15min  
✅ Can onboard new client in <2 hours

**You're ready to start Apollo cold email.**

---

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` is correct
- Ensure database allows connections from your IP
- Verify `?sslmode=require` is in connection string

### "SRB_ENCRYPTION_KEY not set"
- Generate key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add to `.env.local`

### "Password not working"
- Use browser console method to set password (avoids shell escaping issues)

### Health check not running
- Vercel cron jobs only work in production
- Test locally: `curl http://localhost:3000/api/cron/health-check -H "Authorization: Bearer YOUR_CRON_SECRET"`

---

## Maintenance

### Cleaning Up Old Events

Events table will grow over time. Set up a monthly cleanup:

```sql
DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';
```

### Rotating Encryption Key

Not supported yet. Keep your `SRB_ENCRYPTION_KEY` secure and backed up.

---

## What's NOT Included (Intentionally)

- ❌ Client dashboards
- ❌ Client-facing alerts
- ❌ Slack notifications
- ❌ Retry queues
- ❌ Webhook replay UI
- ❌ Lead analytics
- ❌ OAuth
- ❌ Multi-admin support

These come **after money**, not before.

