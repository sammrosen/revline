# QA: Resend Multi-Webhook-Secret + Email Agent Flow Hardening

## What Changed

1. **Per-endpoint Resend webhook secrets** — Two separate signing secrets ("Webhook Secret - Delivery" and "Webhook Secret - Inbound") replace the single "Webhook Secret". Falls back to legacy name for backward compatibility.

2. **Default greeting fallback** — Agent proactive outreach no longer hard-fails when no `initialMessage` is configured. Falls back to a generic greeting and logs `agent_initiate_default_greeting`.

3. **Email HTML wrapping** — Agent email replies are wrapped in HTML with `white-space: pre-wrap` and XSS escaping for proper rendering in email clients.

---

## Part 1: Multi-Webhook Secrets

### Files Changed
- `app/_lib/integrations/config.ts` — Two new secret entries
- `app/_lib/integrations/resend.adapter.ts` — Per-type getWebhookSecret/verifyWebhook/isWebhookConfigured with fallback
- `app/api/v1/resend-webhook/route.ts` — Passes `'delivery'` to verification
- `app/api/v1/resend-inbound/route.ts` — Passes `'inbound'` to verification

### Smoke Test — Separate Secrets

1. Open dashboard -> workspace -> Resend integration -> Manage Secrets
2. Add "Webhook Secret - Delivery" with the signing secret from Resend's delivery webhook config
3. Add "Webhook Secret - Inbound" with the signing secret from Resend's inbound email webhook config
4. Send a test email -> delivery webhook fires
5. **Expected:** Signature verifies using the delivery-specific secret
6. Reply to an email -> inbound webhook fires
7. **Expected:** Signature verifies using the inbound-specific secret

### Smoke Test — Backward Compatibility

1. Remove "Webhook Secret - Delivery" and "Webhook Secret - Inbound"
2. Add single "Webhook Secret" (legacy name)
3. Send a test email -> delivery webhook fires
4. **Expected:** Falls back to legacy secret, verifies successfully
5. Reply -> inbound webhook fires
6. **Expected:** Falls back to legacy secret, verifies successfully

### Edge Cases

- [ ] Only "Webhook Secret - Delivery" set, inbound webhook arrives -> falls back to legacy, if no legacy either -> returns `webhookAck` with warning
- [ ] Neither secret configured -> both routes return `webhookAck` with "not configured" warning
- [ ] Wrong secret value -> signature verification fails, event emitted, 200 returned (fail-safe)

---

## Part 2: Default Greeting Fallback

### Files Changed
- `app/_lib/agent/engine.ts` — Fallback greeting in `initiateConversation()`

### Smoke Test

1. Create an agent with NO `initialMessage` set (leave blank)
2. Create a workflow: `contact-submitted` -> `create_lead` -> `route_to_agent` with NO `messageText`
3. Submit landing page form
4. **Expected:** Agent sends `"Hi! I'm reaching out from {workspace name}."` instead of failing
5. Check event log for `agent_initiate_default_greeting` event with `reason: 'no initialMessage configured'`

### With Initial Message Set

1. Set agent `initialMessage` to custom text
2. Submit form -> workflow fires
3. **Expected:** Custom initial message used (not fallback)

---

## Part 3: Email HTML Wrapping

### Files Changed
- `app/_lib/agent/adapter-registry.ts` — HTML wrapping in ResendChannelAdapter

### Smoke Test

1. Trigger an agent email send (proactive or reply)
2. Check received email in email client
3. **Expected:**
   - [ ] Line breaks preserved (not collapsed into one line)
   - [ ] No raw HTML tags visible in email body
   - [ ] Font renders as sans-serif, readable size
   - [ ] Special characters (`<`, `>`, `&`) display correctly (not as HTML entities in source)

### Regression

- [ ] SMS agent conversations still work (TwilioChannelAdapter unaffected)
- [ ] Webchat agent conversations still work
- [ ] Email delivery webhook events (bounces, opens) still processed correctly

---

## Automated Checks

```bash
npm run type-check    # Zero new errors
npm run test          # No test changes (webhook secret + engine behavior changes)
```
