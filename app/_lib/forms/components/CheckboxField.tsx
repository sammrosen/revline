'use client';

/**
 * CheckboxField Component
 * 
 * A styled checkbox field for boolean inputs.
 * Used for agreements, opt-ins, feature toggles, etc.
 */

import { CheckboxFieldProps } from '../types';

export function CheckboxField({
  name,
  label,
  required,
  error,
  disabled,
  className = '',
  helpText,
  checked,
  onChange,
  onBlur,
}: CheckboxFieldProps) {
  return (
    <div className={`w-full ${className}`}>
      <label 
        htmlFor={name}
        className="flex items-start gap-3 cursor-pointer group"
      >
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            id={name}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
            className="sr-only peer"
          />
          <div 
            className={`
              w-5 h-5 border-2 rounded
              transition-colors duration-200
              peer-focus:ring-2 peer-focus:ring-zinc-600 peer-focus:ring-offset-2 peer-focus:ring-offset-zinc-950
              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
              ${checked ? 'bg-white border-white' : 'bg-zinc-900 border-zinc-700'}
              ${error ? 'border-red-500' : ''}
              group-hover:border-zinc-500
            `}
          />
          {checked && (
            <svg 
              className="absolute top-0.5 left-0.5 w-4 h-4 text-black pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3}
                d="M5 13l4 4L19 7" 
              />
            </svg>
          )}
        </div>
        
        <span className={`
          text-sm text-zinc-300 select-none
          ${disabled ? 'opacity-50' : ''}
        `}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </span>
      </label>
      
      {error && (
        <p 
          id={`${name}-error`}
          className="mt-1.5 text-sm text-red-400 ml-8"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={`${name}-help`}
          className="mt-1.5 text-sm text-zinc-500 ml-8"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}
