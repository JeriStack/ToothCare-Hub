import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Schedule Calendar & Facility Hours Skeleton
 *
 * Renders structural placeholders for:
 * - Weekly facility operating hours across 7 days
 * - Weekly recurring dentist shifts grid across 7 days
 *
 * @param {'hours' | 'shifts'} view - Target schedule view (default: 'shifts')
 */
export function ScheduleCalendarSkeleton({ view = 'shifts' }) {
  if (view === 'hours') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading facility operating hours">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800"
              >
                <Skeleton className="h-4 w-28" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Shifts View
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dentist shift schedules">
      {/* Top Filter and Add Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-9 w-60 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* 7-Day Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>

            <div className="space-y-2 py-1">
              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-14 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScheduleCalendarSkeleton;
