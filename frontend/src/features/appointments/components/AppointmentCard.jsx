import React from 'react';
import { Calendar, Clock, User, Stethoscope, AlertCircle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export const STATUS_STYLES = {
  PENDING: {
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-500/30',
    icon: AlertCircle,
    label: 'Awaiting Clinic Review',
  },
  CONFIRMED: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
    label: 'Confirmed',
  },
  COMPLETED: {
    bg: 'bg-blue-50 dark:bg-sky-500/15',
    text: 'text-blue-700 dark:text-sky-300',
    border: 'border-blue-200 dark:border-sky-500/30',
    icon: CheckCircle2,
    label: 'Completed',
  },
  CANCELLED: {
    bg: 'bg-slate-100 dark:bg-slate-700/60',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-600',
    icon: XCircle,
    label: 'Cancelled',
  },
  REJECTED: {
    bg: 'bg-rose-50 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-500/30',
    icon: XCircle,
    label: 'Declined',
  },
};

export function AppointmentCard({
  appointment,
  onViewDetails,
  onCancel,
  onReschedule,
  showActions = true,
  role = 'PATIENT',
}) {
  const statusInfo = STATUS_STYLES[appointment.status] || STATUS_STYLES.PENDING;
  const StatusIcon = statusInfo.icon;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const canCancel = ['PENDING', 'CONFIRMED'].includes(appointment.status);
  const canReschedule = ['PENDING', 'CONFIRMED'].includes(appointment.status);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 transition-all p-5 shadow-sm space-y-4">
      {/* Header: Service Name & Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-gray-100 text-base">
            {appointment.service_name || 'Dental Service'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Ref #{appointment.id} {appointment.rescheduled_from_id && `· Rescheduled from #${appointment.rescheduled_from_id}`}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {statusInfo.label}
        </span>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-gray-300 bg-slate-50/70 dark:bg-gray-900/60 p-3 rounded-lg border border-slate-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
          <span>{formatDate(appointment.start_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
          <span>
            {formatTime(appointment.start_at)} – {formatTime(appointment.end_at)} ({appointment.duration_snapshot || 30} mins)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
          <span>
            Dr. {appointment.dentist_first_name} {appointment.dentist_last_name}
          </span>
        </div>
        {role === 'ADMIN' && appointment.patient_first_name && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
            <span>
              {appointment.patient_first_name} {appointment.patient_last_name} ({appointment.patient_phone || 'No phone'})
            </span>
          </div>
        )}
      </div>

      {/* Chief Complaint Preview if available */}
      {appointment.chief_complaint && (
        <p className="text-xs text-slate-600 dark:text-amber-200/90 line-clamp-1 italic bg-amber-50/50 dark:bg-amber-950/35 p-2 rounded border border-amber-100/50 dark:border-amber-800/40">
          "{appointment.chief_complaint}"
        </p>
      )}

      {/* Action Bar */}
      {showActions && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onViewDetails && onViewDetails(appointment)}
            className="text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 flex items-center gap-1 transition-colors"
          >
            View Details <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2">
            {canReschedule && onReschedule && (
              <button
                type="button"
                onClick={() => onReschedule(appointment)}
                className="px-2.5 py-1 rounded text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-600 transition-colors"
              >
                Reschedule
              </button>
            )}
            {canCancel && onCancel && (
              <button
                type="button"
                onClick={() => onCancel(appointment)}
                className="px-2.5 py-1 rounded text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
