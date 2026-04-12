# Fix: All Forms Emit Proper Registered Payloads

## Context

When you add fields in the Build tab (address, message, etc.), they render in the form and get submitted — but the trigger payload system doesn't know about them. The Lead Properties UI only shows `name`, `phone`, `source` because it reads from a hardcoded static Zod schema (4 fields) and a dynamic augmentation that isn't properly surfacing the workspace's form fields.

Root cause: the form builder (Build tab) and the payload declaration system are disconnected. Adding a field in Build doesn't automatically register it as a trigger payload field — it requires manual wiring in multiple places. The fix makes the form's configured fields the single source of truth.

## Goals

- All form fields configured in the Build tab appear in the Lead Properties "available to add" list for the corresponding trigger
- The workflow registry testFields reflect the actual form fields per-trigger (not a global static set)
- Landing page form submissions send all fields uniformly (no known-fields/metadata split)
- Future field additions in Build automatically flow through the entire system with zero code changes

## Non-goals

- Booking/signup form field discovery (they have static payloads, not user-configurable)
- Deprecating `/api/v1/subscribe` (stays as-is for potential external use)
- Changing how email is handled (remains the lead identifier, not a lead property)

## Standards check

- [x] **Workspace isolation** — pagesConfig is always read per-workspace; no global operations
- [x] **Event-driven debugging** — no new state changes; existing event logging unchanged
- [x] **Abstraction first** — no integration-specific logic added to engine.ts; changes stay in adapter, form registry, and compatibility service
- [x] **Fail-safe defaults** — existing fallback behavior preserved (DEFAULT_REVLINE_TEST_FIELDS)
- [x] **Input validation** — form-submit endpoint already validates via `validateSubmissionBody()`; Zod schema with `.passthrough()` unchanged
- [x] **Error handling** — no new routes; existing structured `ApiResponse` preserved
- [ ] **Idempotency** — N/A (no schema provisioning or webhook changes)
- [ ] **Foreign key indexes** — N/A (no schema changes)
- [ ] **Webhook security** — N/A (no webhook endpoint changes)

## File-by-file changes

- `app/_lib/forms/registry.ts` — Add `getFormByTriggerId()` reverse lookup helper
- `app/_lib/services/payload-compatibility.ts` — Remove `STATIC_PAYLOAD_KEYS` filtering from `extractCustomFormFields()`, only filter `email`; add `extractFormFieldsForTrigger()` that maps trigger operation → form → fields
- `app/api/v1/workspaces/[id]/property-compatibility/route.ts` — Use `extractFormFieldsForTrigger(pagesConfig, operation)` instead of `extractCustomFormFields(pagesConfig)` for per-trigger field resolution
- `app/api/v1/workflow-registry/route.ts` — Move testFields construction inside `enabledForms.flatMap` loop for per-form resolution
- `app/public/[slug]/landing/client.tsx` — Remove `KNOWN_FIELDS`, switch from `/api/v1/subscribe` to `/api/v1/form-submit` with all fields flat in `data`

## Risks

- **Landing page regression**: `form-submit` requires `landing-page` to be enabled in `pagesConfig.forms`. If a workspace has a landing page but `forms['landing-page']` is not set, submission fails. Mitigation: `form-submit` already handles the case where RevLine config is not loaded (lines 131-148 allow submission).
- **Rollback**: revert the branch. No data migration, no schema changes.

## Verification

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] Manual: landing page with address + message fields → submit → fields appear in Lead Properties as "available to add"
- [ ] Manual: workflow registry API returns per-form testFields (landing fields differ from booking fields)
- [ ] `/audit` reports clean against this branch

## Todos

- [ ] Add `getFormByTriggerId()` to `app/_lib/forms/registry.ts`
- [ ] Update `extractCustomFormFields()` in `payload-compatibility.ts` to return all non-email fields; add `extractFormFieldsForTrigger()`
- [ ] Update `property-compatibility/route.ts` to use per-trigger field lookup
- [ ] Update `workflow-registry/route.ts` to build per-form testFields
- [ ] Switch `landing/client.tsx` from `/api/v1/subscribe` to `/api/v1/form-submit`
- [ ] Run type-check and tests
