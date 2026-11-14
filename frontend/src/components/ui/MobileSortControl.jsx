import React, { useId } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

/**
 * Mobile-only sort control for tables rendered as stacked cards (`tch-responsive-table`),
 * where the clickable column headers are no longer visible. Hidden from `md` upward.
 *
 * @param {{ value: string, label: string }[]} options  sortable columns
 * @param {string} sortBy        active sort column
 * @param {'ASC' | 'DESC'} sortDir  active sort direction
 * @param {(column: string) => void} onSort  existing page `handleSort` (toggles direction when the
 *        same column is chosen, otherwise sorts the new column ascending)
 */
export function MobileSortControl({ options, sortBy, sortDir, onSort, label = 'Sort by' }) {
  const selectId = useId();
  const isAsc = sortDir === 'ASC';

  return (
    <div className="tch-mobile-sort items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-gray-700">
      <label htmlFor={selectId} className="text-xs font-semibold text-slate-600 dark:text-gray-300 shrink-0">
        {label}
      </label>
      <select
        id={selectId}
        value={sortBy}
        onChange={(e) => onSort(e.target.value)}
        className="flex-1 min-w-0 min-h-11 px-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onSort(sortBy)}
        aria-label={`Sort direction: ${isAsc ? 'ascending' : 'descending'}. Activate to reverse.`}
        className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
      >
        {isAsc ? <ArrowUp className="w-4 h-4" aria-hidden="true" /> : <ArrowDown className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default MobileSortControl;
