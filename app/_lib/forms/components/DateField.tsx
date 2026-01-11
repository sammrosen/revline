'use client';

/**
 * DateField Component
 * 
 * A styled date input field.
 * Used for date of birth, appointment dates, etc.
 */

import { DateFieldProps } from '../types';

export function DateField({
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
  min,
  max,
}: DateFieldProps) {
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
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
        className={`
          w-full px-4 py-3
          bg-zinc-900 border text-zinc-50
          placeholder-zinc-500
          focus:outline-none focus:border-zinc-600
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          [color-scheme:dark]
          ${!value ? 'text-zinc-500' : 'text-zinc-50'}
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
