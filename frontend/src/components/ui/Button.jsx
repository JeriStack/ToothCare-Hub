import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button Component adhering to the ToothCare Hub Impeccable Design System.
 *
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'} variant
 * @param {'sm' | 'md' | 'lg'} size
 * @param {boolean} isLoading
 * @param {React.ReactNode} iconLeft
 * @param {React.ReactNode} iconRight
 */
export const Button = forwardRef(function Button(
  {
    children,
    type = 'button',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    iconLeft,
    iconRight,
    className = '',
    ...props
  },
  ref
) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeClasses = {
    sm: 'px-3 py-1.5 rounded-lg text-xs gap-1.5',
    md: 'px-4 py-2.5 rounded-xl text-sm gap-2',
    lg: 'px-6 py-3.5 rounded-xl text-base gap-2.5 shadow-sm',
  }[size] || 'px-4 py-2.5 rounded-xl text-sm gap-2';

  const variantClasses = {
    primary:
      'bg-[#0D9488] text-white hover:bg-[#0F766E] active:bg-[#115E59] shadow-md shadow-teal-900/10 hover:shadow-teal-900/20',
    secondary:
      'bg-[#CCFBF1] text-[#0F766E] hover:bg-teal-100 active:bg-teal-200 font-semibold',
    outline:
      'bg-white border border-slate-200 text-[#12304A] hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 shadow-2xs',
    ghost:
      'bg-transparent text-slate-600 hover:text-[#12304A] hover:bg-slate-100 active:bg-slate-200',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-md shadow-rose-900/10',
  }[variant] || 'bg-[#0D9488] text-white hover:bg-[#0F766E]';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {iconLeft && <span className="shrink-0">{iconLeft}</span>}
          <span>{children}</span>
          {iconRight && <span className="shrink-0">{iconRight}</span>}
        </>
      )}
    </button>
  );
});

export default Button;
