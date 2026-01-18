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
- [ ] **No secrets in logs** - Verify console.log/error never includes credentials
- [ ] **No secrets in error messages** - API errors should be generic
- [ ] **Encryption keys not committed** - Check `.env` is in `.gitignore`
- [ ] **No secrets in URLs** - Credentials should be in headers only

```bash
# Search for potential secret leaks in code
grep -r "sk_live\|whsec_\|mlsk_\|re_\|app_key\|api_key" --include="*.ts" --include="*.tsx" .

# Search for secrets potentially in console output
grep -rn "console\.\(log\|error\)" --include="*.ts" -A 2 app/_lib/integrations/

# Verify error responses are generic (search for error returns)
grep -rn "return.*error\|ApiResponse.error" --include="*.ts" app/api/
```

### API Response Security

- [ ] **Error messages are generic** - No stack traces, internal paths, or DB errors exposed
- [ ] **No sensitive data in responses** - Secrets never returned, even partially
- [ ] **Rate limiting in place** - Public endpoints have rate limits

### Authentication

- [ ] **Admin routes protected** - All protected app and API routes require authentication
- [ ] **Session handling correct** - HTTP-only cookies, secure in production
- [ ] **No auth bypass paths** - Review new routes for authentication
- [ ] **Use `getAdminIdFromHeaders()`** - All admin API routes must validate session

### Input Validation

- [ ] **All user input validated** - Email format, required fields
- [ ] **XSS prevention** - User input sanitized before display
- [ ] **SQL injection prevention** - Using Prisma parameterized queries (automatic)
- [ ] **JSON payload validation** - Use Zod schemas for request bodies

### Webhook Security

- [ ] **Stripe webhooks verify signatures** - Using Stripe SDK verification
- [ ] **Calendly webhooks verify signatures** - HMAC SHA256 verification
- [ ] **Invalid signatures return 401** - Not 200
- [ ] **Webhook secrets encrypted** - Stored via `encryptSecret()`

---

## Architecture Compliance

### Integration Pattern (for new integrations)

- [ ] **Adapter extends `BaseIntegrationAdapter`** - Never call external APIs directly from routes
- [ ] **Static `forClient()` factory method** - Loads config from database
- [ ] **Uses `getSecret()` for credentials** - Never access secrets directly
- [ ] **Calls `touch()` on success** - Updates health status
- [ ] **Returns `IntegrationResult<T>`** - Consistent return type
- [ ] **Has `isConfigured()` validation** - Check for required secrets/meta

### Workflow Engine (if adding workflow actions)

- [ ] **Adapter added to `registry.ts`** - Triggers and actions defined
- [ ] **Type mapping in `validation.ts`** - `adapterIdToIntegrationType()` includes new type
- [ ] **Executor implemented** - `app/_lib/workflow/executors/{name}.ts`
- [ ] **Executor registered** - Added to `executors/index.ts`
- [ ] **Events emitted** - Success/failure events for all operations

### Frontend Wire-Up (if adding admin UI)

- [ ] **Config added to `integrations/config.ts`** - Secrets, meta template, tips
- [ ] **Add form supports type** - `add-integration-form.tsx`
- [ ] **Edit/Configure works** - `integration-actions.tsx`
- [ ] **Custom editor (if needed)** - `{name}-config-editor.tsx`

### Database Schema (if adding new types)

- [ ] **Enums updated** - `IntegrationType`, `EventSystem` in `schema.prisma`
- [ ] **Migration created** - `npx prisma migrate dev`
- [ ] **Types defined** - `app/_lib/types/index.ts` meta interface

---

## Integration Checklist (New Integration)

Use this checklist when adding a new external integration:

```
Backend:
- [ ] app/_lib/integrations/{name}.adapter.ts - Main adapter class
- [ ] app/_lib/integrations/config.ts - Integration config
- [ ] app/_lib/integrations/index.ts - Export adapter
- [ ] app/_lib/types/index.ts - Meta type definition
- [ ] app/_lib/workflow/registry.ts - Workflow adapter definition
- [ ] app/_lib/workflow/validation.ts - Type mapping
- [ ] app/_lib/workflow/executors/{name}.ts - Action executors
- [ ] app/_lib/workflow/executors/index.ts - Register executors
- [ ] prisma/schema.prisma - Add to enums

Frontend:
- [ ] app/workspaces/[id]/add-integration-form.tsx - Add support
- [ ] app/workspaces/[id]/integration-actions.tsx - Edit support
- [ ] app/workspaces/[id]/{name}-config-editor.tsx - Custom editor (optional)

Tests:
- [ ] __tests__/unit/{name}.test.ts - Unit tests
- [ ] __tests__/setup.ts - Test helper function (if needed)
```

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
- [ ] Make sure we migrate DATABASE_URL and PROD_DATABASE_URL ***THIS IS THE PROD DATABASE, MAKE SURE MIGRATIONS ARE SAFE TO RUN***

---

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

## Summary: What Could Break Production

Before pushing, ask yourself:

1. **Could secrets leak?**
   - No secrets in logs, URLs, or error messages
   - Secrets only in encrypted storage and HTTP headers

2. **Could authentication be bypassed?**
   - All admin routes use `getAdminIdFromHeaders()`
   - No new public endpoints without rate limiting

3. **Could data be corrupted?**
   - Database transactions for multi-step operations
   - Unique constraints prevent duplicates
   - Input validation on all user data

4. **Could integrations break?**
   - Adapter pattern followed (BaseIntegrationAdapter)
   - Type mapping updated in validation.ts
   - Tests cover success and error cases

5. **Is extensibility maintained?**
   - No hardcoded integration logic in routes
   - Configuration-driven behavior (database meta)
   - Clear separation: Route → Service → Adapter → API

**When in doubt, run `npm run pre-push` and review the changes with a colleague.**

---

*Last updated: January 2026*



