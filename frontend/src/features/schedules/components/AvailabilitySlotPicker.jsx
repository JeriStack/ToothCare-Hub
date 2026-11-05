import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { schedulesApi } from '../api';

/**
 * Interactive Availability Slot Picker
 * Fetches dynamic bookable appointment slots calculated by the backend AvailabilityService.
 */
export function AvailabilitySlotPicker({
  dentistId,
  serviceId,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slots, setSlots] = useState([]);
  const [isClinicOpen, setIsClinicOpen] = useState(true);

  useEffect(() => {
    if (!dentistId || !serviceId || !selectedDate) {
      setSlots([]);
      setError(null);
      return;
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
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err.response?.data?.error?.message || err.message || 'Failed to fetch available slots.';
        setError(msg);
        setSlots([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dentistId, serviceId, selectedDate]);

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
      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
        Please select a practitioner, service, and appointment date to view available time slots.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-slate-200 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-teal-600 animate-spin mx-auto" />
        <p className="text-xs text-slate-500">Calculating real-time appointment availability...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-semibold text-red-800">Availability Check</h4>
          <p className="text-xs text-red-700 mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  if (!isClinicOpen) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
        <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
        <h4 className="text-xs font-bold text-amber-800">Clinic Facility Closed</h4>
        <p className="text-xs text-amber-700 mt-0.5">
          The clinic is closed on this day according to operating hours or facility holiday closures.
        </p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 text-center">
        <Clock className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
        <h4 className="text-xs font-bold text-slate-700">No Slots Available</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          No appointment slots match the selected date. The dentist might not have working shifts scheduled, is on leave, or all intervals are already booked.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-600" />
          Available Slots ({slots.length})
        </span>
        <span className="text-[11px] text-slate-400">10m turnaround buffer included</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.start_at;
          const displayTime = formatSlotTime(slot.start_at);

          return (
            <button
              key={slot.start_at}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSlot && onSelectSlot(slot)}
              className={`p-2.5 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                isSelected
                  ? 'bg-teal-600 border-teal-600 text-white shadow-sm ring-2 ring-teal-200'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-teal-500 hover:bg-teal-50/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span>{displayTime}</span>
              <span className={`text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                {slot.duration_minutes}m
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AvailabilitySlotPicker;

