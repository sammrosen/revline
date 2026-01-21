# Operations Guide

Daily usage, client onboarding, troubleshooting, and maintenance.

---

## Daily Operations

### Accessing Admin Dashboard

1. Go to https://yourdomain.com/login
2. Enter your password
3. View clients at `/workspaces`

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
2. Go to the "Events" tab
3. See recent events with total count (e.g., "50 of 2,847")
4. Check for failures (red ✗ icon)
5. Read error messages for diagnosis

**Common issues:**
- `mailerlite_subscribe_failed` with "rate limit" → Wait or upgrade MailerLite plan
- `stripe_payment_failed` with "invalid signature" → Webhook secret mismatch
- `execution_blocked` → Client was paused (intentional or needs unpause)

---

## Client Onboarding

**Time budget: <2 hours per client**

### Step 1: Create Client Record

1. Go to `/workspaces` → "Add Client"
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
- Endpoint URL: `https://yourdomain.com/api/v1/stripe-webhook?source=acme_fitness`
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
curl -X POST https://yourdomain.com/api/v1/subscribe \
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

1. Go to `/workspaces`
2. Click "Pause" next to client
3. Confirm paused (status shows PAUSED)

**Effect:** All automation execution blocked immediately. Webhooks return errors. Forms show "Service unavailable."

### How to Unpause

1. Click "Unpause"
2. Automations resume immediately

**Events:** Both actions emit `client_paused` / `client_unpaused` events.

---

## Troubleshooting

### Using the Testing Tab

The Testing tab (available in each workspace) provides direct API testing for debugging integrations.

**Access:**
1. Go to workspace dashboard
2. Click the "Testing" tab (flask icon)

**Features:**
- **Known Endpoints**: Dropdown of common API endpoints pre-configured
- **Custom Endpoints**: Enter any API path for testing
- **Method Selection**: GET, POST, PUT, DELETE
- **Form Input**: POST /calendars/events has a structured form
- **Query Parameters**: GET /employees supports firstName, lastName, status filters
- **Multi-Panel**: Open up to 3 side-by-side panels for comparison
- **Response Search**: Search and highlight text in responses
- **Match Navigation**: Navigate between search matches

**Use Cases:**
- Verify API credentials are working
- Test new endpoints before implementing
- Debug booking/calendar issues
- Check member data and session balances
- Compare responses between different parameters

**Security:** Requires ADMIN or OWNER role. Authentication credentials are never exposed in the UI.

---

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
- Stripe webhook URL wrong (missing `?source=slug` or not using v1 path)
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

### Automated Data Cleanup

Data retention is enforced automatically via the `data-cleanup` cron job.

**Default retention periods:**
- Events: 90 days
- WebhookEvents: 30 days
- WorkflowExecutions: 90 days
- IdempotencyKeys: 24 hours (TTL-based)

**Configuration (optional):**
```bash
# In .env
RETENTION_EVENTS_DAYS=90
RETENTION_WEBHOOK_EVENTS_DAYS=30
RETENTION_WORKFLOW_EXECUTIONS_DAYS=90
```

**Manual cleanup trigger:**
```bash
# Dry-run first (see what would be deleted)
curl "https://yourdomain.com/api/v1/cron/data-cleanup?dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Run for real
curl https://yourdomain.com/api/v1/cron/data-cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response:**
```json
{
  "success": true,
  "dryRun": false,
  "result": {
    "eventsDeleted": 1234,
    "webhookEventsDeleted": 567,
    "workflowExecutionsDeleted": 89,
    "idempotencyKeysDeleted": 0,
    "durationMs": 2345
  }
}
```

### Legacy Manual Cleanup

If you need more control, you can still run SQL directly:

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
await fetch('https://yourdomain.com/api/v1/auth/reset-password', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({newPassword: 'YourNewPassword'})
}).then(r => r.json()).then(console.log)
```

(Note: Create this endpoint if needed for production use)

---

## Monitoring & Alerts

### Pushover Alerts

All alerts are sent via Pushover (mobile push notifications). Configure in `.env`:
```bash
PUSHOVER_USER_KEY=your_user_key
PUSHOVER_APP_TOKEN=your_app_token
```

**Alert types:**

| Alert | Priority | Trigger |
|-------|----------|---------|
| Webhook Backlog | High | >50 pending webhooks for >15 min |
| Error Rate Spike | High | >10% failure rate in last hour |
| Stuck Processing | High | Webhooks stuck processing >15 min |
| Integration Issues | Normal | Silence (4h) or consecutive failures |
| Stuck Leads | Normal | Leads in CAPTURED for 24+ hours |
| Cleanup Complete | Low | Daily cleanup finished |

**Alert thresholds (configurable):**
```bash
ALERT_ERROR_RATE_THRESHOLD=10        # Percentage
ALERT_WEBHOOK_BACKLOG_MAX=50         # Count
ALERT_STUCK_PROCESSING_MINUTES=15    # Minutes
ALERT_FAILED_WORKFLOWS_PER_HOUR=5    # Count
```

**What to do when alerted:**
1. Open admin dashboard
2. Check affected clients or system health
3. Review events for errors
4. Fix issues (rotate secrets, unpause, clear backlog, etc.)

### Health Check Cron

Runs every 15 minutes, checking:
- Per-client integration health (silence, failures)
- Stuck leads (24+ hours in CAPTURED)
- System-wide webhook backlog
- Error rate spikes
- Workflow failure spikes

**Trigger manually:**
```bash
curl https://yourdomain.com/api/v1/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response includes:**
```json
{
  "success": true,
  "clientsChecked": 5,
  "issuesFound": 2,
  "issues": ["..."],
  "metrics": {
    "webhookBacklog": 12,
    "errorRatePercent": 3.5,
    "workflowFailures": 0
  }
}
```

### Test Notifications

Test your Pushover setup from the admin dashboard:
1. Go to any client detail page
2. Click the actions dropdown (top right)
3. Select "Test Notification"
4. Verify you receive the push notification

---

## Scheduled Jobs (Crons)

### Overview

| Cron | Endpoint | Interval | Purpose |
|------|----------|----------|---------|
| Health Check | `/api/v1/cron/health-check` | 15 min | Monitor client + system health |
| Data Cleanup | `/api/v1/cron/data-cleanup` | Daily | Enforce retention policies |

### Setting Up Crons

**Railway:**
1. Go to your project settings
2. Add cron jobs with schedule:
   - Health check: `*/15 * * * *` (every 15 min)
   - Data cleanup: `0 3 * * *` (daily at 3 AM)
3. Set the endpoint URL and add `Authorization: Bearer YOUR_CRON_SECRET` header

**External scheduler (cron-job.org, EasyCron, etc.):**
1. Create jobs for each endpoint
2. Add the Authorization header
3. Set appropriate schedules

**Verifying crons work:**
```bash
# Test health check
curl https://yourdomain.com/api/v1/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test cleanup (dry run)
curl "https://yourdomain.com/api/v1/cron/data-cleanup?dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Rate Limiting

### Current Implementation

RevLine uses **in-memory rate limiting** for public API endpoints (`/api/v1/subscribe`, `/api/v1/stripe-webhook`, etc.).

**How it works:**
- Tracks request counts per IP address or client ID
- Limits: 100 requests per 15 minutes per IP (configurable)
- Rate limit headers included in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Limitations:**
- ✅ Works correctly with single Railway instance
- ⚠️ Rate limits reset on server restart (in-memory store)
- ⚠️ Multiple instances = separate counters (not shared)
  - If you scale to 2+ Railway containers, each has its own rate limit counter
  - A user could make 100 requests to instance 1, then 100 more to instance 2

**When to upgrade:**
- Scaling to 2+ Railway instances (horizontal scaling)
- Need persistent rate limits across restarts
- Need more sophisticated rate limiting (per-client, per-endpoint, etc.)

**Upgrade path:**
- Implement Redis-backed rate limiter (see `app/_lib/middleware/rate-limit.ts`)
- Use Redis for shared state across instances
- No code changes needed in routes (abstraction handles it)

**For now (single instance):** Current implementation is production-ready and sufficient.

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

