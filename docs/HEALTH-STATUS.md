# Health Status System

This document explains how integration and client health statuses are determined and updated.

---

## Overview

**Two types of health:**
1. **Integration Health** - Stored in `client_integrations.health_status` (GREEN/YELLOW/RED)
2. **Client Health** - Derived on-the-fly from all integrations (not stored)

---

## Integration Health (Per-Integration)

**Stored in database:** `client_integrations.health_status`

**Updated by:** Health check cron job (`/api/v1/cron/health-check`) running every 15 minutes

### Logic:

```typescript
// Start with GREEN
let status = GREEN;

// Check 1: Silent for 4+ hours?
if (lastSeenAt < 4 hours ago) {
  status = YELLOW;
}

// Check 2: 3+ consecutive failures? (overrides YELLOW)
if (last 3 events all failed) {
  status = RED;
}
```

### What Each Status Means:

- 🟢 **GREEN**: All systems operational
  - Integration has recent activity
  - No consecutive failures
  
- 🟡 **YELLOW**: Degraded or silent
  - No activity in 4+ hours (during business hours)
  - OR: 1-2 recent failures (but not 3 consecutive)
  
- 🔴 **RED**: Critical failure
  - 3+ consecutive failures in last 4 hours
  - Client's automation is broken

### When Status Updates:

1. **Every 15 minutes** - Cron job runs health checks
2. **Only updates if changed** - Avoids spam
3. **Emits event** - `health_status_changed` logged when status changes

---

## Client Health (Per-Client)

**NOT stored in database** - calculated on-demand when viewing clients list

**Calculated in:** `GET /api/admin/clients` endpoint

### Logic:

```typescript
// Collect all integration statuses
const statuses = [integration1.status, integration2.status, ...];

// Worst status wins
if (any integration is RED) {
  clientHealth = RED;
} else if (any integration is YELLOW) {
  clientHealth = YELLOW;
} else {
  clientHealth = GREEN;
}
```

### Why Derived (Not Stored)?

- **Always accurate** - No risk of stale data
- **Simple** - No need to update when integrations change
- **Cheap** - Fast to calculate (just `Array.includes()`)

---

## How `lastSeenAt` is Updated

**Field:** `client_integrations.last_seen_at`

**NOT YET IMPLEMENTED** - Currently always `null` in the database.

### TODO: Update on Success Events

Every time an integration successfully processes an event, update its `lastSeenAt`:

```typescript
// In app/api/v1/subscribe/route.ts after successful MailerLite call:
await prisma.clientIntegration.update({
  where: {
    clientId_integration: {
      clientId: client.id,
      integration: 'MAILERLITE',
    },
  },
  data: { lastSeenAt: new Date() },
});

// In app/api/v1/stripe-webhook/route.ts after successful processing:
await prisma.clientIntegration.update({
  where: {
    clientId_integration: {
      clientId: stripeClient.id,
      integration: 'STRIPE',
    },
  },
  data: { lastSeenAt: new Date() },
});
```

**Why this matters:**
- Without `lastSeenAt` updates, health checks can't detect silent integrations
- Currently, silence detection doesn't work (always shows GREEN unless failures)

---

## Health Check Cron Job

**Endpoint:** `/api/cron/health-check`

**Trigger:** Vercel Cron (every 15 minutes via `vercel.json`)

**Authentication:** Requires `Authorization: Bearer <CRON_SECRET>`

### What It Does:

1. **Fetches active clients** - Only `status: ACTIVE`
2. **Checks each integration:**
   - Silence (4+ hours)
   - Consecutive failures (3+)
3. **Updates health status** if changed
4. **Checks stuck leads** (24+ hours in CAPTURED stage)
5. **Sends email alert** if issues found

### Example Alert Email:

```
Subject: ⚠️ RevOps Alert: 3 issue(s) detected

• Acme Fitness: MAILERLITE silent for 4+ hours
• Acme Fitness: STRIPE has 3+ consecutive failures
• Beta Client: 5 leads stuck for 24+ hours
```

---

## Timezone-Aware Business Hours (TODO)

**Current behavior:** Checks silence 24/7

**Planned behavior:** Only check during client's business hours (4am-11pm)

### Why It Matters:

If a client closes at midnight, you don't want to alert "MAILERLITE silent for 4 hours" at 3am.

### Implementation:

```typescript
// In health check, before checking silence:
const clientLocalTime = new Date().toLocaleString('en-US', {
  timeZone: client.timezone,
  hour: 'numeric',
  hour12: false,
});

const hour = parseInt(clientLocalTime);
const isBusinessHours = hour >= 4 && hour <= 23;

if (!isBusinessHours) {
  // Skip silence check, but still check failures
  continue;
}
```

---

## Common Scenarios

### Scenario 1: New Client Added

- **Integration health:** GREEN (default)
- **Client health:** GREEN
- **After 4 hours with no activity:** Integration → YELLOW
- **After health check runs:** Email alert sent

### Scenario 2: MailerLite API Key Rotated (invalid)

- **First API call fails:** Integration still GREEN (1 failure)
- **Second call fails:** Still GREEN (2 failures)
- **Third call fails:** Integration → RED (3 consecutive failures)
- **Health check detects change:** Email alert sent
- **Fix:** Admin rotates secret → next call succeeds → stays RED until 3 consecutive successes (not yet implemented)

### Scenario 3: Low Traffic Client

- **Last activity:** 6 hours ago
- **Health check runs:** Integration → YELLOW ("silent for 4+ hours")
- **Is this bad?** Maybe not! Low traffic is normal for some clients.
- **Action:** Check if expected. If yes, ignore YELLOW. If no, investigate.

### Scenario 4: Client Has MailerLite (GREEN) + Stripe (RED)

- **MailerLite health:** GREEN
- **Stripe health:** RED (3 failures)
- **Client health:** RED (worst status wins)
- **Dashboard shows:** Client row is red, Stripe integration is red

---

## Testing Health Checks Locally

**Trigger manually:**

```bash
curl http://localhost:3000/api/v1/cron/health-check \
  -H "Authorization: Bearer your_cron_secret_from_env"
```

**Response:**

```json
{
  "success": true,
  "clientsChecked": 2,
  "issuesFound": 1,
  "issues": [
    "Acme Fitness: MAILERLITE silent for 4+ hours"
  ]
}
```

**To test silence detection:**
1. Create a client with integrations
2. Don't trigger any events
3. Manually update `lastSeenAt` to 5 hours ago:
   ```sql
   UPDATE client_integrations 
   SET last_seen_at = NOW() - INTERVAL '5 hours' 
   WHERE id = 'your_integration_id';
   ```
4. Trigger health check manually
5. Check for YELLOW status and alert email

**To test failure detection:**
1. Intentionally break an integration (wrong API key)
2. Trigger 3 events (all will fail)
3. Trigger health check
4. Check for RED status and alert email

---

## Known Limitations

1. **`lastSeenAt` updates** - Updated via `touchIntegration()` on successful API calls
2. **No automatic recovery** - Once RED, stays RED until next successful operation
3. **No timezone-aware business hours** - Alerts 24/7 instead of 4am-11pm client time (future enhancement)
4. **No grace period** - New integrations may show YELLOW after 4 hours of no activity

---

## Quick Reference

| Status | Color | Meaning | Trigger |
|--------|-------|---------|---------|
| 🟢 GREEN | Green | Healthy | Default / recent activity |
| 🟡 YELLOW | Yellow | Degraded | 4+ hours silence |
| 🔴 RED | Red | Broken | 3+ consecutive failures |

**Client health = worst integration status**

**Updated by:** Cron job every 15 minutes (integration health only)

**Viewed at:** `/admin/clients` (both integration & client health)



