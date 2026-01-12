/**
 * Form Field Types
 * 
 * Shared types for all form field components.
 * These provide a consistent interface across all field types.
 */

import { ChangeEvent } from 'react';

/**
 * Base props shared by all field components
 */
export interface BaseFieldProps {
  /** Field name (used for form data key) */
  name: string;
  /** Display label (optional - field can be used without label) */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Validation error message */
  error?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Help text displayed below the field */
  helpText?: string;
}

/**
 * Props for text-based input fields (text, email, phone)
 */
export interface TextFieldProps extends BaseFieldProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler for validation on blur */
  onBlur?: () => void;
  /** HTML input type */
  type?: 'text' | 'email' | 'tel' | 'password' | 'url';
  /** Autocomplete attribute */
  autoComplete?: string;
  /** Max length */
  maxLength?: number;
}

/**
 * Props for textarea fields
 */
export interface TextareaFieldProps extends BaseFieldProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Number of rows */
  rows?: number;
  /** Max length */
  maxLength?: number;
}

/**
 * Option for select and radio/checkbox groups
 */
export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Props for select dropdown fields
 */
export interface SelectFieldProps extends BaseFieldProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Available options */
  options: FieldOption[];
  /** Placeholder option text */
  placeholderOption?: string;
}

/**
 * Props for checkbox fields (single boolean checkbox)
 */
export interface CheckboxFieldProps extends BaseFieldProps {
  /** Current checked state */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Blur handler */
  onBlur?: () => void;
}

/**
 * Props for date fields
 */
export interface DateFieldProps extends BaseFieldProps {
  /** Current value (ISO date string YYYY-MM-DD) */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Minimum date */
  min?: string;
  /** Maximum date */
  max?: string;
}

/**
 * Form status for submission state
 */
export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Form state returned by useFormState hook
 */
export interface FormState<T extends Record<string, unknown>> {
  /** Current form values */
  values: T;
  /** Validation errors by field name */
  errors: Record<string, string>;
  /** Which fields have been touched (blurred) */
  touched: Record<string, boolean>;
  /** Form submission status */
  status: FormStatus;
  /** Success or error message */
  message: string;
  /** Update a single field value */
  setValue: (name: keyof T, value: unknown) => void;
  /** Set an error for a field */
  setError: (name: keyof T, error: string) => void;
  /** Clear error for a field */
  clearError: (name: keyof T) => void;
  /** Mark a field as touched */
  setTouched: (name: keyof T) => void;
  /** Set all values at once */
  setValues: (values: Partial<T>) => void;
  /** Set status */
  setStatus: (status: FormStatus) => void;
  /** Set message */
  setMessage: (message: string) => void;
  /** Reset form to initial state */
  reset: () => void;
  /** Get props for an input field (spread into field component) */
  getFieldProps: (name: keyof T) => {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error: string | undefined;
    disabled: boolean;
  };
}

/**
 * Helper type for form change events
 */
export type FieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

/**
 * Form submission handler type
 */
export type FormSubmitHandler<T> = (values: T) => Promise<{ success: boolean; error?: string }>;
