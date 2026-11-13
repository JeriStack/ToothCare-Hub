import React from 'react';
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonText } from '../ui/Skeleton';

/**
 * Appointment Detail Skeleton
 *
 * Accurately models the clinical appointment detail view in DentistAppointmentDetailPage,
 * replacing inappropriate generic dashboard skeletons with exact detail geometry.
 */
export function AppointmentDetailSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading appointment clinical details"
    >
      {/* Top Breadcrumb & Ref ID Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-3.5 w-24" />
      </div>

      {/* Appointment Overview Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {/* Patient Profile Snapshot Strip */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SkeletonAvatar size="md" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Treatment Record / Clinical Documentation Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <SkeletonButton size="sm" width="w-32" />
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default AppointmentDetailSkeleton;
