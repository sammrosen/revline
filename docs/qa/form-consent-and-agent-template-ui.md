# QA: Form Consent Recording + Agent Prompt Template UI

## What Changed

1. **Form Consent Recording** -- Landing page form submissions now record consent via `ConsentRecord` when the consent checkbox is checked. This unblocks proactive agent outreach (route_to_agent) which checks `checkConsent()` before sending.

2. **Agent Prompt Template Picker** -- The agent editor's System Prompt section now has a "Use Template" button that opens a modal to pick a template, fill variables, optionally provide reference content for AI generation, and apply the generated prompt.

---

## Part 1: Form Consent Recording

### Files Changed
- `app/public/[slug]/landing/client.tsx` -- sends `consentGiven` + `consentText` in fetch body
- `app/api/v1/form-submit/route.ts` -- imports consent service, validates consent fields, fire-and-forget `recordConsent()` for EMAIL/SMS

### Smoke Test -- Consent Recorded on Form Submit

**Prereqs:** Workspace with a landing page configured, `consentText` set in pages config, a phone field in `formFields`.

1. Open landing page: `http://localhost:3000/public/{slug}/landing`
2. Fill out form with email + phone, check consent checkbox
3. Submit
4. **Verify in DB:** `ConsentRecord` rows created for both EMAIL and SMS channels:
   ```sql
   SELECT * FROM consent_records WHERE workspace_id = '{WORKSPACE_ID}' ORDER BY granted_at DESC;
   ```
   - [ ] Row for EMAIL channel with `contact_address` = submitted email
   - [ ] Row for SMS channel with `contact_address` = submitted phone
   - [ ] `consent_type` = 'MARKETING'
   - [ ] `method` = 'WEB_FORM'
   - [ ] `language_presented` = the verbatim `consentText` from config
   - [ ] `ip_address` captured
   - [ ] `revoked_at` is null

### E2E -- Agent Proactive Outreach After Form

**Prereqs:** Workspace with landing page, consent text, workflow: `contact-submitted` trigger -> `create_lead` action -> `route_to_agent` action (proactive mode).

1. Submit landing page form with email + phone
2. **Expected:** Workflow fires, lead created, agent initiates conversation (no `no_consent` error)
3. **Verify in Event Log:** `consent_granted` event + `agent_route_success` event (not `agent_route_failed` with `no_consent`)

### Edge Cases

- [ ] Submit form **without** `consentText` configured in pages -> no consent fields sent, no consent recorded, form submits normally
- [ ] Submit form with email only (no phone field) -> only EMAIL consent recorded, no SMS consent
- [ ] Submit form with phone only (no email field) -> only SMS consent recorded
- [ ] Duplicate submission (same email in same minute) -> dedup returns success, consent upserted (idempotent)
- [ ] `consentText` over 2000 chars -> consent fields silently dropped (validation rejects), form still submits

### Regression

- [ ] Forms without consent checkbox still work (no consent fields sent, no consent recorded)
- [ ] Existing workflows unaffected
- [ ] Agent reactive mode (inbound SMS -> route_to_agent) still works without consent check

---

## Part 2: Agent Prompt Template Picker

### Files Changed
- `app/(dashboard)/workspaces/[id]/_components/prompt-template-picker.tsx` -- NEW modal component
- `app/(dashboard)/workspaces/[id]/agent-editor.tsx` -- "Use Template" button + state

### Smoke Test -- Template Picker Opens

1. Start dev server: `npm run dev`
2. Open dashboard -> any workspace -> Agents -> create or edit an agent
3. In the "System Prompt" section, verify "Use Template" button appears (violet outline, Sparkles icon)
4. Click it -> modal opens with template cards
5. **Expected:** 3 templates: Virtual Receptionist, Appointment Booker, Support

### E2E -- Generate Prompt from Template

1. Click "Use Template" -> select "Virtual Receptionist"
2. Fill required fields: Agent Name, Business Name, Agent Goal, CTA Text, CTA Link, Escalation Contact
3. Click "Generate Prompt"
4. **Expected:** Preview step shows generated system prompt with variables filled in
5. Click "Use This Prompt"
6. **Expected:**
   - [ ] System prompt textarea populated with generated prompt
   - [ ] Initial message auto-filled (e.g., "Hi! I'm Alex from Acme Fitness...")
   - [ ] For Appointment Booker template: `enabledTools` updated with scheduling tools

### E2E -- AI-Generated Variables (with Reference Content)

**Prereqs:** Workspace with an AI integration configured (OpenAI or Anthropic).

1. Select a template with `ai_generated` variables (e.g., Virtual Receptionist has `businessDescription`, `businessContext`, `qualificationQuestions`)
2. Paste business info into the "Reference Content" textarea
3. Click "Generate Prompt"
4. **Expected:** AI-generated fields filled with context-specific content derived from reference content

### E2E -- Placeholder Fallback (without Reference Content)

1. Select a template, fill required user_input fields, leave Reference Content empty
2. Click "Generate Prompt"
3. **Expected:** AI-generated fields show `[FILL: description]` placeholders for manual editing

### Edge Cases

- [ ] Missing required fields -> error message "Please fill in: ..."
- [ ] API error on generate -> error displayed in modal, agent editor unaffected
- [ ] Cancel/close modal -> no changes to agent data
- [ ] Back button navigation: fill -> pick (resets template selection), preview -> fill (retains inputs)
- [ ] Rate limit: 10 generate requests per minute per user (11th returns 429)

### Security

- [ ] Template list endpoint (`/api/v1/agents/templates`) is public (intentional, static metadata only)
- [ ] Generate endpoint (`/api/v1/workspaces/{id}/agents/generate-prompt`) requires auth + workspace access
- [ ] VIEWER role on generate endpoint -> returns 403

---

## Automated Checks

```bash
npm run type-check    # Zero new errors (pre-existing actionflow errors only)
npm run test          # No test changes (these are UI + route changes)
```
