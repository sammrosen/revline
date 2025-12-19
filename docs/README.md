# SRB RevOps MVP Documentation

Internal-only infrastructure for managing multi-client RevOps operations.

## What This System Does

Transform your single-client landing page system into a **multi-client managed service** with:

- **Database-backed secrets** - No more per-client env vars sprawl
- **Event logging** - All automation actions logged to a single place
- **Execution gating** - Pause clients instantly to block all automation
- **Health monitoring** - Detect failures before clients notice (every 15min)
- **Admin dashboard** - View events, manage clients, add integrations

## Definition of Ready for Cold Email

✅ **No per-client secrets in `.env`** - Only master encryption key  
✅ **All automations emit events** - Single source of truth for debugging  
✅ **Failures visible in one place** - Admin dashboard shows all issues  
✅ **Can pause a client instantly** - One-click execution blocking  
✅ **Health monitoring runs every 15min** - Proactive failure detection  
✅ **Can onboard new client in <2 hours** - Streamlined process

**You're ready to start Apollo cold email.**

---

## Quick Links

- [Setup Guide](./SETUP.md) - Get the system running locally
- [Architecture](./ARCHITECTURE.md) - How the system works
- [Operations](./OPERATIONS.md) - Daily usage, client onboarding, troubleshooting

---

## System Overview

### Before (Per-Client Env Vars)
```
MAILERLITE_GROUP_ID_SAM=123
MAILERLITE_CUSTOMER_GROUP_SAM=456
STRIPE_WEBHOOK_SECRET_SAM=whsec_xxx
MAILERLITE_GROUP_ID_CLIENT2=789
MAILERLITE_CUSTOMER_GROUP_CLIENT2=012
STRIPE_WEBHOOK_SECRET_CLIENT2=whsec_yyy
... (grows with every client)
```

### After (Database-Backed)
```
SRB_ENCRYPTION_KEY=<32 bytes>  # One master key
DATABASE_URL=<postgres>         # Source of truth
RESEND_API_KEY=<alerts>         # Health monitoring
CRON_SECRET=<cron auth>         # Secure health checks
```

All client secrets stored encrypted in Postgres, decrypted at runtime only.

---

## Non-Goals (Intentionally NOT Built)

These features come **after money**, not before:

- ❌ Client dashboards
- ❌ Client-facing alerts  
- ❌ Slack notifications
- ❌ Retry queues
- ❌ Webhook replay UI
- ❌ Lead analytics
- ❌ OAuth
- ❌ Multi-admin support

**Guiding Principle:** If it doesn't help detect or fix a revenue failure faster, it doesn't get built.

