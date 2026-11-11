import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Booking Wizard Step Skeleton
 *
 * Renders structural placeholders for the 4-step dental booking wizard:
 * - step 1: Service procedure selection cards
 * - step 2: Dentist practitioner roster cards
 * - step 3: Date picker input and available time slots grid
 * - step 4: Booking review summary card
 *
 * @param {1 | 2 | 3 | 4} step - Active wizard step (default: 1)
 */
export function BookingStepSkeleton({ step = 1 }) {
  if (step === 1) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading available dental services">
        <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-full" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dental practitioner roster">
        <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-start gap-3.5"
            >
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="space-1 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-full rounded-md mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading available appointment slots">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>

        {/* Date Picker Input Skeleton */}
        <div className="max-w-xs space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Availability Time Slots Grid */}
        <div className="pt-2 space-y-3">
          <Skeleton className="h-3.5 w-36" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Review Summary Skeleton
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading booking summary">
      <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-700">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-slate-200/60 dark:border-slate-700/60 last:border-b-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Isolated Slots Grid Skeleton for AvailabilitySlotPicker
 */
BookingStepSkeleton.Slots = function BookingStepSlots({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-11 rounded-xl" />
      ))}
    </div>
  );
};

export default BookingStepSkeleton;
