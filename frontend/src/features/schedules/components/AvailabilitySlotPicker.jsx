import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertCircle,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';
import { schedulesApi } from '../api';
import { BookingStepSkeleton } from '../../../components/skeletons/BookingStepSkeleton';

const REASON_TITLES = {
  CLINIC_CLOSED: 'Clinic Facility Closed',
  NOT_WORKING_DAY: 'Dentist Not Scheduled on This Day',
  NOT_ON_DUTY: 'Dentist Not on Duty',
  OUTSIDE_WORKING_HOURS: 'Outside Working Hours',
  APPROVED_LEAVE: 'Dentist Unavailable on This Date',
  UNAVAILABLE_PERIOD: 'Date Unavailable',
  ALL_SLOTS_BOOKED: 'All Time Slots Booked',
  ROOM_CONFLICT: 'Clinic Rooms Occupied',
  SERVICE_DURATION_CONFLICT: 'Procedure Exceeds Remaining Schedule',
  ADVANCE_NOTICE_REQUIRED: 'Advance Notice Required',
};

function formatReadableIsoDate(isoDate) {
  if (!isoDate) return '';
  try {
    return new Date(`${isoDate}T12:00:00+08:00`).toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Interactive Availability Slot Picker
 * Fetches dynamic bookable appointment slots calculated by the centralized backend AvailabilityService,
 * shows specific unavailability reasons, and presents validated alternatives when a date has no slots.
 */
export function AvailabilitySlotPicker({
  dentistId,
  serviceId,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  onSelectAlternativeDate,
  onSelectAlternativeDentist,
  refreshTrigger = 0,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slots, setSlots] = useState([]);
  const [isClinicOpen, setIsClinicOpen] = useState(true);
  const [reasonCode, setReasonCode] = useState(null);
  const [reasonMessage, setReasonMessage] = useState(null);
  const [alternatives, setAlternatives] = useState(null);
  const [localRetry, setLocalRetry] = useState(0);

  const loadAvailability = useCallback(() => {
    if (!dentistId || !serviceId || !selectedDate) {
      setSlots([]);
      setError(null);
      setReasonCode(null);
      setReasonMessage(null);
      setAlternatives(null);
      return () => {};
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    schedulesApi
      .getAvailability({
        dentist_id: dentistId,
        service_id: serviceId,
        date: selectedDate,
      })
      .then((data) => {
        if (!isMounted) return;
        const dayData = data?.availability?.[0];
        setIsClinicOpen(dayData?.is_clinic_open ?? true);
        setSlots(dayData?.slots || []);
        setReasonCode(dayData?.reason_code || null);
        setReasonMessage(dayData?.reason_message || null);
        setAlternatives(data?.alternatives || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err.response?.data?.error?.message || err.message || 'Unable to verify dentist availability right now.';
        setError(msg);
        setSlots([]);
        setReasonCode(null);
        setReasonMessage(null);
        setAlternatives(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dentistId, serviceId, selectedDate]);

  useEffect(() => {
    return loadAvailability();
  }, [loadAvailability, refreshTrigger, localRetry]);

  const formatSlotTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  if (!dentistId || !serviceId || !selectedDate) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-gray-700 text-center text-xs text-slate-500 dark:text-gray-400">
        Please select a practitioner, service, and appointment date to view available time slots.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0D9488]" aria-hidden="true" />
          <span>Checking dentist schedule and clinic availability...</span>
        </div>
        <BookingStepSkeleton.Slots count={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h4 className="text-xs font-semibold text-rose-800 dark:text-rose-200">Availability Validation Failed</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLocalRetry((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100/60 dark:hover:bg-rose-900/40 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (!isClinicOpen || slots.length === 0) {
    const resolvedTitle = !isClinicOpen
      ? 'Clinic Facility Closed'
      : (REASON_TITLES[reasonCode] || 'No Available Slots');
    const resolvedMessage =
      reasonMessage ||
      (!isClinicOpen
        ? 'The clinic is closed on this day according to operating hours or facility holiday closures.'
        : 'No appointment slots are available for this date. Please select another date or dentist.');

    const altDates = Array.isArray(alternatives?.next_available_dates) ? alternatives.next_available_dates : [];
    const altDentists = Array.isArray(alternatives?.alternative_dentists) ? alternatives.alternative_dentists : [];
    const hasAlternatives = altDates.length > 0 || altDentists.length > 0;

    return (
      <div className="space-y-3">
        <div
          role="status"
          className={`p-4 rounded-xl border ${
            !isClinicOpen || reasonCode === 'APPROVED_LEAVE' || reasonCode === 'NOT_WORKING_DAY'
              ? 'bg-amber-50/80 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/80'
              : 'bg-slate-50 dark:bg-gray-900/60 border-slate-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                !isClinicOpen || reasonCode === 'APPROVED_LEAVE' || reasonCode === 'NOT_WORKING_DAY'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-hidden="true"
            />
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{resolvedTitle}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{resolvedMessage}</p>
            </div>
          </div>
        </div>

        {hasAlternatives && (
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700/80 space-y-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Suggested Available Alternatives
            </div>

            {altDates.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                  Next available dates for this dentist
                </span>
                <div className="flex flex-wrap gap-2">
                  {altDates.map((alt) => (
                    <button
                      key={alt.date}
                      type="button"
                      disabled={!onSelectAlternativeDate}
                      onClick={() => onSelectAlternativeDate?.(alt.date)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/70 bg-teal-50/70 dark:bg-teal-950/40 text-[#0F766E] dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default"
                    >
                      <span>{formatReadableIsoDate(alt.date)}</span>
                      <span className="text-[10px] font-normal text-teal-700/80 dark:text-teal-400/90 tabular-nums">
                        {alt.slot_count} {alt.slot_count === 1 ? 'slot' : 'slots'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {altDentists.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                  Other dentists available on {formatReadableIsoDate(selectedDate)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {altDentists.map((altD) => (
                    <button
                      key={altD.dentist_id}
                      type="button"
                      disabled={!onSelectAlternativeDentist}
                      onClick={() => onSelectAlternativeDentist?.(altD.dentist_id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-600 hover:text-[#0F766E] dark:hover:text-teal-300 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default"
                    >
                      <span>{altD.name}</span>
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                        {altD.slot_count} {altD.slot_count === 1 ? 'slot' : 'slots'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          Available Slots ({slots.length})
        </span>
        <span className="text-[11px] text-slate-400 dark:text-gray-400">10m turnaround buffer included</span>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.start_at === slot.start_at || selectedSlot === slot.start_at;
          const startTime = formatSlotTime(slot.start_at);
          const endTime = slot.end_at ? formatSlotTime(slot.end_at) : null;
          const displayRange = endTime ? `${startTime} – ${endTime}` : startTime;

          return (
            <button
              key={slot.start_at}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onSelectSlot && onSelectSlot(slot)}
              className={`min-h-12 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center gap-0.5 tabular-nums ${
                isSelected
                  ? 'bg-teal-600 dark:bg-[#0F766E] border-teal-600 dark:border-teal-400 text-white shadow-sm ring-2 ring-teal-200 dark:ring-teal-500/40'
                  : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/40'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="whitespace-nowrap">{displayRange}</span>
              <span className={`text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400 dark:text-gray-400'}`}>
                {slot.duration_minutes} mins
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AvailabilitySlotPicker;
