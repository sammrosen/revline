# Phone Infrastructure — Inbound Call & SMS for Contractors

> **Created:** March 29, 2026
> **Scope:** Missed-call interception via Twilio, auto-text, AI agent takeover, notification-only mode, escalation SMS to contractor, blocklist, and a new "Phone" tab in the workspace dashboard.

---

## Status Summary

| Feature | Status | Phase |
|---------|--------|-------|
| 1.1 `PhoneConfig` Prisma model + migration | DONE | 1 |
| 1.2 Phone config CRUD API | DONE | 1 |
| 1.3 Phone dashboard tab + sidebar | DONE | 1 |
| 1.4 Phone config editor UI | DONE | 1 |
| 2.1 Voice webhook (`POST /api/v1/twilio-voice`) | DONE | 2 |
| 2.2 Missed-call handler (blocklist, lead upsert, auto-text) | DONE | 2 |
| 2.3 Agent-mode conversation start (proactive outreach) | DONE | 2 |
| 2.4 `missed_call` trigger in workflow registry | DONE | 2 |
| 3.1 SMS escalation in `notifyEscalation` | NOT STARTED | 3 |
| 3.2 Resolution metadata on conversation completion | NOT STARTED | 3 |
| 3.3 Resolution-driven notification templates | NOT STARTED | 3 |

**Key decisions:**
- **Carrier-side forwarding.** The contractor configures "forward unanswered calls" on their carrier. By the time Twilio receives the call, it's already missed. No `<Dial>`, no Twilio-side call bridging. The voice webhook plays a greeting, hangs up, and fires the missed-call flow asynchronously.
- **PhoneConfig is workspace-level, not agent-level.** A phone config ties a Twilio number to a missed-call behavior (notification vs agent). The same agent can serve webchat, SMS, and phone — the phone config just selects which agent to activate for missed calls.
- **Two modes, one model.** `NOTIFICATION` mode sends a heads-up to the contractor and an auto-text to the caller — contractor texts them back from their personal phone. `AGENT` mode sends an auto-text and starts an AI conversation via SMS.
- **No SMS bridging.** In notification mode, the contractor texts the lead directly from their personal number. Revline logs the lead capture but doesn't broker the conversation. This eliminates the entire forwarding-thread complexity.
- **Hardcoded core path, workflow-driven extensions.** The voice webhook handles the deterministic flow (blocklist → greeting → auto-text → agent/notification) directly. It emits `twilio.missed_call` so workflows can add secondary automations (Pipedrive sync, MailerLite tagging, etc.).
- **Escalation = SMS to forwarding number.** The existing email-only `notifyEscalation` is extended with an SMS path. When an agent escalates or resolves, the contractor gets a text at their personal cell with a summary and lead link.

---

## Architecture

### Call Flow

```
Customer calls contractor's public number
    │
    ├── Contractor answers → normal call, Revline not involved
    │
    └── Contractor doesn't answer
        │
        ▼
    Carrier forwards to assigned Twilio number
        │
        ▼
    POST /api/v1/twilio-voice?source={workspaceSlug}
        │
        ├── Verify Twilio signature
        ├── Resolve workspace via slug
        ├── Find PhoneConfig matching the Twilio number (To header)
        ├── Check caller against blocklist → if blocked, empty TwiML
        │
        ├── Return TwiML: <Say>{voiceGreeting}</Say><Hangup/>
        │
        └── Async (fire-and-forget after TwiML response):
            │
            ├── Upsert lead (caller phone → lead record)
            │
            ├── emitTrigger('twilio', 'missed_call', { from, to, ... })
            │
            └── Based on PhoneConfig.mode:
                │
                ├── NOTIFICATION:
                │   ├── Send auto-text to caller via Twilio
                │   │   "Hey! Sorry I missed your call. How can I help?"
                │   │
                │   └── Send notification SMS to contractor's personal cell
                │       "Missed call from +15551234567. Text them back!"
                │
                └── AGENT:
                    └── Start proactive agent conversation
                        ├── handleInboundMessage (synthetic trigger)
                        ├── Agent sends auto-text as initial message
                        ├── Conversation is now ACTIVE
                        └── Caller replies via SMS → existing SMS webhook
                            → active conversation found → agent handles it
```

### Notification Mode (No Agent)

```
Missed call hits Twilio
    │
    ▼
Voice webhook
    ├── TwiML greeting + hangup
    ├── Upsert lead
    ├── Send auto-text to caller (from Twilio number)
    └── Send notification to contractor's personal cell
        │
        ▼
Contractor sees notification on personal phone
    └── Texts lead back directly from personal number
        (Revline not involved in the ongoing conversation)
```

### Agent Mode

```
Missed call hits Twilio
    │
    ▼
Voice webhook
    ├── TwiML greeting + hangup
    ├── Upsert lead
    └── Start agent conversation (proactive outreach)
        ├── Agent sends auto-text as first message
        └── Conversation status: ACTIVE
                │
                ▼
Caller replies via SMS to Twilio number
    │
    ▼
POST /api/v1/twilio-webhook (existing)
    ├── Finds ACTIVE conversation for this contactAddress + channelAddress
    └── Routes directly to handleInboundMessage
        │
        ▼
Agent qualifies, answers questions, books appointment
    │
    └── On resolution:
        ├── Booked → "New lead booked for Tue 3pm" SMS to contractor
        ├── Soft escalation → "New lead from +1555... — [summary]" SMS to contractor
        ├── Hard escalation → "Lead needs you now — +1555..." SMS to contractor
        └── No response (timeout) → log only, no notification
```

### PhoneConfig and Agent Relationship

```
                    ┌────────────────────────────┐
                    │        PhoneConfig          │
                    │  ─────────────────────────  │
                    │  twilioNumberKey: "main"    │
                    │  forwardingNumber: +1555... │
                    │  mode: AGENT               │
                    │  agentId: "abc-123"         │
                    │  autoTextTemplate: "Hey..." │
                    │  voiceGreeting: "Thanks..." │
                    │  blocklist: ["+1444..."]    │
                    └─────────┬──────────────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │          Agent              │
                    │  ─────────────────────────  │
                    │  channels: [SMS, WEB_CHAT]  │
                    │  systemPrompt: "You are..." │
                    │  tools: [scheduling]        │
                    │  escalationPattern: [ESC]   │
                    └────────────────────────────┘
```

The PhoneConfig tells the system "when a missed call hits this Twilio number, activate this agent via SMS." The agent's own channel config determines how it sends messages. The forwarding number is where contractor notifications go.

---

## Data Model

### PhoneConfig

```prisma
model PhoneConfig {
  id          String @id @default(uuid())
  workspaceId String @map("workspace_id")
  name        String

  // Which Twilio phone number receives the forwarded calls
  // Key into TwilioMeta.phoneNumbers (e.g., "main")
  twilioNumberKey String @map("twilio_number_key")

  // Contractor's personal cell — where notifications/escalations go
  forwardingNumber String @map("forwarding_number")

  // Operating mode
  mode String @default("NOTIFICATION") // "NOTIFICATION" | "AGENT"

  // Agent config (mode = AGENT only)
  agentId String? @map("agent_id")

  // Templates
  autoTextTemplate     String @default("Hey! Sorry I missed your call. How can I help?") @map("auto_text_template") @db.Text
  voiceGreeting        String @default("Thanks for calling. We'll text you right away.") @map("voice_greeting") @db.Text
  notificationTemplate String @default("Missed call from {{callerPhone}}. Text them back!") @map("notification_template") @db.Text

  // Blocklist — JSON array of E.164 phone numbers to ignore
  blocklist Json @default("[]")

  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  agent     Agent?    @relation(fields: [agentId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
  @@unique([workspaceId, twilioNumberKey])
  @@map("phone_configs")
}
```

**Key design choices:**
- `twilioNumberKey` references a key from `TwilioMeta.phoneNumbers`, not a raw E.164 number. This avoids duplication and stays consistent if the number changes in Twilio config.
- `@@unique([workspaceId, twilioNumberKey])` — one phone config per Twilio number per workspace. A Twilio number can't have two different missed-call behaviors.
- `blocklist` is JSON array, not a separate model. Contractors have a handful of personal numbers to exclude (spouse, business partner) — not hundreds. JSON is simpler and avoids a join.
- `notificationTemplate` supports `{{callerPhone}}` and `{{callerName}}` template variables.
- `forwardingNumber` is the contractor's personal cell. In notification mode, notifications go here. In agent mode, escalation SMSes go here.

### Workspace Relations Update

```prisma
model Workspace {
  // ... existing fields ...
  phoneConfigs PhoneConfig[]
}

model Agent {
  // ... existing fields ...
  phoneConfigs PhoneConfig[]
}
```

---

## File Touchpoints

### New Files

| File | Purpose |
|------|---------|
| `app/api/v1/twilio-voice/route.ts` | Voice webhook — TwiML greeting, missed-call processing |
| `app/api/v1/workspaces/[id]/phone-configs/route.ts` | List + create phone configs |
| `app/api/v1/workspaces/[id]/phone-configs/[configId]/route.ts` | Get, update, delete phone config |
| `app/_lib/phone/missed-call-handler.ts` | Core missed-call processing logic (blocklist, lead upsert, auto-text, agent start, notification) |
| `app/(dashboard)/workspaces/[id]/phone-config-list.tsx` | Dashboard UI — manage phone configs |
| `prisma/migrations/YYYYMMDD_phone_config/migration.sql` | Create `phone_configs` table |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PhoneConfig` model, add `phoneConfigs` relation to `Workspace` and `Agent` |
| `app/_lib/workflow/registry.ts` | Add `missed_call` trigger to `TWILIO_ADAPTER` |
| `app/_lib/agent/escalation.ts` | Add SMS escalation path (send to forwarding number via Twilio) |
| `app/_lib/agent/engine.ts` | Emit resolution metadata on conversation completion (resolution type, summary) |
| `app/(dashboard)/_components/sidebar/WorkspaceNav.tsx` | Add "Phone" to sidebar navigation |
| `app/(dashboard)/workspaces/[id]/workspace-tabs.tsx` | Add "Phone" tab |
| `app/(dashboard)/workspaces/[id]/page.tsx` | Fetch phone configs for the Phone tab |
| `app/(dashboard)/workspaces/[id]/twilio-config-editor.tsx` | Show voice webhook URL alongside existing SMS webhook URL |

---

## Phase 1 — Data Model + Config + Dashboard

The foundation: phone config model, CRUD API, dashboard tab.

### 1.1 Prisma Schema + Migration

Add `PhoneConfig` model as defined above. Add `phoneConfigs` relation on `Workspace` and `Agent`.

Write manual migration SQL:
```sql
CREATE TABLE "phone_configs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "twilio_number_key" TEXT NOT NULL,
  "forwarding_number" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'NOTIFICATION',
  "agent_id" TEXT REFERENCES "agents"("id") ON DELETE SET NULL,
  "auto_text_template" TEXT NOT NULL DEFAULT 'Hey! Sorry I missed your call. How can I help?',
  "voice_greeting" TEXT NOT NULL DEFAULT 'Thanks for calling. We''ll text you right away.',
  "notification_template" TEXT NOT NULL DEFAULT 'Missed call from {{callerPhone}}. Text them back!',
  "blocklist" JSONB NOT NULL DEFAULT '[]',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "phone_configs_workspace_id_idx" ON "phone_configs"("workspace_id");
CREATE INDEX "phone_configs_agent_id_idx" ON "phone_configs"("agent_id");
CREATE UNIQUE INDEX "phone_configs_workspace_id_twilio_number_key_key"
  ON "phone_configs"("workspace_id", "twilio_number_key");
```

### 1.2 Phone Config CRUD API

`app/api/v1/workspaces/[id]/phone-configs/route.ts` — GET (list) and POST (create).

`app/api/v1/workspaces/[id]/phone-configs/[configId]/route.ts` — GET, PATCH, DELETE.

Follow the same pattern as `webchat-configs` API routes. Validate with Zod:

```typescript
const PhoneConfigSchema = z.object({
  name: z.string().min(1).max(100),
  twilioNumberKey: z.string().min(1),
  forwardingNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
  mode: z.enum(['NOTIFICATION', 'AGENT']),
  agentId: z.string().uuid().optional().nullable(),
  autoTextTemplate: z.string().min(1).max(500).optional(),
  voiceGreeting: z.string().min(1).max(500).optional(),
  notificationTemplate: z.string().min(1).max(500).optional(),
  blocklist: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).optional(),
  enabled: z.boolean().optional(),
});
```

Validation rules:
- `agentId` required when `mode === 'AGENT'`
- `twilioNumberKey` must exist in the workspace's Twilio integration `phoneNumbers` meta
- `forwardingNumber` must be valid E.164
- Blocklist entries must be valid E.164

### 1.3 Phone Dashboard Tab + Sidebar

Add "Phone" to the sidebar in `WorkspaceNav.tsx`. Use the `Phone` icon from lucide-react. Place it after "Web Chats" in the list.

Add `phone` tab to `workspace-tabs.tsx`. Render `PhoneConfigList` component.

Update `page.tsx` to fetch phone configs:
```typescript
const phoneConfigs = await prisma.phoneConfig.findMany({
  where: { workspaceId: workspace.id },
  include: { agent: { select: { id: true, name: true } } },
  orderBy: { createdAt: 'desc' },
});
```

### 1.4 Phone Config Editor UI

`app/(dashboard)/workspaces/[id]/phone-config-list.tsx`

Follow the same pattern as `webchat-config-list.tsx`:
- List view showing all phone configs with status badges
- Create/edit form with:
  - Name (text input)
  - Twilio Number (dropdown, populated from workspace's Twilio integration `phoneNumbers` meta)
  - Forwarding Number (phone input, E.164 validation)
  - Mode toggle (Notification / Agent)
  - Agent selector (dropdown, only shown in Agent mode)
  - Auto-text template (textarea, with variable hints)
  - Voice greeting (textarea)
  - Notification template (textarea, only shown in Notification mode, with variable hints)
  - Blocklist manager (add/remove phone numbers)
  - Enabled toggle
- Display the voice webhook URL: `{origin}/api/v1/twilio-voice?source={workspaceSlug}`
  - Include instructions: "Set this as the Voice URL on your Twilio phone number"
- Display the SMS webhook URL reminder (already configured for existing Twilio integration)

**Template variable hints:**
- Auto-text: `{{callerPhone}}`, `{{callerName}}` (if lead exists)
- Notification: `{{callerPhone}}`, `{{callerName}}`, `{{twilioNumber}}`

### What You Test (Phase 1)

1. Create a phone config in the dashboard — verify it saves correctly
2. Validate E.164 format enforcement on forwarding number and blocklist
3. Verify Twilio number dropdown shows numbers from the Twilio integration
4. Verify agent selector only appears in Agent mode
5. Verify the voice webhook URL is displayed correctly
6. Edit and delete phone configs — verify CRUD operations

---

## Phase 2 — Voice Webhook + Missed-Call Flow

The core product: receive forwarded calls, auto-text the caller, notify the contractor or activate an agent.

### 2.1 Voice Webhook

`app/api/v1/twilio-voice/route.ts`

Handles `POST` from Twilio when a call arrives at a workspace phone number.

```
Request flow:
1. Parse form-encoded body (Twilio sends same format as SMS webhooks)
2. Extract source from query param
3. Rate limit by workspace slug
4. Resolve workspace via getActiveClient
5. Verify Twilio signature (same as SMS webhook)
6. Extract: CallSid, From (caller), To (Twilio number), CallStatus, Direction
7. Find PhoneConfig where twilioNumberKey resolves to the To number
8. If no config or config disabled → return empty TwiML (let call ring out)
9. Check caller against blocklist → if blocked, return empty TwiML
10. Return TwiML with voice greeting
11. Fire async missed-call processing (see 2.2)
```

**TwiML response:**
```typescript
function voiceTwimlResponse(greeting: string): NextResponse {
  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Say voice="alice">${escapeXml(greeting)}</Say>`,
    '  <Hangup/>',
    '</Response>',
  ].join('\n');

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

**Twilio voice webhook POST fields** (subset we care about):
- `CallSid` — unique call identifier
- `From` — caller's phone number (E.164)
- `To` — Twilio number that received the call (E.164)
- `CallStatus` — "ringing", "in-progress", etc.
- `Direction` — "inbound"
- `CallerCity`, `CallerState`, `CallerZip`, `CallerCountry` — geo data (optional, nice to log)

**Signature verification:** Reuse the existing `TwilioAdapter.verifyWebhook` method — same signature scheme for voice and SMS.

**Deduplication:** Use `WebhookProcessor` with `CallSid` as `providerEventId`, same pattern as SMS webhook.

### 2.2 Missed-Call Handler

`app/_lib/phone/missed-call-handler.ts`

Core logic extracted from the voice webhook for testability. Called after TwiML is returned.

```typescript
interface MissedCallParams {
  workspaceId: string;
  phoneConfig: PhoneConfig;
  callerPhone: string;   // E.164
  twilioNumber: string;  // E.164
  callSid: string;
  callerGeo?: { city?: string; state?: string; country?: string };
  correlationId: string;
}

async function handleMissedCall(params: MissedCallParams): Promise<void> {
  // 1. Upsert lead by phone number
  //    - Use workspace leadPropertySchema to find the phone field key
  //    - Create lead with phone in properties, source: "missed_call"
  //    - If lead exists (phone match), update lastEventAt

  // 2. Emit events
  //    - emitEvent: twilio_missed_call (success, metadata: callerPhone, twilioNumber, mode)
  //    - emitTrigger: { adapter: 'twilio', operation: 'missed_call' }

  // 3. Mode-specific handling
  if (params.phoneConfig.mode === 'NOTIFICATION') {
    // Send auto-text to caller
    // Send notification to contractor's forwarding number
  } else if (params.phoneConfig.mode === 'AGENT') {
    // Send auto-text as proactive agent outreach (starts conversation)
  }
}
```

**Lead upsert challenge:** Leads are keyed by email (`@@unique([workspaceId, email])`), but missed calls only have a phone number. Options:

- **Option A:** Generate a synthetic email: `+15551234567@phone.revline.io`. This lets the existing lead model work without schema changes. The synthetic email is recognizable and won't conflict with real emails.
- **Option B:** Make `email` optional on Lead and add a `phone` column. This is cleaner long-term but requires a schema migration with broader impact (every lead query assumes email exists).

**Recommendation: Option A for now.** The synthetic email pattern (`{E.164}@phone.revline.io`) is used by other platforms (e.g., Intercom uses `{id}@intercom.io`). It lets us upsert leads without touching the Lead schema. If the lead later provides their real email (via agent conversation or form), we can update the record.

**Notification mode SMS:**
```typescript
// Auto-text to caller
await twilioAdapter.sendSms({
  to: callerPhone,
  body: interpolateTemplate(phoneConfig.autoTextTemplate, { callerPhone, callerName }),
});

// Notification to contractor
await twilioAdapter.sendSms({
  to: phoneConfig.forwardingNumber,
  body: interpolateTemplate(phoneConfig.notificationTemplate, {
    callerPhone,
    callerName,
    twilioNumber,
  }),
});
```

### 2.3 Agent-Mode Conversation Start

In agent mode, the voice webhook starts a proactive agent conversation. The auto-text becomes the agent's first message, and the caller's eventual SMS reply routes to the active conversation.

```typescript
// Agent mode: start proactive conversation
const result = await handleInboundMessage({
  workspaceId: params.workspaceId,
  agentId: phoneConfig.agentId!,
  contactAddress: callerPhone,
  channelAddress: twilioNumber,
  channel: 'SMS',
  channelIntegration: 'TWILIO',
  messageText: '', // empty — agent sends initialMessage
  callerContext: 'proactive',
  proactiveMessage: phoneConfig.autoTextTemplate,
});
```

This requires a small enhancement to `handleInboundMessage` in `engine.ts`:
- Accept `callerContext: 'proactive'` to indicate this is an outbound conversation start (not a response to an inbound message)
- When `proactiveMessage` is provided and the conversation is new, use it as the agent's initial message instead of `agent.initialMessage`
- Skip the normal "process inbound → generate reply" flow — just send the proactive message and set the conversation to ACTIVE
- The next inbound message from the caller (via SMS webhook) will hit the normal `handleInboundMessage` path with an active conversation

**Why not use the existing `route_to_agent` workflow action?** Because `route_to_agent` expects a trigger context with payload data (email, from, body). The voice webhook has different data (phone number, no email, no message body). A direct call to `handleInboundMessage` with the proactive flag is cleaner.

### 2.4 Workflow Registry: `missed_call` Trigger

Add `missed_call` to `TWILIO_ADAPTER.triggers` in `registry.ts`:

```typescript
missed_call: {
  name: 'missed_call',
  label: 'Missed Call',
  description: 'Fires when a forwarded missed call is received at the workspace Twilio number',
  payloadSchema: z.object({
    from: z.string().describe('Caller phone number (E.164)'),
    to: z.string().describe('Twilio number that received the call (E.164)'),
    callSid: z.string().describe('Twilio call SID'),
    callerCity: z.string().optional(),
    callerState: z.string().optional(),
    callerCountry: z.string().optional(),
    phoneConfigId: z.string().optional(),
    mode: z.string().optional().describe('NOTIFICATION or AGENT'),
  }),
  testFields: [
    { name: 'from', label: 'Caller Phone', type: 'text', required: true, placeholder: '+15551234567' },
    { name: 'to', label: 'Twilio Number', type: 'text', required: true, placeholder: '+15559876543' },
  ],
},
```

This lets workspace admins build secondary workflows on missed calls: "When missed call → create Pipedrive person", "When missed call → add to MailerLite group", etc.

### What You Test (Phase 2)

1. **Twilio Console setup** — configure Voice URL on your Twilio number to `{your-host}/api/v1/twilio-voice?source={slug}`
2. **Notification mode test** — call the Twilio number, let it ring to forwarding. Verify: TwiML greeting plays, auto-text received by caller, notification SMS received on contractor's personal cell, lead upserted in Revline
3. **Agent mode test** — same as above, but verify: auto-text sent as agent's first message, conversation appears as ACTIVE in dashboard, replying to auto-text via SMS continues the conversation with the AI agent
4. **Blocklist test** — add a number to blocklist, call from that number. Verify: empty TwiML response, no auto-text, no lead created, no notification
5. **Workflow trigger test** — create a workflow triggered by `twilio.missed_call`, verify it fires with correct payload
6. **Duplicate call test** — trigger the voice webhook twice with the same CallSid, verify dedup
7. **Missing config test** — call a Twilio number that has no PhoneConfig, verify graceful empty TwiML (no crash)
8. **Signature test** — send a request without valid Twilio signature, verify rejection

---

## Phase 3 — Escalation SMS + Resolution Types

The contractor notification loop: when the agent resolves (or can't resolve) a conversation, SMS the contractor with what happened.

### 3.1 SMS Escalation

Extend `app/_lib/agent/escalation.ts` to send SMS to the forwarding number in addition to email.

```typescript
// In notifyEscalation, after the email loop:
const phoneConfig = await prisma.phoneConfig.findFirst({
  where: {
    workspaceId,
    agentId,
    enabled: true,
    mode: 'AGENT',
  },
});

if (phoneConfig) {
  const twilioAdapter = await TwilioAdapter.forWorkspace(workspaceId);
  if (twilioAdapter) {
    await twilioAdapter.sendSms({
      to: phoneConfig.forwardingNumber,
      body: `Lead needs you now — ${contactAddress}. Chat: ${appUrl}/leads/${leadId}`,
      from: phoneConfig.twilioNumberKey,
    });
  }
}
```

This sends the escalation SMS from the same Twilio number the conversation is on, so the contractor sees it in context.

### 3.2 Resolution Metadata

Extend the agent engine's conversation completion to include resolution metadata.

When a conversation ends, the `metadata` JSON on the Conversation record should include:

```typescript
{
  resolution: 'booked' | 'soft_escalation' | 'hard_escalation' | 'no_response' | 'completed',
  summary?: string,        // AI-generated one-line summary
  appointmentTime?: string, // ISO date if booked
}
```

**How resolution is determined:**
- `booked` — `book_appointment` tool was called and succeeded during the conversation
- `hard_escalation` — `[ESCALATE]` pattern detected → conversation status = ESCALATED
- `no_response` — conversation timed out (`TIMED_OUT` status) with no lead messages after initial auto-text
- `soft_escalation` — conversation completed normally, no booking, lead engaged but didn't convert
- `completed` — generic fallback for other completion paths

The agent engine already tracks tool call results and conversation status. The resolution type is derived from this existing data at conversation-end time.

### 3.3 Resolution-Driven Notifications

After conversation resolution, send a templated SMS to the contractor's forwarding number:

| Resolution | SMS Template |
|------------|-------------|
| `booked` | `New lead booked for {appointmentTime}. Chat: {leadUrl}` |
| `soft_escalation` | `New lead from {callerPhone} — {summary}. Chat: {leadUrl}` |
| `hard_escalation` | `Lead needs you now — {callerPhone}. Chat: {leadUrl}` |
| `no_response` | No SMS (lead never replied — log only) |

These fire from the `emitAgentEvent('conversation_completed', ...)` path in `engine.ts`. The handler checks if the conversation has an associated PhoneConfig and sends the appropriate notification.

Alternatively, this can be workflow-driven:
- Trigger: `agent.conversation_completed`
- Filter: `{ resolution: 'booked' }`
- Action: `twilio.send_sms` with template to forwarding number

**Recommendation:** Start with hardcoded notifications in Phase 3, then expose as customizable workflow templates later. The contractor shouldn't have to configure workflows to get basic "you got a booking" notifications.

### What You Test (Phase 3)

1. **Hard escalation** — trigger `[ESCALATE]` in an agent conversation started via missed call. Verify: email sent to admins AND SMS sent to contractor's personal cell
2. **Booking resolution** — use agent scheduling tools to book. Verify: `resolution: 'booked'` in conversation metadata, notification SMS with appointment time
3. **Soft escalation** — let conversation complete normally (no booking). Verify: summary SMS to contractor
4. **No response** — let conversation timeout. Verify: no SMS sent, event logged
5. **No phone config** — escalate a conversation started via webchat (no PhoneConfig). Verify: email-only escalation, no SMS error

---

## Twilio Console Setup

The contractor (or workspace admin) needs to configure two webhook URLs on their Twilio phone number:

| Webhook | URL | Method |
|---------|-----|--------|
| **Voice (A CALL COMES IN)** | `https://{domain}/api/v1/twilio-voice?source={workspaceSlug}` | HTTP POST |
| **Messaging (A MESSAGE COMES IN)** | `https://{domain}/api/v1/twilio-webhook?source={workspaceSlug}` | HTTP POST |

The SMS webhook URL is already displayed in the Twilio integration config editor. Phase 1 adds the voice webhook URL to the Phone config editor.

**Carrier-side forwarding:** The contractor sets up call forwarding on their carrier to the Twilio number. This is a one-time phone setting (e.g., on iPhone: Settings > Phone > Call Forwarding, or dial `*61*{twilioNumber}#` for conditional forwarding on most carriers).

---

## Example Workflow Configurations

**Missed call → Pipedrive person sync:**
```json
{
  "name": "Sync missed calls to Pipedrive",
  "triggerAdapter": "twilio",
  "triggerOperation": "missed_call",
  "actions": [
    {
      "adapter": "pipedrive",
      "operation": "create_or_update_person",
      "params": {},
      "continueOnError": true
    },
    {
      "adapter": "revline",
      "operation": "create_lead",
      "params": { "source": "missed_call" }
    }
  ]
}
```

**Agent booking → MailerLite tagging:**
```json
{
  "name": "Tag booked leads from phone",
  "triggerAdapter": "agent",
  "triggerOperation": "conversation_completed",
  "triggerFilter": { "resolution": "booked" },
  "actions": [
    {
      "adapter": "mailerlite",
      "operation": "add_tag",
      "params": { "tag": "phone-booked" }
    }
  ]
}
```

---

## Complexity Estimate

| Component | Est. Lines | Difficulty | Reference |
|-----------|-----------|------------|-----------|
| `PhoneConfig` schema + migration | ~40 | Low | Same pattern as `WebchatConfig` |
| Phone config CRUD API (2 route files) | ~200 | Low | Follow `webchat-configs` routes |
| Phone config editor UI | 400–500 | Medium | Similar to `webchat-config-list.tsx` |
| Sidebar + tab wiring | ~40 | Low | Follow existing tab patterns |
| Voice webhook route | 200–250 | Medium | Same verification pattern as SMS webhook |
| Missed-call handler | 200–300 | Medium | New logic but uses existing adapters |
| `handleInboundMessage` proactive enhancement | ~40 | Low | Small addition to existing function |
| `missed_call` trigger in registry | ~25 | Low | Follow existing trigger pattern |
| SMS escalation in `escalation.ts` | ~30 | Low | Add Twilio path alongside email |
| Resolution metadata | ~50 | Low | Derive from existing conversation data |
| Resolution notifications | ~80 | Low | Template interpolation + sendSms |
| Twilio config editor URL display update | ~10 | Low | Add one line |

**Total new code (all phases):** ~1,300–1,550 lines across 6 new files and ~8 modified files.

**Phase 1:** ~700 lines (schema, API, dashboard). Purely config — no runtime behavior changes.
**Phase 2:** ~500 lines (voice webhook, missed-call handler, proactive outreach). The core product.
**Phase 3:** ~150 lines (escalation SMS, resolution types). Additive notifications.
