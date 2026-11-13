import React from 'react';
import { Skeleton, SkeletonButton } from '../ui/Skeleton';

/**
 * Role Permission Matrix Skeleton
 *
 * Accurately models RolePermissionMatrixPage:
 * - Roles Summary Header Strip
 * - Grouped Permission Matrix Table with Checkbox Skeletons
 */
export function PermissionMatrixSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading role permissions matrix"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <SkeletonButton width="w-36" />
      </div>

      {/* 4 Roles Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="w-2 h-2 rounded-full" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Permission Categories Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <Skeleton className="h-4 w-44" />
          <div className="flex items-center gap-6 pr-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex items-center gap-8 pr-6">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="w-5 h-5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PermissionMatrixSkeleton;
