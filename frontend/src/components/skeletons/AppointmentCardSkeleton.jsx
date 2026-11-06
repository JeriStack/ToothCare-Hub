import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Appointment Card Skeleton
 *
 * Replicates the structure of patient and dentist appointment cards:
 * Status badge, reference number, service title, dentist & operatory info,
 * date/time tag, and action buttons.
 *
 * @param {number} count - Number of appointment card skeletons (default: 4)
 * @param {string} className - Optional container styling
 */
export function AppointmentCardSkeleton({
  count = 4,
  className = 'grid grid-cols-1 md:grid-cols-2 gap-4',
}) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading appointments">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4"
        >
          {/* Top Row: Service Name & Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full shrink-0" />
          </div>

          {/* Clinician and Operatory Chair */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>

          {/* Schedule Date & Time */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-3.5 w-36" />
            </div>
            <Skeleton className="h-3.5 w-20" />
          </div>

          {/* Action Button Row */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end gap-2">
            <Skeleton className="h-8 w-24 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default AppointmentCardSkeleton;
