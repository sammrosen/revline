'use client';

/**
 * PhoneField Component
 * 
 * A styled phone input field with phone-specific attributes.
 * Extends TextField with tel type and autocomplete.
 */

import { TextFieldProps } from '../types';
import { TextField } from './TextField';

export type PhoneFieldProps = Omit<TextFieldProps, 'type' | 'autoComplete'>;

export function PhoneField(props: PhoneFieldProps) {
  return (
    <TextField
      {...props}
      type="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? 'Enter your phone number'}
    />
  );
}
