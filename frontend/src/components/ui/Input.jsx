import React, { forwardRef, useId } from 'react';

/**
 * Reusable Accessible Input Field adhering to ToothCare Hub Impeccable Design System.
 *
 * @param {string} label
 * @param {string} error
 * @param {string} helperText
 * @param {React.ReactNode} iconLeft
 * @param {React.ReactNode} iconRight
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    iconLeft,
    iconRight,
    id: externalId,
    type = 'text',
    disabled = false,
    required = false,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className={`space-y-1.5 text-left ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[#12304A] tracking-tight"
        >
          {label}
          {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-xl">
        {iconLeft && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {iconLeft}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={`w-full rounded-xl border bg-white text-sm text-[#12304A] placeholder-slate-400 transition-colors py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-[#0D9488] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            iconLeft ? 'pl-10' : 'pl-3.5'
          } ${iconRight ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-rose-400 focus:ring-rose-500 focus:border-rose-500 text-rose-900'
              : 'border-slate-200 hover:border-slate-300'
          } ${className}`}
          {...props}
        />

        {iconRight && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
            {iconRight}
          </div>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
