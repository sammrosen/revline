'use client';

/**
 * EmailField Component
 * 
 * A styled email input field with email-specific attributes.
 * Extends TextField with email type and autocomplete.
 */

import { TextFieldProps } from '../types';
import { TextField } from './TextField';

export type EmailFieldProps = Omit<TextFieldProps, 'type' | 'autoComplete'>;

export function EmailField(props: EmailFieldProps) {
  return (
    <TextField
      {...props}
      type="email"
      autoComplete="email"
      placeholder={props.placeholder ?? 'Enter your email'}
    />
  );
}
