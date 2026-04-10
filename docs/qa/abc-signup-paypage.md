# QA: ABC Signup + PayPage Payment Integration

## What Changed

Wired the signup page (`/public/[slug]/signup/`) to ABC Financial's Create Agreement API and replaced the raw card form (Step 5) with ABC's PayPage iframe for PCI-compliant payment tokenization. Card/bank numbers never touch our servers.

### Files Modified
- `app/_lib/types/index.ts` — Added `ppsId`, `sendAgreementEmail`, `paymentPlans` to `AbcIgniteMeta`; `abcPaymentPlanId` to `SignupPlan`
- `app/_lib/config/schema.ts` — Added `abcPaymentPlanId` to `SignupPlanSchema`
- `app/_lib/config/workspace-config.service.ts` — Pass through `abcPaymentPlanId` in `resolveSignupPlans()`
- `app/_lib/integrations/abc-ignite.adapter.ts` — Added types + methods: `getPlans()`, `getPlanDetails()`, `createAgreement()`, `getPpsId()`, `getSendAgreementEmail()`
- `app/public/[slug]/signup/steps/step-5-payment.tsx` — Full rewrite: PayPage iframe replaces raw card form
- `app/public/[slug]/signup/client.tsx` — Replaced card fields with PayPage tokens, wired real API submission
- `app/public/[slug]/signup/[[...step]]/page.tsx` — Loads ppsId from ABC adapter
- `app/(dashboard)/workspaces/[id]/abc-ignite-config-editor.tsx` — Added ppsId field, sendAgreementEmail toggle, Sync Plans button
- `app/(dashboard)/workspaces/[id]/_components/form-preview-mock.tsx` — Added `ppsId={null}` to preview

### File Created
- `app/api/v1/signup/[slug]/route.ts` — POST handler for agreement creation

## Smoke Tests

### Prerequisites
- A workspace with ABC Ignite integration configured (clubNumber, credentials, ppsId)
- Signup plans configured with `abcPaymentPlanId` values matching ABC payment plans
- Signup enabled in workspace config

### Happy Path
1. Navigate to `/public/{slug}/signup/`
2. Complete Step 2 (personal info): fill first name, last name, email, phone
3. Complete Step 3 (plan selection): select a plan with `abcPaymentPlanId` configured
4. Complete Step 4 (member info): fill address, city, state, zip, DOB
5. Step 5 (payment): PayPage iframe should load inside branded UI
6. Enter test payment info in the iframe
7. Iframe should return transactionId via postMessage — "Payment method accepted" indicator appears
8. Check both checkboxes (payment authorization + terms)
9. Click submit button
10. Should advance to Step 6 (confirmation) on success
11. Check event log — should see `signup_agreement_created` event with agreementNumber, memberId, planId, email

### Error Scenarios
1. **No ppsId configured**: Step 5 should show "Payment System Not Configured" message with Back button
2. **No abcPaymentPlanId on plan**: Submit should return 400 "Selected plan is not linked to a payment plan"
3. **ABC API down**: Submit should return 502, error shown to user, `signup_agreement_failed` event emitted
4. **PayPage iframe error**: Error message shown inline, user can retry
5. **Missing checkboxes**: Submit button should be disabled; validation errors shown if somehow triggered
6. **Rate limiting**: After 10 submits/minute from same IP, should return 429

### Dashboard Config
1. Open workspace ABC Ignite config editor
2. Verify ppsId text field is present
3. Verify sendAgreementEmail toggle is present (default: on)
4. Click "Sync Plans from ABC" — should fetch and display available payment plans
5. Toggle JSON mode — verify ppsId, sendAgreementEmail, paymentPlans are in output

### Preview Mode
1. In dashboard form preview, navigate to signup Step 5
2. Should show "Payment System Not Configured" (ppsId is null in preview)
3. Other steps should still work normally in preview

## Security Checks
- [ ] PayPage iframe validates `event.origin === 'https://apipayservice.abcfinancial.net'` before trusting postMessage
- [ ] No card/bank numbers in form state, API request body, or event metadata
- [ ] Transaction IDs are NOT logged in events (they're in the request body only)
- [ ] API route uses Zod validation on all input
- [ ] Rate limited with RATE_LIMITS.SUBSCRIBE (10/min)
- [ ] Adapter errors NOT leaked to client (generic user-facing messages)
- [ ] Workspace scoped via `getActiveWorkspace(slug)`

## Edge Cases
- Plan with expired/invalid `abcPaymentPlanId` — `getPlanDetails()` will fail, event emitted, 502 returned
- `planValidationHash` stale — fetched fresh at each submission, should always be current
- Double-submit — PayPage transactionId stays in state, retryable on backend error
- Browser blocks iframe (CSP) — may need `frame-src apipayservice.abcfinancial.net` in CSP config
- ABC sandbox vs production — PayPage origin is hardcoded to production; sandbox would need code change

## Regression
- [ ] Existing signup preview still works (ppsId={null})
- [ ] Existing ABC Ignite features (calendar, member sync) unaffected
- [ ] Type-check passes
- [ ] Lint passes (only pre-existing warnings)
