'use client';

/**
 * useFormState Hook
 * 
 * A simple form state management hook for controlled forms.
 * Provides values, errors, touched state, and submission handling.
 * 
 * @example
 * const form = useFormState({
 *   email: '',
 *   firstName: '',
 *   lastName: '',
 * });
 * 
 * <TextField
 *   name="email"
 *   label="Email"
 *   {...form.getFieldProps('email')}
 * />
 */

import { useState, useCallback } from 'react';
import { FormState, FormStatus } from './types';

/**
 * Create a form state manager for the given initial values
 */
export function useFormState<T extends Record<string, unknown>>(
  initialValues: T
): FormState<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');

  const setValue = useCallback((name: keyof T, value: unknown) => {
    setValuesState(prev => ({ ...prev, [name]: value }));
    // Clear error when value changes
    setErrors(prev => {
      if (prev[name as string]) {
        const next = { ...prev };
        delete next[name as string];
        return next;
      }
      return prev;
    });
  }, []);

  const setError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const clearError = useCallback((name: keyof T) => {
    setErrors(prev => {
      if (prev[name as string]) {
        const next = { ...prev };
        delete next[name as string];
        return next;
      }
      return prev;
    });
  }, []);

  const setTouched = useCallback((name: keyof T) => {
    setTouchedState(prev => ({ ...prev, [name]: true }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
    setTouchedState({});
    setStatus('idle');
    setMessage('');
  }, [initialValues]);

  const getFieldProps = useCallback((name: keyof T) => ({
    value: values[name],
    onChange: (value: unknown) => setValue(name, value),
    onBlur: () => setTouched(name),
    error: touched[name as string] ? errors[name as string] : undefined,
    disabled: status === 'submitting',
  }), [values, errors, touched, status, setValue, setTouched]);

  return {
    values,
    errors,
    touched,
    status,
    message,
    setValue,
    setError,
    clearError,
    setTouched,
    setValues,
    setStatus,
    setMessage,
    reset,
    getFieldProps,
  };
}

/**
 * Simple email validation
 */
export function validateEmail(email: string): string | null {
  if (!email) return null; // Let required handle empty
  if (!email.includes('@') || !email.includes('.')) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Simple phone validation (basic format check)
 */
export function validatePhone(phone: string): string | null {
  if (!phone) return null; // Let required handle empty
  // Remove non-numeric characters and check length
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return 'Please enter a valid phone number';
  }
  return null;
}

/**
 * Required field validation
 */
export function validateRequired(value: unknown, fieldName?: string): string | null {
  if (value === undefined || value === null || value === '') {
    return fieldName ? `${fieldName} is required` : 'This field is required';
  }
  return null;
}
