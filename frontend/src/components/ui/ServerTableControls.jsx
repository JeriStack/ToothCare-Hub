import React, { useId } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

/**
 * Accessible server-side sortable table column header.
 */
export function SortableColumnHeader({
  columnKey,
  label,
  activeSortBy,
  activeSortDir = 'desc',
  onSort,
  align = 'left',
  className = '',
}) {
  const isActive = activeSortBy === columnKey;
  const ariaSort = !isActive ? 'none' : activeSortDir === 'asc' ? 'ascending' : 'descending';

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={ariaSort}
      className={`py-3.5 px-4 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1.5 uppercase tracking-wider font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md px-1 -mx-1 ${
          isActive
            ? 'text-[#0F766E] dark:text-teal-300'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          activeSortDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-55 shrink-0" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

/**
 * Unified server-side table pagination footer with total vs filtered counts
 * and page-size selector (10 / 15 / 25 / 50 / 100).
 */
export function ServerTableFooter({
  page = 1,
  perPage = 25,
  totalRecords = 0,
  filteredRecords = 0,
  totalPages = 1,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  loading = false,
  itemLabel = 'records',
}) {
  const pageSizeSelectId = useId();
  const filtered = Math.max(0, Number(filteredRecords) || 0);
  const total = Math.max(filtered, Number(totalRecords) || 0);
  const current = Math.max(1, Number(page) || 1);
  const last = Math.max(1, Number(totalPages) || 1);
  const size = Math.max(1, Number(perPage) || 25);

  const rangeStart = filtered === 0 ? 0 : (current - 1) * size + 1;
  const rangeEnd = Math.min(filtered, current * size);
  const isFiltered = total > filtered;
  const normalizedOptions = pageSizeOptions.includes(size)
    ? pageSizeOptions
    : [...pageSizeOptions, size].sort((a, b) => a - b);

  return (
    <div className="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
        <span>
          Showing{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {rangeStart}–{rangeEnd}
          </strong>{' '}
          of{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {filtered.toLocaleString()}
          </strong>{' '}
          {itemLabel}
          {isFiltered && (
            <span className="text-slate-400 dark:text-slate-500">
              {' '}
              (filtered from {total.toLocaleString()} total)
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {typeof onPerPageChange === 'function' && (
          <div className="relative">
            <label htmlFor={pageSizeSelectId} className="sr-only">
              Rows per page
            </label>
            <select
              id={pageSizeSelectId}
              aria-label="Rows per page"
              value={size}
              disabled={loading}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="appearance-none pl-2.5 pr-7 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer disabled:opacity-50"
            >
              {normalizedOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={current <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, current - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg font-semibold text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <span className="px-2 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {current} / {last}
          </span>

          <button
            type="button"
            disabled={current >= last || loading}
            onClick={() => onPageChange(Math.min(last, current + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg font-semibold text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
