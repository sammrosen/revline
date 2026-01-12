# RevLine Funnel Heads & Form Builder

> **Status**: Planning  
> **Author**: Architecture Discussion  
> **Date**: January 2026

## Executive Summary

This document specifies a refactor to introduce **Funnel Heads** as a first-class concept in RevLine, starting with a **Form Builder** system. The goal is to make RevLine a configurable integration (like MailerLite, ABC Ignite) where forms, phone routing, and other intake mechanisms are defined per-client in the admin panel—not in code.

**Key Outcomes:**
1. RevLine becomes an `IntegrationType` with a config panel
2. Admins can create custom forms for each client without code changes
3. Forms trigger workflows that push data to downstream systems (ABC Ignite, MailerLite, etc.)
4. All existing patterns (adapters, registry, executors, workflows) remain intact

---

## Table of Contents

1. [Concept: Funnel Heads](#1-concept-funnel-heads)
2. [Architecture Overview](#2-architecture-overview)
3. [RevLine as IntegrationType](#3-revline-as-integrationtype)
4. [Form Schema Specification](#4-form-schema-specification)
5. [Form Field Components](#5-form-field-components)
6. [API Endpoints](#6-api-endpoints)
7. [Workflow Integration](#7-workflow-integration)
8. [Data Flow](#8-data-flow)
9. [Admin UI Components](#9-admin-ui-components)
10. [File Structure](#10-file-structure)
11. [Database Changes](#11-database-changes)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Requirements](#13-testing-requirements)
14. [Security Considerations](#14-security-considerations)
15. [Future Extensions](#15-future-extensions)

---

## 1. Concept: Funnel Heads

**Funnel Heads** are top-of-funnel intake mechanisms that capture data and trigger workflows. Currently, RevLine has one implicit funnel head:

| Current | Type | Trigger |
|---------|------|---------|
| `EmailCapture.tsx` | Email | `revline.email_captured` |

This refactor expands to a generalized system:

| Funnel Head | Type | Trigger(s) |
|-------------|------|------------|
| Email Capture | Simple form | `email_captured` |
| Custom Forms | Schema-driven | `form_submitted`, `waiver_signed`, `intake_form_submitted`, etc. |
| Phone Router | Phone intake | `phone_routed` (future) |
| Chat Widget | Conversational | `chat_initiated` (future) |

All funnel heads share:
- Rate limiting
- Deduplication via `WebhookProcessor`
- Client resolution via `source` parameter
- Workflow trigger emission
- Audit logging

---

## 2. Architecture Overview

### Current State

```
EmailCapture.tsx → POST /api/subscribe → emitTrigger('revline', 'email_captured')
                                              ↓
                                        Workflow Engine
                                              ↓
                                    MailerLite, RevLine Lead, etc.
```

### Target State

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FUNNEL HEADS                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EmailCapture    FormRenderer       CallRouter       (Future)           │
│       │               │                 │                               │
│       └───────────────┼─────────────────┘                               │
│                       │                                                 │
│                       ▼                                                 │
│              POST /api/form-submit                                      │
│                       │                                                 │
│                       ▼                                                 │
│              ┌────────────────┐                                         │
│              │ Form Processor │ (validate, dedupe, client lookup)       │
│              └────────────────┘                                         │
│                       │                                                 │
│                       ▼                                                 │
│              emitTrigger('revline', triggerOperation, payload)          │
│                       │                                                 │
└───────────────────────┼─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ WORKFLOW ENGINE                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Find matching workflows for client + trigger                           │
│                       │                                                 │
│                       ▼                                                 │
│  Execute actions sequentially:                                          │
│  ├── revline.create_lead                                               │
│  ├── abc_ignite.create_prospect                                        │
│  ├── mailerlite.add_to_group                                           │
│  └── ...                                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. RevLine as IntegrationType

### 3.1 Prisma Schema Change

```prisma
// prisma/schema.prisma

enum IntegrationType {
  MAILERLITE
  STRIPE
  CALENDLY
  MANYCHAT
  ABC_IGNITE
  REVLINE      // ADD THIS
}
```

**Migration required.** Run: `npx prisma migrate dev --name add_revline_integration`

### 3.2 Integration Config

Add to `app/_lib/integrations/config.ts`:

```typescript
export const INTEGRATION_TYPES = [
  'MAILERLITE',
  'STRIPE', 
  'CALENDLY',
  'MANYCHAT',
  'ABC_IGNITE',
  'REVLINE',  // ADD THIS
] as const;

// Add to INTEGRATIONS record:
REVLINE: {
  id: 'REVLINE',
  name: 'revline',
  displayName: 'RevLine',
  color: 'text-amber-400',
  hasStructuredEditor: true,
  secrets: [],  // No external secrets - internal config only
  metaTemplate: {
    forms: {},
    phoneRouting: {
      enabled: false,
      rules: [],
      smsTemplates: {},
    },
    settings: {
      defaultSource: '',
    },
  },
  metaDescription: 'Configure forms, phone routing, and RevLine settings',
  metaFields: [
    { key: 'forms.*', description: 'Form definitions by ID', required: false },
    { key: 'phoneRouting', description: 'Phone routing configuration', required: false },
    { key: 'settings', description: 'General RevLine settings', required: false },
  ],
  tips: [
    'Forms defined here are used with <ClientFormRenderer formId="..." />',
    'Use standard field IDs (email, firstName, lastName) for automatic mapping',
    'Each form can have its own trigger operation for workflow routing',
  ],
},
```

### 3.3 Meta Structure

The `client_integrations.meta` field for REVLINE stores:

```typescript
interface RevlineMeta {
  forms: Record<string, FormDefinition>;
  phoneRouting: {
    enabled: boolean;
    rules: PhoneRoutingRule[];
    smsTemplates: Record<string, string>;
  };
  settings: {
    defaultSource: string;
  };
}
```

---

## 4. Form Schema Specification

### 4.1 Type Definitions

Create `app/_lib/forms/schema.ts`:

```typescript
import { z } from 'zod';

/**
 * Supported field types
 */
export const FieldTypeSchema = z.enum([
  'text',
  'email', 
  'phone',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'checkbox-group',
  'number',
  'date',
  'hidden',
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

/**
 * Select/radio/checkbox option
 */
export const FieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export type FieldOption = z.infer<typeof FieldOptionSchema>;

/**
 * Field validation rules
 */
export const FieldValidationSchema = z.object({
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
}).optional();

export type FieldValidation = z.infer<typeof FieldValidationSchema>;

/**
 * Conditional display rules
 */
export const FieldConditionalSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_empty']),
  value: z.unknown().optional(),
}).optional();

export type FieldConditional = z.infer<typeof FieldConditionalSchema>;

/**
 * Single form field definition
 */
export const FormFieldSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field ID must start with letter, contain only alphanumeric and underscores'),
  type: FieldTypeSchema,
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  validation: FieldValidationSchema,
  options: z.array(FieldOptionSchema).optional(),
  defaultValue: z.unknown().optional(),
  helpText: z.string().optional(),
  conditional: FieldConditionalSchema,
  className: z.string().optional(),
});

export type FormField = z.infer<typeof FormFieldSchema>;

/**
 * Form display settings
 */
export const FormSettingsSchema = z.object({
  submitText: z.string().default('Submit'),
  submittingText: z.string().default('Submitting...'),
  successMessage: z.string().default('Thank you for your submission!'),
  errorMessage: z.string().default('Something went wrong. Please try again.'),
  redirectUrl: z.string().url().optional(),
  layout: z.enum(['stacked', 'inline', 'two-column']).default('stacked'),
  showLabels: z.boolean().default(true),
  resetOnSuccess: z.boolean().default(true),
});

export type FormSettings = z.infer<typeof FormSettingsSchema>;

/**
 * Form metadata for workflow integration
 */
export const FormMetadataSchema = z.object({
  triggerOperation: z.string().default('form_submitted'),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export type FormMetadata = z.infer<typeof FormMetadataSchema>;

/**
 * Complete form definition
 */
export const FormDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Form ID must be lowercase kebab-case'),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().positive().default(1),
  fields: z.array(FormFieldSchema).min(1),
  settings: FormSettingsSchema.default({}),
  metadata: FormMetadataSchema.default({}),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type FormDefinition = z.infer<typeof FormDefinitionSchema>;

/**
 * Form submission payload
 */
export const FormSubmissionSchema = z.object({
  formId: z.string(),
  source: z.string(),
  data: z.record(z.unknown()),
  submittedAt: z.string().datetime().optional(),
});

export type FormSubmission = z.infer<typeof FormSubmissionSchema>;
```

### 4.2 Standard Field IDs

For automatic mapping to downstream systems, use these conventions:

| Field ID | Type | Maps To |
|----------|------|---------|
| `email` | email | Universal email field |
| `firstName` | text | ABC Ignite: firstName, MailerLite: name (split) |
| `lastName` | text | ABC Ignite: lastName |
| `name` | text | Full name (when not split) |
| `phone` | phone | ABC Ignite: mobilePhone |
| `dob` | date | ABC Ignite: dateOfBirth |
| `barcode` | text | ABC Ignite: barcode |
| `address` | text | Street address |
| `city` | text | City |
| `state` | text | State/Province |
| `zipCode` | text | Postal code |
| `emergencyContact` | text | Emergency contact name |
| `emergencyPhone` | phone | Emergency contact phone |

Non-standard field IDs pass through as-is in the payload.

---

## 5. Form Field Components

### 5.1 Component Interface

Create `app/_lib/forms/components/types.ts`:

```typescript
import { FormField } from '../schema';

export interface FieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export interface FieldComponent {
  (props: FieldProps): React.ReactElement;
}
```

### 5.2 Required Components

Create these in `app/_lib/forms/components/`:

| File | Field Type | Notes |
|------|------------|-------|
| `TextField.tsx` | text | Basic text input |
| `EmailField.tsx` | email | Email with format hint |
| `PhoneField.tsx` | phone | Phone with formatting (use libphonenumber-js) |
| `TextareaField.tsx` | textarea | Multi-line text |
| `SelectField.tsx` | select | Dropdown select |
| `RadioField.tsx` | radio | Radio button group |
| `CheckboxField.tsx` | checkbox | Single checkbox (boolean) |
| `CheckboxGroupField.tsx` | checkbox-group | Multiple checkboxes (array) |
| `NumberField.tsx` | number | Numeric input |
| `DateField.tsx` | date | Date picker |
| `HiddenField.tsx` | hidden | Hidden field |

### 5.3 Field Registry

Create `app/_lib/forms/components/index.ts`:

```typescript
import { FieldType } from '../schema';
import { FieldComponent } from './types';

import { TextField } from './TextField';
import { EmailField } from './EmailField';
import { PhoneField } from './PhoneField';
import { TextareaField } from './TextareaField';
import { SelectField } from './SelectField';
import { RadioField } from './RadioField';
import { CheckboxField } from './CheckboxField';
import { CheckboxGroupField } from './CheckboxGroupField';
import { NumberField } from './NumberField';
import { DateField } from './DateField';
import { HiddenField } from './HiddenField';

export const FIELD_COMPONENTS: Record<FieldType, FieldComponent> = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  select: SelectField,
  radio: RadioField,
  checkbox: CheckboxField,
  'checkbox-group': CheckboxGroupField,
  number: NumberField,
  date: DateField,
  hidden: HiddenField,
};

export function getFieldComponent(type: FieldType): FieldComponent {
  return FIELD_COMPONENTS[type] ?? TextField;
}
```

### 5.4 FormRenderer Component

Create `app/_lib/forms/FormRenderer.tsx`:

```typescript
'use client';

import { useState, FormEvent, useMemo } from 'react';
import { FormDefinition, FormField } from './schema';
import { validateFormData, ValidationErrors } from './validation';
import { getFieldComponent } from './components';

interface FormRendererProps {
  form: FormDefinition;
  source: string;
  onSuccess?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  fieldClassName?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function FormRenderer({
  form,
  source,
  onSuccess,
  onError,
  className = '',
  fieldClassName = '',
  buttonClassName = '',
  disabled = false,
}: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    // Initialize with default values
    const defaults: Record<string, unknown> = {};
    for (const field of form.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.id] = field.defaultValue;
      }
    }
    return defaults;
  });
  
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Filter fields based on conditional rules
  const visibleFields = useMemo(() => {
    return form.fields.filter((field) => {
      if (!field.conditional) return true;
      
      const { field: condField, operator, value: condValue } = field.conditional;
      const actualValue = values[condField];
      
      switch (operator) {
        case 'equals':
          return actualValue === condValue;
        case 'not_equals':
          return actualValue !== condValue;
        case 'contains':
          return String(actualValue ?? '').includes(String(condValue));
        case 'not_empty':
          return actualValue !== undefined && actualValue !== null && actualValue !== '';
        default:
          return true;
      }
    });
  }, [form.fields, values]);

  const handleChange = (fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleBlur = (fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (status === 'submitting' || disabled) return;

    // Validate all visible fields
    const validationErrors = validateFormData(form, values, visibleFields);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Mark all fields as touched to show errors
      const allTouched: Record<string, boolean> = {};
      visibleFields.forEach((f) => { allTouched[f.id] = true; });
      setTouched(allTouched);
      return;
    }

    setStatus('submitting');
    setErrors({});

    try {
      const response = await fetch('/api/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          source,
          data: values,
          submittedAt: new Date().toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || form.settings.errorMessage);
      }

      setStatus('success');
      setMessage(form.settings.successMessage);
      
      if (onSuccess) {
        onSuccess(values);
      }

      // Reset form if configured
      if (form.settings.resetOnSuccess) {
        const defaults: Record<string, unknown> = {};
        for (const field of form.fields) {
          if (field.defaultValue !== undefined) {
            defaults[field.id] = field.defaultValue;
          }
        }
        setValues(defaults);
        setTouched({});
      }

      // Redirect if configured
      if (form.settings.redirectUrl) {
        setTimeout(() => {
          window.location.href = form.settings.redirectUrl!;
        }, 1500);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : form.settings.errorMessage;
      setStatus('error');
      setMessage(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  // Success state
  if (status === 'success' && !form.settings.redirectUrl) {
    return (
      <div className={`${className} text-center`}>
        <div className="text-green-500 text-lg font-medium">{message}</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className={`space-y-4 ${form.settings.layout === 'two-column' ? 'grid grid-cols-2 gap-4 space-y-0' : ''}`}>
        {visibleFields.map((field) => {
          const FieldComponent = getFieldComponent(field.type);
          const error = touched[field.id] ? errors[field.id] : undefined;

          return (
            <FieldComponent
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(value) => handleChange(field.id, value)}
              onBlur={() => handleBlur(field.id)}
              error={error}
              disabled={status === 'submitting' || disabled}
              className={fieldClassName}
            />
          );
        })}
      </div>

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting' || disabled}
        className={`mt-6 w-full py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        {status === 'submitting' ? form.settings.submittingText : form.settings.submitText}
      </button>
    </form>
  );
}
```

### 5.5 ClientFormRenderer (Fetches form from API)

Create `app/_lib/forms/ClientFormRenderer.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { FormDefinition } from './schema';
import { FormRenderer } from './FormRenderer';

interface ClientFormRendererProps {
  source: string;
  formId: string;
  onSuccess?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
  fieldClassName?: string;
  buttonClassName?: string;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

export function ClientFormRenderer({
  source,
  formId,
  onSuccess,
  onError,
  className,
  fieldClassName,
  buttonClassName,
  loadingComponent,
  errorComponent,
}: ClientFormRendererProps) {
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForm() {
      try {
        const response = await fetch(`/api/forms/${source}/${formId}`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load form');
        }

        const data = await response.json();
        setForm(data.form);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [source, formId]);

  if (loading) {
    return loadingComponent ?? <div className="animate-pulse">Loading form...</div>;
  }

  if (error || !form) {
    return errorComponent ?? <div className="text-red-500">Error: {error || 'Form not found'}</div>;
  }

  return (
    <FormRenderer
      form={form}
      source={source}
      onSuccess={onSuccess}
      onError={onError}
      className={className}
      fieldClassName={fieldClassName}
      buttonClassName={buttonClassName}
    />
  );
}
```

---

## 6. API Endpoints

### 6.1 Form Definition Endpoint

Create `app/api/forms/[source]/[formId]/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { getRevlineConfig } from '@/app/_lib/forms/loader';

interface RouteParams {
  params: Promise<{
    source: string;
    formId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { source, formId } = await params;

  // Get client by source
  const client = await getActiveClient(source);
  if (!client) {
    return ApiResponse.error('Client not found', 404, ErrorCodes.NOT_FOUND);
  }

  // Load RevLine config for client
  const revlineConfig = await getRevlineConfig(client.id);
  if (!revlineConfig) {
    return ApiResponse.error('RevLine not configured for client', 404, ErrorCodes.NOT_FOUND);
  }

  // Get form definition
  const form = revlineConfig.forms[formId];
  if (!form) {
    return ApiResponse.error('Form not found', 404, ErrorCodes.NOT_FOUND);
  }

  return ApiResponse.success({ form });
}
```

### 6.2 Form Submission Endpoint

Create `app/api/form-submit/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getActiveClient } from '@/app/_lib/client-gate';
import { emitTrigger } from '@/app/_lib/workflow';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { 
  rateLimitByIP, 
  getClientIP, 
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/app/_lib/middleware';
import {
  WebhookProcessor,
  logStructured,
} from '@/app/_lib/reliability';
import { getRevlineConfig } from '@/app/_lib/forms/loader';
import { validateFormSubmission, validateFormData } from '@/app/_lib/forms/validation';

export async function POST(request: NextRequest) {
  // 1. Rate limit check
  const clientIP = getClientIP(request.headers);
  const rateLimit = rateLimitByIP(clientIP, RATE_LIMITS.SUBSCRIBE);
  
  if (!rateLimit.allowed) {
    return ApiResponse.rateLimited(rateLimit.retryAfter);
  }

  // 2. Parse request body
  const rawBody = await request.text();
  
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return ApiResponse.error('Invalid JSON', 400, ErrorCodes.INVALID_INPUT);
  }

  // 3. Validate submission structure
  const submissionValidation = validateFormSubmission(body);
  if (!submissionValidation.success) {
    return ApiResponse.error(
      submissionValidation.error || 'Invalid submission',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  const { formId, source, data } = submissionValidation.data!;

  try {
    // 4. Get active client
    const client = await getActiveClient(source);
    if (!client) {
      return ApiResponse.unavailable();
    }

    // 5. Load form definition
    const revlineConfig = await getRevlineConfig(client.id);
    if (!revlineConfig) {
      return ApiResponse.error('RevLine not configured', 404, ErrorCodes.NOT_FOUND);
    }

    const form = revlineConfig.forms[formId];
    if (!form) {
      return ApiResponse.error('Form not found', 404, ErrorCodes.NOT_FOUND);
    }

    // 6. Validate form data against schema
    const dataValidation = validateFormData(form, data);
    if (Object.keys(dataValidation).length > 0) {
      return ApiResponse.error(
        'Validation failed: ' + Object.values(dataValidation).join(', '),
        400,
        ErrorCodes.INVALID_INPUT
      );
    }

    // 7. Generate deduplication key
    // Use primary identifier (email/phone) + formId + minute timestamp
    const primaryId = data.email || data.phone || JSON.stringify(data);
    const minuteTimestamp = Math.floor(Date.now() / 60000);
    const providerEventId = `form-${formId}-${primaryId}-${minuteTimestamp}`;

    // 8. Register with WebhookProcessor for deduplication
    const registration = await WebhookProcessor.register({
      clientId: client.id,
      provider: 'revline',
      providerEventId,
      rawBody,
    });

    // 9. Handle duplicate submissions gracefully
    if (registration.isDuplicate) {
      logStructured({
        correlationId: registration.correlationId,
        event: 'form_submission_duplicate',
        clientId: client.id,
        provider: 'revline',
        metadata: { formId, source },
      });
      
      return ApiResponse.success({
        message: form.settings.successMessage,
      });
    }

    // 10. Mark as processing
    await WebhookProcessor.markProcessing(registration.id);

    // 11. Build trigger payload
    const triggerOperation = form.metadata.triggerOperation || 'form_submitted';
    const payload = {
      formId,
      source,
      ...data,
      correlationId: registration.correlationId,
      submittedAt: new Date().toISOString(),
    };

    // 12. Emit trigger to workflow engine
    const result = await emitTrigger(
      client.id,
      { adapter: 'revline', operation: triggerOperation },
      payload
    );

    // 13. Check for failures
    const hasFailure = result.executions.some(e => e.status === 'failed');
    
    if (hasFailure) {
      const failures = result.executions
        .filter(e => e.status === 'failed')
        .map(e => e.error)
        .join('; ');
      
      logStructured({
        correlationId: registration.correlationId,
        event: 'form_submission_partial_failure',
        clientId: client.id,
        provider: 'revline',
        error: failures,
        metadata: { formId },
      });
    }

    // 14. Mark as processed
    await WebhookProcessor.markProcessed(registration.id);

    logStructured({
      correlationId: registration.correlationId,
      event: 'form_submission_processed',
      clientId: client.id,
      provider: 'revline',
      success: true,
      metadata: { 
        formId, 
        source,
        triggerOperation,
        workflowsExecuted: result.workflowsExecuted,
      },
    });

    // 15. Return success
    const response = ApiResponse.success({
      message: form.settings.successMessage,
      redirectUrl: form.settings.redirectUrl,
    });

    const headers = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'form_submission_error',
      provider: 'revline',
      error: errorMessage,
      metadata: { formId, source },
    });
    
    return ApiResponse.internalError();
  }
}
```

### 6.3 Form Loader Utility

Create `app/_lib/forms/loader.ts`:

```typescript
import { prisma } from '@/app/_lib/db';
import { IntegrationType } from '@prisma/client';
import { FormDefinition } from './schema';

interface RevlineConfig {
  forms: Record<string, FormDefinition>;
  phoneRouting: {
    enabled: boolean;
    rules: unknown[];
    smsTemplates: Record<string, string>;
  };
  settings: {
    defaultSource: string;
  };
}

/**
 * Load RevLine configuration for a client
 */
export async function getRevlineConfig(clientId: string): Promise<RevlineConfig | null> {
  const integration = await prisma.clientIntegration.findUnique({
    where: {
      clientId_integration: {
        clientId,
        integration: IntegrationType.REVLINE,
      },
    },
    select: {
      meta: true,
    },
  });

  if (!integration || !integration.meta) {
    return null;
  }

  return integration.meta as unknown as RevlineConfig;
}

/**
 * Load a specific form definition for a client
 */
export async function getFormDefinition(
  clientId: string, 
  formId: string
): Promise<FormDefinition | null> {
  const config = await getRevlineConfig(clientId);
  
  if (!config || !config.forms) {
    return null;
  }

  return config.forms[formId] || null;
}
```

---

## 7. Workflow Integration

### 7.1 Registry Updates

Update `app/_lib/workflow/registry.ts`:

Add to `REVLINE_ADAPTER.triggers`:

```typescript
// Add these triggers
form_submitted: {
  name: 'form_submitted',
  label: 'Form Submitted',
  description: 'Fires when any custom form is submitted',
  payloadSchema: z.object({
    formId: z.string(),
    source: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
  }).passthrough(),
},

waiver_signed: {
  name: 'waiver_signed',
  label: 'Waiver Signed',
  description: 'Fires when a waiver/agreement form is submitted',
  payloadSchema: z.object({
    formId: z.string(),
    source: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    agreedToTerms: z.boolean().optional(),
  }).passthrough(),
},

intake_form_submitted: {
  name: 'intake_form_submitted',
  label: 'Intake Form Submitted',
  description: 'Fires when an intake/application form is submitted',
  payloadSchema: z.object({
    formId: z.string(),
    source: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  }).passthrough(),
},

prospect_form_submitted: {
  name: 'prospect_form_submitted',
  label: 'Prospect Form Submitted',
  description: 'Fires when a prospect/lead capture form is submitted',
  payloadSchema: z.object({
    formId: z.string(),
    source: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    interests: z.array(z.string()).optional(),
  }).passthrough(),
},
```

### 7.2 ABC Ignite Actions (New)

Add to `ABC_IGNITE_ADAPTER.actions` in registry:

```typescript
create_prospect: {
  name: 'create_prospect',
  label: 'Create Prospect',
  description: 'Create a new prospect in ABC Ignite',
  payloadSchema: z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  }).passthrough(),
  paramsSchema: z.object({
    source: z.string().optional().describe('Lead source identifier'),
  }),
},

create_or_update_member: {
  name: 'create_or_update_member',
  label: 'Create or Update Member',
  description: 'Create a new member or update existing in ABC Ignite',
  payloadSchema: z.object({
    email: z.string().email().optional(),
    barcode: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  }).passthrough(),
  paramsSchema: z.object({
    createIfNotExists: z.boolean().default(true),
    lookupBy: z.enum(['email', 'barcode']).default('email'),
  }),
},
```

### 7.3 ABC Ignite Adapter Extensions

Add to `app/_lib/integrations/abc-ignite.adapter.ts`:

```typescript
/**
 * Create a prospect (pre-member)
 * POST /{clubNumber}/members
 */
async createProspect(prospectData: {
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone?: string;
  homeClub?: string;
  source?: string;
}): Promise<IntegrationResult<AbcIgniteMember>> {
  const body = {
    ...prospectData,
    homeClub: prospectData.homeClub || this.getClubNumber(),
    joinStatus: 'prospect',
  };

  return this.apiRequest<AbcIgniteMember>('POST', '/members', body);
}

/**
 * Update an existing member
 * PUT /{clubNumber}/members/{memberId}
 */
async updateMember(
  memberId: string,
  memberData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    mobilePhone: string;
  }>
): Promise<IntegrationResult<AbcIgniteMember>> {
  return this.apiRequest<AbcIgniteMember>(
    'PUT',
    `/members/${memberId}`,
    memberData
  );
}

/**
 * Find member by email
 * GET /{clubNumber}/members?email={email}
 */
async getMemberByEmail(email: string): Promise<IntegrationResult<AbcIgniteMember | null>> {
  const result = await this.apiRequest<AbcIgniteListResponse<AbcIgniteMember>>(
    'GET',
    `/members?email=${encodeURIComponent(email)}`
  );

  if (!result.success) {
    return result as IntegrationResult<AbcIgniteMember | null>;
  }

  const members = result.data?.results || [];
  return this.success(members.length > 0 ? members[0] : null);
}
```

### 7.4 ABC Ignite Executor Extensions

Add to `app/_lib/workflow/executors/abc-ignite.ts`:

```typescript
/**
 * Create a prospect in ABC Ignite
 */
const createProspect: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured' };
    }

    const payload = ctx.trigger.payload;
    
    // Extract standard fields from payload
    const prospectData = {
      firstName: (payload.firstName as string) || '',
      lastName: (payload.lastName as string) || '',
      email: (payload.email as string) || ctx.email,
      mobilePhone: payload.phone as string | undefined,
      source: (params.source as string) || ctx.trigger.adapter,
    };

    if (!prospectData.email) {
      return { success: false, error: 'Email is required to create prospect' };
    }

    const result = await adapter.createProspect(prospectData);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        memberId: result.data?.memberId,
        action: 'created',
      },
    };
  },
};

/**
 * Create or update a member in ABC Ignite
 */
const createOrUpdateMember: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    const adapter = await AbcIgniteAdapter.forClient(ctx.clientId);
    if (!adapter) {
      return { success: false, error: 'ABC Ignite not configured' };
    }

    const payload = ctx.trigger.payload;
    const lookupBy = (params.lookupBy as string) || 'email';
    const createIfNotExists = params.createIfNotExists !== false;

    // Try to find existing member
    let existingMember: AbcIgniteMember | null = null;

    if (lookupBy === 'barcode' && payload.barcode) {
      const result = await adapter.getMemberByBarcode(payload.barcode as string);
      if (result.success) {
        existingMember = result.data;
      }
    } else if (payload.email || ctx.email) {
      const email = (payload.email as string) || ctx.email;
      const result = await adapter.getMemberByEmail(email);
      if (result.success) {
        existingMember = result.data;
      }
    }

    // Build member data from payload
    const memberData = {
      firstName: payload.firstName as string | undefined,
      lastName: payload.lastName as string | undefined,
      email: (payload.email as string) || ctx.email,
      mobilePhone: payload.phone as string | undefined,
    };

    if (existingMember) {
      // Update existing member
      const result = await adapter.updateMember(existingMember.memberId, memberData);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          memberId: existingMember.memberId,
          action: 'updated',
        },
      };
    } else if (createIfNotExists) {
      // Create new prospect
      const result = await adapter.createProspect({
        firstName: memberData.firstName || '',
        lastName: memberData.lastName || '',
        email: memberData.email,
        mobilePhone: memberData.mobilePhone,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          memberId: result.data?.memberId,
          action: 'created',
        },
      };
    } else {
      return {
        success: false,
        error: 'Member not found and createIfNotExists is false',
      };
    }
  },
};

// Export
export const abcIgniteExecutors: Record<string, ActionExecutor> = {
  // ... existing executors
  create_prospect: createProspect,
  create_or_update_member: createOrUpdateMember,
};
```

---

## 8. Data Flow

### 8.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. FORM DISPLAY                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Landing Page: /iron-gym/signup                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ <ClientFormRenderer source="iron-gym" formId="prospect-intake" />     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│       │                                                                     │
│       │ GET /api/forms/iron-gym/prospect-intake                            │
│       ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ RevLine API:                                                          │ │
│  │ 1. Lookup client "iron-gym"                                           │ │
│  │ 2. Load REVLINE integration meta                                      │ │
│  │ 3. Return forms["prospect-intake"]                                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│       │                                                                     │
│       ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ FormRenderer renders form fields dynamically                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User fills form, clicks Submit
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FORM SUBMISSION                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/form-submit                                                     │
│  Body: {                                                                    │
│    formId: "prospect-intake",                                              │
│    source: "iron-gym",                                                     │
│    data: {                                                                  │
│      firstName: "John",                                                     │
│      lastName: "Smith",                                                     │
│      email: "john@email.com",                                              │
│      phone: "555-123-4567",                                                │
│      interests: ["personal-training"]                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. REVLINE PROCESSING                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Rate Limit ─────────────────────────────────────────────────────────┐  │
│  │ Check IP: 10 requests/min                                    ✓ PASS  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Client Lookup ──────────────────────────────────────────────────────┐  │
│  │ getActiveClient("iron-gym")                                  ✓ FOUND │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Form Validation ────────────────────────────────────────────────────┐  │
│  │ Load form definition, validate data against schema           ✓ VALID │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Deduplication ──────────────────────────────────────────────────────┐  │
│  │ WebhookProcessor.register(...)                                       │  │
│  │ Key: form-prospect-intake-john@email.com-28934571                   │  │
│  │                                                            ✓ UNIQUE  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Emit Trigger ───────────────────────────────────────────────────────┐  │
│  │ emitTrigger(                                                         │  │
│  │   clientId: "iron-gym-uuid",                                        │  │
│  │   { adapter: "revline", operation: "prospect_form_submitted" },     │  │
│  │   { formId, source, firstName, lastName, email, phone, ... }        │  │
│  │ )                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. WORKFLOW EXECUTION                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Find workflows: triggerAdapter="revline",                                 │
│                  triggerOperation="prospect_form_submitted"                │
│                                                                             │
│  Found: "Prospect → ABC Ignite + MailerLite"                              │
│                                                                             │
│  ┌─ Action 1: revline.create_lead ──────────────────────────────────────┐  │
│  │ INSERT INTO leads (email, source, clientId, ...)                     │  │
│  │ Result: { leadId: "lead-456" }                               ✓ OK    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Action 2: abc_ignite.create_prospect ───────────────────────────────┐  │
│  │ POST https://api.abcfinancial.com/rest/12345/members                 │  │
│  │ Body: { firstName, lastName, email, mobilePhone, joinStatus }        │  │
│  │ Result: { memberId: "ABC-789" }                              ✓ OK    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─ Action 3: mailerlite.add_to_group ──────────────────────────────────┐  │
│  │ POST https://connect.mailerlite.com/api/subscribers                  │  │
│  │ Body: { email, groups: ["prospects"] }                       ✓ OK    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Workflow Status: COMPLETED                                                │
│  Actions: 3/3 succeeded                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. RESPONSE                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP 200 OK                                                               │
│  {                                                                          │
│    "success": true,                                                        │
│    "data": {                                                                │
│      "message": "Thanks! We'll be in touch soon."                         │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  User sees success message in FormRenderer                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Data Storage Locations

| System | What's Stored | Table/Location |
|--------|---------------|----------------|
| RevLine | Form definitions | `client_integrations.meta` (REVLINE type) |
| RevLine | Lead record | `leads` table |
| RevLine | Submission audit | `webhook_events` table |
| RevLine | Workflow execution | `workflow_executions` table |
| ABC Ignite | Prospect/Member | Their `members` endpoint |
| MailerLite | Subscriber | Their subscriber database |

---

## 9. Admin UI Components

### 9.1 RevLine Config Editor

Create `app/admin/clients/[id]/revline-config-editor.tsx`:

This is a tabbed interface with:
- **Forms Tab**: List forms, create/edit/delete forms, field editor
- **Phone Routing Tab**: (Future) Configure phone routing rules
- **Settings Tab**: Default source and other settings

### 9.2 Forms Editor Component

Within the Forms tab:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Forms                                                    [+ New Form]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────────────────────┐│
│  │ FORMS            │  │ FORM EDITOR                                  ││
│  │                  │  │                                              ││
│  │ ► prospect-intake│  │ Name: [Prospect Intake Form        ]        ││
│  │   waiver         │  │ ID:   prospect-intake (readonly)            ││
│  │   contact        │  │                                              ││
│  │                  │  │ Trigger: [prospect_form_submitted  ▼]       ││
│  │                  │  │                                              ││
│  │                  │  │ FIELDS                                       ││
│  │                  │  │ ┌─────────────────────────────────────────┐ ││
│  │                  │  │ │ ≡ firstName  text      Required  [Edit] │ ││
│  │                  │  │ │ ≡ lastName   text      Required  [Edit] │ ││
│  │                  │  │ │ ≡ email      email     Required  [Edit] │ ││
│  │                  │  │ │ ≡ phone      phone     Optional  [Edit] │ ││
│  │                  │  │ │ ≡ interests  checkbox  Optional  [Edit] │ ││
│  │                  │  │ └─────────────────────────────────────────┘ ││
│  │                  │  │                                              ││
│  │                  │  │ [+ Add Field]                                ││
│  │                  │  │                                              ││
│  │                  │  │ SETTINGS                                     ││
│  │                  │  │ Submit Text: [Get Started           ]        ││
│  │                  │  │ Success Msg: [Thanks! We'll call you]        ││
│  │                  │  │                                              ││
│  └──────────────────┘  └──────────────────────────────────────────────┘│
│                                                                         │
│                                            [Delete Form]  [Save Form]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Field Editor Modal

When editing a field:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Edit Field                                                        [×]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Field ID:    [firstName        ]  (used in payload and mappings)       │
│ Type:        [text            ▼]                                        │
│ Label:       [First Name       ]                                        │
│ Placeholder: [Enter first name ]                                        │
│ Required:    [✓]                                                        │
│ Help Text:   [                 ]                                        │
│                                                                         │
│ ▸ Validation Rules (optional)                                           │
│ ▸ Conditional Display (optional)                                        │
│                                                                         │
│                                                [Cancel]  [Save Field]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Wire Into Add Integration Form

Update `app/admin/clients/[id]/add-integration-form.tsx`:

```typescript
import { RevlineConfigEditor } from './revline-config-editor';

// Add check
const isRevline = integration === 'REVLINE';

// In JSX, config editor section:
{isRevline ? (
  <RevlineConfigEditor
    value={meta}
    onChange={setMeta}
  />
) : isAbcIgnite ? (
  // ... existing
```

---

## 10. File Structure

```
app/
├── _lib/
│   ├── forms/
│   │   ├── schema.ts                 # Zod schemas for form definitions
│   │   ├── validation.ts             # Form data validation
│   │   ├── loader.ts                 # Load forms from client config
│   │   ├── FormRenderer.tsx          # Main form rendering component
│   │   ├── ClientFormRenderer.tsx    # Wrapper that fetches form definition
│   │   └── components/
│   │       ├── types.ts              # Field component interface
│   │       ├── index.ts              # Field component registry
│   │       ├── TextField.tsx
│   │       ├── EmailField.tsx
│   │       ├── PhoneField.tsx
│   │       ├── TextareaField.tsx
│   │       ├── SelectField.tsx
│   │       ├── RadioField.tsx
│   │       ├── CheckboxField.tsx
│   │       ├── CheckboxGroupField.tsx
│   │       ├── NumberField.tsx
│   │       ├── DateField.tsx
│   │       └── HiddenField.tsx
│   │
│   ├── integrations/
│   │   ├── config.ts                 # ADD: REVLINE to integration config
│   │   └── abc-ignite.adapter.ts     # ADD: createProspect, updateMember methods
│   │
│   └── workflow/
│       ├── registry.ts               # ADD: form_submitted triggers, ABC actions
│       └── executors/
│           ├── abc-ignite.ts         # ADD: createProspect, createOrUpdateMember
│           └── index.ts              # (no changes needed if already exports abc-ignite)
│
├── api/
│   ├── forms/
│   │   └── [source]/
│   │       └── [formId]/
│   │           └── route.ts          # GET form definition
│   │
│   └── form-submit/
│       └── route.ts                  # POST form submission
│
└── admin/
    └── clients/
        └── [id]/
            ├── add-integration-form.tsx    # ADD: RevlineConfigEditor case
            ├── revline-config-editor.tsx   # NEW: Main RevLine config UI
            ├── revline-forms-editor.tsx    # NEW: Forms list and editor
            └── revline-field-editor.tsx    # NEW: Field editing modal

prisma/
├── schema.prisma                     # ADD: REVLINE to IntegrationType enum
└── migrations/
    └── YYYYMMDD_add_revline_integration/
        └── migration.sql
```

---

## 11. Database Changes

### 11.1 Migration

```sql
-- Add REVLINE to IntegrationType enum
ALTER TYPE "IntegrationType" ADD VALUE 'REVLINE';
```

### 11.2 No New Tables Required

Form definitions are stored in `client_integrations.meta` as JSON. This keeps the schema simple and avoids new tables.

If form volume grows significantly, consider a dedicated `client_forms` table in the future.

---

## 12. Implementation Phases

### Phase 1: Foundation (3-4 days)
- [ ] Add REVLINE to Prisma enum + migrate
- [ ] Add REVLINE to integration config
- [ ] Create form schema types (`schema.ts`)
- [ ] Create form validation (`validation.ts`)
- [ ] Create form loader (`loader.ts`)

### Phase 2: Components (3-4 days)
- [ ] Create all field components (TextField, EmailField, etc.)
- [ ] Create FormRenderer component
- [ ] Create ClientFormRenderer component
- [ ] Add basic styling (match existing design system)

### Phase 3: API Endpoints (2 days)
- [ ] Create `/api/forms/[source]/[formId]` endpoint
- [ ] Create `/api/form-submit` endpoint
- [ ] Add rate limiting and deduplication
- [ ] Add logging and error handling

### Phase 4: Workflow Integration (2-3 days)
- [ ] Add form triggers to registry (`form_submitted`, etc.)
- [ ] Add ABC Ignite actions (`create_prospect`, `create_or_update_member`)
- [ ] Create ABC Ignite executors
- [ ] Add adapter methods to ABC Ignite adapter
- [ ] Test end-to-end workflow

### Phase 5: Admin UI (3-4 days)
- [ ] Create RevlineConfigEditor with tabs
- [ ] Create FormsEditor (list + create/delete)
- [ ] Create FormFieldsEditor (field list + reorder)
- [ ] Create FieldEditorModal (edit single field)
- [ ] Wire into add-integration-form.tsx

### Phase 6: Testing & Polish (2-3 days)
- [ ] Unit tests for schema validation
- [ ] Unit tests for form submission flow
- [ ] Integration tests for workflow execution
- [ ] Manual testing with real ABC Ignite sandbox
- [ ] UI polish and error states

**Total Estimated Time: 15-20 days**

---

## 13. Testing Requirements

### 13.1 Unit Tests

Create `__tests__/unit/forms/`:

```typescript
// schema.test.ts
describe('FormDefinitionSchema', () => {
  it('validates correct form definition');
  it('rejects form with no fields');
  it('rejects field with invalid ID format');
  it('validates conditional rules');
});

// validation.test.ts
describe('validateFormData', () => {
  it('returns empty errors for valid data');
  it('returns error for missing required field');
  it('validates email format');
  it('validates phone format');
  it('validates min/max constraints');
  it('validates pattern constraints');
});
```

### 13.2 Integration Tests

Create `__tests__/integration/form-submit.test.ts`:

```typescript
describe('POST /api/form-submit', () => {
  it('accepts valid form submission');
  it('rejects invalid client source');
  it('rejects invalid form ID');
  it('rejects invalid form data');
  it('handles rate limiting');
  it('deduplicates identical submissions');
  it('triggers workflow on valid submission');
});
```

### 13.3 Manual Testing Checklist

- [ ] Create form in admin UI
- [ ] Render form on landing page
- [ ] Submit form with valid data
- [ ] Verify lead created in RevLine
- [ ] Verify prospect created in ABC Ignite (sandbox)
- [ ] Verify subscriber added to MailerLite
- [ ] Test form with conditional fields
- [ ] Test form validation errors
- [ ] Test rate limiting behavior
- [ ] Test duplicate submission handling

---

## 14. Security Considerations

### 14.1 Input Validation
- All form data validated server-side against schema
- Field IDs restricted to alphanumeric + underscore
- Form IDs restricted to lowercase kebab-case
- Zod schemas enforce type safety

### 14.2 Rate Limiting
- `/api/form-submit`: 10 requests per minute per IP
- `/api/forms/[source]/[formId]`: 100 requests per minute per IP

### 14.3 Client Isolation
- Forms scoped to client via `source` parameter
- Client must be active (not paused)
- Form must exist in client's RevLine config

### 14.4 XSS Prevention
- React auto-escapes rendered content
- No `dangerouslySetInnerHTML` usage
- Form field values sanitized before display

### 14.5 CSRF Protection
- Same-origin requests only (handled by Next.js defaults)
- No cookies/sessions required for form submission

---

## 15. Future Extensions

### 15.1 Phone Routing (Phase 2)
- Add `phoneRouting` config to RevLine meta
- Create phone input component with validation
- Add `phone_routed` trigger
- Integrate with SMS providers (Twilio, etc.)

### 15.2 File Uploads (Phase 3)
- Add `file` field type
- Integrate with S3/Cloudflare R2 for storage
- Add virus scanning
- Link uploaded files to form submission

### 15.3 Form Analytics (Phase 4)
- Track form views vs submissions (conversion rate)
- Track field drop-off
- A/B test form variants
- Add to admin dashboard

### 15.4 Form Templates (Phase 5)
- Pre-built templates (contact, waiver, intake, etc.)
- Clone form across clients
- Form marketplace

---

## Appendix A: Example Form Definitions

### A.1 Simple Contact Form

```json
{
  "id": "contact",
  "name": "Contact Form",
  "version": 1,
  "fields": [
    { "id": "name", "type": "text", "label": "Your Name", "required": true },
    { "id": "email", "type": "email", "label": "Email Address", "required": true },
    { "id": "message", "type": "textarea", "label": "Message", "required": true }
  ],
  "settings": {
    "submitText": "Send Message",
    "successMessage": "Thanks! We'll get back to you soon."
  },
  "metadata": {
    "triggerOperation": "form_submitted"
  }
}
```

### A.2 Gym Waiver Form

```json
{
  "id": "membership-waiver",
  "name": "Membership Waiver",
  "version": 1,
  "fields": [
    { "id": "firstName", "type": "text", "label": "First Name", "required": true },
    { "id": "lastName", "type": "text", "label": "Last Name", "required": true },
    { "id": "email", "type": "email", "label": "Email", "required": true },
    { "id": "phone", "type": "phone", "label": "Phone Number", "required": true },
    { "id": "dob", "type": "date", "label": "Date of Birth", "required": true },
    { "id": "emergencyContact", "type": "text", "label": "Emergency Contact Name", "required": true },
    { "id": "emergencyPhone", "type": "phone", "label": "Emergency Contact Phone", "required": true },
    { 
      "id": "agreedToTerms", 
      "type": "checkbox", 
      "label": "I have read and agree to the terms and conditions and waiver of liability",
      "required": true
    }
  ],
  "settings": {
    "submitText": "Sign Waiver",
    "successMessage": "Waiver signed successfully. Welcome to the gym!",
    "layout": "stacked"
  },
  "metadata": {
    "triggerOperation": "waiver_signed",
    "category": "waiver"
  }
}
```

### A.3 Prospect Intake Form

```json
{
  "id": "prospect-intake",
  "name": "Prospect Intake",
  "version": 1,
  "fields": [
    { "id": "firstName", "type": "text", "label": "First Name", "required": true },
    { "id": "lastName", "type": "text", "label": "Last Name", "required": true },
    { "id": "email", "type": "email", "label": "Email", "required": true },
    { "id": "phone", "type": "phone", "label": "Phone", "required": false },
    { 
      "id": "interests", 
      "type": "checkbox-group", 
      "label": "What are you interested in?",
      "options": [
        { "value": "personal-training", "label": "Personal Training" },
        { "value": "group-classes", "label": "Group Classes" },
        { "value": "membership", "label": "Gym Membership" },
        { "value": "nutrition", "label": "Nutrition Coaching" }
      ]
    },
    { 
      "id": "experience", 
      "type": "select", 
      "label": "Fitness Experience",
      "options": [
        { "value": "beginner", "label": "Beginner (< 1 year)" },
        { "value": "intermediate", "label": "Intermediate (1-3 years)" },
        { "value": "advanced", "label": "Advanced (3+ years)" }
      ]
    },
    { "id": "goals", "type": "textarea", "label": "Tell us about your fitness goals" }
  ],
  "settings": {
    "submitText": "Get Started",
    "successMessage": "Thanks! A team member will reach out within 24 hours."
  },
  "metadata": {
    "triggerOperation": "prospect_form_submitted"
  }
}
```

---

## Appendix B: Workflow Example

### B.1 Prospect → ABC Ignite + MailerLite

```json
{
  "name": "New Prospect Flow",
  "triggerAdapter": "revline",
  "triggerOperation": "prospect_form_submitted",
  "triggerFilter": null,
  "actions": [
    {
      "adapter": "revline",
      "operation": "create_lead",
      "params": {
        "source": "prospect-form"
      }
    },
    {
      "adapter": "abc_ignite",
      "operation": "create_prospect",
      "params": {}
    },
    {
      "adapter": "mailerlite",
      "operation": "add_to_group",
      "params": {
        "group": "prospects"
      }
    }
  ],
  "enabled": true
}
```

---

## Appendix C: Environment Variables

No new environment variables required. Forms use existing:

- `DATABASE_URL` - For client/integration lookup
- `REVLINE_ENCRYPTION_KEY` - Not used (RevLine has no secrets)
- ABC Ignite credentials stored in client integration

---

*End of Specification*
