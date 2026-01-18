# RevLine

**Multi-client RevOps automation platform** for agencies running inbound capture and routing solutions for businesses.

## What is RevLine?

RevLine is an internal operations platform that lets you manage automation services for multiple business clients from a single dashboard. Each client gets their own encrypted integrations, event logging, and health monitoring—without touching code or environment files.

**Core capabilities:**
- 🔐 **Encrypted per-client secrets** - MailerLite, Stripe, Calendly credentials stored securely in Postgres
- 📊 **Event logging** - Full audit trail for every automation action
- ⏸️ **Instant client controls** - Pause/unpause any client with one click
- 🏥 **Health monitoring** - Automatic checks every 15 minutes with email alerts
- 🎯 **Lead tracking** - Follow customers through capture → booking → payment stages

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

RevLine supports these integrations per-client:

| Integration | Purpose |
|-------------|---------|
| **MailerLite** | Email capture and subscriber management |
| **Stripe** | Payment webhooks and customer tracking |
| **Calendly** | Booking webhooks and appointment tracking |
| **ManyChat** | Instagram DM automation (coming soon) |

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
├── (dashboard)/           # App dashboard (protected)
│   ├── workspaces/       # Workspace management
│   ├── login/            # User authentication
│   └── onboarding/       # Client setup wizard
├── api/
│   ├── v1/               # API routes (auth, workspaces, integrations, etc.)
│   ├── subscribe/        # Email capture endpoint
│   ├── stripe-webhook/   # Stripe webhook handler
│   ├── calendly-webhook/ # Calendly webhook handler
│   └── cron/             # Health check cron job
├── _lib/
│   ├── integrations/     # Integration adapters
│   ├── services/         # Business logic
│   ├── middleware/       # Rate limiting, etc.
│   └── utils/            # Validation, API responses
└── (landing pages)/      # Client-facing pages

__tests__/
├── unit/                 # Unit tests
└── integration/          # Integration tests

docs/                     # Documentation
prisma/                   # Database schema & migrations
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

- All client secrets are encrypted with AES-256-GCM before storage
- Admin passwords hashed with Argon2id
- Session-based authentication with HTTP-only cookies
- Rate limiting on all public endpoints
- Input validation and XSS sanitization
- Webhook signature verification (Stripe, Calendly)

## License

Private - Internal use only.
