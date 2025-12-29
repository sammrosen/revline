# Operations Guide

Daily usage, client onboarding, troubleshooting, and maintenance.

---

## Daily Operations

### Accessing Admin Dashboard

1. Go to https://yourdomain.com/admin/login
2. Enter your password
3. View clients at `/admin/clients`

### Reading Health Indicators

**Integration health (per-client):**
- 🟢 **GREEN**: All systems operational
- 🟡 **YELLOW**: Silent (no activity in 4+ hours) or degraded
- 🔴 **RED**: Multiple consecutive failures (3+)

**Client health (derived):**
- Worst status among all integrations
- One red integration = client shows red

**What to do:**
- GREEN: Nothing, all good
- YELLOW: Investigate if expected (low traffic OK, broken integration NOT OK)
- RED: Fix immediately - client's automation is broken

### Viewing Events

1. Click on any client
2. See last 50 events
3. Check for failures (red ✗ icon)
4. Read error messages for diagnosis

**Common issues:**
- `mailerlite_subscribe_failed` with "rate limit" → Wait or upgrade MailerLite plan
- `stripe_payment_failed` with "invalid signature" → Webhook secret mismatch
- `execution_blocked` → Client was paused (intentional or needs unpause)

---

## Client Onboarding

**Time budget: <2 hours per client**

### Step 1: Create Client Record

1. Go to `/admin/clients` → "Add Client"
2. Enter:
   - **Name**: "Acme Fitness"
   - **Slug**: `acme_fitness` (lowercase, underscores OK)
   - **Timezone**: `America/New_York` (searchable dropdown - type to filter)
3. Click "Create Client"

**Why timezone is required:**
- Health checks use it to determine business hours (4am-11pm client time)
- Prevents false "silent integration" alerts during off-hours

### Step 2: Collect Integration Secrets

Ask client for:
- MailerLite API key
- MailerLite group IDs (lead + customer)
- Stripe webhook signing secret
- Stripe API key (optional, for signature verification)

**MailerLite setup:**
- Client logs into MailerLite
- Creates groups: "Leads - Acme Fitness" and "Customer - Acme Fitness"
- Gets group IDs from URL: `https://dashboard.mailerlite.com/groups/123456`
- Gets API key from Settings → API

**Stripe setup:**
- Client logs into Stripe
- Goes to Developers → Webhooks → Add Endpoint
- Endpoint URL: `https://yourdomain.com/api/stripe-webhook?source=acme_fitness`
- Events to send: `checkout.session.completed`
- Copies webhook signing secret (starts with `whsec_`)

### Step 3: Add Integrations

Click on the client → "Add Integration"

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

**Important:** Meta stores non-sensitive config only (group IDs, URLs, flags). Never put API keys or secrets in meta - they go in the Secret field.

**Stripe:**
```
Type: STRIPE
Secret: whsec_xxxxxxxxxxxxx  (webhook secret - encrypted on save)
Meta (optional - usually empty):
{}
```

**Note:** Stripe webhook uses MailerLite groups (configured above). You don't need Stripe API keys for webhooks. Leave meta empty or add optional product routing if needed.

**Calendly (Optional):**
```
Type: CALENDLY
Secret: your_signing_key_from_calendly  (webhook signing key - encrypted on save)
Meta (optional):
{
  "schedulingUrls": {
    "discovery": "https://calendly.com/yourname/30min"
  },
  "addToBookedSegment": false
}
```

**Note:** Calendly integration requires webhook subscription setup via their API. Store scheduling URLs and optional config flags in meta. The webhook signing key must go in the Secret field (encrypted).

Secrets are **never shown again** after saving.

### Step 4: Test the Flow

**Test email capture:**
```bash
curl -X POST https://yourdomain.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"acme_fitness"}'
```

Check:
- MailerLite: Email appears in lead group
- Admin dashboard: `email_captured` and `mailerlite_subscribe_success` events logged

**Test payment webhook:**
- Use Stripe test mode
- Create test payment link
- Complete checkout with test card: `4242 4242 4242 4242`
- Check:
  - Stripe Dashboard → Webhooks: Delivery shows success
  - MailerLite: Customer appears in customer group
  - Admin dashboard: `stripe_payment_succeeded` and `mailerlite_subscribe_success` events

### Step 5: Client Handoff

Provide client with:
- Their webhook URL: `https://yourdomain.com/api/stripe-webhook?source=acme_fitness`
- Their subscribe endpoint: `https://yourdomain.com/api/subscribe` (with `source: "acme_fitness"` in body)
- Confirmation that automations are live

**What clients can/cannot touch:**
- ✅ Can edit: MailerLite groups, email sequences, Stripe products
- ❌ Cannot edit: Webhook URLs, API keys (you manage these)

---

## Pausing & Unpausing Clients

### When to Pause

- Client stops paying
- Client requests suspension
- Too many errors (fix before unpausing)
- Testing/debugging

### How to Pause

1. Go to `/admin/clients`
2. Click "Pause" next to client
3. Confirm paused (status shows PAUSED)

**Effect:** All automation execution blocked immediately. Webhooks return errors. Forms show "Service unavailable."

### How to Unpause

1. Click "Unpause"
2. Automations resume immediately

**Events:** Both actions emit `client_paused` / `client_unpaused` events.

---

## Troubleshooting

### Client reports "emails not going through"

1. Check admin dashboard → click client
2. Look for recent `mailerlite_subscribe_failed` events
3. Read error message:
   - "rate limit" → MailerLite plan maxed out
   - "invalid API key" → Secret rotated, need to update integration
   - "group not found" → Group ID in meta is wrong

**Fix:**
- If secret changed: Click "Add Integration" again (overwrites existing)
- If group ID changed: Update meta JSON
- If rate limit: Wait or upgrade MailerLite

### Client reports "payments processed but customer not added to list"

1. Check Stripe webhook logs (Stripe Dashboard → Developers → Webhooks)
2. If webhook failed: Check error message
3. Check admin dashboard for `stripe_payment_succeeded` but `mailerlite_subscribe_failed`

**Common causes:**
- Stripe webhook URL wrong (missing `?source=slug`)
- Webhook secret rotated (update integration)
- MailerLite rate limit
- Customer group ID wrong in meta

### Health check shows RED but everything works

**Possible causes:**
- Low traffic client (no events in 4h is normal)
- Timezone issue (health check looks at business hours)
- Flaky integration (3 failures then recovered)

**Action:** Review recent events. If truly recovered, health will turn GREEN after next successful operation.

### Admin login not working

**Troubleshooting:**
1. Check browser console for network errors
2. Check server logs for `[LOGIN]` messages
3. Verify password (case-sensitive)
4. Clear cookies and try again

**If locked out:**
- Database access required to reset password
- Run: `UPDATE admins SET password_hash = '<new_argon2_hash>' WHERE id = '<admin_id>'`
- Generate hash with: `node -e "require('argon2').hash('newpass').then(console.log)"`

---

## Maintenance

### Cleaning Up Old Events

Events table grows unbounded. Clean up monthly:

```sql
-- Keep last 90 days only
DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';

-- Or keep last N events per client
DELETE FROM events
WHERE id NOT IN (
  SELECT id FROM events e
  WHERE e.client_id = events.client_id
  ORDER BY created_at DESC
  LIMIT 1000
);
```

Run via database GUI or CLI. **Backup first.**

### Monitoring Disk Usage

Check Postgres storage:
```sql
SELECT pg_size_pretty(pg_database_size('railway'));
```

Events table size:
```sql
SELECT pg_size_pretty(pg_total_relation_size('events'));
```

If approaching plan limit: Clean up old events or upgrade database.

### Backup Strategy

**Critical data:**
- Admin password (you can reset)
- Client records
- Integration secrets (encrypted)

**Backup methods:**
- Cloud Postgres: Use provider's backup feature (Supabase/Neon/Railway have daily backups)
- Self-hosted: `pg_dump` daily to S3
- **Most critical:** Back up your `SRB_ENCRYPTION_KEY` securely offline

**Recovery:** If database lost, you need:
1. Database backup (from provider)
2. `SRB_ENCRYPTION_KEY` (to decrypt secrets)
3. Restore database, verify key matches

### Managing Integrations

**Rotating secrets (e.g., MailerLite API key rotated):**
1. Get new secret from client
2. Go to admin → client → "Add or Replace Integration"
3. Select same integration type
4. Paste new secret
5. Saves over existing (automatic upsert)

**Editing meta config (group IDs, product maps, etc.):**
1. Go to admin → client → find integration
2. Click "Edit Meta" button
3. Update JSON directly
4. Save changes
5. **No secret re-entry required** (only meta is updated)

**Deleting an integration:**
1. Go to admin → client → find integration
2. Click "Delete" button
3. Type `DELETE` to confirm
4. **Warning:** Webhooks will stop working immediately

**Master encryption key:**
- Not supported yet
- Keep `SRB_ENCRYPTION_KEY` secure
- Plan for post-MVP: Re-encrypt all secrets with new key

### Updating Admin Password

Use browser console:
```javascript
await fetch('https://yourdomain.com/api/admin/reset-password', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({newPassword: 'YourNewPassword'})
}).then(r => r.json()).then(console.log)
```

(Note: Create this endpoint if needed for production use)

---

## Monitoring & Alerts

### Email Alerts

You receive email alerts when health check detects:
- Integration silent for 4+ hours
- 3+ consecutive failures
- Leads stuck for 24+ hours

**Alert format:**
```
Subject: ⚠️ RevOps Alert: 3 issue(s) detected

Acme Fitness: MAILERLITE silent for 4+ hours
Acme Fitness: STRIPE has 3+ consecutive failures
Beta Client: 5 leads stuck for 24+ hours
```

**What to do:**
1. Log into admin dashboard
2. Check affected clients
3. Review events for errors
4. Fix issues (rotate secrets, unpause, etc.)

### Manual Health Check

Trigger manually:
```bash
curl https://yourdomain.com/api/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Returns JSON with issues found (if any).

---

## Scaling Considerations

### When you hit 10 clients

- Event table cleanup becomes critical (automate monthly)
- Consider adding indexes: `CREATE INDEX CONCURRENTLY idx_events_lead ON events(lead_id, created_at);`
- Monitor database connection limits

### When you hit 50 clients

- Health check may timeout (move to background queue)
- Consider splitting into multiple cron jobs (one per client)
- Add connection pooling (PgBouncer)

### When you hit 100 clients

- Event table will be huge (partition by month)
- Need read replicas for admin dashboard
- Consider splitting admin UI from public API

**For now (0-10 clients):** Don't optimize. Current architecture is fine.

---

## Common Admin Tasks

### Deleting a Client

**⚠️ DESTRUCTIVE ACTION - Cannot be undone**

When to delete:
- Client permanently churned
- Test/demo client no longer needed
- Duplicate entry

**How to delete:**
1. Go to admin → click client
2. Click "Delete Client" (top right)
3. Review what will be deleted:
   - Client record
   - All integrations (encrypted secrets)
   - All leads and customer data
   - All event history
4. Type the **exact client name** to confirm
5. Click "Permanently Delete"

**Effect:**
- Cascade deletion (all related data removed)
- Webhooks will return 404 immediately
- Forms will error (source not found)
- **Cannot be recovered** (unless database backup exists)

**Alternative to deletion:**
- Consider pausing instead (reversible)
- Only delete when certain client won't return

### Adding a new integration type (e.g., Calendly)

1. Add to `IntegrationType` enum in `prisma/schema.prisma`
2. Run migration: `npx prisma migrate dev --name add_calendly`
3. Update admin UI to show Calendly option
4. No code changes needed (system is integration-agnostic)

### Viewing all events for a specific email

Database query:
```sql
SELECT e.created_at, e.system, e.event_type, e.success, e.error_message
FROM events e
JOIN leads l ON e.lead_id = l.id
WHERE l.email = 'customer@example.com'
ORDER BY e.created_at DESC;
```

### Bulk pausing clients

If emergency (e.g., MailerLite API down):
```sql
UPDATE clients SET status = 'PAUSED';
```

Unpause individually after fixing.

---

## Support Workflow

When client reports an issue:

1. **Get details**: Email? Timestamp? What they expected?
2. **Check admin dashboard**: Find client, check recent events
3. **Diagnose**:
   - No events? Automation didn't fire (check webhook delivery)
   - Failed events? Read error message
   - Success events but wrong outcome? Check integration config (meta)
4. **Fix**:
   - Rotate secret if invalid
   - Update meta if group IDs changed
   - Unpause if accidentally paused
5. **Verify**: Test the flow end-to-end
6. **Communicate**: Tell client it's fixed, what caused it

**Average resolution time:** <10 minutes for common issues.

