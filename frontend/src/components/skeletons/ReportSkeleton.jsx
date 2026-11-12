import React from 'react';
import { Skeleton, SkeletonButton } from '../ui/Skeleton';

/**
 * Reports & Clinical Analytics Skeleton
 *
 * Accurately models ReportsPage:
 * - Date Range Filter Tabs
 * - 4 Summary KPI Metric Cards
 * - Chart Placeholder Panels (Appointments by Status & Revenue Breakdown)
 * - Clinical Production by Dentist Table
 */
export function ReportSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading reports and analytics data"
    >
      {/* Header and Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* 2-Column Chart Visualization Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <div className="h-48 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-end justify-between p-4 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Skeleton className={`w-full rounded-t-md ${['h-20', 'h-36', 'h-28', 'h-16', 'h-32'][i]}`} />
                <Skeleton className="h-2.5 w-10" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <div className="h-48 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center p-4">
            <Skeleton className="w-32 h-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportSkeleton;
