'use client';

/**
 * SelectField Component
 * 
 * A styled dropdown select field.
 * Used for single-choice selections from a list of options.
 */

import { SelectFieldProps } from '../types';

export function SelectField({
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
  options,
  placeholderOption = 'Select an option',
}: SelectFieldProps) {
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
      
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
        className={`
          w-full px-4 py-3
          bg-zinc-900 border text-zinc-50
          focus:outline-none focus:border-zinc-600
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          appearance-none cursor-pointer
          ${!value ? 'text-zinc-500' : 'text-zinc-50'}
          ${error ? 'border-red-500' : 'border-zinc-800'}
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.75rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.25em 1.25em',
          paddingRight: '2.5rem',
        }}
      >
        <option value="" disabled>
          {placeholderOption}
        </option>
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
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
