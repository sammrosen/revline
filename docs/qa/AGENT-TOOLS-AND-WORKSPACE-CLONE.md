# QA: Agent Tools Bridge + Workspace Clone

## What Changed

1. **Agent Tool Bridge** — Workflow executors (Pipedrive, MailerLite, Resend, Twilio, RevLine, ABC Ignite) are now registered as agent tools via `app/_lib/agent/tools/workflow-bridge.ts`. AI agents can call these mid-conversation.

2. **Workspace Clone** — `POST /api/v1/workspaces/{id}/clone` clones a workspace's config, agents, workflows, webchat/phone configs, and integration metadata (not secrets).

---

## Part 1: Agent Tools Bridge

### Smoke Test — Tools Registered

1. Start dev server: `npm run dev`
2. Open dashboard → any workspace → Agents → create or edit an agent
3. In the "Enabled Tools" section, verify new tools appear:
   - `pipedrive.create_or_update_person`
   - `pipedrive.create_deal`
   - `pipedrive.update_deal`
   - `pipedrive.move_deal_stage`
   - `pipedrive.update_person_fields`
   - `revline.create_lead`
   - `revline.update_lead_properties`
   - `revline.update_lead_stage`
   - `revline.emit_event`
   - `mailerlite.add_to_group`
   - `mailerlite.remove_from_group`
   - `mailerlite.add_tag`
   - `resend.send_email`
   - `twilio.send_sms`
   - `abc_ignite.lookup_member`
   - `abc_ignite.check_availability`
   - `abc_ignite.enroll_member`
   - `abc_ignite.unenroll_member`
   - `abc_ignite.add_to_waitlist`
   - `abc_ignite.remove_from_waitlist`
4. Verify the 4 original scheduling tools still appear:
   - `check_availability`, `book_appointment`, `lookup_customer`

### E2E — Agent Uses Pipedrive Tool

**Prereqs:** Workspace with Pipedrive integration configured (API token set).

1. Create/edit an agent with:
   - `enabledTools`: `["pipedrive.create_or_update_person", "pipedrive.create_deal"]`
   - System prompt that instructs: "When a lead wants to sign up, create them in Pipedrive and open a deal."
2. Open Test Chat panel
3. Send: "Hi, I'm John Smith, john@test.com, I want to sign up for the premium plan"
4. **Expected:** Agent calls `pipedrive.create_or_update_person` with name/email, then `pipedrive.create_deal`, then responds to the user with confirmation
5. **Verify in Pipedrive:** Person + deal created
6. **Verify in Event Log:** `agent_response_sent` event with tool calls in turn log

### E2E — Agent Uses Revline Lead Tools

**Prereqs:** Any workspace.

1. Create/edit an agent with:
   - `enabledTools`: `["revline.create_lead", "revline.update_lead_stage"]`
   - System prompt: "When someone provides their email, create a lead and mark them as BOOKED."
2. Open Test Chat
3. Send: "Hey, my email is test-agent@example.com"
4. **Expected:** Agent calls `revline.create_lead`, then `revline.update_lead_stage` with stage=BOOKED
5. **Verify in Leads tab:** Lead created with stage=BOOKED

### E2E — Agent Uses Resend Email

**Prereqs:** Workspace with Resend integration configured (API key + fromEmail in meta).

1. Create/edit an agent with:
   - `enabledTools`: `["resend.send_email"]`
   - System prompt: "When the user asks for a confirmation email, send one."
2. Open Test Chat
3. Send: "Can you send me a confirmation at sam@test.com?"
4. **Expected:** Agent calls `resend.send_email` with subject/body params
5. **Verify:** Email delivered (check Resend dashboard)

### Regression — Scheduling Tools Still Work

1. Agent with `enabledTools`: `["check_availability", "book_appointment"]`
2. Test Chat: "What times do you have available tomorrow?"
3. **Expected:** Agent calls `check_availability`, returns slots, same behavior as before

---

## Part 2: Workspace Clone

### Smoke Test — Clone Endpoint

```bash
# Replace {WORKSPACE_ID} with a real workspace ID, {SESSION_COOKIE} with valid session
curl -X POST http://localhost:3000/api/v1/workspaces/{WORKSPACE_ID}/clone \
  -H "Content-Type: application/json" \
  -H "Cookie: session={SESSION_COOKIE}" \
  -d '{"name": "Test Clone", "slug": "test-clone"}'
```

**Expected response (201):**
```json
{
  "success": true,
  "data": {
    "workspaceId": "...",
    "name": "Test Clone",
    "slug": "test-clone",
    "cloned": {
      "integrations": 5,
      "agents": 2,
      "agentFiles": 1,
      "workflows": 3,
      "webchatConfigs": 1,
      "phoneConfigs": 1
    }
  }
}
```

### E2E — Full Clone Verification

1. Pick a fully-configured source workspace (e.g., existing client)
2. Clone it via the API
3. Open cloned workspace in dashboard and verify:
   - [ ] **Timezone** matches source
   - [ ] **Lead stages** match source (same pipeline)
   - [ ] **Lead property schema** matches source
   - [ ] **Pages config** matches source (branding, copy, signup plans)
   - [ ] **Integrations** are listed but have NO secrets (need to re-enter API keys)
   - [ ] **Integration meta** (group IDs, field mappings) copied correctly
   - [ ] **Agents** cloned with correct system prompts, enabled tools, guardrails
   - [ ] **Agent files** (RAG docs) cloned
   - [ ] **Workflows** cloned with correct triggers + actions
   - [ ] **Webchat configs** present with correct agent references (new IDs, not old)
   - [ ] **Phone configs** present
4. Verify source workspace is **unchanged** (no side effects)

### Edge Cases

- [ ] Clone with duplicate slug → should return 400 "slug already exists"
- [ ] Clone as MEMBER role → should return 403 (only OWNER/ADMIN)
- [ ] Clone workspace with no agents/workflows → should succeed with `cloned` counts at 0
- [ ] Cloned workspace functions independently — editing config doesn't affect source

### Security

- [ ] Integration secrets are NOT copied (verify `secrets` field is null on cloned integrations)
- [ ] Cloned workspace has no leads, conversations, events (clean slate)
- [ ] Only authenticated users with OWNER/ADMIN on source can clone

---

## Automated Tests

```bash
npm run type-check          # TypeScript compilation
npm run test                # 461 tests pass (no new tests added — these are integration features)
```
