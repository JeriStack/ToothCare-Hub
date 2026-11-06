import React from 'react';

/**
 * Reusable Base Skeleton Component adhering to ToothCare Hub & Impeccable Design System.
 *
 * Provides a theme-aware, accessible pulsing surface to reserve layout dimensions
 * during asynchronous API data fetching, eliminating layout shifts (CLS).
 *
 * @param {string} className - Tailwind CSS classes for width, height, radius, etc.
 * @param {'pulse' | 'shimmer' | 'none'} animation - Animation style (default: 'pulse').
 * @param {React.ReactNode} children - Optional nested elements.
 */
export function Skeleton({
  className = '',
  animation = 'pulse',
  children,
  ...props
}) {
  const animationClass = {
    pulse: 'animate-pulse motion-reduce:animate-none',
    shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent motion-reduce:before:animate-none',
    none: '',
  }[animation] || 'animate-pulse motion-reduce:animate-none';

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`bg-slate-200/80 dark:bg-slate-700/80 rounded-md transition-colors ${animationClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Skeleton;
