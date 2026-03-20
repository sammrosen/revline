# RevLine

**Multi-client RevOps automation platform** for agencies running inbound capture and routing solutions for businesses.

## What is RevLine?

RevLine is an internal operations platform that lets you manage automation services for multiple business clients from a single dashboard. Each client gets their own encrypted integrations, event logging, and health monitoring—without touching code or environment files.

**Core capabilities:**
- 🔐 **Encrypted per-workspace secrets** — 10 integration types with AES-256-GCM encryption
- 📊 **Event logging** — Full audit trail for every automation action (12 system types)
- ⏸️ **Instant workspace controls** — Pause/unpause any workspace with one click
- 🏥 **Health monitoring** — Automatic checks every 15 minutes with email/Pushover alerts
- 🎯 **Lead tracking** — Custom pipeline stages and properties per workspace
- 🔄 **Workflow engine** — 11-adapter trigger → action automation system
- 🤖 **AI agents** — Autonomous SMS conversations via OpenAI/Anthropic + Twilio
- 📅 **Booking system** — Provider-agnostic with magic link confirmation
- 👥 **Multi-user auth** — Organizations, workspace roles (Owner/Admin/Member/Viewer)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment (see docs/ENV.md)
cp env.example .env.local
# Edit .env.local with your DATABASE_URL and REVLINE_ENCRYPTION_KEY

# Run database migrations
npx prisma migrate deploy

# Seed admin user
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000/workspaces](http://localhost:3000/workspaces) to access the dashboard.

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](./docs/SETUP.md) | Local development + Railway deployment |
| [Architecture](./docs/ARCHITECTURE.md) | System design, database schema, API routes |
| [Operations](./docs/OPERATIONS.md) | Client onboarding, troubleshooting, maintenance |
| [Standards](./docs/STANDARDS.md) | Coding standards and architectural patterns |
| [Environment](./docs/ENV.md) | Environment variable reference |

## Tech Stack

- **Next.js 16** (App Router) - Full-stack React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **PostgreSQL** - Database (via Prisma ORM)
- **AES-256-GCM** - Secret encryption
- **Argon2id** - Password hashing

## Integrations

RevLine supports 10 integration types per-workspace:

| Integration | Purpose |
|-------------|---------|
| **MailerLite** | Email capture, subscriber groups, tagging |
| **Stripe** | Payment/subscription webhooks |
| **Calendly** | Booking webhooks and appointment tracking |
| **ABC Ignite** | Gym member management, booking, availability |
| **Resend** | Transactional email (templates + inline), bounce/complaint webhooks |
| **Twilio** | SMS send/receive, AI agent channel |
| **OpenAI** | AI text generation, agent backbone |
| **Anthropic** | AI text generation (Claude), agent backbone |
| **ManyChat** | Instagram DM automation (stub) |
| **RevLine** | Internal lead management, event logging, form triggers |

## Testing

RevLine includes comprehensive CI/CD testing for all business-critical features.

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Full CI check (lint + type-check + test + build)
npm run ci
```

### Test Coverage

| Module | Tests | Priority |
|--------|-------|----------|
| Encryption/Decryption | 18 | P0 - Critical |
| Client Gating | 17 | P0 - Critical |
| Stripe Webhooks | 14 | P0 - Critical |
| Email Capture | 9 | P0 - Critical |
| Input Validation | 42 | P1 - High |

### CI/CD Pipeline

On every push to `main`:

```
Push → ESLint → Type Check → Unit Tests → Integration Tests → Build → Deploy
```

GitHub Actions workflow is configured in `.github/workflows/ci.yml`.

**Required GitHub Secrets:**
- `TEST_DATABASE_URL` - PostgreSQL connection string for test database

## Project Structure

```
app/
├── (auth)/                # Auth pages (login, setup)
├── (dashboard)/           # Protected dashboard
│   ├── workspaces/        # Workspace management + config editors
│   ├── settings/          # App settings
│   └── onboarding/        # Onboarding wizard
├── api/v1/                # API routes
│   ├── auth/              # Login, logout, 2FA
│   ├── organizations/     # Org CRUD + members + templates
│   ├── workspaces/        # Workspace CRUD + agents, domain, health
│   ├── integrations/      # Integration CRUD + secrets, sync
│   ├── workflows/         # Workflow CRUD + executions
│   ├── booking/           # Booking request, confirm, lookup
│   ├── *-webhook/         # Stripe, Calendly, Resend, Twilio webhooks
│   └── cron/              # Health check, data cleanup, ABC sync
├── _lib/
│   ├── integrations/      # 10 integration adapters
│   ├── workflow/           # Workflow engine + 9 executors
│   ├── agent/             # AI agent engine
│   ├── booking/           # Booking system + magic links
│   ├── reliability/       # Webhook processor, idempotency
│   ├── services/          # Business logic
│   └── forms/             # Form system
├── public/[slug]/         # Public signup flow
├── book/[workspaceSlug]/  # Booking pages
└── [landing-pages]/       # Client-facing pages

__tests__/
├── unit/                  # Unit tests
└── integration/           # Integration tests

docs/                      # Documentation
prisma/                    # Database schema & 18 migrations
```

## Landing Pages

RevLine also serves as the host for client landing pages. Each landing page can capture emails and route them to the appropriate client's integrations.

**Current pages:**
- `/` - RevLine marketing page
- `/fit1` - FIT1 coaching program
- `/demo` - Demo landing page
- `/cyclic`, `/diet`, `/semi-private` - Client landing pages

### Creating a New Landing Page

1. Create `app/your-page/page.tsx`
2. Use the `EmailCapture` component with a `source` prop
3. Set up the client in the admin dashboard
4. Their MailerLite integration handles the rest

```tsx
import EmailCapture from '@/app/_components/EmailCapture';

export default function YourPage() {
  return (
    <div>
      <h1>Your Landing Page</h1>
      <EmailCapture 
        source="your-client-slug"
        buttonText="Get Started"
      />
    </div>
  );
}
```

## Deployment

RevLine is designed for Railway deployment with Docker.

```bash
# Build the Docker image
docker build -t revline .

# Deploy to Railway
railway up
```

See [docs/SETUP.md](./docs/SETUP.md) for detailed deployment instructions.

## Development

```bash
# Start dev server
npm run dev

# Database commands
npm run db:migrate     # Run migrations
npm run db:push        # Push schema changes
npm run db:seed        # Seed admin user

# Code quality
npm run lint           # ESLint
npm run type-check     # TypeScript check
npm run test           # Vitest
npm run ci             # Full CI check
```

## Security

- All workspace secrets are encrypted with AES-256-GCM before storage (keyring with version support)
- User passwords hashed with Argon2id (64MB memory, 3 iterations)
- Session-based authentication with HTTP-only cookies
- Optional TOTP 2FA with recovery codes
- Rate limiting on all public endpoints (global + per-route)
- Zod input validation on all external input
- Webhook signature verification (Stripe, Calendly, Resend, Twilio)
- SMS opt-out compliance tracking

## License

Private - Internal use only.
