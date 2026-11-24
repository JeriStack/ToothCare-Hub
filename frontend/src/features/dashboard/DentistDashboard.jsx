import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Coffee,
  CheckCircle2,
  Stethoscope,
  RefreshCw,
  FileText,
  AlertTriangle,
  ChevronRight,
  Shield,
  ArrowRight,
  Search,
  Filter,
  X,
  Plus,
  AlertCircle,
  Phone,
  Sparkles,
  Award,
} from 'lucide-react';
import { schedulesApi } from '../schedules/api';
import { appointmentsApi } from '../appointments/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
];

const LEAVE_REASON_PRESETS = [
  'Annual Dental Conference (CME)',
  'Annual Vacation Leave',
  'Medical / Sick Leave',
  'Personal Time Off',
];

function computeLeaveDurationSummary(startAt, endAt) {
  if (!startAt || !endAt) return null;
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  const diffMs = endMs - startMs;
  if (diffMs <= 0) {
    return {
      valid: false,
      label: 'End date and time must be strictly after the start date and time.',
    };
  }
  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  return { valid: true, label: parts.join(', ') || 'Less than 1 minute' };
}

function formatManilaDateTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatAppointmentTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateStr.slice(11, 16);
  }
}

function formatAppointmentDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr.slice(0, 10);
  }
}

function formatShiftTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = String(timeStr).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(timeStr).slice(0, 5);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function getShiftMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hStr, mStr] = String(timeStr).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function getManilaDayOfWeek() {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
    }).format(new Date());
    const found = DAYS_OF_WEEK.find((d) => d.name.toLowerCase() === weekday.toLowerCase());
    return found ? found.id : null;
  } catch {
    return null;
  }
}

export function DentistDashboard({ dentistId = 1, onNavigateTab, onSelectAppointment }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [timeOffList, setTimeOffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Real-time Manila clinic clock
  const [liveClinicTime, setLiveClinicTime] = useState(() => formatManilaDateTime());

  // Today's Queue interactive filters
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState('ALL');

  // Leave Request Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    start_at: '',
    end_at: '',
    reason: 'Annual Dental Conference (CME)',
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [leaveSuccess, setLeaveSuccess] = useState(null);
  const leaveDialogRef = useRef(null);

  const closeLeaveModal = () => {
    if (leaveSubmitting) return;
    setIsLeaveModalOpen(false);
    setLeaveError(null);
    setLeaveSuccess(null);
  };

  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (!dialog) return;

    if (isLeaveModalOpen) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }, [isLeaveModalOpen]);

  const leaveDurationSummary = useMemo(
    () => computeLeaveDurationSummary(leaveForm.start_at, leaveForm.end_at),
    [leaveForm.start_at, leaveForm.end_at]
  );

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClinicTime(formatManilaDateTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboard = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [dash, s, t] = await Promise.all([
        appointmentsApi.getDentistDashboard().catch(() => null),
        schedulesApi.getDentistSchedules(dentistId).catch(() => []),
        schedulesApi.getDentistTimeOff(dentistId).catch(() => []),
      ]);

      const resolvedDentistId = Number(dash?.dentist?.id || 0);
      let finalShifts = Array.isArray(s) ? s : [];
      let finalTimeOff = Array.isArray(t) ? t : [];

      if (resolvedDentistId > 0 && resolvedDentistId !== Number(dentistId)) {
        const [resolvedShifts, resolvedTimeOff] = await Promise.all([
          schedulesApi.getDentistSchedules(resolvedDentistId).catch(() => finalShifts),
          schedulesApi.getDentistTimeOff(resolvedDentistId).catch(() => finalTimeOff),
        ]);
        finalShifts = Array.isArray(resolvedShifts) ? resolvedShifts : finalShifts;
        finalTimeOff = Array.isArray(resolvedTimeOff) ? resolvedTimeOff : finalTimeOff;
      }

      setDashboardData(dash);
      setShifts(finalShifts);
      setTimeOffList(finalTimeOff);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dentist dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [dentistId]);

  useDashboardSync({
    role: 'DENTIST',
    domains: [
      DASHBOARD_SYNC_DOMAINS.DENTIST_DASHBOARD,
      DASHBOARD_SYNC_DOMAINS.APPOINTMENTS,
      DASHBOARD_SYNC_DOMAINS.SCHEDULES,
    ],
    onRefresh: () => fetchDashboard(true),
  });

  // Handle Leave Request Submission
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLeaveSubmitting(true);
    setLeaveError(null);
    setLeaveSuccess(null);

    try {
      if (!leaveForm.start_at || !leaveForm.end_at || !leaveForm.reason.trim()) {
        throw new Error('Please fill in all required leave details.');
      }
      if (new Date(leaveForm.start_at) >= new Date(leaveForm.end_at)) {
        throw new Error('End date and time must be strictly after the start date and time.');
      }

      await schedulesApi.requestTimeOff({
        start_at: leaveForm.start_at.replace('T', ' ') + ':00',
        end_at: leaveForm.end_at.replace('T', ' ') + ':00',
        reason: leaveForm.reason.trim(),
      });

      setLeaveSuccess('Leave request submitted successfully! Awaiting administrative review.');
      setLeaveForm({
        start_at: '',
        end_at: '',
        reason: 'Annual Dental Conference (CME)',
      });

      // Refresh time-off list using resolved dentist profile ID
      const targetDentistId = Number(dashboardData?.dentist?.id || dentistId);
      const updatedTimeOff = await schedulesApi.getDentistTimeOff(targetDentistId).catch(() => []);
      setTimeOffList(Array.isArray(updatedTimeOff) ? updatedTimeOff : []);

      setTimeout(() => {
        setIsLeaveModalOpen(false);
        setLeaveSuccess(null);
      }, 2000);
    } catch (err) {
      setLeaveError(
        err.response?.data?.error?.message || err.message || 'Failed to submit leave request.'
      );
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // Deduplicate active recurring shifts & sort chronologically per day so repeated rows never clutter the grid
  const uniqueActiveShifts = useMemo(() => {
    const seen = new Set();
    const cleaned = [];
    for (const sh of shifts) {
      if (sh?.is_active === 0 || sh?.is_active === false) continue;
      const dow = Number(sh?.day_of_week || 0);
      const startKey = String(sh?.start_time || '').slice(0, 5);
      const endKey = String(sh?.end_time || '').slice(0, 5);
      const chairKey = String(sh?.operatory_chair || 'Operatory Chair 1').trim().toLowerCase();
      const dedupeKey = `${dow}|${startKey}|${endKey}|${chairKey}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      cleaned.push({ ...sh, day_of_week: dow });
    }
    return cleaned.sort(
      (a, b) => a.day_of_week - b.day_of_week || String(a.start_time || '').localeCompare(String(b.start_time || ''))
    );
  }, [shifts]);

  const weeklyScheduleSummary = useMemo(() => {
    const workingDays = new Set(uniqueActiveShifts.map((s) => s.day_of_week)).size;
    const totalMinutes = uniqueActiveShifts.reduce((acc, s) => {
      const diff = getShiftMinutes(s.end_time) - getShiftMinutes(s.start_time);
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    return { workingDays, totalHours };
  }, [uniqueActiveShifts]);

  const currentManilaDayId = useMemo(() => getManilaDayOfWeek(), []);

  if (loading) {
    return <DashboardSkeleton role="dentist" />;
  }

  const metrics = {
    todayCount: dashboardData?.today_count ?? 0,
    upcomingCount: dashboardData?.upcoming_count ?? 0,
    pendingCount: dashboardData?.pending_count ?? 0,
    completedCount: dashboardData?.completed_count ?? 0,
  };

  const todayAppts = dashboardData?.today_appointments || [];
  const clinician = dashboardData?.dentist;
  const nextAppt = dashboardData?.next_appointment;
  const activitySummary = dashboardData?.activity_summary || {
    completed_this_week: 0,
    upcoming_this_week: 0,
    pending_documentation_count: 0,
    cancelled_this_week: 0,
  };

  // Filtered Today's Queue
  const filteredQueue = todayAppts.filter((appt) => {
    if (queueStatusFilter !== 'ALL' && appt.status !== queueStatusFilter) {
      return false;
    }
    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase().trim();
      const patientName = `${appt.patient_first_name || ''} ${appt.patient_last_name || ''}`.toLowerCase();
      const service = (appt.service_name || '').toLowerCase();
      const chair = (appt.operatory_chair || '').toLowerCase();
      return patientName.includes(q) || service.includes(q) || chair.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12304A] dark:text-slate-100">Clinical Practice Overview</h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <Stethoscope className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              Dentist Workspace
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {clinician
              ? `Welcome back, Dr. ${clinician.first_name} ${clinician.last_name} (${clinician.specialization || 'Dental Practitioner'}) • PRC: ${clinician.license_number || 'Registered'}`
              : 'Your assigned daily schedule, patient appointments, and clinical treatment records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Manila Clinic Clock */}
          <div
            title="Clinic Local Time (Asia/Manila)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-medium shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="whitespace-nowrap">{liveClinicTime}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            title="Refresh clinical metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95 transition-all shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            className="text-xs font-bold underline hover:text-rose-900 dark:hover:text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. 4 Live Metric Stat Cards */}
      <div className="portal-grid-4">
        {[
          {
            key: 'today',
            label: "Today's Visits",
            value: metrics.todayCount,
            subtitle: 'Scheduled for today',
            ariaLabel: `Today's Visits: ${metrics.todayCount} scheduled`,
            targetTab: 'appointments',
            Icon: Calendar,
            accentBar: 'from-teal-500/80 via-teal-400/60 to-transparent',
            glow: 'group-hover:bg-teal-500/10 dark:group-hover:bg-teal-400/10',
            hoverBorder: 'hover:border-teal-300/90 dark:hover:border-teal-500/50',
            iconWrap:
              'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-teal-200/80 dark:ring-teal-500/25',
            dot: 'bg-teal-500 dark:bg-teal-400',
            subText: 'text-teal-700 dark:text-teal-300',
          },
          {
            key: 'upcoming',
            label: 'Upcoming Confirmed',
            value: metrics.upcomingCount,
            subtitle: 'Confirmed clinical visits',
            ariaLabel: `Upcoming Confirmed: ${metrics.upcomingCount} visits`,
            targetTab: 'appointments',
            Icon: CheckCircle2,
            accentBar: 'from-emerald-500/80 via-emerald-400/60 to-transparent',
            glow: 'group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-400/10',
            hoverBorder: 'hover:border-emerald-300/90 dark:hover:border-emerald-500/50',
            iconWrap:
              'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200/80 dark:ring-emerald-500/25',
            dot: 'bg-emerald-500 dark:bg-emerald-400',
            subText: 'text-emerald-700 dark:text-emerald-300',
          },
          {
            key: 'pending',
            label: 'Awaiting Review',
            value: metrics.pendingCount,
            subtitle: 'Pending approval',
            ariaLabel: `Awaiting Review: ${metrics.pendingCount} visits`,
            targetTab: 'appointments',
            Icon: Clock,
            accentBar: 'from-amber-500/85 via-amber-400/60 to-transparent',
            glow: 'group-hover:bg-amber-500/10 dark:group-hover:bg-amber-400/10',
            hoverBorder: 'hover:border-amber-300/90 dark:hover:border-amber-500/50',
            iconWrap:
              'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-200/80 dark:ring-amber-500/25',
            dot: 'bg-amber-500 dark:bg-amber-400',
            subText: 'text-amber-700 dark:text-amber-300',
          },
          {
            key: 'completed',
            label: 'Completed Care',
            value: metrics.completedCount,
            subtitle: 'Treated & documented',
            ariaLabel: `Completed Care: ${metrics.completedCount} visits`,
            targetTab: 'treatment-records',
            Icon: Stethoscope,
            accentBar: 'from-sky-500/85 via-blue-400/60 to-transparent',
            glow: 'group-hover:bg-sky-500/10 dark:group-hover:bg-sky-400/10',
            hoverBorder: 'hover:border-sky-300/90 dark:hover:border-sky-500/50',
            iconWrap:
              'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-200/80 dark:ring-sky-500/25',
            dot: 'bg-sky-500 dark:bg-sky-400',
            subText: 'text-sky-700 dark:text-sky-300',
          },
        ].map(({ key, label, value, subtitle, ariaLabel, targetTab, Icon, accentBar, glow, hoverBorder, iconWrap, dot, subText }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigateTab && onNavigateTab(targetTab)}
            aria-label={ariaLabel}
            className={`relative overflow-hidden text-left p-5 rounded-2xl bg-white dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 ${hoverBorder} transition-all duration-200 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]`}
          >
            {/* Subtle Top Accent Hairline */}
            <span
              className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${accentBar} opacity-75 group-hover:opacity-100 transition-opacity`}
              aria-hidden="true"
            />
            {/* Soft Corner Ambient Glow */}
            <span
              className={`pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full bg-transparent ${glow} blur-2xl transition-colors duration-300`}
              aria-hidden="true"
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {label}
                </span>
                <div className="mt-2.5 text-3xl sm:text-[2rem] font-extrabold tracking-tight text-[#12304A] dark:text-slate-50 tabular-nums leading-none">
                  {value}
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 ${iconWrap}`}
              >
                <Icon className="w-4.5 h-4.5" aria-hidden="true" />
              </div>
            </div>

            <div className="relative mt-4 pt-3 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${subText}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                <span className="truncate">{subtitle}</span>
              </span>
              <ChevronRight
                className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0"
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>

      {/* 3. Next Patient / Next Appointment Card */}
      <div className="bg-gradient-to-r from-[#12304A] to-[#1E4D6B] dark:from-[#0f2438] dark:to-[#173a53] dark:border dark:border-slate-700/80 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative background wave */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-teal-500/10 rounded-l-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/30">
                Next Scheduled Patient
              </span>
              {nextAppt && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    nextAppt.status === 'CONFIRMED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {nextAppt.status}
                </span>
              )}
            </div>

            {nextAppt ? (
              <div className="flex items-start gap-4">
                {/* Patient Avatar Initials */}
                <div className="w-12 h-12 rounded-2xl bg-teal-500/30 border border-teal-300/40 flex items-center justify-center text-teal-100 font-bold text-lg shrink-0 shadow-inner">
                  {(nextAppt.patient_first_name?.[0] || 'P') + (nextAppt.patient_last_name?.[0] || '')}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <span>
                      {nextAppt.patient_first_name} {nextAppt.patient_last_name}
                    </span>
                    {nextAppt.patient_phone && (
                      <span className="text-xs font-normal text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-teal-400" />
                        {nextAppt.patient_phone}
                      </span>
                    )}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <span className="font-semibold text-teal-300">
                      {nextAppt.service_name || 'General Dental Consultation'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      {formatAppointmentDate(nextAppt.start_at)} at {formatAppointmentTime(nextAppt.start_at)}
                    </span>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[11px] font-medium">
                      {nextAppt.operatory_chair || 'Operatory Chair 1'}
                    </span>
                  </div>

                  {nextAppt.patient_medical_alerts && (
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-200 border border-rose-400/40">
                        <AlertTriangle className="w-3 h-3 text-rose-300 shrink-0" />
                        Medical Alert: {nextAppt.patient_medical_alerts}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2 flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-white">No upcoming patient visits scheduled.</p>
                  <p className="text-xs text-slate-300">
                    All scheduled clinical visits for today have concluded, or check upcoming appointments.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action CTA */}
          <div className="shrink-0 flex items-center gap-3">
            {nextAppt ? (
              <button
                type="button"
                onClick={() => onSelectAppointment && onSelectAppointment(nextAppt.id)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-teal-400 text-slate-900 hover:bg-teal-300 active:scale-95 transition-all shadow-sm"
              >
                <Stethoscope className="w-4 h-4 text-slate-900" />
                <span>Start Consultation / View Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('appointments')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-300" />
                <span>View Assigned Workload</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Clinical Activity Summary Widget */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-gray-700/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/80 dark:ring-teal-500/25 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100 tracking-tight">
              Weekly Clinical Activity Summary
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100/90 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700/80">
            This Week (Mon - Sun)
          </span>
        </div>

        <div className="portal-grid-4">
          <div className="p-4 rounded-xl bg-slate-50/75 dark:bg-gray-900/55 border border-slate-200/70 dark:border-gray-700/75 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Completed This Week
            </span>
            <div className="mt-2 text-2xl font-extrabold text-[#12304A] dark:text-slate-50 tabular-nums leading-none">
              {activitySummary.completed_this_week}
            </div>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-300 font-medium mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0" aria-hidden="true" />
              Visits treated
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/75 dark:bg-gray-900/55 border border-slate-200/70 dark:border-gray-700/75 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Upcoming This Week
            </span>
            <div className="mt-2 text-2xl font-extrabold text-[#12304A] dark:text-slate-50 tabular-nums leading-none">
              {activitySummary.upcoming_this_week}
            </div>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" aria-hidden="true" />
              Confirmed visits
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] ${
              activitySummary.pending_documentation_count > 0
                ? 'bg-amber-50/70 dark:bg-amber-500/[0.08] border-amber-200/90 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-400/60 hover:-translate-y-0.5'
                : 'bg-slate-50/75 dark:bg-gray-900/55 border-slate-200/70 dark:border-gray-700/75 hover:border-slate-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Pending Documentation
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-600/70 dark:text-amber-400/70 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
            </div>
            <div
              className={`mt-2 text-2xl font-extrabold tabular-nums leading-none ${
                activitySummary.pending_documentation_count > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-[#12304A] dark:text-slate-50'
              }`}
            >
              {activitySummary.pending_documentation_count}
            </div>
            <p
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium mt-2.5 ${
                activitySummary.pending_documentation_count > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activitySummary.pending_documentation_count > 0 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              {activitySummary.pending_documentation_count > 0
                ? 'Chart notes needed • Click to view'
                : 'All charts signed'}
            </p>
          </button>

          <div className="p-4 rounded-xl bg-slate-50/75 dark:bg-gray-900/55 border border-slate-200/70 dark:border-gray-700/75 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Cancelled / Missed
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-700 dark:text-slate-200 tabular-nums leading-none">
              {activitySummary.cancelled_this_week}
            </div>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" aria-hidden="true" />
              Adjusted visits
            </p>
          </div>
        </div>

        {/* Attention banner if pending documentation exists */}
        {activitySummary.pending_documentation_count > 0 && (
          <div className="px-4 py-3 rounded-xl bg-amber-50/85 dark:bg-amber-500/[0.08] border border-amber-200/90 dark:border-amber-500/25 border-l-4 border-l-amber-500 dark:border-l-amber-400 text-amber-950 dark:text-amber-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <span className="leading-relaxed">
                <strong className="font-semibold text-amber-900 dark:text-amber-200">Clinical Documentation Notice:</strong>{' '}
                You have {activitySummary.pending_documentation_count} completed visit(s) awaiting clinical procedure notes.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <span>Document Now</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* 5. Today's Appointment Queue & Clinical Sidebar (Grid 2:1) */}
      <div className="portal-split-2-1">
        {/* Today's Queue (2 Cols) */}
        <div data-testid="appointment-queue" className="min-w-0 bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-gray-700/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/80 dark:ring-teal-500/25 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100 tracking-tight">
                Today&apos;s Appointment Queue
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/25 tabular-nums">
                {todayAppts.length} total
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('appointments')}
              className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 inline-flex items-center gap-1 cursor-pointer group"
            >
              <span>View Full Workload</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          </div>

          {/* Interactive Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search today's queue"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-gray-600/80 bg-slate-50/70 dark:bg-gray-900/60 text-slate-800 dark:text-slate-100 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-all"
              />
              {queueSearch && (
                <button
                  type="button"
                  onClick={() => setQueueSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700/80 overflow-x-auto">
              {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setQueueStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    queueStatusFilter === st
                      ? 'bg-[#0D9488] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-gray-800'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment Items List */}
          {filteredQueue.length === 0 ? (
            <div className="py-10 px-6 text-center bg-slate-50/50 dark:bg-gray-900/40 border border-dashed border-slate-200 dark:border-gray-700/80 rounded-xl space-y-2.5">
              <div className="w-11 h-11 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
                <Calendar className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                {todayAppts.length === 0
                  ? 'No patient visits scheduled for today.'
                  : 'No appointments match your search or filter.'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {todayAppts.length === 0
                  ? 'Check upcoming visits in your assigned appointments tab.'
                  : 'Try clearing your search term or selecting "All".'}
              </p>
              {todayAppts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQueueSearch('');
                    setQueueStatusFilter('ALL');
                  }}
                  className="mt-1 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
                >
                  Reset Queue Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQueue.map((appt) => {
                const hasAlerts = Boolean(appt.patient_medical_alerts);
                return (
                  <div
                    key={appt.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50/60 dark:bg-gray-900/45 border border-slate-200/70 dark:border-gray-700/75 hover:border-teal-300/80 dark:hover:border-teal-500/45 hover:bg-white dark:hover:bg-gray-800/80 transition-all cursor-pointer group"
                    onClick={() => onSelectAppointment && onSelectAppointment(appt.id)}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[#12304A] dark:text-slate-100">
                          {appt.patient_first_name} {appt.patient_last_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            appt.status === 'CONFIRMED'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                              : appt.status === 'COMPLETED'
                              ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30'
                              : appt.status === 'PENDING'
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                              : 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {appt.service_name || 'Dental Consultation'}
                        </span>
                        <span className="text-slate-300 dark:text-gray-600">•</span>
                        <span className="font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
                          {formatAppointmentTime(appt.start_at)}
                        </span>
                        <span className="text-slate-300 dark:text-gray-600">•</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {appt.operatory_chair || 'Operatory Chair 1'}
                        </span>
                      </p>

                      {hasAlerts && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 pt-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" aria-hidden="true" />
                          <span>{appt.patient_medical_alerts}</span>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectAppointment) onSelectAppointment(appt.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F766E] dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/25 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
                      >
                        <span>Chart / Manage</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clinical Sidebar: Shortcuts & Approved Leaves (1 Col) */}
        <div className="min-w-0 space-y-6">
          {/* Quick Navigation Panel */}
          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-5 space-y-3.5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Clinical Shortcuts
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('appointments')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/45 hover:border-teal-300/90 dark:hover:border-teal-500/50 hover:bg-teal-50/40 dark:hover:bg-teal-500/10 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:border-teal-300 dark:group-hover:border-teal-600 transition-colors">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span>Assigned Appointments</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/45 hover:border-teal-300/90 dark:hover:border-teal-500/50 hover:bg-teal-50/40 dark:hover:bg-teal-500/10 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:border-teal-300 dark:group-hover:border-teal-600 transition-colors">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span>Treatment Records</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-teal-200/90 dark:border-teal-500/35 bg-teal-50/70 dark:bg-teal-500/[0.12] hover:bg-teal-100/70 dark:hover:bg-teal-500/20 text-left text-xs font-bold text-teal-900 dark:text-teal-200 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span>Request Leave / Time Off</span>
                </div>
                <ChevronRight className="w-4 h-4 text-teal-700 dark:text-teal-300 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Approved Leaves & Vacations Card */}
          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 ring-1 ring-inset ring-amber-200/80 dark:ring-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-200">
                  Approved Leaves
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25 tabular-nums">
                {timeOffList.length} total
              </span>
            </div>

            {timeOffList.length === 0 ? (
              <div className="text-center py-5 px-3 rounded-xl bg-slate-50/60 dark:bg-gray-900/45 border border-dashed border-slate-200 dark:border-gray-700/80 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">No leaves or vacations scheduled.</p>
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                >
                  Request Time Off
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {timeOffList.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-amber-50/55 dark:bg-amber-500/[0.07] border border-amber-200/75 dark:border-amber-500/25 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{t.reason}</p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          t.approved_by_user_id
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                            : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30'
                        }`}
                      >
                        {t.approved_by_user_id ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {t.start_at?.slice(0, 10)} → {t.end_at?.slice(0, 10)}
                    </p>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="tch-tap w-full py-2 rounded-xl border border-dashed border-teal-300/80 dark:border-teal-500/35 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50/60 dark:hover:bg-teal-500/10 transition-colors cursor-pointer"
                >
                  + Request New Leave
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Weekly Recurring Operatory Shifts Grid */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-gray-700/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/80 dark:ring-teal-500/25 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100 tracking-tight">
                Weekly Recurring Operatory Shifts
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live synced duty schedule ({weeklyScheduleSummary.workingDays} active {weeklyScheduleSummary.workingDays === 1 ? 'day' : 'days'} · {weeklyScheduleSummary.totalHours}h/wk)
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/25 tabular-nums">
            {uniqueActiveShifts.length} {uniqueActiveShifts.length === 1 ? 'active shift' : 'active shifts'}
          </span>
        </div>

        <div className="portal-grid-7">
          {DAYS_OF_WEEK.map((day) => {
            const dayShifts = uniqueActiveShifts.filter((s) => s.day_of_week === day.id);
            const isToday = currentManilaDayId === day.id;
            const isOffDuty = dayShifts.length === 0;
            return (
              <div
                key={day.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[126px] transition-colors ${
                  isToday
                    ? 'bg-teal-50/50 dark:bg-teal-500/[0.08] border-teal-300/90 dark:border-teal-500/45 ring-1 ring-teal-500/20'
                    : isOffDuty
                    ? 'bg-slate-50/45 dark:bg-gray-900/35 border-slate-200/70 dark:border-gray-700/60'
                    : 'bg-slate-50/75 dark:bg-gray-900/55 border-slate-200/80 dark:border-gray-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-200/60 dark:border-gray-700/60">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{day.name}</span>
                  {isToday ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-teal-600 text-white">
                      Today
                    </span>
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isOffDuty ? 'bg-slate-300 dark:bg-gray-600' : 'bg-teal-500 dark:bg-teal-400'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="mt-2.5 flex-1 flex flex-col justify-center space-y-2">
                  {isOffDuty ? (
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-slate-100/80 dark:bg-gray-800/80 border border-slate-200/70 dark:border-gray-700/70 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Off duty
                    </span>
                  ) : (
                    dayShifts.map((sh) => (
                      <div
                        key={sh.id}
                        className="p-2 rounded-lg bg-white dark:bg-gray-800/90 border border-slate-200/80 dark:border-gray-700/80 space-y-0.5 shadow-2xs"
                      >
                        <p className="text-[11px] font-bold text-teal-800 dark:text-teal-300 tabular-nums whitespace-nowrap">
                          {formatShiftTime12h(sh.start_time)} – {formatShiftTime12h(sh.end_time)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          {sh.operatory_chair || 'Operatory Chair 1'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Leave / Time-Off Request Modal */}
      {isLeaveModalOpen && (
        <dialog
          ref={leaveDialogRef}
          aria-labelledby="leave-modal-title"
          onCancel={(e) => {
            if (leaveSubmitting) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            closeLeaveModal();
          }}
          className="p-0 m-auto bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 rounded-2xl max-w-[540px] w-[calc(100%-2rem)] shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-[#F8FAFC] to-white dark:from-gray-800 dark:to-gray-800 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-[#F0FDFA] dark:bg-teal-900/50 border border-[#CCFBF1] dark:border-teal-800 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </span>
              <h3 id="leave-modal-title" className="text-base font-bold text-[#12304A] dark:text-slate-100 tracking-tight">
                Request Leave / Time Off
              </h3>
            </div>
            <button
              type="button"
              onClick={closeLeaveModal}
              disabled={leaveSubmitting}
              aria-label="Close dialog"
              className="w-9 h-9 rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#12304A] dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleLeaveSubmit} className="p-6 space-y-5">
            <div className="rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700 px-4 py-3 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 text-justify">
                Submit your practitioner leave request. In compliance with clinic protocol, all leave
                requests require administrative approval before scheduling blocks are finalized.
              </p>
            </div>

            {leaveError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{leaveError}</span>
              </div>
            )}

            {leaveSuccess && (
              <div
                role="status"
                className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span>{leaveSuccess}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <label htmlFor="leave-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason / Leave Category
              </label>
              <input
                id="leave-reason"
                type="text"
                autoFocus
                required
                placeholder="e.g. CME Convention, Annual Vacation, Medical Leave"
                value={leaveForm.reason}
                onChange={(e) => {
                  setLeaveForm({ ...leaveForm, reason: e.target.value });
                  if (leaveError) setLeaveError(null);
                }}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500 text-sm text-[#12304A] dark:text-slate-100 bg-white dark:bg-gray-700 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 focus:border-[#0D9488] transition-colors"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Quick leave categories">
                {LEAVE_REASON_PRESETS.map((preset) => {
                  const isSelected = leaveForm.reason === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setLeaveForm((prev) => ({ ...prev, reason: preset }));
                        if (leaveError) setLeaveError(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#F0FDFA] dark:bg-teal-950/60 border-[#0D9488] dark:border-teal-500 text-[#0F766E] dark:text-teal-300 shadow-xs'
                          : 'bg-white dark:bg-gray-900/50 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50/70 dark:hover:bg-gray-700/60 hover:text-[#12304A] dark:hover:text-slate-100'
                      }`}
                    >
                      <span className="truncate">{preset}</span>
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-[#0D9488] dark:bg-teal-400' : 'bg-slate-200 dark:bg-gray-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="leave-start" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date &amp; Time
                </label>
                <input
                  id="leave-start"
                  type="datetime-local"
                  required
                  value={leaveForm.start_at}
                  onChange={(e) => {
                    setLeaveForm({ ...leaveForm, start_at: e.target.value });
                    if (leaveError) setLeaveError(null);
                  }}
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500 text-sm text-[#12304A] dark:text-slate-100 bg-white dark:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 focus:border-[#0D9488] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="leave-end" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  End Date &amp; Time
                </label>
                <input
                  id="leave-end"
                  type="datetime-local"
                  required
                  min={leaveForm.start_at || undefined}
                  value={leaveForm.end_at}
                  onChange={(e) => {
                    setLeaveForm({ ...leaveForm, end_at: e.target.value });
                    if (leaveError) setLeaveError(null);
                  }}
                  aria-invalid={leaveDurationSummary ? !leaveDurationSummary.valid : false}
                  className={`w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border text-sm text-[#12304A] dark:text-slate-100 bg-white dark:bg-gray-700 focus:outline-none focus-visible:ring-2 transition-colors ${
                    leaveDurationSummary && !leaveDurationSummary.valid
                      ? 'border-rose-400 dark:border-rose-500 focus-visible:ring-rose-200 dark:focus-visible:ring-rose-500/30 focus:border-rose-500'
                      : 'border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500 focus-visible:ring-teal-500/25 focus:border-[#0D9488]'
                  }`}
                />
              </div>
            </div>

            {leaveDurationSummary && (
              <div
                className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  leaveDurationSummary.valid
                    ? 'bg-[#F0FDFA] dark:bg-teal-950/50 border-[#CCFBF1] dark:border-teal-800 text-[#0F766E] dark:text-teal-300 font-medium'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium'
                }`}
              >
                {leaveDurationSummary.valid ? (
                  <>
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      Requested Duration: <strong>{leaveDurationSummary.label}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{leaveDurationSummary.label}</span>
                  </>
                )}
              </div>
            )}

            <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 dark:border-gray-700">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Clinic Timezone: Asia/Manila
              </span>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeLeaveModal}
                  disabled={leaveSubmitting}
                  className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {leaveSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}

export default DentistDashboard;
