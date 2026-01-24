# SWAC Booking Form + Capture System Configuration Guide

> Complete guide for configuring the Sports West Athletic Club (SWAC) booking form with RevLine's unified capture system, workflow engine, and ABC Ignite integration.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Pre-Configuration Checklist](#pre-configuration-checklist)
5. [Step-by-Step Configuration](#step-by-step-configuration)
6. [Custom Fields Setup](#custom-fields-setup)
7. [Workflow Configuration](#workflow-configuration)
8. [Testing the Integration](#testing-the-integration)
9. [Troubleshooting](#troubleshooting)

---

## System Overview

The SWAC booking form is a **bespoke form** that lives within the RevLine codebase at `/public/[slug]/book`. Unlike external capture forms that use `capture.js`, bespoke forms use the **server-side SDK** (`submitCaptureTrigger()`) to integrate with the capture system.

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| Booking Form UI | User-facing form for selecting slots and entering details | `app/public/[slug]/book/client.tsx` |
| Booking Request API | Creates pending booking, sends magic link | `app/api/v1/booking/request/route.ts` |
| Magic Link Confirm | Validates token, executes booking | `app/api/v1/booking/confirm/[token]/route.ts` |
| ABC Ignite Adapter | Low-level ABC API calls | `app/_lib/integrations/abc-ignite/` |
| Capture Service | Server-side capture SDK | `app/_lib/services/capture.service.ts` |
| Workflow Engine | Trigger-action automation | `app/_lib/workflow/` |

### Flow Types

The system supports two execution paths:

1. **Sync Workflow Execution** (preferred)
   - Booking triggers workflow → ABC Ignite action creates appointment
   - Result returned synchronously to confirm flow
   - Visible in dependency graph

2. **Direct Provider Fallback**
   - If no workflow configured, calls ABC Ignite directly
   - Legacy approach, not visible in dependency graph

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SWAC BOOKING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│  Booking    │────▶│   Booking   │────▶│   Pending   │
│  (Browser)  │     │  Form UI    │     │   Request   │     │   Booking   │
│             │     │  /[slug]/   │     │     API     │     │   Created   │
│             │     │    book     │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                         ┌─────────────────────────────────────────┘
                         ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Email    │────▶│   User      │────▶│   Confirm   │
│   Service   │     │  Clicks     │     │    API      │
│  (Resend)   │     │  Magic Link │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    ▼                                                      ▼
           ┌───────────────┐                                      ┌───────────────┐
           │  Sync Workflow │                                      │    Direct     │
           │   Execution    │                                      │   Provider    │
           │               │                                      │   Fallback    │
           │ booking.create │                                      │               │
           │   _booking    │                                      │ provider.     │
           └───────┬───────┘                                      │ createBooking │
                   │                                              └───────┬───────┘
                   ▼                                                      │
           ┌───────────────┐                                              │
           │  ABC Ignite   │◀─────────────────────────────────────────────┘
           │   Executor    │
           │               │
           │ create_       │
           │ appointment   │
           └───────┬───────┘
                   │
                   ▼
           ┌───────────────┐     ┌─────────────┐     ┌─────────────┐
           │  ABC Ignite   │────▶│   Capture   │────▶│   Lead +    │
           │     API       │     │   Trigger   │     │  Workflow   │
           │               │     │             │     │   Actions   │
           └───────────────┘     └─────────────┘     └─────────────┘
```

---

## Data Flow

### 1. User Submits Booking Request

```typescript
// Client sends to POST /api/v1/booking/request
{
  workspaceSlug: "sportswest",
  identifier: "fgj6",           // Member barcode
  staffId: "trainer_123",       // Selected trainer
  slotTime: "2026-01-25T10:00:00Z",
  email: "member@example.com",
  serviceId: "event_type_456",  // ABC Ignite event type
  serviceName: "Personal Training",
  staffName: "John Trainer",
  slotProviderData: {           // Provider-specific data from availability
    employeeId: "emp_123",
    levelId: "level_1"
  }
}
```

### 2. Magic Link Confirmation Creates Booking

When user clicks the magic link:

1. **Token validated** (hash lookup, expiry check)
2. **Customer re-verified** with ABC Ignite
3. **Eligibility re-checked** (sessions remaining, etc.)
4. **Booking executed** via workflow or direct provider

### 3. Sync Workflow Trigger Payload

```typescript
// Trigger: booking.create_booking
{
  slotId: "pending_abc123",
  employeeId: "emp_123",
  eventTypeId: "event_type_456",
  levelId: "level_1",           // Optional
  startTime: "2026-01-25T10:00:00Z",
  memberId: "member_789",
  customerEmail: "member@example.com",
  customerName: "Jane Member"
}
```

### 4. Workflow Action Result

```typescript
// Result from abc_ignite.create_appointment
{
  success: true,
  bookingId: "appt_xyz789",
  eventId: "evt_abc123"
}
```

### 5. Capture Trigger (Post-Booking)

After successful booking, a capture trigger fires to create/update the lead:

```typescript
// Trigger: capture.booking_confirmed (configurable via WorkspaceForm)
{
  formId: "form_uuid",
  formName: "SWAC Booking Capture",
  email: "member@example.com",
  leadId: "lead_123",           // Created/updated
  isNewLead: false,
  captureId: "cap_abc123",
  mode: "internal",
  firstName: "Jane",
  customFields: {
    barcode: "fgj6",
    bookingId: "appt_xyz789",
    trainerName: "John Trainer",
    sessionTime: "2026-01-25T10:00:00Z"
  }
}
```

---

## Pre-Configuration Checklist

Before configuring, ensure these are complete:

- [ ] Workspace exists with slug `sportswest` (or your workspace slug)
- [ ] ABC Ignite integration is configured and enabled
- [ ] ABC Ignite credentials are valid (test with `/api/v1/booking/employees`)
- [ ] Resend integration is configured (for magic link emails)
- [ ] User has ADMIN+ role on the workspace

---

## Step-by-Step Configuration

### Step 1: Create Custom Field Definitions

Go to **Workspace → Settings → Custom Fields** and create these fields:

| Key | Label | Type | Required | Description |
|-----|-------|------|----------|-------------|
| `barcode` | Member Barcode | TEXT | No | ABC Ignite member identifier |
| `trainerName` | Trainer Name | TEXT | No | Name of assigned trainer |
| `sessionTime` | Session Time | TEXT | No | ISO datetime of booked session |
| `bookingId` | Booking ID | TEXT | No | ABC Ignite appointment ID |

**Via API:**

```bash
# Create barcode field
curl -X POST "https://revline.app/api/v1/workspaces/{workspaceId}/custom-fields" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "barcode",
    "label": "Member Barcode",
    "fieldType": "TEXT",
    "required": false,
    "description": "ABC Ignite member identifier"
  }'

# Repeat for other fields...
```

### Step 2: Create the Capture Form

Go to **Workspace → Capture** and click "Add Form":

| Field | Value |
|-------|-------|
| Name | SWAC Booking Capture |
| Trigger Name | `booking_confirmed` |
| Security Mode | Browser (or Both if calling from server too) |
| Allowed Origins | Leave empty for server-side SDK only |
| Rate Limit | 10/min (default) |
| Target Fields | `email`, `firstName`, `custom.barcode`, `custom.trainerName`, `custom.sessionTime`, `custom.bookingId` |

**Via API:**

```bash
curl -X POST "https://revline.app/api/v1/workspaces/{workspaceId}/capture-forms" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SWAC Booking Capture",
    "triggerName": "booking_confirmed",
    "security": {
      "mode": "both",
      "allowedOrigins": [],
      "rateLimitPerIp": 10
    },
    "allowedTargets": [
      "email",
      "firstName",
      "custom.barcode",
      "custom.trainerName",
      "custom.sessionTime",
      "custom.bookingId"
    ]
  }'
```

### Step 3: Create the Booking Workflow

Go to **Workspace → Workflows** and click "Add Workflow":

#### Workflow 1: Create Appointment (Sync)

| Field | Value |
|-------|-------|
| Name | ABC Ignite Booking |
| Trigger Adapter | `booking` |
| Trigger Operation | `create_booking` |
| Action Adapter | `abc_ignite` |
| Action Operation | `create_appointment` |

**Action Parameters:**

```json
{
  "employeeId": "{{employeeId}}",
  "eventTypeId": "{{eventTypeId}}",
  "levelId": "{{levelId}}",
  "startTime": "{{startTime}}",
  "memberId": "{{memberId}}"
}
```

#### Workflow 2: Post-Booking Capture (Optional)

If you want to capture booking data to leads:

| Field | Value |
|-------|-------|
| Name | Capture Booking Data |
| Trigger Adapter | `booking` |
| Trigger Operation | `create_booking` |
| Action Adapter | `capture` |
| Action Operation | `submit` |

**Note:** The current booking confirm flow already calls `submitCaptureTrigger()` directly. This workflow is optional and for additional automation.

### Step 4: Verify the Integration

1. **Check Dependency Graph**: Go to Workflows and switch to "Dependency Graph" view. You should see:
   - `booking` node with outgoing edge to `abc_ignite`
   - Edge labeled "ABC Ignite Booking" (your workflow name)

2. **Test the Booking Flow**:
   - Navigate to `/public/sportswest/book`
   - Select a trainer and time slot
   - Enter test barcode, email, and phone
   - Click "Request Booking"
   - Check email for magic link
   - Click magic link to confirm

3. **Verify in Events Tab**: Check for these events:
   - `booking_pending_created`
   - `booking_confirmed`
   - `workflow_executed` (if workflow configured)

---

## Custom Fields Setup

### Required Custom Fields for SWAC

Create these in **Workspace → Settings → Custom Fields**:

```
┌────────────────┬─────────────────────┬────────┬──────────┐
│ Key            │ Label               │ Type   │ Required │
├────────────────┼─────────────────────┼────────┼──────────┤
│ barcode        │ Member Barcode      │ TEXT   │ No       │
│ trainerName    │ Trainer Name        │ TEXT   │ No       │
│ sessionTime    │ Session Time        │ TEXT   │ No       │
│ bookingId      │ Booking ID          │ TEXT   │ No       │
│ membershipType │ Membership Type     │ TEXT   │ No       │
│ sessionsUsed   │ Sessions Used       │ NUMBER │ No       │
│ sessionsRemain │ Sessions Remaining  │ NUMBER │ No       │
└────────────────┴─────────────────────┴────────┴──────────┘
```

### Field Mapping for Capture

When calling `submitCaptureTrigger()`, use the `custom.` prefix:

```typescript
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';

await submitCaptureTrigger(workspaceId, 'booking_confirmed', {
  // Lead fields (no prefix)
  email: customer.email,
  firstName: customer.firstName,
  
  // Custom fields (with 'custom.' prefix)
  'custom.barcode': customer.barcode,
  'custom.trainerName': trainerName,
  'custom.sessionTime': scheduledAt.toISOString(),
  'custom.bookingId': bookingResult.bookingId,
});
```

---

## Workflow Configuration

### Available Triggers

| Adapter | Operation | Description |
|---------|-----------|-------------|
| `booking` | `create_booking` | User confirms magic link booking |
| `booking` | `add_to_waitlist` | User added to waitlist |
| `capture` | `booking_confirmed` | Post-booking capture trigger |
| `capture` | `form_captured` | Default capture trigger |

### Available Actions

| Adapter | Operation | Description |
|---------|-----------|-------------|
| `abc_ignite` | `create_appointment` | Create appointment in ABC |
| `resend` | `send_email` | Send custom email |
| `capture` | `submit` | Submit data to capture |

### Workflow Variables

Variables from trigger payload can be used in action parameters:

```
{{email}}           - Customer email
{{firstName}}       - Customer first name
{{memberId}}        - ABC Ignite member ID
{{employeeId}}      - Trainer/staff ID
{{eventTypeId}}     - Service/event type ID
{{levelId}}         - Level ID (optional)
{{startTime}}       - Session start time (ISO)
{{customerName}}    - Full customer name
```

### Example: Send Confirmation Email After Booking

```yaml
name: Send Booking Confirmation
trigger:
  adapter: capture
  operation: booking_confirmed
actions:
  - adapter: resend
    operation: send_email
    params:
      template: booking-confirmed
      to: "{{email}}"
      variables:
        name: "{{firstName}}"
        trainer: "{{customFields.trainerName}}"
        time: "{{customFields.sessionTime}}"
```

---

## Testing the Integration

### 1. Test ABC Ignite Connection

```bash
# Get employees (trainers)
curl "https://revline.app/api/v1/booking/employees?workspaceSlug=sportswest"

# Get availability
curl "https://revline.app/api/v1/booking/availability?workspaceSlug=sportswest&startDate=2026-01-25&endDate=2026-01-31&staffId=trainer_key"
```

### 2. Test Capture System

```bash
# Submit test capture via SDK (server-side)
# In a test script:
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';

const result = await submitCaptureTrigger(
  'workspace-id-here',
  'booking_confirmed',
  {
    email: 'test@example.com',
    firstName: 'Test',
    'custom.barcode': 'test123',
  }
);

console.log('Capture result:', result);
```

### 3. Test Full Booking Flow

1. Open `/public/sportswest/book` in browser
2. Select trainer → Select time slot
3. Enter:
   - Barcode: (valid ABC member barcode)
   - Email: (matching member email)
   - Phone: (last 4 digits)
4. Click "Request Booking"
5. Check email inbox for magic link
6. Click link → Should redirect to success page

### 4. Verify Data in Dashboard

1. **Leads Tab**: Check if lead was created/updated
2. **Events Tab**: Check for capture and booking events
3. **Workflow Executions**: Check if workflows triggered

---

## Troubleshooting

### "Form not found" Error

**Cause:** WorkspaceForm with matching triggerName doesn't exist or is disabled.

**Fix:** 
1. Create capture form in Workspace → Capture
2. Ensure `triggerName` matches what you're calling with `submitCaptureTrigger()`
3. Ensure form is enabled

### "No workflow configured" in Logs

**Cause:** No workflow matches the trigger. Not necessarily an error - direct provider fallback will be used.

**Fix:** If you want workflow execution:
1. Create workflow in Workspace → Workflows
2. Set trigger adapter to `booking`, operation to `create_booking`
3. Ensure workflow is enabled

### Magic Link Not Received

**Causes:**
1. Resend integration not configured
2. Email doesn't match ABC member record
3. Rate limited

**Fix:**
1. Check Resend integration in workspace settings
2. Verify customer email matches ABC records
3. Check Events tab for `booking_request_email_mismatch`

### Booking Fails at Confirmation

**Causes:**
1. Token expired (15 min default)
2. Customer no longer eligible (used all sessions)
3. Slot no longer available

**Fix:**
1. Check Events tab for specific error event
2. Customer should request a new booking

### Custom Fields Not Saving

**Causes:**
1. Custom field not defined in workspace
2. Field key mismatch (e.g., `barcode` vs `custom.barcode`)
3. Field type mismatch (sending string to NUMBER field)

**Fix:**
1. Create custom field definition in Settings → Custom Fields
2. Use `custom.` prefix when submitting: `'custom.barcode': value`
3. Ensure value type matches field type

---

## Related Documentation

- [CAPTURE-SYSTEM.md](../CAPTURE-SYSTEM.md) - Full capture system documentation
- [WORKFLOW-ENGINE.md](../WORKFLOW-ENGINE.md) - Workflow engine details
- [STANDARDS.md](../STANDARDS.md) - Architecture principles
- [ABC-IGNITE-INTEGRATION.md](./ABC-IGNITE-INTEGRATION.md) - ABC Ignite specifics

---

## Quick Reference

### SDK Functions

```typescript
// Submit by trigger name
import { submitCaptureTrigger } from '@/app/_lib/services/capture.service';
await submitCaptureTrigger(workspaceId, 'booking_confirmed', payload);

// Submit by form ID
import { submitToCapture } from '@/app/_lib/services/capture.service';
await submitToCapture(formId, payload);

// Execute sync workflow
import { executeWorkflowSync } from '@/app/_lib/workflow';
const result = await executeWorkflowSync(
  workspaceId,
  { adapter: 'booking', operation: 'create_booking' },
  payload,
  { allowNoWorkflow: true }
);
```

### Key API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/booking/employees` | List trainers |
| GET | `/api/v1/booking/availability` | Get time slots |
| POST | `/api/v1/booking/request` | Request booking |
| GET | `/api/v1/booking/confirm/[token]` | Confirm booking |
| POST | `/api/v1/capture/[formId]` | Public capture |

### Trigger/Action Reference

```
TRIGGERS:
booking.create_booking      → User confirms magic link
booking.add_to_waitlist     → User waitlisted
capture.{triggerName}       → Capture form submitted

ACTIONS:
abc_ignite.create_appointment  → Book in ABC
abc_ignite.lookup_member       → Find member
resend.send_email              → Send email
capture.submit                 → Submit capture
```
