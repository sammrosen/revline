# Pre-Push Routine

A comprehensive checklist to run before pushing code to the repository. Ensures code quality, security, and stability.

---

## Quick Start

```bash
# Run the full pre-push check (lint + type-check + test + build)
npm run pre-push
```

This command runs:
1. `npm run lint` - ESLint code quality checks
2. `npm run type-check` - TypeScript compilation check
3. `npm run test` - Vitest unit and integration tests
4. `npm run build` - Next.js production build

**All four must pass before pushing.**

---

## Pre-Push Checklist

### 1. Code Quality Checks

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

**Common lint issues:**
- Unused imports/variables
- Missing TypeScript types
- Console.log statements (remove or use proper logging)
- Inconsistent formatting

---

### 2. TypeScript Verification

```bash
# Type check without emitting
npm run type-check
```

**Ensure:**
- [ ] No `any` types without explicit justification
- [ ] All exported functions have explicit return types
- [ ] No TypeScript errors in the codebase

---

### 3. Run Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**Test coverage includes:**
- Unit tests (`__tests__/unit/`)
- Integration tests (`__tests__/integration/`)

**Before pushing, verify:**
- [ ] All existing tests pass
- [ ] New features have corresponding tests
- [ ] Edge cases are covered

---

### 4. Build Verification

```bash
# Production build
npm run build
```

**Build must complete without errors.**

Common build issues:
- Missing environment variables (check `env.example`)
- Import path errors
- Server/client component boundary issues

---

## Security Checklist

### Secrets & Encryption

- [ ] **No secrets in code** - All secrets use environment variables
- [ ] **No secrets in logs** - grep for `console.log` near sensitive operations
- [ ] **Encryption keys not committed** - Check `.env` is in `.gitignore`

```bash
# Search for potential secret leaks
grep -r "sk_live\|whsec_\|mlsk_\|re_" --include="*.ts" --include="*.tsx" .
```

### Authentication

- [ ] **Admin routes protected** - All `/admin/*` and `/api/admin/*` routes require authentication
- [ ] **Session handling correct** - HTTP-only cookies, secure in production
- [ ] **No auth bypass paths** - Review new routes for authentication

### Input Validation

- [ ] **All user input validated** - Email format, required fields
- [ ] **XSS prevention** - User input sanitized before display
- [ ] **SQL injection prevention** - Using Prisma parameterized queries (automatic)

### Webhook Security

- [ ] **Stripe webhooks verify signatures** - Using Stripe SDK verification
- [ ] **Calendly webhooks verify signatures** - HMAC SHA256 verification
- [ ] **Invalid signatures return 401** - Not 200

---

## Environment Variables

### Verify Required Variables

Before pushing changes that add new features, ensure `env.example` is updated:

```bash
# Required variables (cannot run without these)
DATABASE_URL          # PostgreSQL connection
REVLINE_ENCRYPTION_KEY_V1  # AES-256-GCM encryption key
STRIPE_API_KEY        # Stripe secret key

# Production features
RESEND_API_KEY        # Email alerts
ADMIN_ALERT_EMAIL     # Alert recipient
CRON_SECRET           # Health check authentication
```

### Check for New Variables

If you added new environment variables:
- [ ] Added to `env.example` with description
- [ ] Added to `docs/ENV.md` documentation
- [ ] Added to Railway/deployment environment

---

## Database Changes

### Schema Changes

If you modified `prisma/schema.prisma`:

```bash
# Generate Prisma client
npm run db:generate

# Create migration (development)
npm run db:migrate

# Verify migration files are committed
git status prisma/migrations/
```

**Before pushing:**
- [ ] Migration file created and committed
- [ ] Migration tested locally
- [ ] No data loss in migration (for production)

---

## Manual Testing Recommendations

### Critical Flows to Test

1. **Email Capture Flow**
   ```bash
   curl -X POST http://localhost:3000/api/subscribe \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","source":"demo"}'
   ```
   - [ ] Returns success response
   - [ ] Event logged in admin dashboard
   - [ ] MailerLite receives subscriber (if configured)

2. **Admin Login Flow**
   - [ ] Login page loads (`/admin/login`)
   - [ ] Can log in with valid password
   - [ ] Redirected to dashboard after login
   - [ ] Session persists across page refreshes

3. **Client Management**
   - [ ] Can create new client
   - [ ] Can pause/unpause client
   - [ ] Health check runs successfully

4. **2FA Flow** (if modifying auth)
   - [ ] Can enable 2FA from settings
   - [ ] QR code displays correctly
   - [ ] TOTP verification works
   - [ ] Recovery codes function

---

## Pre-Commit Sanity Checks

### Quick Verification

```bash
# Check git status
git status

# Review staged changes
git diff --staged

# Ensure no sensitive files staged
git diff --staged --name-only | grep -E "\.env|\.env\.local|\.env\.production"
```

### Files That Should NOT Be Committed

- `.env` / `.env.local` / `.env.production`
- `node_modules/`
- `.next/`
- Any file containing secrets

### Files That SHOULD Be Committed

- `env.example` (template without real values)
- `prisma/migrations/*` (database migrations)
- Updated documentation

---

## Common Issues & Solutions

### "Prisma Client not found"

```bash
npm run db:generate
```

### "Cannot find module" errors

```bash
rm -rf node_modules .next
npm install
npm run build
```

### Tests failing due to database

```bash
# Ensure test database is set up
export TEST_DATABASE_URL="postgresql://..."
npm run test
```

### Build fails with env var errors

Check that all required variables are in `.env.local`:
```bash
cat env.example  # Compare with your .env.local
```

---

## Full Pre-Push Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies (if package.json changed)
npm install

# 3. Generate Prisma client (if schema changed)
npm run db:generate

# 4. Run pre-push checks
npm run pre-push

# 5. If all pass, commit and push
git add .
git commit -m "Your commit message"
git push origin main
```

---

## CI/CD Pipeline

The same checks run in CI via `npm run ci`:

```bash
npm run ci  # Same as pre-push
```

**CI will fail if:**
- Lint errors present
- TypeScript errors present
- Tests fail
- Build fails

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint check |
| `npm run lint -- --fix` | Auto-fix lint issues |
| `npm run type-check` | TypeScript verification |
| `npm run test` | Run all tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run build` | Production build |
| `npm run pre-push` | Full pre-push check |
| `npm run ci` | CI pipeline check |

---

## When to Skip Checks

**Never skip `npm run pre-push` for:**
- Feature branches merging to main
- Any code affecting authentication
- Any code affecting payments/webhooks
- Database schema changes

**Acceptable to push without full checks:**
- Documentation-only changes (but still lint)
- README updates
- Non-code files (images, configs)

---

*Last updated: January 2025*

