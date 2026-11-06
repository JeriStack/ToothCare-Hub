import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Loading Spinner adhering to ToothCare Hub Design System.
 *
 * @param {'sm' | 'md' | 'lg'} size
 * @param {string} label
 */
export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  className = '',
  inline = false,
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  }[size] || 'w-6 h-6';

  const spinner = (
    <div
      role="status"
      className={`inline-flex items-center gap-2.5 text-[#0D9488] ${className}`}
    >
      <Loader2 className={`${sizeClasses} animate-spin shrink-0`} aria-hidden="true" />
      {label && <span className="text-xs text-slate-500 font-medium">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  );

  if (inline) {
    return spinner;
  }

  return (
    <div className="flex items-center justify-center p-8 sm:p-12 w-full">
      {spinner}
    </div>
  );
}

export default LoadingSpinner;
