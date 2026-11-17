import React from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  CalendarCheck,
  Activity,
  AlertCircle,
} from 'lucide-react';

/**
 * Reusable StatusBadge adhering to ToothCare Hub Impeccable Design System.
 * Ensures appointment and entity statuses are distinguishable through both color and iconography/text.
 *
 * @param {string} status - Raw status string (e.g. 'PENDING', 'CONFIRMED', 'COMPLETED', etc.)
 * @param {'sm' | 'md'} size - Badge sizing
 * @param {boolean} showIcon - Whether to render semantic status icon
 */
export function StatusBadge({
  status = 'PENDING',
  size = 'md',
  showIcon = true,
  className = '',
}) {
  const normalizedStatus = String(status).toUpperCase();

  const statusConfig = {
    PENDING: {
      label: 'Pending Review',
      classes: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      dotClass: 'bg-amber-500 dark:bg-amber-400',
      icon: Clock,
    },
    CONFIRMED: {
      label: 'Confirmed',
      classes: 'bg-teal-50 text-[#0F766E] border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
      dotClass: 'bg-[#0D9488] dark:bg-teal-400',
      icon: CheckCircle2,
    },
    COMPLETED: {
      label: 'Completed',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      dotClass: 'bg-emerald-500 dark:bg-emerald-400',
      icon: CalendarCheck,
    },
    CANCELLED: {
      label: 'Cancelled',
      classes: 'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600/80',
      dotClass: 'bg-slate-400 dark:bg-slate-400',
      icon: Ban,
    },
    REJECTED: {
      label: 'Declined',
      classes: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      dotClass: 'bg-rose-500 dark:bg-rose-400',
      icon: XCircle,
    },
    ACTIVE: {
      label: 'Active',
      classes: 'bg-teal-50 text-[#0F766E] border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
      dotClass: 'bg-[#0D9488] dark:bg-teal-400',
      icon: Activity,
    },
    INACTIVE: {
      label: 'Inactive',
      classes: 'bg-slate-100 text-slate-500 border-slate-200/80 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-600/80',
      dotClass: 'bg-slate-400',
      icon: AlertCircle,
    },
  }[normalizedStatus] || {
    label: normalizedStatus,
    classes: 'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600/80',
    dotClass: 'bg-slate-400',
    icon: Activity,
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }[size] || 'px-2.5 py-1 text-xs gap-1.5';

  const Icon = statusConfig.icon;

  return (
    <span
      role="status"
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs ${statusConfig.classes} ${sizeClasses} ${className}`}
    >
      {showIcon && Icon ? (
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotClass}`}
          aria-hidden="true"
        />
      )}
      <span>{statusConfig.label}</span>
    </span>
  );
}

export default StatusBadge;
