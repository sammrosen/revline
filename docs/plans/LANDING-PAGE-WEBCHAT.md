# Landing Page Template + Webchat Widget

> **Date:** March 24, 2026
> **Status:** Core implementation complete. Ready for testing and iteration.
> **Plan file:** `.cursor/plans/landing_page_+_webchat_b2860d9d.plan.md`
> **Reference:** `docs/STANDARDS.md` for architecture principles, `docs/workflows/LANDING-PAGE-CREATION.md` for the older landing page workflow doc.

---

## What This Is

Two features that compose together:

1. **Landing page template** — a configurable, workspace-scoped public page at `/public/{slug}/landing` with hero, services, images, contact form, and footer. Uses the same `WorkspaceConfigService` 3-layer merge + branding system as booking/signup.
2. **Webchat widget** — a standalone floating chat bubble that talks to AI agents via a new public API. Embedded on the landing page when configured, but designed to be droppable onto any page.

---

## What Was Built (files to know)

### Types & Config Layer

| File | What changed |
|---|---|
| `app/_lib/types/index.ts` | Added `LandingCopyConfig` interface, `webchat` field on `RevlineMeta`, `CHAT` rate limit constant |
| `app/_lib/config/defaults.ts` | Added `DEFAULT_LANDING_COPY` with generic business placeholder text |
| `app/_lib/config/workspace-config.service.ts` | Added `ResolvedLandingCopy`, `ResolvedLandingConfig`, `resolveForLanding()` (3-layer merge), `resolveLandingCopy()` (sanitization) |
| `app/_lib/config/index.ts` | Barrel exports for new types and defaults |
| `app/_lib/templates/schemas.ts` | Added `LANDING_COPY_SCHEMA` (10 fields), registered in `TEMPLATE_COPY_SCHEMAS` under key `'landing'` |
| `app/_lib/forms/registry.ts` | Added `'landing'` to form type union, registered `landing-page` entry with `contact-submitted` trigger |

### Landing Page Route

| File | Purpose |
|---|---|
| `app/public/[slug]/landing/page.tsx` | Server component — workspace lookup, active check, `resolveForLanding()`, metadata generation |
| `app/public/[slug]/landing/client.tsx` | Client component — renders all sections, contact form (submits to `POST /api/v1/subscribe`), conditionally renders webchat |

### Webchat

| File | Purpose |
|---|---|
| `app/api/v1/chat/route.ts` | `POST /api/v1/chat` — public endpoint, Zod validated, rate-limited per sessionId, calls `handleInboundMessage` with `channel: 'WEB_CHAT'`, returns reply text in response |
| `app/_components/WebchatWidget.tsx` | Standalone client component — floating bubble, message list, typing indicator, session management (`sessionStorage`), optional email gate |

---

## Architecture Decisions

### Why WEB_CHAT doesn't need a channel adapter

The `CHANNEL_REGISTRY` pattern (Twilio, Resend) is for channels where the platform *pushes* replies asynchronously. Webchat is synchronous request/response — the widget POSTs a message and gets the reply in the same HTTP response. So:

- `handleInboundMessage` runs the full engine (conversation lookup/create, AI call, tool execution, message persistence)
- The engine's `sendReply()` is skipped because there's no `channelIntegration` configured for WEB_CHAT agents
- The `replyText` from `AgentResponse` is returned directly in the JSON response to the widget

This means **no changes to the engine or adapter registry were needed**.

### Contact form reuses existing subscribe API

The landing page contact form submits to `POST /api/v1/subscribe` (the same endpoint used by `EmailCapture` components). The `source` field is set to the workspace slug. This means:

- Existing `revline.email_captured` workflow triggers fire automatically
- Deduplication, rate limiting, and validation are already handled
- No new API endpoint needed for contact capture

### Config follows the 3-layer merge pattern

Exactly like booking/signup:

```
Code defaults (DEFAULT_LANDING_COPY)
  ↓ overridden by
Org template defaults (OrganizationTemplate where type='landing')
  ↓ overridden by
Workspace Revline meta (meta.copy.landing + meta.webchat)
```

### Services and images are structured fields

The `services` array (`Array<{ title, description }>`) and `images` array don't fit the simple `CopyFieldSchema` string-field pattern. They're stored directly in `meta.copy.landing.services` / `meta.copy.landing.images` as JSON. The `LANDING_COPY_SCHEMA` only covers the simple string fields. Editing services/images requires either:

- A custom section in the config editor (future work)
- Direct JSON editing in the Revline meta config

---

## How to Configure a Landing Page

### Minimum viable setup

1. Workspace must be `ACTIVE` with a Revline integration
2. Visit `/public/{slug}/landing` — it renders with all defaults out of the box
3. No webchat until `meta.webchat` is configured

### Full configuration (Revline meta JSON)

```json
{
  "branding": { "color1": "#1e40af", "color2": "#1e3a8a", "color3": "#f8fafc", "color4": "#ffffff", "color5": "#1e293b", "logo": "https://..." },
  "copy": {
    "landing": {
      "heroHeadline": "Your Custom Headline",
      "heroSubhead": "Your subhead text",
      "servicesTitle": "Our Services",
      "services": [
        { "title": "Personal Training", "description": "One-on-one coaching." },
        { "title": "Group Classes", "description": "High-energy group sessions." }
      ],
      "images": ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
      "contactTitle": "Contact Us",
      "contactSubmitText": "Send Message",
      "footerEmail": "hello@yourgym.com"
    }
  },
  "webchat": {
    "agentId": "uuid-of-agent",
    "enabled": true,
    "collectEmail": true
  }
}
```

### Webchat agent setup

The agent referenced by `webchat.agentId` must:
- Exist in the same workspace
- Be `active: true`
- Have an AI integration configured (OpenAI or Anthropic)
- Does **not** need a channel integration (WEB_CHAT is adapter-less)

---

## What's NOT Done Yet (future work)

### Dashboard UI for landing config

There's no dedicated landing page config editor in the dashboard yet. The `LANDING_COPY_SCHEMA` is registered and will be picked up by the generic copy editor, but:

- **Services array editing** — needs a custom UI (add/remove/reorder service cards)
- **Images array editing** — needs a custom UI (add/remove image URLs, maybe upload)
- **Webchat toggle** — needs a UI to select an agent and toggle enabled/collectEmail
- **Live preview** — the booking/signup templates have preview modes; landing page doesn't yet

### Org-level template defaults

The `resolveForLanding` method supports org templates (`loadOrgTemplate(workspaceId, 'landing')`), but no org-level landing template has been seeded. To add one, insert an `OrganizationTemplate` with `type: 'landing'` and `defaultCopy` containing a `LandingCopyConfig` JSON.

### Webchat improvements

- **Typing indicators from the agent side** — currently only shows dots while waiting for the HTTP response
- **Message persistence across page reloads** — messages are in React state only; sessionId persists but message history doesn't
- **File/image support** — the widget only handles text
- **Conversation handoff** — no way to escalate from webchat to a human agent channel (SMS/email)
- **Widget position/style customization** — currently fixed bottom-right, hardcoded sizing

### SEO and Open Graph

The `generateMetadata` function sets a basic title and description. Could be extended with OG images, structured data, etc.

---

## Testing Checklist

- [ ] Visit `/public/{slug}/landing` for an active workspace — renders with defaults
- [ ] Visit for a non-existent slug — 404
- [ ] Visit for a paused workspace — shows "Page Unavailable"
- [ ] Configure `meta.copy.landing` with custom values — verify they appear
- [ ] Submit the contact form — verify it hits `/api/v1/subscribe` and triggers `revline.email_captured`
- [ ] Configure `meta.webchat` with a valid agent — verify bubble appears
- [ ] Send a message via webchat — verify agent response comes back
- [ ] Verify rate limiting: send >10 messages in a minute from one session — should get 429
- [ ] Verify branding: change palette colors and font — verify landing page reflects them
- [ ] Verify images: add 1–6 image URLs to `copy.landing.images` — verify gallery renders

---

## Key Code Patterns to Follow

If you're extending this, these are the patterns to maintain:

1. **Config resolution** — always use `WorkspaceConfigService.resolveForLanding()`, never read Revline meta directly from components
2. **Sanitization** — all user-provided copy goes through `sanitizeCopyText()` with explicit max lengths
3. **Image validation** — URLs go through `isValidLogoUrl()` (https or data: URLs only)
4. **Branding** — use `deriveBrandColors(branding, theme)` to get the full color set, apply via inline `style` props
5. **Public endpoints** — rate limit, validate with Zod, use `ApiResponse` helpers, log with `logStructured`
6. **Webchat sessions** — `sessionStorage`-based, UUID format, treated as `contactAddress` in the agent engine
