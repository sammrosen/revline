'use client';

/**
 * TextField Component
 * 
 * A styled text input field matching the RevLine design system.
 * Used for general text input like names, addresses, etc.
 */

import { TextFieldProps } from '../types';

export function TextField({
  name,
  label,
  placeholder,
  required,
  error,
  disabled,
  className = '',
  helpText,
  value,
  onChange,
  onBlur,
  type = 'text',
  autoComplete,
  maxLength,
}: TextFieldProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
        className={`
          w-full px-4 py-3
          bg-zinc-900 border text-zinc-50
          placeholder-zinc-500
          focus:outline-none focus:border-zinc-600
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-zinc-800'}
        `}
      />
      
      {error && (
        <p 
          id={`${name}-error`}
          className="mt-1.5 text-sm text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={`${name}-help`}
          className="mt-1.5 text-sm text-zinc-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}
