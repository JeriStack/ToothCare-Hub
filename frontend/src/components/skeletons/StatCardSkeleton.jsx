import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Metric & KPI Stat Card Skeleton
 *
 * Matches the dimensions of executive and clinical dashboard metric cards,
 * preventing layout shift during aggregate counts and KPI calculations.
 *
 * @param {number} count - Number of stat cards to render (default: 4)
 * @param {string} className - Optional grid wrapper classes
 */
export function StatCardSkeleton({ count = 4, className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5' }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading clinical metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm relative overflow-hidden"
        >
          {/* Header Row: Label & Icon Badge */}
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="w-9 h-9 rounded-xl" />
          </div>

          {/* Aggregate Metric Number */}
          <Skeleton className="h-9 w-20 my-2" />

          {/* Subtext Status Pill */}
          <div className="flex items-center gap-2 mt-3">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Footer Action Link */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatCardSkeleton;
