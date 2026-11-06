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
      classes: 'bg-amber-50 text-amber-700 border-amber-200/80',
      dotClass: 'bg-amber-500',
      icon: Clock,
    },
    CONFIRMED: {
      label: 'Confirmed',
      classes: 'bg-teal-50 text-[#0F766E] border-teal-200/80',
      dotClass: 'bg-[#0D9488]',
      icon: CheckCircle2,
    },
    COMPLETED: {
      label: 'Completed',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      dotClass: 'bg-emerald-500',
      icon: CalendarCheck,
    },
    CANCELLED: {
      label: 'Cancelled',
      classes: 'bg-slate-100 text-slate-600 border-slate-200/80',
      dotClass: 'bg-slate-400',
      icon: Ban,
    },
    REJECTED: {
      label: 'Declined',
      classes: 'bg-rose-50 text-rose-700 border-rose-200/80',
      dotClass: 'bg-rose-500',
      icon: XCircle,
    },
    ACTIVE: {
      label: 'Active',
      classes: 'bg-teal-50 text-[#0F766E] border-teal-200/80',
      dotClass: 'bg-[#0D9488]',
      icon: Activity,
    },
    INACTIVE: {
      label: 'Inactive',
      classes: 'bg-slate-100 text-slate-500 border-slate-200/80',
      dotClass: 'bg-slate-400',
      icon: AlertCircle,
    },
  }[normalizedStatus] || {
    label: normalizedStatus,
    classes: 'bg-slate-100 text-slate-600 border-slate-200/80',
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
