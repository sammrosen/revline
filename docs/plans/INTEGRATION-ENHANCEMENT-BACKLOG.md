# Integration Enhancement Backlog

## Overview
Comprehensive improvements to make integrations fully configurable, modular, and user-friendly. Each integration should have structured sub-configurations (products, events, etc.) that are properly handled across config pages, workflow editor, and test suite.

---

## 1. Sub-Configuration System

### 1.1 Stripe Sub-Configurations
**Current State**: Products are stored in `meta.productMap` but UI is inconsistent

**Requirements**:
- [ ] **Products Configuration**
  - Structured UI in config page (no JSON defaults)
  - Dropdown in workflow editor for product selection
  - Validation that selected products exist in config
  - Test suite can select products when testing Stripe triggers

- [ ] **Future Stripe Sub-Configs** (if needed):
  - Payment methods
  - Subscription plans
  - Webhook event types

**Files to Update**:
- `app/workspaces/[id]/stripe-config-editor.tsx` - Already has structured UI, ensure no JSON mode by default
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Already has dropdown, verify it works correctly
- `app/_lib/workflow/registry.ts` - Ensure product validation is correct
- Test suite files (TBD)

### 1.2 Calendly Sub-Configurations
**Current State**: Basic integration, no structured event/booking type config

**Requirements**:
- [ ] **Event Types Configuration**
  - Structured UI to configure available event types/bookings
  - Map Calendly event types to internal names
  - Dropdown in workflow editor for event selection
  - Test suite can select specific events when testing Calendly triggers

- [ ] **Scheduling URLs** (already in meta, needs UI)
  - Structured UI for managing scheduling URLs
  - Link URLs to event types
  - Validation that URLs are valid

**Files to Create/Update**:
- `app/workspaces/[id]/calendly-config-editor.tsx` - New structured config editor
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Add event type dropdown
- `app/_lib/workflow/registry.ts` - Add event type param requirements
- Test suite files (TBD)

### 1.3 MailerLite Sub-Configurations
**Current State**: Groups are configured, but could be more structured

**Requirements**:
- [ ] **Groups Management**
  - Ensure structured UI (no JSON defaults)
  - Sync groups from MailerLite API
  - Validation that selected groups exist
  - Test suite can select groups when testing MailerLite actions

- [ ] **Tags Management** (future)
  - Structured UI for managing tags
  - Dropdown in workflow editor
  - Test suite support

**Files to Update**:
- `app/workspaces/[id]/mailerlite-config-editor.tsx` - Verify structured UI
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Verify group dropdowns work
- Test suite files (TBD)

### 1.4 ManyChat Sub-Configurations
**Current State**: Not fully implemented

**Requirements**:
- [ ] **Flows Configuration**
  - Structured UI for managing flows
  - Dropdown in workflow editor
  - Test suite support

- [ ] **Tags Configuration**
  - Structured UI for managing tags
  - Dropdown in workflow editor
  - Test suite support

**Files to Create/Update**:
- `app/workspaces/[id]/manychat-config-editor.tsx` - New structured config editor
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Add flow/tag dropdowns
- Test suite files (TBD)

---

## 2. Configuration Page Improvements

### 2.1 Remove JSON Defaults
**Current State**: Some config editors default to JSON mode or show JSON as fallback

**Requirements**:
- [ ] **Structured UI First**
  - All config editors should default to structured mode
  - JSON mode should be optional/advanced toggle
  - No raw JSON visible unless user explicitly enables it

**Files to Update**:
- `app/workspaces/[id]/stripe-config-editor.tsx` - Remove JSON mode default
- `app/workspaces/[id]/mailerlite-config-editor.tsx` - Ensure structured UI
- Any other config editors

### 2.2 Integration Title Colors
**Current State**: Integration titles use default text color

**Requirements**:
- [ ] **Color-Coded Integration Titles**
  - Use integration-specific colors from `integration-config.ts`
  - Apply `textClass` to integration title text
  - Match the visual style from workflow visualization

**Files to Update**:
- `app/workspaces/[id]/integration-actions.tsx` - Apply color to integration title
- `app/workspaces/[id]/client-tabs.tsx` - Integration list styling
- Any other integration list/display components

**Implementation**:
```typescript
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

const style = getIntegrationStyle(integration.integration.toLowerCase());
// Apply style.textClass to title text
```

---

## 3. Workflow Editor Improvements

### 3.1 Action Reordering
**Current State**: Actions are in fixed order, can only add/remove

**Requirements**:
- [ ] **Drag-and-Drop Reordering**
  - Allow dragging actions to reorder
  - Visual feedback during drag
  - Persist order to database
  - Show order numbers/indicators

**Files to Update**:
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Add drag-and-drop
- Consider using `react-beautiful-dnd` or `@dnd-kit/core`

**Implementation Notes**:
- Actions array order determines execution order
- Update `handleActionChange` to support reordering
- Add visual drag handles/icons

### 3.2 Sub-Configuration Dropdowns
**Current State**: Some dropdowns exist (Stripe products, MailerLite groups)

**Requirements**:
- [ ] **Complete Dropdown Coverage**
  - Stripe: Product dropdown (already exists, verify)
  - Calendly: Event type dropdown (needs implementation)
  - MailerLite: Group dropdown (already exists, verify)
  - ManyChat: Flow/tag dropdowns (needs implementation)

**Files to Update**:
- `app/workspaces/[id]/workflows/workflow-editor.tsx` - Add missing dropdowns
- Ensure all sub-configs are passed as props
- Validate selections against available configs

---

## 4. Test Suite Enhancements

### 4.1 Sub-Configuration Support
**Current State**: Test suite may not account for sub-configurations

**Requirements**:
- [ ] **Stripe Testing**
  - Select product when testing payment triggers
  - Verify product filtering works correctly
  - Test with different products

- [ ] **Calendly Testing**
  - Select event type when testing booking triggers
  - Test different event types
  - Verify event filtering works

- [ ] **MailerLite Testing**
  - Select group when testing group actions
  - Verify group exists before testing
  - Test with different groups

**Files to Create/Update**:
- Test suite files (location TBD)
- Ensure test suite can access integration configs
- Add UI for selecting sub-configs in test interface

### 4.2 Modular Test Framework
**Requirements**:
- [ ] **Decoupled Test Modules**
  - Each integration has its own test module
  - Test modules can be extended independently
  - Common test utilities shared
  - Easy to add new integration tests

---

## 5. Architecture & Modularity

### 5.1 Decoupled Integration System
**Requirements**:
- [ ] **Modular Adapter Pattern**
  - Each adapter is self-contained
  - Config editors are modular and reusable
  - Validation rules are declarative
  - Easy to add new integrations

**Current State**: Already somewhat modular, but can be improved

**Improvements Needed**:
- [ ] Standardize config editor interface
- [ ] Create base config editor component
- [ ] Ensure all adapters follow same patterns
- [ ] Document integration extension process

### 5.2 Configuration Schema System
**Requirements**:
- [ ] **Type-Safe Config Schemas**
  - Zod schemas for each integration's meta
  - Validation at config save time
  - TypeScript types generated from schemas
  - Runtime validation in workflow editor

**Files to Create**:
- `app/_lib/integrations/schemas/` - Config schemas directory
- `app/_lib/integrations/schemas/stripe.ts`
- `app/_lib/integrations/schemas/calendly.ts`
- `app/_lib/integrations/schemas/mailerlite.ts`
- `app/_lib/integrations/schemas/manychat.ts`

---

## 6. Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Remove JSON defaults from config editors
2. ✅ Add integration title colors
3. ✅ Fix Stripe product dropdown (verify it works)
4. ✅ Add Calendly event type configuration

### Phase 2: UX Improvements (Short-term)
1. Add action reordering (drag-and-drop)
2. Complete all sub-config dropdowns
3. Improve config editor UIs

### Phase 3: Test Suite (Medium-term)
1. Add sub-configuration support to test suite
2. Create modular test framework
3. Add tests for all integrations

### Phase 4: Architecture (Long-term)
1. Standardize config editor interface
2. Create config schema system
3. Document extension process
4. Refactor for maximum modularity

---

## 7. Technical Notes

### Integration Color System
Colors are defined in `app/_lib/workflow/integration-config.ts`:
- `textClass`: Tailwind class for text color (e.g., `text-blue-400`)
- `color`: Hex color value
- `bgClass`: Background color class
- `borderClass`: Border color class

### Configuration Storage
- Secrets: Stored encrypted in `client_integrations.secrets` (JSON array)
- Meta: Stored in `client_integrations.meta` (JSON object)
- Sub-configs: Stored in `meta` (e.g., `meta.productMap`, `meta.groups`)

### Validation Flow
1. Adapter declares requirements in `registry.ts`
2. Validation checks requirements in `validation.ts`
3. UI shows validation errors/warnings
4. Workflow can't be enabled if validation fails

---

## 8. Open Questions

1. **Calendly Event Types**: How should we structure event type configuration? Map Calendly event URIs to friendly names?
2. **Test Suite Location**: Where should the test suite live? Separate route/page or integrated into workflow editor?
3. **Action Reordering Library**: Which drag-and-drop library should we use? `react-beautiful-dnd` is popular but has React 18 issues. `@dnd-kit/core` is more modern.
4. **Config Editor Base**: Should we create a base config editor component, or keep them independent?
5. **ManyChat Implementation**: Is ManyChat fully implemented, or is it still a placeholder?

---

## 9. Related Files Reference

### Config Editors
- `app/workspaces/[id]/stripe-config-editor.tsx`
- `app/workspaces/[id]/mailerlite-config-editor.tsx`
- `app/workspaces/[id]/calendly-config-editor.tsx` (may need creation)
- `app/workspaces/[id]/manychat-config-editor.tsx` (may need creation)

### Workflow Editor
- `app/workspaces/[id]/workflows/workflow-editor.tsx`
- `app/workspaces/[id]/workflows/workflow-list.tsx`

### Integration Display
- `app/workspaces/[id]/integration-actions.tsx`
- `app/workspaces/[id]/client-tabs.tsx`
- `app/workspaces/[id]/_components/dependency-tree.tsx`

### Core Integration Files
- `app/_lib/workflow/registry.ts` - Adapter definitions
- `app/_lib/workflow/validation.ts` - Validation logic
- `app/_lib/workflow/integration-config.ts` - Colors/styling
- `app/_lib/integrations/stripe.adapter.ts`
- `app/_lib/integrations/calendly.adapter.ts`
- `app/_lib/integrations/mailerlite.adapter.ts`
- `app/_lib/integrations/manychat.adapter.ts` (if exists)

---

## 10. Success Criteria

- [ ] All integrations have structured config UIs (no JSON defaults)
- [ ] All sub-configurations are accessible via dropdowns in workflow editor
- [ ] Integration titles use their brand colors throughout the app
- [ ] Actions can be reordered via drag-and-drop
- [ ] Test suite supports all sub-configurations
- [ ] System is modular and easy to extend with new integrations
- [ ] All validation is declarative and consistent
- [ ] Documentation exists for adding new integrations

