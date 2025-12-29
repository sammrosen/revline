# Health Check System

## Overview

The Health Check System provides a quick way to verify that each client's configuration and integrations are working correctly. With a single button click, you can run comprehensive tests in ~15 seconds.

## Features

### Configuration Tests (~2 seconds)
- ✅ Client exists and is active
- ✅ MailerLite integration configured
- ✅ MailerLite meta JSON structure valid
- ✅ Stripe integration exists (optional)
- ✅ Recent activity detected (7-day window)

### API Connectivity Tests (~10-15 seconds)
- ✅ MailerLite API connection and group verification
- ✅ Landing page accessibility and EmailCapture component check
- ✅ Stripe webhook endpoint responsiveness

## How to Use

### Running a Health Check

1. Navigate to **Admin Panel** → **Clients**
2. Click on a client name to view their detail page
3. Click the **"Run Health Check"** button (blue button at top)
4. Wait ~15 seconds for tests to complete
5. Review the results

### Understanding Results

**Overall Status:**
- 🟢 **PASS** - All tests passed successfully
- 🟡 **WARN** - All critical tests passed, but some warnings present
- 🔴 **FAIL** - One or more critical tests failed

**Test Categories:**

**Configuration Tests** - Quick database checks:
- Client Active - Verifies client status is ACTIVE (not PAUSED)
- MailerLite Integration - Checks if integration exists in database
- MailerLite Meta Valid - Validates JSON structure and required fields
- Stripe Integration - Checks if Stripe is configured (WARN if missing)
- Recent Activity - Checks for events in last 7 days (WARN if none)

**API Connectivity Tests** - External API calls:
- MailerLite API - Tests API key validity and group existence
- Landing Page - Verifies page loads and has EmailCapture component
- Stripe Webhook - Tests webhook endpoint responds correctly

### Rate Limiting

Health checks are rate-limited to prevent API abuse:
- **Cooldown:** 60 seconds between runs
- If you try to run again too soon, you'll see: "Please wait Xs before running again"

### Results Display

Results are displayed for **30 seconds** after completion, then automatically cleared.

Each test shows:
- Status icon (✓ / ⚠ / ✗)
- Test name
- Duration in milliseconds
- Detailed message

## Common Issues & Solutions

### ❌ "MailerLite API returned 401 - check API key"

**Problem:** API key is invalid or expired

**Solution:**
1. Log into MailerLite dashboard
2. Generate a new API key
3. Update the client integration in admin panel
4. Re-run health check

### ❌ "Lead group ID (123456) not found in MailerLite"

**Problem:** The group ID in meta doesn't exist in MailerLite

**Solution:**
1. Log into MailerLite dashboard
2. Navigate to Groups
3. Find the correct group ID from the URL
4. Update the client integration meta with correct group ID
5. Re-run health check

### ⚠️ "Page loads but email capture component not detected"

**Problem:** Landing page exists but EmailCapture component not found

**Solution:**
1. Check that the landing page includes the EmailCapture component
2. Verify the `source` prop matches the client slug
3. Example:
   ```tsx
   <EmailCapture source="clientslug" />
   ```

### ⚠️ "No events in last 7 days (low traffic or new client)"

**Problem:** No activity detected recently

**Solution:**
- This is a WARNING, not a failure
- Common for new clients or low-traffic periods
- If client should have traffic, investigate:
  - Is the landing page being promoted?
  - Are webhooks firing correctly?
  - Check MailerLite/Stripe dashboards for activity

### ❌ "Cannot reach landing page: ECONNREFUSED"

**Problem:** Landing page URL is not accessible

**Solution:**
1. Verify `NEXT_PUBLIC_APP_URL` is set correctly in `.env.local`
2. Check that the landing page route exists: `app/[slug]/page.tsx`
3. Ensure dev server or production server is running
4. Test manually: `curl http://localhost:3000/clientslug`

### ❌ "Webhook endpoint not found"

**Problem:** Stripe webhook endpoint returns 404

**Solution:**
1. Verify the webhook route exists: `app/api/stripe-webhook/route.ts`
2. Check that the endpoint accepts `?source=` query parameter
3. Test manually:
   ```bash
   curl -X POST http://localhost:3000/api/stripe-webhook?source=clientslug \
     -H "Stripe-Signature: test" \
     -d '{"test": true}'
   ```
   Should return 401 (invalid signature) - this is correct!

## Technical Details

### API Route

**Endpoint:** `GET /api/admin/clients/[id]/health-check`

**Authentication:** Requires admin session

**Response Format:**
```json
{
  "clientId": "uuid",
  "clientName": "Sam Rosen",
  "clientSlug": "sam",
  "timestamp": "2025-12-29T10:30:00Z",
  "overallStatus": "PASS",
  "duration": 12450,
  "tests": [
    {
      "category": "configuration",
      "name": "Client Active",
      "status": "PASS",
      "message": "Client status is ACTIVE",
      "duration": 5
    }
  ]
}
```

### Timeout Protection

Each test has a **5-second timeout** to prevent hanging:
- If a test exceeds 5 seconds, it's marked as FAIL
- Error message: "Test timed out"

### Environment Variables

Required for full functionality:

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production URL
```

This is used for testing landing pages and webhook endpoints.

## Testing Scenarios

### Happy Path (All Tests Pass)

**Setup:**
- Active client with valid MailerLite integration
- Correct API key and group IDs
- Landing page exists with EmailCapture component
- Recent activity in last 7 days

**Expected Result:** 🟢 PASS

### Invalid API Key

**Setup:**
1. Rotate API key in MailerLite
2. Don't update the key in the admin panel

**Expected Result:** 🔴 FAIL - "MailerLite API returned 401"

### Wrong Group ID

**Setup:**
1. Change group ID in meta to non-existent ID (e.g., "999999999")

**Expected Result:** 🔴 FAIL - "Lead group ID not found in MailerLite"

### Paused Client

**Setup:**
1. Click "Pause" button on client

**Expected Result:** 🔴 FAIL - "Client is PAUSED"

### Missing Landing Page

**Setup:**
1. Client slug doesn't match any route

**Expected Result:** 🔴 FAIL - "Landing page returned 404"

### Low Traffic Client

**Setup:**
- Client with no events in last 7 days

**Expected Result:** 🟡 WARN - "No events in last 7 days (low traffic or new client)"

## Files Created

- `app/api/admin/clients/[id]/health-check/route.ts` - API endpoint
- `app/admin/clients/[id]/health-check-button.tsx` - UI component
- `docs/HEALTH-CHECK-SYSTEM.md` - This documentation

## Files Modified

- `app/admin/clients/[id]/page.tsx` - Added health check button

## Future Enhancements

Potential additions (not in current MVP):

- **Test History:** Store results in database for trend analysis
- **Scheduled Tests:** Run health checks automatically every 24h
- **System-Wide Test Page:** Test all clients at once
- **Slack Alerts:** Notify when health checks fail
- **More Tests:** Calendly API, ManyChat flow validation
- **Dry-Run Tests:** Simulate email capture without saving to database

## Troubleshooting

### Button Not Appearing

**Check:**
1. Are you logged in as admin?
2. Are you on a client detail page (`/admin/clients/[id]`)?
3. Check browser console for errors

### Tests Taking Too Long

**Normal Duration:** 10-15 seconds
**If > 20 seconds:**
- Check network connection
- Verify external APIs (MailerLite) are responding
- Check for timeout errors in results

### "Unauthorized" Error

**Solution:**
1. Log out and log back in
2. Check admin session hasn't expired
3. Verify admin authentication is working

## Support

For issues or questions:
1. Check this documentation first
2. Review the test results for specific error messages
3. Check the event log on the client detail page
4. Review MailerLite/Stripe dashboards for external issues

