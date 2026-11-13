import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Reusable Data Table Skeleton
 *
 * Renders structured table headers, rows, and pagination controls matching
 * administrative patient, dentist, service, and appointment registries.
 *
 * @param {string[]} columns - Array of column width classes (e.g. ['w-12', 'w-48', 'w-32', 'w-24'])
 * @param {number} rows - Number of body rows to generate (default: 5)
 * @param {boolean} showHeader - Whether to render table header (default: true)
 * @param {boolean} showPagination - Whether to render pagination footer (default: true)
 * @param {string} className - Optional wrapper styling
 */
export function TableSkeleton({
  columns = ['w-12', 'w-48', 'w-32', 'w-28', 'w-24', 'w-20'],
  rows = 5,
  showHeader = true,
  showPagination = true,
  className = '',
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}
      aria-busy="true"
      aria-label="Loading data records"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {showHeader && (
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {columns.map((colWidth, idx) => (
                  <th key={idx} className="py-3.5 px-4">
                    <Skeleton className={`h-3.5 ${colWidth}`} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30 transition-colors">
                {columns.map((colWidth, colIdx) => (
                  <td key={colIdx} className="py-3.5 px-4">
                    <Skeleton className={`h-4 ${colWidth}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Skeleton className="h-3.5 w-40" />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Isolated Table Row Skeleton for rendering directly inside an existing <tbody>
 */
TableSkeleton.Rows = function TableSkeletonRows({ count = 5, columns = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, rIdx) => (
        <tr key={rIdx} className="hover:bg-slate-50/40 dark:hover:bg-slate-700/30 transition-colors">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <Skeleton className="h-4 w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;
