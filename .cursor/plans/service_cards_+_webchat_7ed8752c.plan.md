---
name: Service Cards + Webchat
overview: Redesign the landing page service section with image-backed cards that show descriptions on hover and an arrow CTA linking to the contact form. Add a Webchat configuration section to the landing page Build tab so users can enable/disable the widget and select an agent.
todos:
  - id: service-data-model
    content: Expand service type in types/index.ts to include optional image and ctaLink fields
    status: completed
  - id: service-editor-ui
    content: Build full services editor in LandingBuildSection (add/remove/reorder/edit/image-upload per service card)
    status: completed
  - id: service-landing-render
    content: "Redesign service cards on landing page: image-backed cards with hover overlay, title bar, and arrow CTA button"
    status: completed
  - id: webchat-prop-threading
    content: Thread agents prop from workspace-tabs -> pages-editor -> revline-config-editor -> LandingBuildSection
    status: completed
  - id: webchat-build-ui
    content: Add Webchat CollapsibleSection in Landing Build tab with enable toggle, agent dropdown, and collect-email toggle
    status: completed
isProject: false
---

# Service Cards Redesign + Webchat Build Tab Controls

## Part 1: Service Cards Redesign

The current service cards are plain text boxes with a checkmark icon (screenshot 1). The goal is to transform them into image-backed cards similar to the appliance repair grid (screenshot 2): large image fills the card, a title overlay with an arrow button is always visible, and on hover a short description fades in. Clicking the arrow button scrolls to the contact/schedule section (`#contact`).

### Data Model Changes

**[app/_lib/types/index.ts](app/_lib/types/index.ts)** -- Expand the service type:

```typescript
// Current
services?: Array<{ title: string; description: string }>;

// New
services?: Array<{
  title: string;
  description: string;
  image?: string;       // base64 data URI (compressed via existing compressImage)
  ctaLink?: string;     // defaults to '#contact'
}>;
```

No schema migration needed -- this is JSON config stored in `pagesConfig`.

### Build Tab: Services Editor

**[app/(dashboard)/workspaces/[id]/revline-config-editor.tsx](app/(dashboard)/workspaces/[id]/revline-config-editor.tsx)**

Replace the placeholder text in the Services `CollapsibleSection` (~line 2644-2654) with a proper editor:

- **servicesTitle** field (already wired via `renderCopyField`)
- **Max services limit** (e.g., 6)
- For each service card:
  - Text input for **title**
  - Text input for **description** (short, shown on hover)
  - Optional **image upload** using the existing `ImageUploadField` component with compression
  - **ctaLink** text input (defaults to `#contact`)
  - Reorder (up/down) and delete buttons (same pattern as form fields and gallery images)
- "Add Service" button at the bottom

Helper functions to add (mirroring gallery/form-field patterns): `updateServices`, `addService`, `removeService`, `moveService`, `updateServiceAt`.

### Landing Page Rendering

**[app/public/[slug]/landing/client.tsx](app/public/[slug]/landing/client.tsx)** -- Replace the current service card rendering (~lines 358-398) with two visual variants:

- **If service has an image**: Render as an image card with:
  - Image fills the card via `background-image` / `object-fit: cover`
  - Title overlay with arrow button at bottom-left (always visible)
  - On hover, a semi-transparent overlay fades in showing the description text
  - Arrow button links to `service.ctaLink || '#contact'` with smooth scroll
- **If service has no image**: Fall back to the current text-card style (title + description + checkmark icon) to stay backwards compatible

Grid layout stays adaptive to service count (existing logic). Arrow button uses an SVG arrow icon (e.g., right-arrow in a circle or the style from screenshot 2).

### Preview

**[app/(dashboard)/workspaces/[id]/_components/form-preview-mock.tsx](app/(dashboard)/workspaces/[id]/_components/form-preview-mock.tsx)** -- No structural changes needed; the preview already renders `resolvedLandingCopy` which includes `services`. The new fields will flow through automatically since `resolveLandingCopy` spreads the user config over defaults.

### Config Resolution

**[app/_lib/config/workspace-config.service.ts](app/_lib/config/workspace-config.service.ts)** -- `resolveLandingCopy` already spreads services from user config. Only ensure the new optional fields (`image`, `ctaLink`) are preserved through resolution (they will be by default since the spread already includes the whole service object).

---

## Part 2: Webchat Configuration in Build Tab

The webchat config already exists on `RevlineMeta.webchat` and is resolved/rendered on the landing page, but there is no UI to configure it. The user cannot currently enable it from the Build tab.

### Threading agents list to RevlineConfigEditor

- **[app/(dashboard)/workspaces/[id]/revline-config-editor.tsx](app/(dashboard)/workspaces/[id]/revline-config-editor.tsx)** -- Add `agents?: Record<string, string>` to `RevlineConfigEditorProps`
- **[app/(dashboard)/workspaces/[id]/pages-editor.tsx](app/(dashboard)/workspaces/[id]/pages-editor.tsx)** -- Accept `agents` prop, pass through to `RevlineConfigEditor`
- **[app/(dashboard)/workspaces/[id]/workspace-tabs.tsx](app/(dashboard)/workspaces/[id]/workspace-tabs.tsx)** -- Pass `agents` to `PagesEditor` (already available in scope)

### Webchat Section in Landing Build Tab

In `LandingBuildSection`, add a new `CollapsibleSection` titled "Webchat" after the Footer section:

- **Enable/disable toggle** -- writes to `meta.webchat.enabled`
- **Agent dropdown** -- populated from `agents` prop, writes to `meta.webchat.agentId`
- **Collect Email toggle** -- writes to `meta.webchat.collectEmail`

The `LandingBuildSection` component will need to accept `agents` as a prop (threaded from `RevlineConfigEditor`).

### Sections Toggle

Add `webchat` to the `LandingSections` type in [app/_lib/types/index.ts](app/_lib/types/index.ts) so it can be toggled on/off independently. Or, keep it simpler: since webchat already has its own `enabled` boolean on `meta.webchat`, the CollapsibleSection toggle can directly control `meta.webchat.enabled` without a separate sections toggle.

Recommended: Use the existing `meta.webchat.enabled` directly -- no new sections flag needed.
