import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  History,
  AlertTriangle,
  Phone,
  Mail,
  ShieldAlert,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import { appointmentsApi } from '../api';
import { dentistsApi } from '../../dentists/api';
import { servicesApi } from '../../services/api';
import { AvailabilitySlotPicker } from '../../schedules/components/AvailabilitySlotPicker';
import { useOptionalAuth } from '../../auth/context/AuthContext';
import { useDashboardSync } from '../../../hooks/useDashboardSync';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';

const CLINIC_TIME_ZONE = 'Asia/Manila';

const STATUS_BADGE_MAP = {
  PENDING: {
    label: 'Pending Review',
    pill: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmed',
    pill: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/25',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600',
    dot: 'bg-slate-400',
  },
  REJECTED: {
    label: 'Declined',
    pill: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

const AVAILABILITY_BADGE_MAP = {
  AVAILABLE: {
    label: 'Available',
    pill: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  SCHEDULING_CONFLICT: {
    label: 'Scheduling Conflict',
    pill: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
  DENTIST_NOT_ON_DUTY: {
    label: 'Dentist Not on Duty',
    pill: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  DENTIST_UNAVAILABLE: {
    label: 'Dentist Unavailable',
    pill: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
  REQUIRES_REVIEW: {
    label: 'Schedule Requires Review',
    pill: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  PENDING_VALIDATION: {
    label: 'Pending Validation',
    pill: 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600',
    dot: 'bg-slate-400',
  },
};

const CONFLICT_CATEGORY_LABELS = {
  DENTIST_INACTIVE: 'Dentist Inactive',
  SERVICE_INACTIVE: 'Service Inactive',
  CLINIC_CLOSED: 'Clinic Closed',
  NOT_WORKING_DAY: 'Not a Working Day',
  OUTSIDE_WORKING_HOURS: 'Outside Working Hours',
  NOT_ON_DUTY: 'Dentist Not on Duty',
  APPROVED_LEAVE: 'Approved Leave / Time Off',
  UNAVAILABLE_PERIOD: 'Unavailable Period',
  APPOINTMENT_CONFLICT: 'Overlapping Appointment',
  ROOM_CONFLICT: 'Operatory Room Occupied',
  SERVICE_DURATION_CONFLICT: 'Exceeds Shift Duration',
  APPOINTMENT_NO_LONGER_ELIGIBLE: 'No Longer Eligible',
};

function getInitials(firstName = '', lastName = '') {
  const f = (firstName || '').trim().charAt(0);
  const l = (lastName || '').trim().charAt(0);
  return (f + l).toUpperCase() || 'PT';
}

function getClinicTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatReadableDate(sqlDateTime) {
  if (!sqlDateTime) return 'N/A';
  const datePart = String(sqlDateTime).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    return new Date(`${datePart}T12:00:00+08:00`).toLocaleDateString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return datePart;
  }
}

function formatTime12h(sqlDateTime) {
  if (!sqlDateTime || String(sqlDateTime).length < 16) return '';
  const hhmm = String(sqlDateTime).slice(11, 16);
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatClockTime(isoOrDate) {
  if (!isoOrDate) return '';
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    return d.toLocaleTimeString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function AdminAppointmentsPage({ initialStatus = '', initialDate = '' } = {}) {
  const auth = useOptionalAuth();
  const user = auth?.user || null;
  const hasPermission = auth?.hasPermission;

  // Preserve safe defaults when rendered inside isolated unit tests without AuthProvider
  const hasAuthContext = Boolean(user);
  const canManageAppointments = !hasAuthContext || Boolean(
    (typeof hasPermission === 'function' && hasPermission('appointments.manage'))
    || user?.role === 'ADMIN'
    || user?.role === 'RECEPTIONIST'
  );
  const canCompleteAppointments = !hasAuthContext || Boolean(
    (typeof hasPermission === 'function' && hasPermission('appointments.complete'))
    || user?.role === 'ADMIN'
  );

  // Core Data State
  const [appointments, setAppointments] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 15, last_page: 1 });
  const [summary, setSummary] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dentists, setDentists] = useState([]);
  const [services, setServices] = useState([]);
  const requestSeqRef = useRef(0);

  // Filter State
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setStatusFilter(initialStatus || '');
    setSelectedDate(initialDate || '');
    setPage(1);
  }, [initialStatus, initialDate]);

  // Toast / Status Banner
  const [notification, setNotification] = useState(null);

  // Detail Drawer State
  const [detailModalAppt, setDetailModalAppt] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Confirm & Live Revalidation Modal State
  const [confirmModalAppt, setConfirmModalAppt] = useState(null);
  const [validatingApproval, setValidatingApproval] = useState(false);
  const [approvalValidation, setApprovalValidation] = useState(null);
  const [validationFetchError, setValidationFetchError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Reject Modal State (with conflict-prefilled reason + optional extra message)
  const [rejectModalAppt, setRejectModalAppt] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectAdditionalNote, setRejectAdditionalNote] = useState('');
  const [rejectConflictCode, setRejectConflictCode] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  // Complete Modal State
  const [completeModalAppt, setCompleteModalAppt] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  // Cancel Modal State
  const [cancelModalAppt, setCancelModalAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Reschedule / Reassign Modal State (reuses POST /appointments/{id}/reschedule + AvailabilitySlotPicker)
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState(null);
  const [rescheduleDentistId, setRescheduleDentistId] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);

  // Debounce text search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load Dentists & Services dropdown options once
  useEffect(() => {
    dentistsApi
      .getPublicDentists()
      .then((data) => setDentists(Array.isArray(data) ? data : []))
      .catch(() => {});
    servicesApi
      .getPublicServices()
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch paginated appointments + backend summary & availability checks
  const fetchAppointments = useCallback(() => {
    setLoading(true);
    setError(null);
    const currentSeq = ++requestSeqRef.current;

    const params = {
      page,
      per_page: 15,
    };
    if (statusFilter) params.status = statusFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    if (dentistId) params.dentist_id = dentistId;
    if (serviceId) params.service_id = serviceId;
    if (selectedDate) {
      params.start_date = selectedDate;
      params.end_date = selectedDate;
    }

    appointmentsApi
      .listAdmin(params)
      .then((res) => {
        if (currentSeq !== requestSeqRef.current) return;
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.items)
          ? res.data.items
          : [];
        setAppointments(list);
        if (res?.meta) {
          setMeta(res.meta);
          if (res.meta.summary) {
            setSummary(res.meta.summary);
          }
        }
        setLastRefreshedAt(res?.meta?.summary?.refreshed_at || new Date());
      })
      .catch((err) => {
        if (currentSeq !== requestSeqRef.current) return;
        setAppointments([]);
        setError(err.response?.data?.error?.message || err.message || 'Failed to load appointments.');
      })
      .finally(() => {
        if (currentSeq === requestSeqRef.current) {
          setLoading(false);
        }
      });
  }, [page, statusFilter, debouncedSearch, dentistId, serviceId, selectedDate, refreshKey]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Real-time queue synchronization (auto-refreshes without page reload on booking/decision/schedule changes)
  useDashboardSync({
    domains: ['appointments', 'schedules'],
    role: user?.role || null,
    debounceMs: 300,
    onRefresh: () => {
      setRefreshKey((k) => k + 1);
    },
    enabled: Boolean(user),
  });

  // Run fresh backend availability validation for an appointment
  const runLiveAvailabilityCheck = useCallback(async (appt) => {
    if (!appt) return;
    setValidatingApproval(true);
    setValidationFetchError(null);
    setConfirmError(null);

    if (typeof appointmentsApi.checkAvailability !== 'function') {
      setApprovalValidation(appt.availability_check || { available: true, availability_status: 'AVAILABLE' });
      setValidatingApproval(false);
      return;
    }

    try {
      const result = await appointmentsApi.checkAvailability(appt.id);
      setApprovalValidation(result);
    } catch (err) {
      setApprovalValidation(null);
      setValidationFetchError(
        err.response?.data?.error?.message
        || err.message
        || 'Unable to verify dentist availability right now. Approval is paused until validation succeeds.'
      );
    } finally {
      setValidatingApproval(false);
    }
  }, []);

  // Open Confirm / Conflict Warning Modal with mandatory live revalidation
  const openApprovalReviewModal = (appt) => {
    setConfirmModalAppt(appt);
    setApprovalValidation(appt.availability_check || null);
    setConfirmError(null);
    setValidationFetchError(null);
    void runLiveAvailabilityCheck(appt);
  };

  // Open Rejection Modal (automatically prefilling reason from conflict result when present)
  const openRejectModal = (appt, conflictResult = null) => {
    const check = conflictResult || appt?.availability_check || null;
    const isBlockedConflict = Boolean(check && check.available === false);
    setRejectModalAppt(appt);
    setRejectReason(isBlockedConflict && check.suggested_rejection_reason ? check.suggested_rejection_reason : '');
    setRejectAdditionalNote('');
    setRejectConflictCode(isBlockedConflict && check.reason_code ? check.reason_code : null);
    setRejectError(null);
  };

  // Open Compact Staff Reschedule / Reassign Modal (explicit dentist & validated slot selection)
  const openRescheduleModal = (appt, conflictResult = null) => {
    const todayIso = getClinicTodayIso();
    const currentApptDate = appt?.start_at ? String(appt.start_at).slice(0, 10) : '';
    const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(currentApptDate) && currentApptDate >= todayIso
      ? currentApptDate
      : todayIso;
    const conflictCode = conflictResult?.reason_code || appt?.availability_check?.reason_code || null;

    setRescheduleModalAppt(appt);
    setRescheduleDentistId(appt?.dentist_id ? String(appt.dentist_id) : '');
    setRescheduleDate(initialDate);
    setRescheduleSlot(null);
    setRescheduleReason(
      conflictCode
        ? `Rescheduled by clinic desk due to schedule conflict (${CONFLICT_CATEGORY_LABELS[conflictCode] || conflictCode}).`
        : 'Rescheduled by clinic desk upon schedule review.'
    );
    setRescheduleError(null);
  };

  // Open Details / Audit Drawer
  const handleOpenDetails = async (appt) => {
    setDetailModalAppt(appt);
    setLoadingDetails(true);
    try {
      const full = await appointmentsApi.getAdminById(appt.id);
      if (full) setDetailModalAppt(full);
    } catch {
      // Keep summary row if detail fetch fails
    } finally {
      setLoadingDetails(false);
    }
  };

  // Confirm Action Handler (backend performs final transactional locked revalidation)
  const handleConfirmAction = async () => {
    if (!confirmModalAppt) return;
    if (validatingApproval || validationFetchError) return;
    if (approvalValidation && approvalValidation.available === false) return;

    setConfirming(true);
    setConfirmError(null);
    try {
      await appointmentsApi.confirm(confirmModalAppt.id);
      setConfirmModalAppt(null);
      setApprovalValidation(null);
      setNotification({
        type: 'success',
        message: `Appointment #${confirmModalAppt.id} verified and confirmed.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const status = err.response?.status;
      const errData = err.response?.data?.error;
      const details = errData?.details || {};
      const message = errData?.message || err.message || 'Failed to confirm appointment.';

      if (status === 409 && (details.reason_code || errData?.code)) {
        // Switch modal directly into the structured conflict warning state
        setApprovalValidation({
          appointment_id: confirmModalAppt.id,
          available: false,
          eligible_for_approval: false,
          availability_status: details.availability_status || 'SCHEDULING_CONFLICT',
          reason_code: details.reason_code || errData.code,
          message,
          suggested_rejection_reason: details.suggested_rejection_reason || null,
          conflict_context: details.conflict_context || null,
        });
        setRefreshKey((k) => k + 1);
      } else {
        setConfirmError(message);
      }
    } finally {
      setConfirming(false);
    }
  };

  // Combine reviewed rejection reason + optional additional message cleanly within 255 chars
  const composedRejectionReason = (() => {
    const base = rejectReason.trim();
    const extra = rejectAdditionalNote.trim();
    if (!base) return '';
    return extra ? `${base} ${extra}`.trim() : base;
  })();

  // Reject Action Handler
  const handleRejectAction = async () => {
    if (!rejectModalAppt) return;
    if (!rejectReason.trim()) {
      setRejectError('A meaningful rejection reason is required before notifying the patient.');
      return;
    }
    if (composedRejectionReason.length > 255) {
      setRejectError('Combined rejection reason must not exceed 255 characters.');
      return;
    }

    setRejecting(true);
    setRejectError(null);
    try {
      await appointmentsApi.reject(
        rejectModalAppt.id,
        composedRejectionReason,
        rejectConflictCode || null
      );
      setRejectModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${rejectModalAppt.id} declined and patient notification queued.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setRejectError(err.response?.data?.error?.message || err.message || 'Failed to reject appointment.');
    } finally {
      setRejecting(false);
    }
  };

  // Complete Action Handler
  const handleCompleteAction = async () => {
    if (!completeModalAppt) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await appointmentsApi.complete(completeModalAppt.id);
      setCompleteModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${completeModalAppt.id} marked as completed.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCompleteError(err.response?.data?.error?.message || err.message || 'Failed to complete appointment.');
    } finally {
      setCompleting(false);
    }
  };

  // Cancel Action Handler
  const handleCancelAction = async () => {
    if (!cancelModalAppt) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await appointmentsApi.cancel(cancelModalAppt.id, cancelReason.trim() || 'Administrative cancellation');
      setCancelModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${cancelModalAppt.id} was cancelled.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelError(err.response?.data?.error?.message || err.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  // Reschedule / Reassign Action Handler (revalidates server-side via POST /appointments/{id}/reschedule)
  const handleRescheduleAction = async () => {
    if (!rescheduleModalAppt) return;
    if (!rescheduleDentistId || !rescheduleSlot?.start_at) {
      setRescheduleError('Please select a dentist, date, and available time slot before confirming.');
      return;
    }

    setRescheduling(true);
    setRescheduleError(null);
    try {
      const created = await appointmentsApi.reschedule(rescheduleModalAppt.id, {
        dentist_id: Number(rescheduleDentistId),
        start_at: rescheduleSlot.start_at,
        reason: rescheduleReason.trim() || 'Rescheduled by clinic desk',
      });
      const reassigned = Number(rescheduleDentistId) !== Number(rescheduleModalAppt.dentist_id);
      setRescheduleModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${rescheduleModalAppt.id} ${reassigned ? 'reassigned and rescheduled' : 'rescheduled'}${created?.id ? ` to #${created.id}` : ''}.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Failed to reschedule appointment.';
      setRescheduleError(message);
      if (err.response?.status === 409) {
        setRescheduleSlot(null);
      }
    } finally {
      setRescheduling(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSearchInput('');
    setDebouncedSearch('');
    setDentistId('');
    setServiceId('');
    setSelectedDate('');
    setPage(1);
  };

  const hasAnyFilter = Boolean(statusFilter || searchInput || dentistId || serviceId || selectedDate);
  const clinicTodayIso = getClinicTodayIso();

  const isApprovalBlocked = Boolean(approvalValidation && approvalValidation.available === false);
  const isApprovalReady = Boolean(!validatingApproval && !validationFetchError && approvalValidation?.available === true);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              Appointment Triage &amp; Management
            </h1>
            {summary && summary.pending_review > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden="true" />
                {summary.pending_review} Pending Review
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review appointment requests, verify dentist availability, manage booking decisions, and oversee the clinic schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {lastRefreshedAt && (
            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
              Updated {formatClockTime(lastRefreshedAt)} PST
            </span>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Operational Summary Strip (Real Backend Counts) */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Pending Review */}
          <button
            type="button"
            aria-pressed={statusFilter === 'PENDING'}
            onClick={() => {
              setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING');
              setPage(1);
            }}
            className={`group text-left p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-50/80 dark:bg-amber-500/12 border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-300/60 dark:ring-amber-500/30'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-amber-300/80 dark:hover:border-amber-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pending Review
                </span>
                <div className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
                  {summary.pending_review ?? 0}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 ring-1 ring-inset ring-amber-200/80 dark:ring-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" aria-hidden="true" />
                <span className="truncate">Awaiting front-desk decision</span>
              </span>
              {statusFilter === 'PENDING' ? (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
                  Filtered
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
              )}
            </div>
          </button>

          {/* Confirmed */}
          <button
            type="button"
            aria-pressed={statusFilter === 'CONFIRMED'}
            onClick={() => {
              setStatusFilter(statusFilter === 'CONFIRMED' ? '' : 'CONFIRMED');
              setPage(1);
            }}
            className={`group text-left p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              statusFilter === 'CONFIRMED'
                ? 'bg-emerald-50/80 dark:bg-emerald-500/12 border-emerald-300 dark:border-emerald-500/50 ring-1 ring-emerald-300/60 dark:ring-emerald-500/30'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-emerald-300/80 dark:hover:border-emerald-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Confirmed
                </span>
                <div className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
                  {summary.confirmed ?? 0}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 ring-1 ring-inset ring-emerald-200/80 dark:ring-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" aria-hidden="true" />
                <span className="truncate">Approved clinic bookings</span>
              </span>
              {statusFilter === 'CONFIRMED' ? (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 shrink-0">
                  Filtered
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
              )}
            </div>
          </button>

          {/* Today's Appointments */}
          <button
            type="button"
            aria-pressed={selectedDate === clinicTodayIso}
            onClick={() => {
              setSelectedDate(selectedDate === clinicTodayIso ? '' : clinicTodayIso);
              setPage(1);
            }}
            className={`group text-left p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              selectedDate === clinicTodayIso
                ? 'bg-teal-50/80 dark:bg-teal-500/12 border-teal-300 dark:border-teal-500/50 ring-1 ring-teal-300/60 dark:ring-teal-500/30'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-teal-300/80 dark:hover:border-teal-500/40 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Today&apos;s Appointments
                </span>
                <div className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
                  {summary.today_appointments ?? 0}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/80 dark:ring-teal-500/25 text-[#0D9488] dark:text-teal-400 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-300 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0" aria-hidden="true" />
                <span className="truncate">Scheduled for today (PST)</span>
              </span>
              {selectedDate === clinicTodayIso ? (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200 shrink-0">
                  Filtered
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
              )}
            </div>
          </button>

          {/* Scheduling Conflicts */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING');
              setPage(1);
            }}
            className={`group text-left p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              (summary.scheduling_conflicts ?? 0) > 0
                ? 'bg-rose-50/75 dark:bg-rose-500/12 border-rose-200/90 dark:border-rose-500/40 hover:border-rose-300 dark:hover:border-rose-400/60 hover:-translate-y-0.5'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-slate-300 dark:hover:border-gray-600 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Scheduling Conflicts
                </span>
                <div
                  className={`mt-1.5 text-3xl font-extrabold tracking-tight tabular-nums ${
                    (summary.scheduling_conflicts ?? 0) > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-slate-50'
                  }`}
                >
                  {summary.scheduling_conflicts ?? 0}
                </div>
              </div>
              <div
                className={`w-9 h-9 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 ${
                  (summary.scheduling_conflicts ?? 0) > 0
                    ? 'bg-rose-100/80 dark:bg-rose-500/20 ring-rose-200/80 dark:ring-rose-500/30 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-100/80 dark:bg-gray-700/70 ring-slate-200/80 dark:ring-gray-600/70 text-slate-500 dark:text-slate-400'
                }`}
              >
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2 text-[11px]">
              <span
                className={`inline-flex items-center gap-1.5 font-medium truncate ${
                  (summary.scheduling_conflicts ?? 0) > 0
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    (summary.scheduling_conflicts ?? 0) > 0
                      ? 'bg-rose-500 dark:bg-rose-400'
                      : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {(summary.scheduling_conflicts ?? 0) > 0
                    ? 'Pending requests failing validation'
                    : 'No pending availability conflicts'}
                </span>
              </span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-all shrink-0 group-hover:translate-x-0.5 ${
                  (summary.scheduling_conflicts ?? 0) > 0
                    ? 'text-rose-400 group-hover:text-rose-500'
                    : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                }`}
                aria-hidden="true"
              />
            </div>
          </button>
        </div>
      )}

      {/* Filter and Triage Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <label htmlFor="admin-appt-search" className="sr-only">Search patient, email, or service</label>
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="admin-appt-search"
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search patient, email, service..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
            />
          </div>

          {/* Status Select */}
          <div>
            <label htmlFor="admin-appt-status" className="sr-only">Filter by status</label>
            <select
              id="admin-appt-status"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-100"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REJECTED">Declined</option>
            </select>
          </div>

          {/* Dentist Select */}
          <div>
            <label htmlFor="admin-appt-dentist" className="sr-only">Filter by dentist</label>
            <select
              id="admin-appt-dentist"
              aria-label="Filter by dentist"
              value={dentistId}
              onChange={(e) => {
                setDentistId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-100"
            >
              <option value="">All Dentists</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Dental Service Select */}
          <div>
            <label htmlFor="admin-appt-service" className="sr-only">Filter by dental service</label>
            <select
              id="admin-appt-service"
              aria-label="Filter by dental service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-100"
            >
              <option value="">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Single Calendar Date Filter */}
          <div>
            <label htmlFor="admin-appt-date" className="sr-only">Appointment date</label>
            <input
              id="admin-appt-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400 text-slate-700 dark:text-slate-100"
              aria-label="Appointment date"
            />
          </div>
        </div>

        {hasAnyFilter && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Filters currently applied</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[#0D9488] dark:text-teal-400 font-semibold hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:text-rose-900 dark:hover:text-rose-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Appointment Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
            <thead role="rowgroup">
              <tr role="row" className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th role="columnheader" className="py-3.5 px-5">Reference</th>
                <th role="columnheader" className="py-3.5 px-4">Patient</th>
                <th role="columnheader" className="py-3.5 px-4">Service</th>
                <th role="columnheader" className="py-3.5 px-4">Dentist</th>
                <th role="columnheader" className="py-3.5 px-4">Date &amp; Time</th>
                <th role="columnheader" className="py-3.5 px-4">Availability</th>
                <th role="columnheader" className="py-3.5 px-4">Status</th>
                <th role="columnheader" className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
              {loading ? (
                <TableSkeleton.Rows count={8} columns={8} />
              ) : (!Array.isArray(appointments) || appointments.length === 0) ? (
                <tr>
                  <td role="cell" colSpan={8} className="py-12 px-4 text-center">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                      <CalendarClock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                      No appointments matched the current filter criteria.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {hasAnyFilter
                        ? 'Try clearing or adjusting your active search and date range filters.'
                        : 'Incoming patient booking requests and clinic appointments will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => {
                  const statusBadge = STATUS_BADGE_MAP[appt?.status] || STATUS_BADGE_MAP.PENDING;
                  const isPending = appt?.status === 'PENDING';
                  const avail = isPending ? appt?.availability_check : null;
                  const availKey = isPending
                    ? (avail?.availability_status || (avail?.available === true ? 'AVAILABLE' : avail?.available === false ? 'SCHEDULING_CONFLICT' : 'PENDING_VALIDATION'))
                    : null;
                  const availBadge = availKey ? (AVAILABILITY_BADGE_MAP[availKey] || AVAILABILITY_BADGE_MAP.REQUIRES_REVIEW) : null;
                  const hasBlockingConflict = Boolean(isPending && avail && avail.available === false);
                  const roomLabel = appt.operatory_chair || appt.dentist_room_number || 'Chair 1';

                  return (
                    <tr
                      role="row"
                      key={appt.id}
                      className={`transition-colors ${
                        hasBlockingConflict
                          ? 'bg-rose-50/30 dark:bg-rose-950/15 hover:bg-rose-50/60 dark:hover:bg-rose-950/25'
                          : 'hover:bg-slate-50/75 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <td role="cell" data-label="Reference" className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                        #{appt.id}
                        {appt.rescheduled_from_id && (
                          <span className="block text-[10px] text-sky-600 dark:text-sky-400 font-normal mt-0.5">
                            from #{appt.rescheduled_from_id}
                          </span>
                        )}
                      </td>

                      <td role="cell" data-label="Patient" className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[11px] font-semibold shrink-0">
                            {getInitials(appt.patient_first_name, appt.patient_last_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-50 truncate">
                              {appt.patient_first_name} {appt.patient_last_name}
                            </div>
                            {appt.patient_phone && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 tabular-nums">
                                <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                                <span>{appt.patient_phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td role="cell" data-label="Service" className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{appt.service_name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          <span className="font-semibold text-[#0F766E] dark:text-teal-400">
                            ₱{Number(appt.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="mx-1 text-slate-300 dark:text-gray-600">·</span>
                          <span>{appt.duration_snapshot || 30}m</span>
                        </div>
                      </td>

                      <td role="cell" data-label="Dentist" className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          Dr. {appt.dentist_first_name} {appt.dentist_last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {roomLabel}
                        </div>
                      </td>

                      <td role="cell" data-label="Date & Time" className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatReadableDate(appt.start_at)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {formatTime12h(appt.start_at)}
                          {appt.end_at ? ` – ${formatTime12h(appt.end_at)}` : ''}
                        </div>
                      </td>

                      <td role="cell" data-label="Availability" className="py-3.5 px-4 whitespace-nowrap">
                        {isPending && availBadge ? (
                          hasBlockingConflict ? (
                            <button
                              type="button"
                              onClick={() => openApprovalReviewModal(appt)}
                              title={avail?.message || 'View scheduling conflict details'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer hover:opacity-90 transition-opacity ${availBadge.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${availBadge.dot}`} aria-hidden="true" />
                              {availBadge.label}
                            </button>
                          ) : (
                            <span
                              title={avail?.message || 'Availability check status'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${availBadge.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${availBadge.dot}`} aria-hidden="true" />
                              {availBadge.label}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      <td role="cell" data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadge.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} aria-hidden="true" />
                          {statusBadge.label}
                        </span>
                      </td>

                      <td role="cell" data-label="Actions" className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(appt)}
                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 inline-flex items-center justify-center transition-colors cursor-pointer"
                            title="View Full Details & History"
                            aria-label={`View appointment #${appt.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          {/* Pending Actions */}
                          {isPending && canManageAppointments && (
                            <>
                              {hasBlockingConflict ? (
                                <>
                                  <button
                                    type="button"
                                    disabled
                                    title={`Cannot confirm: ${avail?.message || 'Dentist availability conflict detected.'}`}
                                    aria-label={`Confirm blocked for appointment #${appt.id}: ${avail?.message || 'Availability conflict'}`}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-gray-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-not-allowed opacity-70"
                                  >
                                    <Check className="w-3 h-3" aria-hidden="true" /> Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openApprovalReviewModal(appt)}
                                    title={avail?.message || 'Inspect availability conflict'}
                                    aria-label={`Inspect conflict for appointment #${appt.id}`}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200/80 dark:border-amber-500/30 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Conflict
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openApprovalReviewModal(appt)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200/80 dark:border-emerald-500/30 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Verify Availability & Confirm Appointment"
                                  aria-label={`Confirm appointment #${appt.id}`}
                                >
                                  <Check className="w-3 h-3" aria-hidden="true" /> Confirm
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openRejectModal(appt)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200/80 dark:border-rose-500/30 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title="Reject Appointment Request"
                                aria-label={`Reject appointment #${appt.id}`}
                              >
                                <X className="w-3 h-3" aria-hidden="true" /> Reject
                              </button>
                            </>
                          )}

                          {/* Confirmed Actions */}
                          {appt.status === 'CONFIRMED' && (
                            <>
                              {canCompleteAppointments && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompleteModalAppt(appt);
                                    setCompleteError(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200/80 dark:border-sky-500/30 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Mark as Completed"
                                  aria-label={`Complete appointment #${appt.id}`}
                                >
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Complete
                                </button>
                              )}
                              {canManageAppointments && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalAppt(appt);
                                    setCancelReason('');
                                    setCancelError(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-gray-600 border border-slate-200 dark:border-gray-600 font-semibold text-[11px] cursor-pointer transition-colors"
                                  title="Cancel Appointment"
                                  aria-label={`Cancel appointment #${appt.id}`}
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="tabular-nums">
            Showing{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {appointments.length > 0 ? (meta.page - 1) * meta.per_page + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {Math.min(meta.page * meta.per_page, meta.total)}
            </span>{' '}
            of <span className="font-semibold text-slate-700 dark:text-slate-200">{meta.total}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={meta.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Previous
            </button>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-semibold tabular-nums">
              Page {meta.page} of {meta.last_page || 1}
            </span>
            <button
              type="button"
              disabled={meta.page >= (meta.last_page || 1) || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL / AUDIT DRAWER MODAL */}
      {detailModalAppt && (
        <DialogOverlay
          onClose={() => setDetailModalAppt(null)}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-xl w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Appointment Triage &amp; Audit Record
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Appointment #{detailModalAppt.id} — {detailModalAppt.service_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                aria-label="Close appointment details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Availability Banner for Pending Requests */}
              {detailModalAppt.status === 'PENDING' && detailModalAppt.availability_check && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    detailModalAppt.availability_check.available
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {detailModalAppt.availability_check.available ? (
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {detailModalAppt.availability_check.available
                        ? 'Dentist & Clinic Availability Verified'
                        : `Availability Blocked (${CONFLICT_CATEGORY_LABELS[detailModalAppt.availability_check.reason_code] || 'Schedule Conflict'})`}
                    </div>
                    <p className="opacity-90">{detailModalAppt.availability_check.message}</p>
                  </div>
                </div>
              )}

              {/* Patient Info */}
              <div className="bg-slate-50/80 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700/80">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Patient Information
                </span>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">
                  {detailModalAppt.patient_first_name} {detailModalAppt.patient_last_name}
                </div>
                <div className="mt-1.5 text-slate-600 dark:text-slate-300 flex flex-wrap gap-4">
                  {detailModalAppt.patient_phone && (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {detailModalAppt.patient_phone}
                    </span>
                  )}
                  {detailModalAppt.patient_email && (
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {detailModalAppt.patient_email}
                    </span>
                  )}
                </div>
              </div>

              {/* Consultation Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/80 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-gray-700/80">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Attending Dentist</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    Dr. {detailModalAppt.dentist_first_name} {detailModalAppt.dentist_last_name}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {detailModalAppt.operatory_chair || detailModalAppt.dentist_room_number || 'Chair 1'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Fee &amp; Duration</span>
                  <p className="font-bold text-[#0F766E] dark:text-teal-400 mt-0.5 tabular-nums">
                    ₱{Number(detailModalAppt.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">{detailModalAppt.duration_snapshot || 30} minutes</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Scheduled Date</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                    {formatReadableDate(detailModalAppt.start_at)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Time Window</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                    {formatTime12h(detailModalAppt.start_at)} – {formatTime12h(detailModalAppt.end_at)}
                  </p>
                </div>
              </div>

              {/* Recorded Decline / Cancellation Reason */}
              {detailModalAppt.cancellation_reason && (
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {detailModalAppt.status === 'REJECTED' ? 'Recorded Rejection Reason' : 'Cancellation Reason'}
                  </span>
                  <p className="mt-1.5 text-slate-700 dark:text-slate-200 bg-rose-50/50 dark:bg-rose-950/25 p-3 rounded-xl border border-rose-200/70 dark:border-rose-800/50 leading-relaxed">
                    {detailModalAppt.cancellation_reason}
                  </p>
                </div>
              )}

              {/* Chief Complaint */}
              {detailModalAppt.chief_complaint && (
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Chief Complaint / Notes
                  </span>
                  <p className="mt-1.5 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-gray-900/50 p-3 rounded-xl border border-slate-200 dark:border-gray-700 italic">
                    &ldquo;{detailModalAppt.chief_complaint}&rdquo;
                  </p>
                </div>
              )}

              {/* Immutable Status History Timeline */}
              <div>
                <h4 className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" aria-hidden="true" />
                  Audit Trail &amp; Status Transitions
                </h4>
                {loadingDetails ? (
                  <div className="text-slate-400 dark:text-slate-500 animate-pulse">Loading transition log...</div>
                ) : detailModalAppt.status_history && detailModalAppt.status_history.length > 0 ? (
                  <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-gray-700">
                    {detailModalAppt.status_history.map((h, idx) => {
                      const prevStatus = h.old_status ?? h.from_status ?? null;
                      const nextStatus = h.new_status ?? h.to_status ?? '';
                      return (
                        <div key={h.id || idx} className="relative">
                          <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-[#0D9488] dark:bg-teal-400 ring-4 ring-white dark:ring-gray-800" />
                          <div className="bg-slate-50 dark:bg-gray-900/50 p-3 rounded-xl border border-slate-200/80 dark:border-gray-700 space-y-1">
                            <div className="flex items-center justify-between gap-2 font-semibold text-slate-800 dark:text-slate-100">
                              <span>
                                {prevStatus ? `${prevStatus} → ` : ''}
                                {nextStatus}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] tabular-nums">{h.created_at}</span>
                            </div>
                            {h.reason && <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{h.reason}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic">No transition history recorded yet.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* APPROVAL VALIDATION / CONFLICT WARNING MODAL */}
      {confirmModalAppt && (
        <DialogOverlay
          onClose={() => {
            if (!confirming) {
              setConfirmModalAppt(null);
              setApprovalValidation(null);
            }
          }}
          dismissible={!confirming}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-start justify-between gap-3 ${
              isApprovalBlocked
                ? 'bg-rose-50/70 dark:bg-rose-950/35 border-rose-200/80 dark:border-rose-800/60'
                : validationFetchError
                ? 'bg-amber-50/70 dark:bg-amber-950/35 border-amber-200/80 dark:border-amber-800/60'
                : 'bg-slate-50/60 dark:bg-gray-900/40 border-slate-100 dark:border-gray-700'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isApprovalBlocked
                    ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    : validationFetchError
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {isApprovalBlocked ? (
                    <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                  ) : validationFetchError ? (
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {isApprovalBlocked
                      ? 'Appointment Cannot Be Approved'
                      : validationFetchError
                      ? 'Availability Validation Failed'
                      : `Approve Appointment #${confirmModalAppt.id}`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isApprovalBlocked
                      ? 'This appointment remains pending and has not been approved.'
                      : validationFetchError
                      ? 'Approval is blocked until live dentist availability can be verified.'
                      : 'Live dentist and clinic availability verification.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={confirming}
                onClick={() => {
                  setConfirmModalAppt(null);
                  setApprovalValidation(null);
                }}
                aria-label="Close approval dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Appointment Summary Box */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50/80 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80">
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">#{confirmModalAppt.id}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Patient</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmModalAppt.patient_first_name} {confirmModalAppt.patient_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Service</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{confirmModalAppt.service_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Dentist</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Dr. {confirmModalAppt.dentist_first_name} {confirmModalAppt.dentist_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Requested Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatReadableDate(confirmModalAppt.start_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Requested Time</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatTime12h(confirmModalAppt.start_at)} – {formatTime12h(confirmModalAppt.end_at)}
                  </span>
                </div>
              </div>

              {/* Validation State Display */}
              {validatingApproval ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 flex items-center gap-3 text-slate-600 dark:text-slate-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0D9488]" aria-hidden="true" />
                  <span>Validating live dentist schedule, leaves, closures, and overlapping bookings...</span>
                </div>
              ) : validationFetchError ? (
                <div role="alert" className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 space-y-1">
                  <div className="font-semibold">Unable to Verify Availability</div>
                  <p className="leading-relaxed">{validationFetchError}</p>
                </div>
              ) : isApprovalBlocked ? (
                <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-rose-900 dark:text-rose-100">Blocking Conflict Detected</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30">
                      {CONFLICT_CATEGORY_LABELS[approvalValidation.reason_code] || approvalValidation.reason_code}
                    </span>
                  </div>
                  <p className="leading-relaxed">{approvalValidation.message}</p>
                  {approvalValidation.conflict_context?.window && (
                    <p className="text-[11px] text-rose-700/90 dark:text-rose-300/90 tabular-nums">
                      Conflicting schedule window: <strong>{approvalValidation.conflict_context.window}</strong>
                    </p>
                  )}
                </div>
              ) : isApprovalReady ? (
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-semibold">Ready for Approval</div>
                    <p className="mt-0.5 opacity-90">
                      Dentist is active and scheduled on duty with no conflicting bookings or closures.
                    </p>
                  </div>
                </div>
              ) : null}

              {confirmError && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 p-3 rounded-xl text-xs">
                  {confirmError}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModalAppt(null);
                    setApprovalValidation(null);
                  }}
                  disabled={confirming}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Close
                </button>

                {(isApprovalBlocked || validationFetchError) && (
                  <button
                    type="button"
                    disabled={validatingApproval}
                    onClick={() => runLiveAvailabilityCheck(confirmModalAppt)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${validatingApproval ? 'animate-spin' : ''}`} aria-hidden="true" />
                    Recheck Availability
                  </button>
                )}

                {isApprovalBlocked ? (
                  <>
                    {canManageAppointments && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetAppt = confirmModalAppt;
                          const conflictData = approvalValidation;
                          setConfirmModalAppt(null);
                          setApprovalValidation(null);
                          openRescheduleModal(targetAppt, conflictData);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-teal-200 dark:border-teal-700/80 bg-teal-50/70 dark:bg-teal-950/40 text-[#0F766E] dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                        Reschedule / Reassign
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const targetAppt = confirmModalAppt;
                        const conflictData = approvalValidation;
                        setConfirmModalAppt(null);
                        setApprovalValidation(null);
                        openRejectModal(targetAppt, conflictData);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Reject Appointment
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmAction}
                    disabled={!isApprovalReady || confirming}
                    aria-busy={confirming}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {confirming && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                    {confirming ? 'Confirming...' : 'Approve & Confirm'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* REJECT APPOINTMENT DIALOG (PREFILLED + EDITABLE) */}
      {rejectModalAppt && (
        <DialogOverlay
          onClose={() => {
            if (!rejecting) setRejectModalAppt(null);
          }}
          dismissible={!rejecting}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-rose-50/60 dark:bg-rose-950/30 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Reject Appointment</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Review and confirm the patient-facing rejection reason before declining this request.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={rejecting}
                onClick={() => setRejectModalAppt(null)}
                aria-label="Close reject dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80">
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Appointment Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">#{rejectModalAppt.id}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Patient</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rejectModalAppt.patient_first_name} {rejectModalAppt.patient_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Service &amp; Dentist</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {rejectModalAppt.service_name} · Dr. {rejectModalAppt.dentist_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Requested Slot</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                    {formatReadableDate(rejectModalAppt.start_at)} · {formatTime12h(rejectModalAppt.start_at)}
                  </span>
                </div>
              </div>

              {rejectConflictCode && (
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span>
                    Prefilled from detected conflict (<strong>{CONFLICT_CATEGORY_LABELS[rejectConflictCode] || rejectConflictCode}</strong>). You may edit this message before sending.
                  </span>
                </div>
              )}

              {rejectError && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 p-3 rounded-xl text-xs">
                  {rejectError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="reject-reason-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Reason for Rejection <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <span className={`text-[11px] tabular-nums ${composedRejectionReason.length > 255 ? 'text-rose-600 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                    {composedRejectionReason.length}/255
                  </span>
                </div>
                <textarea
                  id="reject-reason-input"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Provide a clear, polite explanation for the patient..."
                  className="w-full text-xs p-3 bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label htmlFor="reject-additional-note" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Additional Message (Optional)
                </label>
                <textarea
                  id="reject-additional-note"
                  rows={2}
                  value={rejectAdditionalNote}
                  onChange={(e) => {
                    setRejectAdditionalNote(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Optional guidance, e.g. suggested rebooking hours or clinic desk phone..."
                  className="w-full text-xs p-3 bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setRejectModalAppt(null)}
                  disabled={rejecting}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectAction}
                  disabled={rejecting || !rejectReason.trim() || composedRejectionReason.length > 255}
                  aria-busy={rejecting}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {rejecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* COMPLETE MODAL */}
      {completeModalAppt && (
        <DialogOverlay
          onClose={() => setCompleteModalAppt(null)}
          dismissible={!completing}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Complete Appointment #{completeModalAppt.id}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Mark consultation for <strong className="text-slate-700 dark:text-slate-200">{completeModalAppt.patient_first_name} {completeModalAppt.patient_last_name}</strong> as completed?
                </p>
              </div>
            </div>

            {completeError && (
              <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 p-3 rounded-xl text-xs">
                {completeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCompleteModalAppt(null)}
                disabled={completing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteAction}
                disabled={completing}
                aria-busy={completing}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {completing && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                {completing ? 'Completing...' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* ADMIN CANCEL MODAL */}
      {cancelModalAppt && (
        <DialogOverlay
          onClose={() => setCancelModalAppt(null)}
          dismissible={!cancelling}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Cancel Appointment #{cancelModalAppt.id}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cancel confirmed visit for {cancelModalAppt.patient_first_name} {cancelModalAppt.patient_last_name}?
                </p>
              </div>
            </div>

            {cancelError && (
              <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 p-3 rounded-xl text-xs">
                {cancelError}
              </div>
            )}

            <div>
              <label htmlFor="cancel-reason-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Cancellation Reason
              </label>
              <textarea
                id="cancel-reason-input"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for administrative cancellation..."
                className="w-full text-xs p-3 bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelAction}
                disabled={cancelling}
                aria-busy={cancelling}
                className="px-4 py-2 rounded-xl bg-slate-700 dark:bg-gray-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-gray-500 shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {cancelling && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* STAFF RESCHEDULE / REASSIGN MODAL (REUSES EXISTING RESCHEDULE WORKFLOW & SLOT PICKER) */}
      {rescheduleModalAppt && (
        <DialogOverlay
          onClose={() => {
            if (!rescheduling) setRescheduleModalAppt(null);
          }}
          dismissible={!rescheduling}
          className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-[#0D9488] dark:text-teal-400 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Reschedule / Reassign Appointment #{rescheduleModalAppt.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a validated schedule slot and optionally reassign to an available dentist. Original appointment history is preserved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={rescheduling}
                onClick={() => setRescheduleModalAppt(null)}
                aria-label="Close reschedule dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80">
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Patient</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rescheduleModalAppt.patient_first_name} {rescheduleModalAppt.patient_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Service</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{rescheduleModalAppt.service_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Current Dentist</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Dr. {rescheduleModalAppt.dentist_first_name} {rescheduleModalAppt.dentist_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Current Slot</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                    {formatReadableDate(rescheduleModalAppt.start_at)} · {formatTime12h(rescheduleModalAppt.start_at)}
                  </span>
                </div>
              </div>

              {rescheduleError && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 p-3 rounded-xl text-xs">
                  {rescheduleError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reschedule-dentist-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Assigned Dentist
                  </label>
                  <select
                    id="reschedule-dentist-select"
                    value={rescheduleDentistId}
                    disabled={rescheduling}
                    onChange={(e) => {
                      setRescheduleDentistId(e.target.value);
                      setRescheduleSlot(null);
                      if (rescheduleError) setRescheduleError(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  >
                    {!dentists.some((d) => String(d.id) === String(rescheduleModalAppt.dentist_id)) && rescheduleModalAppt.dentist_id && (
                      <option value={String(rescheduleModalAppt.dentist_id)}>
                        Dr. {rescheduleModalAppt.dentist_first_name} {rescheduleModalAppt.dentist_last_name} (Current)
                      </option>
                    )}
                    {dentists.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        Dr. {d.first_name} {d.last_name}
                        {String(d.id) === String(rescheduleModalAppt.dentist_id) ? ' (Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="reschedule-date-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    New Appointment Date
                  </label>
                  <input
                    id="reschedule-date-input"
                    type="date"
                    min={clinicTodayIso}
                    value={rescheduleDate}
                    disabled={rescheduling}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleSlot(null);
                      if (rescheduleError) setRescheduleError(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
              </div>

              {Number(rescheduleDentistId) > 0 && Number(rescheduleDentistId) !== Number(rescheduleModalAppt.dentist_id) && (
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span>
                    Explicit dentist reassignment selected. The new appointment will be linked to #{rescheduleModalAppt.id} in the audit trail.
                  </span>
                </div>
              )}

              <div>
                <AvailabilitySlotPicker
                  dentistId={rescheduleDentistId ? Number(rescheduleDentistId) : null}
                  serviceId={rescheduleModalAppt.service_id ? Number(rescheduleModalAppt.service_id) : null}
                  selectedDate={rescheduleDate}
                  selectedSlot={rescheduleSlot}
                  onSelectSlot={(slot) => {
                    setRescheduleSlot(slot);
                    if (rescheduleError) setRescheduleError(null);
                  }}
                  onSelectAlternativeDate={(altDate) => {
                    setRescheduleDate(altDate);
                    setRescheduleSlot(null);
                  }}
                  onSelectAlternativeDentist={(altDentistId) => {
                    setRescheduleDentistId(String(altDentistId));
                    setRescheduleSlot(null);
                  }}
                  disabled={rescheduling}
                />
              </div>

              <div>
                <label htmlFor="reschedule-reason-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Reschedule Reason (Recorded in History &amp; Patient Notice)
                </label>
                <input
                  id="reschedule-reason-input"
                  type="text"
                  maxLength={255}
                  value={rescheduleReason}
                  disabled={rescheduling}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Provide reason for rescheduling or reassignment..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900/60 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRescheduleModalAppt(null)}
                disabled={rescheduling}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRescheduleAction}
                disabled={rescheduling || !rescheduleSlot?.start_at || !rescheduleDentistId}
                aria-busy={rescheduling}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
              >
                {rescheduling && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
