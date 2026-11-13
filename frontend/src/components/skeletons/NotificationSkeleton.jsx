import React from 'react';
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonText } from '../ui/Skeleton';

/**
 * Reusable Notification Skeleton
 *
 * Supports:
 * - 'compact': Dropdown notification list in NotificationCenter.
 * - 'page': Full notification management feed in PatientNotificationsPage.
 *
 * @param {'compact' | 'page'} variant
 * @param {number} count
 * @param {string} className
 */
export function NotificationSkeleton({
  variant = 'compact',
  count = 3,
  className = '',
}) {
  if (variant === 'compact') {
    return (
      <div
        className={`divide-y divide-slate-100 dark:divide-slate-700/60 ${className}`}
        aria-busy="true"
        aria-label="Loading notifications"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3.5 flex items-start gap-3 bg-white dark:bg-slate-800">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="w-2 h-2 rounded-full shrink-0 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  // Full page feed variant
  return (
    <div
      className={`space-y-3 ${className}`}
      aria-busy="true"
      aria-label="Loading notification history"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full max-w-xl" />
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationSkeleton;
