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

✅ **Production Ready** — All core features implemented  
✅ **No per-client secrets in `.env`** — Only master encryption key  
✅ **All automations emit events** — Single source of truth for debugging  
✅ **Failures visible in one place** — Dashboard shows all issues  
✅ **Can pause a workspace instantly** — One-click execution blocking  
✅ **Health monitoring runs every 15min** — Proactive failure detection  
✅ **Can onboard new client in <2 hours** — Streamlined process  
✅ **Full funnel tracking** — Custom pipeline stages per workspace  
✅ **Decoupled workflows** — 11-adapter trigger → action automation  
✅ **Multi-user auth** — Organizations, workspace roles (Owner/Admin/Member/Viewer)  
✅ **AI agent engine** — Autonomous SMS conversations via OpenAI/Anthropic + Twilio  
✅ **Booking system** — Provider-agnostic with magic link confirmation  
✅ **Reliability layer** — Webhook deduplication, idempotent execution

---

## Quick Links

### Core Documentation

- [Setup Guide](./SETUP.md) - Get the system running locally
- [Architecture](./ARCHITECTURE.md) - How the system works
- [Workflow Engine](./WORKFLOW-ENGINE.md) - Configurable automation system
- [Operations](./OPERATIONS.md) - Daily usage, client onboarding, troubleshooting
- [Environment Variables](./ENV.md) - Configuration reference

### Workflows

- [Pre-Push Routine](./workflows/PRE-PUSH.md) — Before pushing code
- [Client Onboarding](./workflows/CLIENT-ONBOARDING.md) — Full onboarding protocol
- [Landing Page Creation](./workflows/LANDING-PAGE-CREATION.md) — 15-minute page workflow
- [ManyChat Setup](./workflows/MANYCHAT-SETUP.md) — Instagram automation setup
- [Integration Onboarding](./workflows/INTEGRATION-ONBOARDING.md) — Adding new integrations
- [External API Integration](./workflows/EXTERNAL-API-INTEGRATION.md) — External API patterns

### Reference

- [Standards](./STANDARDS.md) — Coding standards and conventions
- [Health Check System](./HEALTH-CHECK-SYSTEM.md) — Health monitoring details
- [AI Agent System](./AI-AGENT-SYSTEM.md) — AI agent engine documentation
- [Production Audit](./PRODUCTION-AUDIT.md) — Security and reliability review
- [Status](./STATUS.md) — Implementation status

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
| MailerLite | ✅ Complete | Email capture, subscriber groups, tagging |
| Stripe | ✅ Complete | Payment/subscription webhooks |
| Calendly | ✅ Complete | Booking webhooks, stage tracking |
| ABC Ignite | ✅ Complete | Gym member management, booking, availability |
| Resend | ✅ Complete | Transactional email (templates + inline), bounce/complaint webhooks |
| Twilio | ✅ Complete | SMS send/receive, agent channel |
| OpenAI | ✅ Complete | AI text generation, agent backbone |
| Anthropic | ✅ Complete | AI text generation (Claude), agent backbone |
| ManyChat | ✅ Stub | Instagram DM automation (adapter defined) |
| RevLine | ✅ Internal | Lead management, event logging, form triggers |

### Workflow Engine

All integrations are connected through the **Workflow Engine** — a configurable automation system with 11 adapters:

- **Triggers:** Events that start workflows (payments, bookings, email captures, SMS, bounces, new members, agent events)
- **Actions:** Operations workflows can execute (add to group, send email/SMS, generate text, route to agent, enroll member, etc.)
- **Decoupled:** Add new integrations without modifying existing code
- **Configurable:** Different actions per workspace without code changes

See [Workflow Engine Documentation](./WORKFLOW-ENGINE.md) for details.

---

## Non-Goals (Intentionally NOT Built Yet)

- ❌ Client-facing dashboards (clients see booking pages, not admin)
- ❌ Slack notifications
- ❌ Webhook replay UI
- ❌ Lead analytics / reporting
- ❌ OAuth (email+password auth only)

**Previously non-goals, now implemented:**
- ~~Multi-admin support~~ → ✅ Multi-user with organizations and workspace roles
- ~~Retry queues~~ → ✅ Execution retry with audit trail
- ~~Client dashboards~~ → ✅ Booking pages for clients

**Guiding Principle:** If it doesn't help detect or fix a revenue failure faster, it doesn't get built.

---

*Last updated: March 2026*




