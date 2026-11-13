import React from 'react';
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonText } from '../ui/Skeleton';

/**
 * Reusable Profile Page Skeleton
 *
 * Accurately models the .portal-split-1-2 layout across:
 * - PatientProfilePage
 * - DentistProfilePage
 * - StaffProfilePage (Front Desk & Admin)
 *
 * @param {string} title - Optional title placeholder (default: 'My Profile')
 */
export function ProfileSkeleton({ title = 'My Profile' }) {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label={`Loading ${title}`}
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonButton size="sm" width="w-24" />
          <SkeletonButton size="sm" width="w-32" />
        </div>
      </div>

      {/* 1:2 Responsive Split Grid */}
      <div className="portal-split-1-2 gap-6 items-start">
        {/* Left Card: Profile Avatar & Identity Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-5 flex flex-col items-center text-center">
          <SkeletonAvatar size="2xl" shape="rect" className="rounded-2xl border-4 border-slate-100 dark:border-slate-700 shadow-sm" />

          <div className="space-y-1.5 flex flex-col items-center w-full">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3.5 w-44 mt-1" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>

          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>

        {/* Right Column: Form Sections */}
        <div className="space-y-5">
          {/* Section 1: Demographics / Identity Details */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-4 w-48" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 2: Contact / Clinic Information */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-4 w-40" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileSkeleton;
