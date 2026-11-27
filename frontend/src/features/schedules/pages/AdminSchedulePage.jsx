import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  User,
  Coffee,
  Check,
  X,
  RefreshCw,
  Copy,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { schedulesApi } from '../api';
import { dentistsApi } from '../../dentists/api';
import { servicesApi } from '../../services/api';
import { useAuth } from '../../auth';
import { AvailabilitySlotPicker } from '../components/AvailabilitySlotPicker';
import { ScheduleCalendarSkeleton } from '../../../components/skeletons/ScheduleCalendarSkeleton';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

const CLOSURE_TYPE_LABELS = {
  HOLIDAY: 'Holiday',
  MAINTENANCE: 'Maintenance',
  EMERGENCY: 'Emergency',
  SPECIAL_CLOSURE: 'Special Closure',
};

const CLOSURE_TYPE_OPTIONS = [
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'SPECIAL_CLOSURE', label: 'Special Closure' },
];

const SHIFT_PRESETS = [
  { label: 'Morning (8–12)', start: '08:00', end: '12:00' },
  { label: 'Afternoon (1–5)', start: '13:00', end: '17:00' },
  { label: 'Full Day (8–5)', start: '08:00', end: '17:00' },
];

const CHAIR_QUICK_OPTIONS = [
  'Operatory Chair 1',
  'Operatory Chair 2',
  'Operatory Chair 3',
  'Surgical Suite',
];

const LEAVE_REASON_PRESETS = [
  'Annual Vacation Leave',
  'Medical / Sick Leave',
  'Dental Conference (CME)',
  'Personal Time Off',
];

function computeDateTimeRangeSummary(startAt, endAt) {
  if (!startAt || !endAt) return null;
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  const diffMs = endMs - startMs;
  if (diffMs <= 0) {
    return { valid: false, label: 'End date/time must be after start date/time.' };
  }
  const totalMins = Math.round(diffMs / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (mins > 0 && days === 0) parts.push(`${mins} ${mins === 1 ? 'min' : 'mins'}`);
  return { valid: true, label: parts.join(', ') || 'Less than 1 min' };
}

function computeTimeRangeSummary(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = String(startTime).split(':').map(Number);
  const [eh, em] = String(endTime).split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diffMins = eh * 60 + em - (sh * 60 + sm);
  if (diffMins <= 0) {
    return { valid: false, label: 'End time must be after start time.' };
  }
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hrs > 0 && mins > 0) return { valid: true, label: `${hrs}h ${mins}m shift` };
  if (hrs > 0) return { valid: true, label: `${hrs}h shift` };
  return { valid: true, label: `${mins}m shift` };
}

function normalizeClinicHours(rawHours = []) {
  return DAYS_OF_WEEK.map((day) => {
    const match = rawHours.find((h) => Number(h.day_of_week) === day.id);
    if (match) {
      return {
        day_of_week: day.id,
        opening_time: String(match.opening_time || '08:00:00').slice(0, 8),
        closing_time: String(match.closing_time || '17:00:00').slice(0, 8),
        is_closed: Number(match.is_closed) ? 1 : 0,
      };
    }
    return {
      day_of_week: day.id,
      opening_time: day.id === 6 ? '08:00:00' : '08:00:00',
      closing_time: day.id === 6 ? '12:00:00' : '17:00:00',
      is_closed: day.id === 7 ? 1 : 0,
    };
  });
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatTime12h(timeStr) {
  if (!timeStr) return '--:--';
  const match = String(timeStr).match(/(\d{2}):(\d{2})/);
  if (!match) return String(timeStr).slice(0, 5);
  const h24 = parseInt(match[1], 10);
  const mins = match[2];
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mins} ${period}`;
}

function formatDurationLabel(startStr, endStr) {
  const diff = timeToMinutes(endStr) - timeToMinutes(startStr);
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function formatDateTimeReadable(dateTimeStr) {
  if (!dateTimeStr) return '—';
  const normalized = String(dateTimeStr).includes('T')
    ? String(dateTimeStr)
    : String(dateTimeStr).replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(dateTimeStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function normalizeDateTimeLocalPayload(val) {
  if (!val) return '';
  const cleaned = String(val).trim().replace('T', ' ');
  return cleaned.length === 16 ? `${cleaned}:00` : cleaned;
}

function getCurrentManilaDayOfWeek() {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
    }).format(new Date());
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[weekday] || 1;
  } catch {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }
}

function getOperatingBarStyle(openingTime, closingTime) {
  const scaleStart = 6 * 60; // 6:00 AM
  const scaleEnd = 21 * 60; // 9:00 PM
  const totalSpan = scaleEnd - scaleStart;
  const startMin = Math.max(scaleStart, Math.min(scaleEnd, timeToMinutes(openingTime)));
  const endMin = Math.max(startMin, Math.min(scaleEnd, timeToMinutes(closingTime)));
  const leftPct = ((startMin - scaleStart) / totalSpan) * 100;
  const widthPct = Math.max(6, ((endMin - startMin) / totalSpan) * 100);
  return { left: `${leftPct}%`, width: `${Math.min(100 - leftPct, widthPct)}%` };
}

export function AdminSchedulePage() {
  const { user, hasPermission } = useAuth();
  const canManageClinic = Boolean(
    (typeof hasPermission === 'function' && hasPermission('settings.manage')) || user?.role === 'ADMIN'
  );
  const canManageDentists = Boolean(
    (typeof hasPermission === 'function' && hasPermission('dentists.manage')) || user?.role === 'ADMIN'
  );

  const [activeTab, setActiveTab] = useState('clinic'); // 'clinic', 'shifts', 'timeoff', 'tester'
  const [initialLoading, setInitialLoading] = useState(true);

  // Common data
  const [dentists, setDentists] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDentistId, setSelectedDentistId] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Inline confirmation state for destructive actions (replaces window.confirm)
  const [pendingDelete, setPendingDelete] = useState(null); // { type: 'closure'|'shift'|'timeoff', id }

  // Tab 1: Clinic Hours & Closures
  const [clinicHours, setClinicHours] = useState(() => normalizeClinicHours([]));
  const [savedClinicHours, setSavedClinicHours] = useState(() => normalizeClinicHours([]));
  const [closures, setClosures] = useState([]);
  const [isHoursSaving, setIsHoursSaving] = useState(false);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [closureFormError, setClosureFormError] = useState(null);
  const [closureForm, setClosureForm] = useState({
    title: '',
    start_at: '',
    end_at: '',
    closure_type: 'HOLIDAY',
    notes: '',
  });

  // Tab 2: Dentist Weekly Shifts
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftFormError, setShiftFormError] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '12:00',
    operatory_chair: 'Chair 1',
    is_active: 1,
  });

  // Tab 3: Dentist Time-Off
  const [timeOffList, setTimeOffList] = useState([]);
  const [timeOffLoading, setTimeOffLoading] = useState(false);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffSubmitting, setTimeOffSubmitting] = useState(false);
  const [timeOffFormError, setTimeOffFormError] = useState(null);
  const [timeOffForm, setTimeOffForm] = useState({
    start_at: '',
    end_at: '',
    reason: '',
  });

  // Tab 4: Tester
  const [testServiceId, setTestServiceId] = useState('');
  const [testDate, setTestDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedTestSlot, setSelectedTestSlot] = useState(null);

  const loadClinicData = useCallback(async () => {
    try {
      const [hours, cls] = await Promise.all([
        schedulesApi.getClinicHours(),
        schedulesApi.getClinicClosures(),
      ]);
      const normalized = normalizeClinicHours(hours);
      setClinicHours(normalized);
      setSavedClinicHours(normalized);
      setClosures(Array.isArray(cls) ? cls : []);
    } catch {
      setErrorMsg('Failed to load clinic facility operating data.');
    }
  }, []);

  const loadDentistShifts = useCallback(async (dentistId) => {
    setShiftsLoading(true);
    try {
      const data = await schedulesApi.getDentistSchedules(dentistId);
      setShifts(Array.isArray(data) ? data : []);
    } catch {
      setErrorMsg('Failed to load practitioner weekly shifts.');
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  const loadDentistTimeOff = useCallback(async (dentistId) => {
    setTimeOffLoading(true);
    try {
      const data = await schedulesApi.getDentistTimeOff(dentistId);
      setTimeOffList(Array.isArray(data) ? data : []);
    } catch {
      setErrorMsg('Failed to load practitioner leave records.');
    } finally {
      setTimeOffLoading(false);
    }
  }, []);

  // Initial Load: Dentists, Services, Clinic Hours & Closures
  useEffect(() => {
    Promise.all([
      dentistsApi
        .getAdminDentists({ per_page: 50 })
        .then((res) => {
          const list = res.data || [];
          setDentists(list);
          if (list.length > 0) {
            setSelectedDentistId((prev) => prev || list[0].id);
          }
        })
        .catch(() => {}),

      servicesApi
        .getPublicServices()
        .then((res) => {
          const list = res || [];
          setServices(list);
          if (list.length > 0) {
            setTestServiceId((prev) => prev || list[0].id);
          }
        })
        .catch(() => {}),

      loadClinicData(),
    ]).finally(() => {
      setInitialLoading(false);
    });
  }, [loadClinicData]);

  // Reload shifts or time-off when selected dentist or active tab changes
  useEffect(() => {
    if (!selectedDentistId) return;
    setPendingDelete(null);
    if (activeTab === 'shifts') {
      loadDentistShifts(selectedDentistId);
    } else if (activeTab === 'timeoff') {
      loadDentistTimeOff(selectedDentistId);
    }
  }, [selectedDentistId, activeTab, loadDentistShifts, loadDentistTimeOff]);

  // Derived Clinic Hours Metrics & Validation
  const clinicHoursErrors = useMemo(() => {
    const errs = {};
    for (const row of clinicHours) {
      if (!row.is_closed && timeToMinutes(row.closing_time) <= timeToMinutes(row.opening_time)) {
        errs[row.day_of_week] = 'Closing time must be after opening time.';
      }
    }
    return errs;
  }, [clinicHours]);

  const hasInvalidHours = Object.keys(clinicHoursErrors).length > 0;

  const hasUnsavedHours = useMemo(() => {
    return JSON.stringify(clinicHours) !== JSON.stringify(savedClinicHours);
  }, [clinicHours, savedClinicHours]);

  const clinicHoursSummary = useMemo(() => {
    let openDays = 0;
    let totalMinutes = 0;
    for (const row of clinicHours) {
      if (!row.is_closed) {
        openDays += 1;
        const diff = timeToMinutes(row.closing_time) - timeToMinutes(row.opening_time);
        if (diff > 0) totalMinutes += diff;
      }
    }
    const hrs = Math.round((totalMinutes / 60) * 10) / 10;
    return { openDays, totalHours: hrs };
  }, [clinicHours]);

  const dentistWeeklySummary = useMemo(() => {
    let totalMinutes = 0;
    for (const s of shifts) {
      const diff = timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
      if (diff > 0) totalMinutes += diff;
    }
    const hrs = Math.round((totalMinutes / 60) * 10) / 10;
    return { shiftCount: shifts.length, totalHours: hrs };
  }, [shifts]);

  // Shift vs Clinic Operating Hours live advisory warning inside modal
  const shiftClinicBoundaryWarning = useMemo(() => {
    const dayRule = clinicHours.find((h) => h.day_of_week === Number(shiftForm.day_of_week));
    if (!dayRule) return null;
    if (dayRule.is_closed) {
      return `The clinic is currently set to Closed on ${DAYS_OF_WEEK.find((d) => d.id === dayRule.day_of_week)?.name}.`;
    }
    const sStart = timeToMinutes(shiftForm.start_time);
    const sEnd = timeToMinutes(shiftForm.end_time);
    const cOpen = timeToMinutes(dayRule.opening_time);
    const cClose = timeToMinutes(dayRule.closing_time);
    if (sStart < cOpen || sEnd > cClose) {
      return `Shift extends outside clinic hours (${formatTime12h(dayRule.opening_time)} – ${formatTime12h(dayRule.closing_time)}). Slots outside facility hours are automatically clamped.`;
    }
    return null;
  }, [clinicHours, shiftForm.day_of_week, shiftForm.start_time, shiftForm.end_time]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };

  // --- Clinic Hours Handlers ---
  const handleClinicHourChange = (dayOfWeek, field, value) => {
    if (!canManageClinic) return;
    setClinicHours((prev) =>
      prev.map((item) =>
        item.day_of_week === dayOfWeek ? { ...item, [field]: value } : item
      )
    );
  };

  const handleCopyMondayToWeekdays = () => {
    if (!canManageClinic) return;
    const monday = clinicHours.find((h) => h.day_of_week === 1);
    if (!monday) return;
    setClinicHours((prev) =>
      prev.map((item) =>
        item.day_of_week >= 2 && item.day_of_week <= 5
          ? {
              ...item,
              opening_time: monday.opening_time,
              closing_time: monday.closing_time,
              is_closed: monday.is_closed,
            }
          : item
      )
    );
  };

  const handleDiscardClinicHours = () => {
    setClinicHours(savedClinicHours);
    setErrorMsg(null);
  };

  const handleSaveClinicHours = async () => {
    if (!canManageClinic || hasInvalidHours) return;
    setIsHoursSaving(true);
    setErrorMsg(null);
    try {
      await schedulesApi.updateClinicHours({ hours: clinicHours });
      showSuccess('Clinic weekly operating hours saved.');
      await loadClinicData();
    } catch (e) {
      showError(e.response?.data?.error?.message || 'Failed to update operating hours.');
    } finally {
      setIsHoursSaving(false);
    }
  };

  // --- Clinic Closure Handlers ---
  const handleCreateClosure = async (e) => {
    e.preventDefault();
    if (!canManageClinic) return;
    setClosureFormError(null);

    if (!closureForm.start_at || !closureForm.end_at || closureForm.end_at <= closureForm.start_at) {
      setClosureFormError('End date/time must be strictly after start date/time.');
      return;
    }

    setClosureSubmitting(true);
    try {
      await schedulesApi.createClinicClosure({
        ...closureForm,
        title: closureForm.title.trim(),
        notes: closureForm.notes.trim(),
        start_at: normalizeDateTimeLocalPayload(closureForm.start_at),
        end_at: normalizeDateTimeLocalPayload(closureForm.end_at),
      });
      showSuccess('Clinic closure window scheduled.');
      setIsClosureModalOpen(false);
      setClosureForm({ title: '', start_at: '', end_at: '', closure_type: 'HOLIDAY', notes: '' });
      await loadClinicData();
    } catch (err) {
      setClosureFormError(err.response?.data?.error?.message || 'Failed to register clinic closure.');
    } finally {
      setClosureSubmitting(false);
    }
  };

  const handleConfirmDeleteClosure = async (id) => {
    if (!canManageClinic) return;
    try {
      await schedulesApi.deleteClinicClosure(id);
      setPendingDelete(null);
      showSuccess('Clinic closure removed.');
      await loadClinicData();
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to remove closure.');
    }
  };

  // --- Dentist Shifts Handlers ---
  const openAddShiftModal = (dayOfWeek = 1) => {
    setEditingShiftId(null);
    setShiftFormError(null);
    setShiftForm({
      day_of_week: dayOfWeek,
      start_time: '08:00',
      end_time: '12:00',
      operatory_chair: 'Chair 1',
      is_active: 1,
    });
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!canManageDentists || !selectedDentistId) return;
    setShiftFormError(null);

    if (timeToMinutes(shiftForm.end_time) <= timeToMinutes(shiftForm.start_time)) {
      setShiftFormError('End time must be strictly after start time.');
      return;
    }

    setShiftSubmitting(true);
    try {
      const payload = {
        ...shiftForm,
        operatory_chair: shiftForm.operatory_chair.trim() || 'Chair 1',
      };
      if (editingShiftId) {
        await schedulesApi.updateDentistSchedule(selectedDentistId, editingShiftId, payload);
        showSuccess('Recurring shift updated.');
      } else {
        await schedulesApi.createDentistSchedule(selectedDentistId, payload);
        showSuccess('Recurring shift created.');
      }
      setIsShiftModalOpen(false);
      setEditingShiftId(null);
      await loadDentistShifts(selectedDentistId);
    } catch (err) {
      setShiftFormError(err.response?.data?.error?.message || 'Failed to save shift.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleConfirmDeleteShift = async (scheduleId) => {
    if (!canManageDentists) return;
    try {
      await schedulesApi.deleteDentistSchedule(selectedDentistId, scheduleId);
      setPendingDelete(null);
      showSuccess('Shift removed.');
      await loadDentistShifts(selectedDentistId);
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to delete shift.');
    }
  };

  // --- Dentist Time-Off Handlers ---
  const handleSaveTimeOff = async (e) => {
    e.preventDefault();
    if (!canManageDentists || !selectedDentistId) return;
    setTimeOffFormError(null);

    if (!timeOffForm.start_at || !timeOffForm.end_at || timeOffForm.end_at <= timeOffForm.start_at) {
      setTimeOffFormError('End date/time must be strictly after start date/time.');
      return;
    }

    setTimeOffSubmitting(true);
    try {
      await schedulesApi.createDentistTimeOff(selectedDentistId, {
        start_at: normalizeDateTimeLocalPayload(timeOffForm.start_at),
        end_at: normalizeDateTimeLocalPayload(timeOffForm.end_at),
        reason: timeOffForm.reason.trim(),
      });
      showSuccess('Practitioner leave scheduled.');
      setIsTimeOffModalOpen(false);
      setTimeOffForm({ start_at: '', end_at: '', reason: '' });
      await loadDentistTimeOff(selectedDentistId);
    } catch (err) {
      setTimeOffFormError(err.response?.data?.error?.message || 'Failed to record time-off.');
    } finally {
      setTimeOffSubmitting(false);
    }
  };

  const handleConfirmDeleteTimeOff = async (timeOffId) => {
    if (!canManageDentists) return;
    try {
      await schedulesApi.deleteDentistTimeOff(selectedDentistId, timeOffId);
      setPendingDelete(null);
      showSuccess('Practitioner leave removed.');
      await loadDentistTimeOff(selectedDentistId);
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to delete time-off.');
    }
  };

  const todayDayOfWeek = useMemo(() => getCurrentManilaDayOfWeek(), []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-[#12304A] dark:text-slate-100">
              Clinic Hours &amp; Practitioner Schedules
            </h2>
            {!canManageClinic && !canManageDentists && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-700">
                <Lock className="w-3 h-3" aria-hidden="true" />
                View-Only Access
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage facility operating hours, closures, recurring dentist shifts, leaves, and real-time slot availability.
          </p>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div
            role="status"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 text-teal-800 dark:text-teal-200 text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              aria-label="Dismiss notification"
              className="ml-1 text-teal-600/80 hover:text-teal-900 dark:text-teal-300 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs font-semibold"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
              className="ml-1 text-rose-600/80 hover:text-rose-900 dark:text-rose-300 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-gray-700 gap-2" role="tablist" aria-label="Schedule management sections">
        {[
          { id: 'clinic', label: 'Clinic Hours & Closures', Icon: Building2 },
          { id: 'shifts', label: 'Dentist Weekly Shifts', Icon: Clock },
          { id: 'timeoff', label: 'Dentist Time-Off & Leaves', Icon: Coffee },
          { id: 'tester', label: 'Live Availability Tester', Icon: Calendar },
        ].map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer rounded-t-lg ${
                isActive
                  ? 'border-[#0D9488] dark:border-teal-400 text-[#0F766E] dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/35'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800/70'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CLINIC OPERATING HOURS & FACILITY CLOSURES */}
      {/* ========================================================= */}
      {activeTab === 'clinic' && (
        initialLoading ? (
          <ScheduleCalendarSkeleton view="hours" />
        ) : (
          <div className="space-y-6">
            {/* Weekly Hours Card */}
            <section
              aria-label="Weekly Facility Operating Hours"
              className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Weekly Facility Operating Hours
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                      {clinicHoursSummary.openDays} open days · {clinicHoursSummary.totalHours}h/wk
                    </span>
                    {canManageClinic && hasUnsavedHours && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Global clinic boundaries (Asia/Manila). Dentist shifts are automatically clamped inside these hours.
                  </p>
                </div>

                {canManageClinic ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMondayToWeekdays}
                      title="Copy Monday's schedule to Tuesday through Friday"
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>Copy Mon to Weekdays</span>
                    </button>

                    {hasUnsavedHours && (
                      <button
                        type="button"
                        onClick={handleDiscardClinicHours}
                        disabled={isHoursSaving}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Discard</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveClinicHours}
                      disabled={isHoursSaving || !hasUnsavedHours || hasInvalidHours}
                      className="px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isHoursSaving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{isHoursSaving ? 'Saving...' : 'Save Facility Hours'}</span>
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 self-start lg:self-auto">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>Managed by Clinic Administrator</span>
                  </span>
                )}
              </div>

              {/* 7-Day Modern Weekly Calendar Grid */}
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const hourRecord = clinicHours.find((h) => h.day_of_week === day.id) || {
                      day_of_week: day.id,
                      opening_time: '08:00:00',
                      closing_time: '17:00:00',
                      is_closed: 0,
                    };
                    const isOpen = !Boolean(hourRecord.is_closed);
                    const isToday = day.id === todayDayOfWeek;
                    const rowError = clinicHoursErrors[day.id];
                    const durationLabel = isOpen
                      ? formatDurationLabel(hourRecord.opening_time, hourRecord.closing_time)
                      : null;
                    const barStyle = isOpen && !rowError
                      ? getOperatingBarStyle(hourRecord.opening_time, hourRecord.closing_time)
                      : null;

                    return (
                      <div
                        key={day.id}
                        className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                          rowError
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-700/80'
                            : isToday
                            ? 'bg-teal-50/35 dark:bg-teal-950/25 border-[#0D9488]/60 dark:border-teal-400/50 ring-1 ring-[#0D9488]/15 dark:ring-teal-400/20'
                            : isOpen
                            ? 'bg-white dark:bg-gray-900/50 border-slate-200/90 dark:border-gray-700/80 hover:border-slate-300 dark:hover:border-gray-600'
                            : 'bg-slate-50/75 dark:bg-gray-900/30 border-slate-200/75 dark:border-gray-800'
                        }`}
                      >
                        {/* Day Calendar Column Header */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-gray-700/70">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-widest ${
                                  isToday
                                    ? 'text-[#0F766E] dark:text-teal-300'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {day.short}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#0D9488]/15 dark:bg-teal-400/15 text-[#0F766E] dark:text-teal-300">
                                  Today
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                              {day.name}
                            </p>
                          </div>

                          {canManageClinic ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isOpen}
                              aria-label={`${day.name} clinic open status`}
                              onClick={() =>
                                handleClinicHourChange(day.id, 'is_closed', isOpen ? 1 : 0)
                              }
                              className="inline-flex items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-full mt-0.5 shrink-0"
                              title={isOpen ? 'Open (click to mark closed)' : 'Closed (click to mark open)'}
                            >
                              <span
                                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 ${
                                  isOpen
                                    ? 'bg-[#0D9488] dark:bg-teal-500'
                                    : 'bg-slate-300 dark:bg-gray-600'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs transform transition-transform duration-150 ${
                                    isOpen ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </span>
                            </button>
                          ) : (
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                isOpen ? 'bg-teal-500 dark:bg-teal-400' : 'bg-slate-300 dark:bg-gray-600'
                              }`}
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        {/* Day Calendar Body */}
                        {isOpen ? (
                          <div className="flex-1 flex flex-col justify-between gap-3">
                            {/* Operating Window Event Block */}
                            <div className="rounded-xl border border-teal-200/75 dark:border-teal-500/25 border-l-[3px] border-l-[#0D9488] dark:border-l-teal-400 bg-teal-50/55 dark:bg-teal-500/10 p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                                  Open
                                </span>
                                {durationLabel && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-white/80 dark:bg-gray-900/60 text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-500/25 tabular-nums">
                                    {durationLabel}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs font-bold text-slate-900 dark:text-slate-50 tabular-nums leading-snug">
                                {formatTime12h(hourRecord.opening_time)} – {formatTime12h(hourRecord.closing_time)}
                              </p>

                              {/* Proportional Day Timeline Bar (6 AM – 9 PM) */}
                              {barStyle && (
                                <div className="pt-0.5 space-y-1">
                                  <div className="relative h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-gray-800 overflow-hidden">
                                    <span
                                      aria-hidden="true"
                                      style={barStyle}
                                      className="absolute inset-y-0 rounded-full bg-[#0D9488] dark:bg-teal-400"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
                                    <span>6 AM</span>
                                    <span>12 PM</span>
                                    <span>9 PM</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Admin Inline Time Pickers */}
                            {canManageClinic && (
                              <div className="space-y-2 pt-0.5">
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                                    Opens
                                  </label>
                                  <input
                                    type="time"
                                    aria-label={`${day.name} opening time`}
                                    value={hourRecord.opening_time.substring(0, 5)}
                                    onChange={(e) =>
                                      handleClinicHourChange(day.id, 'opening_time', `${e.target.value}:00`)
                                    }
                                    className={`w-full px-2 py-1.5 text-xs tabular-nums bg-white dark:bg-gray-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 ${
                                      rowError
                                        ? 'border-rose-400 dark:border-rose-500'
                                        : 'border-slate-200 dark:border-gray-600'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                                    Closes
                                  </label>
                                  <input
                                    type="time"
                                    aria-label={`${day.name} closing time`}
                                    value={hourRecord.closing_time.substring(0, 5)}
                                    onChange={(e) =>
                                      handleClinicHourChange(day.id, 'closing_time', `${e.target.value}:00`)
                                    }
                                    className={`w-full px-2 py-1.5 text-xs tabular-nums bg-white dark:bg-gray-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 ${
                                      rowError
                                        ? 'border-rose-400 dark:border-rose-500'
                                        : 'border-slate-200 dark:border-gray-600'
                                    }`}
                                  />
                                </div>
                                {rowError && (
                                  <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400 leading-snug">
                                    {rowError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-gray-700/80 bg-slate-100/50 dark:bg-gray-900/40 px-3 py-6 text-center">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Closed All Day
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              No clinic bookings
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calendar Legend Footer */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/35 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Timezone: Asia/Manila (PST)</span>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400" aria-hidden="true" />
                    Open
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-gray-600" aria-hidden="true" />
                    Closed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs border border-[#0D9488] bg-teal-500/20" aria-hidden="true" />
                    Today
                  </span>
                </div>
              </div>
            </section>

            {/* Scheduled Closures Card */}
            <section
              aria-label="Clinic-Wide Closures and Holidays"
              className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Clinic-Wide Closures &amp; Holidays
                    </h3>
                    {closures.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25 tabular-nums">
                        {closures.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Entire facility closures that supersede all dentist shifts and suppress all slot booking.
                  </p>
                </div>

                {canManageClinic && (
                  <button
                    type="button"
                    onClick={() => {
                      setClosureFormError(null);
                      setIsClosureModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-[#0D9488] dark:border-teal-500/80 text-[#0F766E] dark:text-teal-300 text-xs font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Schedule Closure</span>
                  </button>
                )}
              </div>

              <div className="p-4">
                {closures.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/30 rounded-xl">
                    No active or scheduled clinic closures found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-gray-700/70 border border-slate-200/80 dark:border-gray-700/80 rounded-xl overflow-hidden">
                    {closures.map((c) => {
                      const isConfirming = pendingDelete?.type === 'closure' && pendingDelete.id === c.id;
                      return (
                        <div
                          key={c.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800/95"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                {c.title}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25">
                                {CLOSURE_TYPE_LABELS[c.closure_type] || c.closure_type}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 tabular-nums">
                              <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>
                                {formatDateTimeReadable(c.start_at)} → {formatDateTimeReadable(c.end_at)}
                              </span>
                            </p>
                            {c.notes && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1">
                                "{c.notes}"
                              </p>
                            )}
                          </div>

                          {canManageClinic && (
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              {isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeleteClosure(c.id)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingDelete(null)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete({ type: 'closure', id: c.id })}
                                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 inline-flex items-center justify-center transition-colors cursor-pointer"
                                  title="Remove Closure"
                                  aria-label={`Remove closure ${c.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )
      )}

      {/* ========================================================= */}
      {/* TAB 2: DENTIST WEEKLY SHIFT PLANNER */}
      {/* ========================================================= */}
      {activeTab === 'shifts' && (
        initialLoading || shiftsLoading ? (
          <ScheduleCalendarSkeleton view="shifts" />
        ) : (
          <div className="space-y-6">
            {/* Dentist Selector Bar */}
            <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                  <label htmlFor="shifts-practitioner-select" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Practitioner:
                  </label>
                </div>
                <select
                  id="shifts-practitioner-select"
                  value={selectedDentistId}
                  onChange={(e) => setSelectedDentistId(Number(e.target.value))}
                  className="px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-slate-50/70 dark:bg-gray-900/60 text-slate-800 dark:text-slate-100"
                >
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name} ({d.specialization})
                    </option>
                  ))}
                </select>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                  {dentistWeeklySummary.shiftCount} {dentistWeeklySummary.shiftCount === 1 ? 'shift' : 'shifts'} · {dentistWeeklySummary.totalHours}h/wk
                </span>
              </div>

              {canManageDentists ? (
                <button
                  type="button"
                  onClick={() => openAddShiftModal(1)}
                  className="px-3.5 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] transition-colors shadow-2xs inline-flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Recurring Shift</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 self-start md:self-auto">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  <span>View-Only Shifts</span>
                </span>
              )}
            </div>

            {/* Shifts Grid by Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayShifts = shifts.filter((s) => Number(s.day_of_week) === day.id);
                const clinicDay = clinicHours.find((h) => h.day_of_week === day.id);
                const clinicClosed = Boolean(clinicDay?.is_closed);

                return (
                  <div
                    key={day.id}
                    className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {day.name}
                          </span>
                          {clinicClosed && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-900 text-slate-500 dark:text-slate-400">
                              Clinic closed
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-slate-300 tabular-nums">
                          {dayShifts.length} {dayShifts.length === 1 ? 'Shift' : 'Shifts'}
                        </span>
                      </div>

                      {dayShifts.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2">
                          No shift scheduled (off duty)
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayShifts.map((shift) => {
                            const isConfirming = pendingDelete?.type === 'shift' && pendingDelete.id === shift.id;
                            const dur = formatDurationLabel(shift.start_time, shift.end_time);
                            return (
                              <div
                                key={shift.id}
                                className="p-3 rounded-xl border border-teal-200/70 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/30 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900 dark:text-teal-200 tabular-nums">
                                    <Clock className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                                    <span>
                                      {formatTime12h(shift.start_time)} – {formatTime12h(shift.end_time)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-teal-700/90 dark:text-teal-300/90">
                                    <span>{shift.operatory_chair || 'Chair 1'}</span>
                                    {dur && (
                                      <>
                                        <span className="text-teal-400/70" aria-hidden="true">·</span>
                                        <span className="tabular-nums">{dur}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {canManageDentists && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isConfirming ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmDeleteShift(shift.id)}
                                          className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold cursor-pointer"
                                        >
                                          Delete
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPendingDelete(null)}
                                          className="px-2 py-1 rounded-md border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300 text-[10px] font-semibold cursor-pointer"
                                        >
                                          No
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingShiftId(shift.id);
                                            setShiftFormError(null);
                                            setShiftForm({
                                              day_of_week: Number(shift.day_of_week),
                                              start_time: shift.start_time.substring(0, 5),
                                              end_time: shift.end_time.substring(0, 5),
                                              operatory_chair: shift.operatory_chair || 'Chair 1',
                                              is_active: shift.is_active,
                                            });
                                            setIsShiftModalOpen(true);
                                          }}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-white/70 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                          title="Edit Shift"
                                          aria-label={`Edit ${day.name} shift`}
                                        >
                                          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPendingDelete({ type: 'shift', id: shift.id })}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/70 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                          title="Delete Shift"
                                          aria-label={`Delete ${day.name} shift`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {canManageDentists && (
                      <button
                        type="button"
                        onClick={() => openAddShiftModal(day.id)}
                        className="w-full py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-gray-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Add {day.short} shift</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ========================================================= */}
      {/* TAB 3: DENTIST TIME-OFF & LEAVES */}
      {/* ========================================================= */}
      {activeTab === 'timeoff' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                <label htmlFor="timeoff-practitioner-select" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Practitioner:
                </label>
              </div>
              <select
                id="timeoff-practitioner-select"
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(Number(e.target.value))}
                className="px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 bg-slate-50/70 dark:bg-gray-900/60 text-slate-800 dark:text-slate-100"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            {canManageDentists ? (
              <button
                type="button"
                onClick={() => {
                  setTimeOffFormError(null);
                  setIsTimeOffModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] transition-colors shadow-2xs inline-flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Schedule Time-Off</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 self-start md:self-auto">
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>View-Only Leaves</span>
              </span>
            )}
          </div>

          <section
            aria-label="Scheduled Practitioner Leaves"
            className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Scheduled Practitioner Leaves &amp; Vacations
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                {timeOffList.length}
              </span>
            </div>

            <div className="p-4">
              {timeOffLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading leave records...</div>
              ) : timeOffList.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/30 rounded-xl">
                  No active leave or vacation records for this dentist.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700/70 border border-slate-200/80 dark:border-gray-700/80 rounded-xl overflow-hidden">
                  {timeOffList.map((item) => {
                    const isConfirming = pendingDelete?.type === 'timeoff' && pendingDelete.id === item.id;
                    return (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800/95"
                      >
                        <div>
                          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block">
                            {item.reason}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 tabular-nums">
                            <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>
                              {formatDateTimeReadable(item.start_at)} → {formatDateTimeReadable(item.end_at)}
                            </span>
                          </p>
                          {item.approver_name && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                              Approved by {item.approver_name}
                            </p>
                          )}
                        </div>

                        {canManageDentists && (
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {isConfirming ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteTimeOff(item.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(null)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ type: 'timeoff', id: item.id })}
                                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 inline-flex items-center justify-center transition-colors cursor-pointer"
                                title="Remove Leave"
                                aria-label={`Remove leave ${item.reason}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: LIVE AVAILABILITY TESTER */}
      {/* ========================================================= */}
      {activeTab === 'tester' && (
        <section
          aria-label="Real-Time Availability Slot Inspection"
          className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-6 space-y-6"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Real-Time Availability Slot Inspection
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect bookable slots calculated from dentist shifts, clinic operating hours, turnaround buffers, closures, and existing appointments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700">
            <div>
              <label htmlFor="tester-dentist" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Dentist
              </label>
              <select
                id="tester-dentist"
                value={selectedDentistId}
                onChange={(e) => {
                  setSelectedDentistId(Number(e.target.value));
                  setSelectedTestSlot(null);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tester-service" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Service &amp; Duration
              </label>
              <select
                id="tester-service"
                value={testServiceId}
                onChange={(e) => {
                  setTestServiceId(Number(e.target.value));
                  setSelectedTestSlot(null);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes}m · ₱{Number(s.price).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tester-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Target Date
              </label>
              <input
                id="tester-date"
                type="date"
                value={testDate}
                onChange={(e) => {
                  setTestDate(e.target.value);
                  setSelectedTestSlot(null);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
            </div>
          </div>

          <div className="border border-slate-200/80 dark:border-gray-700 rounded-xl p-5">
            <AvailabilitySlotPicker
              dentistId={Number(selectedDentistId)}
              serviceId={Number(testServiceId)}
              selectedDate={testDate}
              selectedSlot={selectedTestSlot?.start_at}
              onSelectSlot={(slot) => setSelectedTestSlot(slot)}
            />

            {selectedTestSlot && (
              <div className="mt-4 p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/70 text-xs text-teal-950 dark:text-teal-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-400 block">
                    Appointment Window
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatTime12h(selectedTestSlot.start_at)} – {formatTime12h(selectedTestSlot.end_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-400 block">
                    Duration
                  </span>
                  <span className="font-semibold tabular-nums">{selectedTestSlot.duration_minutes} minutes</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-400 block">
                    Buffer Cleared At
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatTime12h(selectedTestSlot.blocking_end_at)} (+{selectedTestSlot.buffer_minutes}m)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-400 block">
                    Operatory Chair
                  </span>
                  <span className="font-semibold">{selectedTestSlot.operatory_chair}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT SHIFT */}
      {/* ========================================================= */}
      {isShiftModalOpen && canManageDentists && (() => {
        const activeDentist = dentists.find((d) => Number(d.id) === Number(selectedDentistId));
        const shiftDuration = computeTimeRangeSummary(shiftForm.start_time, shiftForm.end_time);

        return (
          <DialogOverlay
            onClose={() => setIsShiftModalOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 max-w-md w-full shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                      {editingShiftId ? 'Edit Weekly Shift' : 'Add Recurring Weekly Shift'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {activeDentist
                        ? `Dr. ${activeDentist.first_name} ${activeDentist.last_name} · Weekly duty schedule`
                        : 'Configure recurring practitioner duty hours'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  aria-label="Close shift modal"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShift} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {shiftFormError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{shiftFormError}</span>
                    </div>
                  )}

                  {shiftClinicBoundaryWarning && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{shiftClinicBoundaryWarning}</span>
                    </div>
                  )}

                  {/* Day of Week Pills */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Day of Week
                    </span>
                    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Select day of week">
                      {DAYS_OF_WEEK.map((d) => {
                        const selected = Number(shiftForm.day_of_week) === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setShiftForm({ ...shiftForm, day_of_week: d.id })}
                            className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              selected
                                ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-500 dark:border-teal-400 text-[#0F766E] dark:text-teal-200 ring-1 ring-teal-500/30'
                                : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500/60'
                            }`}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Range + Quick Presets */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="shift-start-time"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Start Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="shift-start-time"
                          type="time"
                          required
                          value={shiftForm.start_time}
                          onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="shift-end-time"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          End Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="shift-end-time"
                          type="time"
                          required
                          value={shiftForm.end_time}
                          onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {SHIFT_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setShiftForm({ ...shiftForm, start_time: preset.start, end_time: preset.end })
                            }
                            className="px-2 py-1 rounded-lg text-[10.5px] font-medium bg-slate-100 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500/60 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {shiftDuration && (
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            shiftDuration.valid
                              ? 'text-teal-700 dark:text-teal-300'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {shiftDuration.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operatory Chair */}
                  <div className="space-y-2">
                    <label
                      htmlFor="shift-operatory-chair"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Operatory Chair <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      id="shift-operatory-chair"
                      type="text"
                      required
                      value={shiftForm.operatory_chair}
                      onChange={(e) => setShiftForm({ ...shiftForm, operatory_chair: e.target.value })}
                      placeholder="e.g., Operatory Chair 1"
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CHAIR_QUICK_OPTIONS.map((chair) => (
                        <button
                          key={chair}
                          type="button"
                          onClick={() => setShiftForm({ ...shiftForm, operatory_chair: chair })}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-medium border transition-colors cursor-pointer ${
                            shiftForm.operatory_chair === chair
                              ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500 text-[#0F766E] dark:text-teal-200'
                              : 'bg-slate-100 dark:bg-gray-900/70 border-slate-200/80 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
                          }`}
                        >
                          {chair}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={shiftSubmitting || (shiftDuration && !shiftDuration.valid)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {shiftSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                    <span>{shiftSubmitting ? 'Saving...' : editingShiftId ? 'Update Shift' : 'Create Shift'}</span>
                  </button>
                </div>
              </form>
            </div>
          </DialogOverlay>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL: SCHEDULE CLINIC CLOSURE */}
      {/* ========================================================= */}
      {isClosureModalOpen && canManageClinic && (() => {
        const closureDuration = computeDateTimeRangeSummary(closureForm.start_at, closureForm.end_at);
        const notesLength = (closureForm.notes || '').length;

        return (
          <DialogOverlay
            onClose={() => setIsClosureModalOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 max-w-lg w-full shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 ring-1 ring-inset ring-amber-200/90 dark:ring-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                      Schedule Facility Closure
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Block clinic-wide appointments during holidays or maintenance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(false)}
                  aria-label="Close closure modal"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClosure} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {closureFormError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{closureFormError}</span>
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="closure-title"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Title <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      id="closure-title"
                      type="text"
                      required
                      maxLength={120}
                      placeholder="e.g., Christmas Holiday, Facility Renovation"
                      value={closureForm.title}
                      onChange={(e) => setClosureForm({ ...closureForm, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                    />
                  </div>

                  {/* Date Range */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="closure-start"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Start Date &amp; Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="closure-start"
                          type="datetime-local"
                          required
                          value={closureForm.start_at}
                          onChange={(e) => setClosureForm({ ...closureForm, start_at: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="closure-end"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          End Date &amp; Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="closure-end"
                          type="datetime-local"
                          required
                          value={closureForm.end_at}
                          onChange={(e) => setClosureForm({ ...closureForm, end_at: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                    </div>

                    {closureDuration && (
                      <div
                        className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                          closureDuration.valid
                            ? 'bg-teal-50/70 dark:bg-teal-500/10 text-teal-800 dark:text-teal-200 border border-teal-200/70 dark:border-teal-500/25'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {closureDuration.valid ? `Closure duration: ${closureDuration.label}` : closureDuration.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Closure Category
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Select closure category">
                      {CLOSURE_TYPE_OPTIONS.map((opt) => {
                        const selected = closureForm.closure_type === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setClosureForm({ ...closureForm, closure_type: opt.value })}
                            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              selected
                                ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-500 dark:border-teal-400 text-[#0F766E] dark:text-teal-200 ring-1 ring-teal-500/30'
                                : 'bg-white dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500/60'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="closure-notes"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        <span>Notes</span>
                        <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                          Optional
                        </span>
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {notesLength} / 400
                      </span>
                    </div>
                    <textarea
                      id="closure-notes"
                      rows={2}
                      maxLength={400}
                      placeholder="Optional patient notice or internal closure remarks..."
                      value={closureForm.notes}
                      onChange={(e) => setClosureForm({ ...closureForm, notes: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsClosureModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={closureSubmitting || (closureDuration && !closureDuration.valid)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {closureSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                    <span>{closureSubmitting ? 'Registering...' : 'Register Closure'}</span>
                  </button>
                </div>
              </form>
            </div>
          </DialogOverlay>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL: DENTIST TIME-OFF */}
      {/* ========================================================= */}
      {isTimeOffModalOpen && canManageDentists && (() => {
        const activeDentist = dentists.find((d) => Number(d.id) === Number(selectedDentistId));
        const leaveDuration = computeDateTimeRangeSummary(timeOffForm.start_at, timeOffForm.end_at);

        return (
          <DialogOverlay
            onClose={() => setIsTimeOffModalOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 max-w-lg w-full shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/90 dark:ring-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Coffee className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                      Schedule Practitioner Leave
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {activeDentist
                        ? `Dr. ${activeDentist.first_name} ${activeDentist.last_name} · Blocks booking slots automatically`
                        : 'Block dentist availability during approved time off'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimeOffModalOpen(false)}
                  aria-label="Close leave modal"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700/70 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTimeOff} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {timeOffFormError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{timeOffFormError}</span>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="leave-start"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Start Date &amp; Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="leave-start"
                          type="datetime-local"
                          required
                          value={timeOffForm.start_at}
                          onChange={(e) => setTimeOffForm({ ...timeOffForm, start_at: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="leave-end"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          End Date &amp; Time <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          id="leave-end"
                          type="datetime-local"
                          required
                          value={timeOffForm.end_at}
                          onChange={(e) => setTimeOffForm({ ...timeOffForm, end_at: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs tabular-nums bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                        />
                      </div>
                    </div>

                    {leaveDuration && (
                      <div
                        className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                          leaveDuration.valid
                            ? 'bg-teal-50/70 dark:bg-teal-500/10 text-teal-800 dark:text-teal-200 border border-teal-200/70 dark:border-teal-500/25'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {leaveDuration.valid ? `Leave duration: ${leaveDuration.label}` : leaveDuration.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reason + Quick Presets */}
                  <div className="space-y-2">
                    <label
                      htmlFor="leave-reason"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Reason / Description <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      id="leave-reason"
                      type="text"
                      required
                      maxLength={200}
                      placeholder="e.g., Annual Medical Leave, Conference, Vacation"
                      value={timeOffForm.reason}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900/70 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-colors"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {LEAVE_REASON_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTimeOffForm({ ...timeOffForm, reason: preset })}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium border transition-colors cursor-pointer ${
                            timeOffForm.reason === preset
                              ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500 text-[#0F766E] dark:text-teal-200'
                              : 'bg-slate-100 dark:bg-gray-900/70 border-slate-200/80 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsTimeOffModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={timeOffSubmitting || (leaveDuration && !leaveDuration.valid)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {timeOffSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                    <span>{timeOffSubmitting ? 'Saving...' : 'Schedule Leave'}</span>
                  </button>
                </div>
              </form>
            </div>
          </DialogOverlay>
        );
      })()}
    </div>
  );
}

export default AdminSchedulePage;
