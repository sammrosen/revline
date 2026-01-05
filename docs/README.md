# RevLine Documentation

Internal-only infrastructure for managing multi-client RevOps operations.

## What This System Does

Transform your single-client landing page system into a **multi-client managed service** with:

- **Database-backed secrets** - No more per-client env vars sprawl
- **Event logging** - All automation actions logged to a single place
- **Execution gating** - Pause clients instantly to block all automation
- **Health monitoring** - Detect failures before clients notice (every 15min)
- **Admin dashboard** - View events, manage clients, add integrations
- **Two-factor authentication** - Secure admin access with TOTP

## System Status

✅ **Production Ready** - All core features implemented  
✅ **No per-client secrets in `.env`** - Only master encryption key  
✅ **All automations emit events** - Single source of truth for debugging  
✅ **Failures visible in one place** - Admin dashboard shows all issues  
✅ **Can pause a client instantly** - One-click execution blocking  
✅ **Health monitoring runs every 15min** - Proactive failure detection  
✅ **Can onboard new client in <2 hours** - Streamlined process
✅ **Full funnel tracking** - Captured → Booked → Paid

---

## Quick Links

### Core Documentation

- [Setup Guide](./SETUP.md) - Get the system running locally
- [Architecture](./ARCHITECTURE.md) - How the system works
- [Operations](./OPERATIONS.md) - Daily usage, client onboarding, troubleshooting
- [Environment Variables](./ENV.md) - Configuration reference

### Workflows

- [Pre-Push Routine](./workflows/PRE-PUSH.md) - Before pushing code
- [Client Onboarding](./workflows/CLIENT-ONBOARDING.md) - Full onboarding protocol
- [Landing Page Creation](./workflows/LANDING-PAGE-CREATION.md) - 15-minute page workflow
- [ManyChat Setup](./workflows/MANYCHAT-SETUP.md) - Instagram automation setup

### Reference

- [Standards](./STANDARDS.md) - Coding standards and conventions
- [Health Check System](./HEALTH-CHECK-SYSTEM.md) - Health monitoring details
- [Production Audit](./PRODUCTION-AUDIT.md) - Security and reliability review
- [Status](./STATUS.md) - Implementation status

---

## System Overview

### Before (Per-Client Env Vars)
```
MAILERLITE_GROUP_ID_SAM=123
MAILERLITE_CUSTOMER_GROUP_SAM=456
STRIPE_WEBHOOK_SECRET_SAM=whsec_xxx
MAILERLITE_GROUP_ID_CLIENT2=789
... (grows with every client)
```

### After (Database-Backed)
```
REVLINE_ENCRYPTION_KEY_V1=<64 hex chars>  # One master key
DATABASE_URL=<postgres>                    # Source of truth
RESEND_API_KEY=<alerts>                    # Health monitoring
CRON_SECRET=<cron auth>                    # Secure health checks
```

All client secrets stored encrypted in Postgres, decrypted at runtime only.

---

## Integrations

| Integration | Status | Description |
|-------------|--------|-------------|
| MailerLite | ✅ Complete | Email capture, customer groups |
| Stripe | ✅ Complete | Payment webhooks, customer tracking |
| Calendly | ✅ Complete | Booking webhooks, stage tracking |
| ManyChat | ✅ Docs | Traffic driver (no backend needed) |

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

---

*Last updated: January 2025*




