import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Multi-Variant Card Skeleton
 *
 * Provides accurate structural placeholders for:
 * - 'service': Dental procedures, fee catalog, duration, and booking CTA.
 * - 'dentist': Licensed practitioner profiles, PRC badge, operatory chair, and bio.
 * - 'general': Versatile content card with title, badge, lines, and action.
 *
 * @param {'service' | 'dentist' | 'general'} variant
 * @param {number} count - Number of cards to render (default: 3)
 * @param {string} className - Optional container styling
 */
export function CardSkeleton({
  variant = 'general',
  count = 3,
  className = '',
}) {
  const defaultGridClass =
    variant === 'service'
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      : variant === 'dentist'
      ? 'grid grid-cols-1 md:grid-cols-3 gap-6'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

  const containerClasses = className || defaultGridClass;

  return (
    <div className={containerClasses} aria-busy="true" aria-label={`Loading ${variant} cards`}>
      {Array.from({ length: count }).map((_, i) => {
        if (variant === 'service') {
          return (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-6 space-y-4 shadow-xs"
            >
              {/* Category Pill & Duration Badge */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>

              {/* Icon Container & Procedure Title */}
              <div className="flex items-start gap-3.5 pt-1">
                <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>

              {/* Clinical Description Lines */}
              <div className="space-y-2 pt-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>

              {/* Price & CTA Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          );
        }

        if (variant === 'dentist') {
          return (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-xs"
            >
              {/* Round Practitioner Avatar */}
              <div className="flex justify-center">
                <Skeleton className="w-20 h-20 rounded-full" />
              </div>

              {/* Practitioner Name & Specialization */}
              <div className="space-y-1.5 flex flex-col items-center">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>

              {/* License & Operatory Room */}
              <div className="flex justify-center items-center gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>

              {/* Bio Summary */}
              <div className="space-y-1.5 py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6 mx-auto" />
              </div>

              {/* Book With Dentist Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          );
        }

        // Generic Card
        return (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CardSkeleton;
