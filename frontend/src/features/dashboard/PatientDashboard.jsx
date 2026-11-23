import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Stethoscope,
  Sparkles,
  FileText,
  ShieldCheck,
  Award,
  ChevronRight,
  X,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Phone,
  History,
  Activity,
  CalendarCheck,
} from 'lucide-react';
import { appointmentsApi } from '../appointments/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';

import { DialogOverlay } from '../../components/ui/DialogOverlay';
const STATUS_BADGE = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  CONFIRMED: 'bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300 border-teal-200 dark:border-teal-800',
  COMPLETED: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  CANCELLED: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-gray-600',
  REJECTED: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
};

const STATUS_LABELS = {
  PENDING: 'Awaiting Clinic Review',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
};

// Formats a date string in Asia/Manila timezone
function formatManilaDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

// Formats the full Manila clinic calendar date once in the header
function formatManilaCalendarDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

// Machine-readable ISO calendar date in Asia/Manila for semantic <time>
function formatManilaIsoDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return undefined;
  }
}

// Live real-time Manila clock formatter (time-only to avoid duplicating the date)
function formatLiveManilaTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

export function PatientDashboard({
  user,
  onNavigateToBook,
  onNavigateToAppointments,
  onNavigateToServices,
  onNavigateToDentists,
  onNavigateToProfile,
}) {
  const [dashboardData, setDashboardData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeListTab, setActiveListTab] = useState('upcoming');
  const appointmentsSectionRef = useRef(null);

  const focusScheduleTab = (tab) => {
    setActiveListTab(tab);
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    appointmentsSectionRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
    });
  };

  // Live Manila clock timestamp (updates date and time without midnight staleness)
  const [clinicNow, setClinicNow] = useState(() => new Date());

  // Cancellation Modal State
  const [cancelModalAppt, setCancelModalAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState('Schedule conflict');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Appointment Details Modal State
  const [detailModalAppt, setDetailModalAppt] = useState(null);

  // Search filter for in-tab appointments
  const [searchFilter, setSearchFilter] = useState('');

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setClinicNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [dashRes, listRes] = await Promise.all([
        appointmentsApi.getPatientDashboard ? appointmentsApi.getPatientDashboard().catch(() => null) : Promise.resolve(null),
        appointmentsApi.list().catch(() => []),
      ]);

      setDashboardData(dashRes);
      const apptList = Array.isArray(listRes) ? listRes : listRes?.items || [];
      setAppointments(apptList);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load your appointments. Please verify clinic server status.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useDashboardSync({
    role: 'PATIENT',
    domains: [
      DASHBOARD_SYNC_DOMAINS.PATIENT_DASHBOARD,
      DASHBOARD_SYNC_DOMAINS.APPOINTMENTS,
    ],
    onRefresh: () => fetchDashboardData(true),
  });

  const patientName = user?.patient?.first_name
    ? user.patient.first_name
    : user?.first_name
    ? user.first_name
    : dashboardData?.patient?.first_name
    ? dashboardData.patient.first_name
    : 'Patient';

  // Current clinic date & time strings formatted in Asia/Manila
  const manilaIsoDate = formatManilaIsoDate(clinicNow);
  const currentManilaDateStr = formatManilaCalendarDate(clinicNow);
  const liveTimeStr = formatLiveManilaTime(clinicNow);
  const currentMinuteBucket = Math.floor(clinicNow.getTime() / 60000);

  // Compute live filtered lists
  const upcomingConfirmedList = useMemo(() => {
    const nowMs = currentMinuteBucket * 60000;
    // If backend dashboard provides next_appointment and additional_upcoming, prefer real records
    return appointments
      .filter((a) => {
        if (a.status !== 'CONFIRMED') return false;
        const d = new Date((a.start_at || a.date || '').replace(' ', 'T'));
        return isNaN(d.getTime()) || d.getTime() >= nowMs;
      })
      .sort((a, b) => {
        const da = new Date((a.start_at || a.date || '').replace(' ', 'T')).getTime() || 0;
        const db = new Date((b.start_at || b.date || '').replace(' ', 'T')).getTime() || 0;
        return da - db;
      });
  }, [appointments, currentMinuteBucket]);

  const pendingList = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'PENDING')
      .sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [appointments]);

  const completedList = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'COMPLETED')
      .sort((a, b) => {
        const da = new Date((a.start_at || a.date || '').replace(' ', 'T')).getTime() || 0;
        const db = new Date((b.start_at || b.date || '').replace(' ', 'T')).getTime() || 0;
        return db - da;
      });
  }, [appointments]);

  // Next confirmed visit hero
  const nextVisit = dashboardData?.next_appointment || upcomingConfirmedList[0] || null;
  const additionalUpcoming = dashboardData?.additional_upcoming || upcomingConfirmedList.slice(1, 4);
  const recentActivity = dashboardData?.recent_activity || [];

  // Metrics (prioritizing backend authoritative summary)
  const metrics = {
    upcomingCount: dashboardData?.upcoming_count ?? upcomingConfirmedList.length,
    pendingCount: dashboardData?.pending_count ?? pendingList.length,
    completedCount: dashboardData?.completed_count ?? completedList.length,
  };

  // Handle Cancellation Submission
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelModalAppt) return;
    setCancelling(true);
    setCancelError(null);

    try {
      await appointmentsApi.cancel(cancelModalAppt.id, {
        reason: cancelReason.trim() || 'Schedule conflict',
      });
      setActionSuccess('Your appointment has been cancelled successfully.');
      setCancelModalAppt(null);
      await fetchDashboardData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setCancelError(
        err.response?.data?.error?.message || err.message || 'Unable to cancel appointment. Please contact the clinic.'
      );
    } finally {
      setCancelling(false);
    }
  };

  // Filter in-tab list based on search query
  const filterBySearch = (list) => {
    if (!searchFilter.trim()) return list;
    const q = searchFilter.toLowerCase().trim();
    return list.filter((item) => {
      const sName = (item.service_name || '').toLowerCase();
      const dName = `${item.dentist_first_name || ''} ${item.dentist_last_name || ''}`.toLowerCase();
      const num = String(item.appointment_number || item.id || '').toLowerCase();
      return sName.includes(q) || dName.includes(q) || num.includes(q);
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-teal-50/45 dark:from-gray-800 dark:via-gray-800 dark:to-teal-950/40 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-5 sm:p-6 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 w-56 h-56 rounded-full bg-teal-500/[0.05] dark:bg-teal-400/[0.06] blur-2xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0 space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#12304A] dark:text-slate-100 text-balance">
              Welcome back, {patientName}!
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E] dark:text-teal-300">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                <time dateTime={manilaIsoDate}>{currentManilaDateStr}</time>
              </span>

              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden="true">
                |
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700 text-slate-600 dark:text-slate-300 text-[11px]">
                <Clock className="w-3 h-3 shrink-0 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
                <time
                  dateTime={clinicNow.toISOString()}
                  className="font-mono tabular-nums font-semibold text-[#12304A] dark:text-slate-100"
                >
                  {liveTimeStr}
                </time>
                <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
                  •
                </span>
                <span>Clinic Time (Asia/Manila)</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed text-pretty">
              Track your appointments, discover clinical services, and manage your oral health profile.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 min-h-10 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-600 hover:border-slate-300 dark:hover:border-gray-500 hover:text-[#12304A] dark:hover:text-white active:scale-[0.98] text-xs font-semibold transition-all shadow-sm disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 ${refreshing ? 'animate-spin text-[#0D9488] dark:text-teal-400' : ''}`}
                aria-hidden="true"
              />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              <span className="sr-only"> appointments</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToBook}
              className="inline-flex items-center justify-center gap-2 min-h-10 px-5 py-2.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Book an Appointment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert State */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            className="px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-800/80 text-rose-800 dark:text-rose-200 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <DashboardSkeleton role="patient" />
      ) : (
        <>
          {/* 2. Dashboard Statistics Cards */}
          <div className="portal-grid-3">
            {[
              {
                key: 'upcoming',
                label: 'Upcoming Visits',
                count: metrics.upcomingCount,
                subtitle: 'Confirmed scheduled',
                Icon: CheckCircle2,
                activeClass: 'bg-teal-50/80 dark:bg-teal-950/50 border-[#0D9488] dark:border-teal-500 ring-1 ring-[#0D9488]/20 dark:ring-teal-500/30 shadow-sm',
                iconClass: 'bg-teal-100/80 dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300 border-teal-200/80 dark:border-teal-800',
                activeTagClass: 'bg-teal-100 dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300',
              },
              {
                key: 'pending',
                label: 'Pending Requests',
                count: metrics.pendingCount,
                subtitle: 'Awaiting triage',
                Icon: Clock,
                activeClass: 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 dark:border-amber-500 ring-1 ring-amber-500/20 dark:ring-amber-500/30 shadow-sm',
                iconClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
                activeTagClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300',
              },
              {
                key: 'completed',
                label: 'Completed Treatments',
                count: metrics.completedCount,
                subtitle: 'Past dental visits',
                Icon: Award,
                activeClass: 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-500 dark:border-sky-500 ring-1 ring-sky-500/20 dark:ring-sky-500/30 shadow-sm',
                iconClass: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 border-sky-200/80 dark:border-sky-800',
                activeTagClass: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300',
              },
            ].map(({ key, label, count, subtitle, Icon, activeClass, iconClass, activeTagClass }) => {
              const isSelected = activeListTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveListTab(key)}
                  aria-pressed={isSelected}
                  aria-label={`${label}: ${count} ${subtitle.toLowerCase()}`}
                  className={`w-full text-left p-5 rounded-2xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] flex flex-col justify-between gap-3.5 ${
                    isSelected
                      ? activeClass
                      : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {label}
                    </span>
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconClass}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight tabular-nums text-[#12304A] dark:text-slate-100">
                      {count}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</span>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/70 dark:border-gray-700 flex items-center justify-between text-[11px] w-full">
                    {isSelected ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold ${activeTagClass}`}
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>Active filter</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">View in schedule</span>
                    )}
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected ? 'text-[#12304A] dark:text-slate-100 translate-x-0.5' : 'text-slate-400 dark:text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. Next Confirmed Visit Hero Card */}
          {nextVisit ? (
            <div className="bg-gradient-to-r from-[#12304A] to-[#1E4D6B] dark:from-[#0f2438] dark:to-[#173a53] dark:border dark:border-slate-700/80 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute right-0 top-0 bottom-0 w-1/3 bg-teal-500/10 rounded-l-full pointer-events-none"
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-400/20 text-teal-200 border border-teal-400/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Next Confirmed Visit
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-100 border border-white/20">
                      Confirmed #{nextVisit.appointment_number || nextVisit.id}
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    {/* Dentist Avatar Initials */}
                    <div
                      aria-hidden="true"
                      className="w-12 h-12 rounded-2xl bg-teal-500/30 border border-teal-300/40 flex items-center justify-center text-teal-100 font-bold text-lg shrink-0 shadow-inner"
                    >
                      {(nextVisit.dentist_first_name?.[0] || 'D') + (nextVisit.dentist_last_name?.[0] || '')}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white text-balance">
                        {nextVisit.service_name || 'Dental Consultation'}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-200 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-teal-300">
                          {nextVisit.dentist_first_name
                            ? `Dr. ${nextVisit.dentist_first_name} ${nextVisit.dentist_last_name}`
                            : 'Assigned Clinician'}
                        </span>
                        {nextVisit.specialization && (
                          <span className="text-slate-300">({nextVisit.specialization})</span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200 pt-1">
                        <span className="flex items-center gap-1 text-teal-300 font-medium">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {formatManilaDate(nextVisit.start_at || nextVisit.date)}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>{nextVisit.service_duration || nextVisit.duration_snapshot || 45} mins</span>
                        <span aria-hidden="true">•</span>
                        <span className="flex items-center gap-1 text-slate-200">
                          <MapPin className="w-3 h-3 text-teal-300" aria-hidden="true" />
                          {nextVisit.operatory_chair || 'Operatory Chair 1'} • Makati Clinic
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDetailModalAppt(nextVisit)}
                    className="inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2.5 rounded-xl font-bold text-xs bg-teal-400 text-slate-900 hover:bg-teal-300 active:scale-95 transition-all shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalAppt(nextVisit);
                      setCancelReason('Schedule conflict');
                      setCancelError(null);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-rose-500/20 hover:text-rose-100 text-slate-200 border border-white/15 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cancel Visit</span>
                  </button>
                </div>
              </div>

              {/* Additional upcoming appointments compact preview if multiple exist */}
              {additionalUpcoming.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center gap-2.5 text-xs text-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                    Other Upcoming:
                  </span>
                  {additionalUpcoming.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailModalAppt(item)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer flex items-center gap-2 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                    >
                      <span className="font-medium text-white">{item.service_name}</span>
                      <span className="text-slate-300">• {formatManilaDate(item.start_at || item.date)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative overflow-hidden bg-gradient-to-r from-white via-teal-50/45 to-emerald-50/60 dark:from-gray-800 dark:via-gray-800 dark:to-teal-950/40 rounded-2xl border border-teal-200/80 dark:border-teal-800/70 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-[#12304A] dark:text-slate-100">
                        No upcoming confirmed appointments
                      </h3>
                      {metrics.pendingCount > 0 && (
                        <button
                          type="button"
                          onClick={() => focusScheduleTab('pending')}
                          className="tch-tap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200/80 dark:hover:bg-amber-900/90 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-[11px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                        >
                          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>
                            {metrics.pendingCount} pending {metrics.pendingCount === 1 ? 'request' : 'requests'} awaiting review
                          </span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-pretty">
                      Check available dates and book your next consultation in minutes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {metrics.pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => focusScheduleTab('pending')}
                      className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500 text-xs font-semibold transition-colors shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                    >
                      <span>View Pending</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onNavigateToBook}
                    className="inline-flex items-center justify-center gap-1.5 min-h-10 px-5 py-2.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  >
                    <span>Book now</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Quick Discovery Navigation Cards */}
          <div className="portal-grid-3">
            {[
              {
                key: 'services',
                title: 'Explore Services',
                description: 'Procedures, pricing & duration',
                Icon: Sparkles,
                onClick: onNavigateToServices,
              },
              {
                key: 'dentists',
                title: 'Our Dentists',
                description: 'Credentials, specialties & chairs',
                Icon: User,
                onClick: onNavigateToDentists,
              },
              {
                key: 'profile',
                title: 'My Medical Profile',
                description: 'Allergies & contact information',
                Icon: ShieldCheck,
                onClick: onNavigateToProfile,
              },
            ].map(({ key, title, description, Icon, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:border-[#0D9488]/60 dark:hover:border-teal-500/70 hover:bg-teal-50/20 dark:hover:bg-teal-950/30 hover:shadow-md transition-all text-left flex items-center justify-between gap-3 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/50 border border-teal-100 dark:border-teal-800 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:bg-[#0D9488] group-hover:text-white group-hover:border-[#0D9488] transition-colors">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors leading-snug">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>
                  </div>
                </div>
                <span className="w-7 h-7 rounded-full bg-slate-50 dark:bg-gray-700 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/60 flex items-center justify-center shrink-0 transition-colors">
                  <ChevronRight
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-[#0F766E] dark:group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all"
                    aria-hidden="true"
                  />
                </span>
              </button>
            ))}
          </div>

          {/* 5. Appointments Multi-Tab Panel & Queue */}
          <div
            ref={appointmentsSectionRef}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveListTab('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'upcoming'
                      ? 'bg-teal-50 dark:bg-teal-900/60 text-[#0D9488] dark:text-teal-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Upcoming ({upcomingConfirmedList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'pending'
                      ? 'bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Pending Requests ({pendingList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'completed'
                      ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Completed ({completedList.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onNavigateToAppointments}
                className="tch-tap text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 flex items-center gap-1 transition-colors self-start sm:self-auto shrink-0"
              >
                <span>View full history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Tab Content */}
            {activeListTab === 'upcoming' && (
              upcomingConfirmedList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A] dark:text-slate-100">No upcoming visits scheduled</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    You have no active confirmed appointments. Schedule your next dental checkup now.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateToBook}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Book Appointment</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {upcomingConfirmedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 dark:hover:bg-gray-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/50 text-[#0D9488] dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A] dark:text-slate-100">
                            {appt.service_name || 'Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {appt.dentist_first_name
                              ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                              : 'Assigned Dentist'}{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            STATUS_BADGE[appt.status] || 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-gray-600'
                          }`}
                        >
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailModalAppt(appt)}
                            className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 px-2 py-1 rounded bg-teal-50 dark:bg-teal-900/50 hover:bg-teal-100 dark:hover:bg-teal-900/80 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalAppt(appt);
                              setCancelReason('Schedule conflict');
                              setCancelError(null);
                            }}
                            className="text-xs font-medium text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Pending Requests Tab with 3-Stage Lifecycle Progress Tracking (Phase 5) */}
            {activeListTab === 'pending' && (
              pendingList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A] dark:text-slate-100">No pending requests</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    All your booking requests have been processed by clinic administration.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {pendingList.map((appt) => (
                    <div key={appt.id} className="p-5 hover:bg-slate-50/80 dark:hover:bg-gray-700/40 transition-colors space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                            #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-[#12304A] dark:text-slate-100">
                              {appt.service_name || 'Requested Dental Service'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Preferred Doctor:{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {appt.dentist_first_name
                                  ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                                  : 'First Available Clinician'}
                              </strong>{' '}
                              • Requested for: {formatManilaDate(appt.start_at || appt.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Awaiting Review
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalAppt(appt);
                              setCancelReason('Patient withdrew request');
                              setCancelError(null);
                            }}
                            className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline px-2 py-1"
                          >
                            Withdraw Request
                          </button>
                        </div>
                      </div>

                      {/* 3-Stage Progress Stepper */}
                      <div className="bg-slate-50 dark:bg-gray-900/60 rounded-xl p-3 border border-slate-100 dark:border-gray-700">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                          Request Lifecycle Progress
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                          {/* Step 1 */}
                          <div className="flex flex-col items-center gap-1 text-teal-700 dark:text-teal-300 font-semibold">
                            <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                            <span className="text-[11px]">1. Submitted</span>
                          </div>

                          {/* Step 2 */}
                          <div className="flex flex-col items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                            <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 flex items-center justify-center text-xs font-bold animate-pulse">
                              2
                            </div>
                            <span className="text-[11px]">2. Clinic Review</span>
                          </div>

                          {/* Step 3 */}
                          <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 font-medium">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold">
                              3
                            </div>
                            <span className="text-[11px]">3. Confirmation</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Completed Treatments Tab */}
            {activeListTab === 'completed' && (
              completedList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A] dark:text-slate-100">No past treatments recorded</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Your completed appointments and dental care history will be shown here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {completedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 dark:hover:bg-gray-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A] dark:text-slate-100">
                            {appt.service_name || 'Completed Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Attending Doctor:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {appt.dentist_first_name
                                ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                                : 'Attending Dentist'}
                            </strong>{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          Completed
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailModalAppt(appt)}
                          className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 px-2 py-1 rounded bg-teal-50 dark:bg-teal-900/50 hover:bg-teal-100 dark:hover:bg-teal-900/80 transition-colors"
                        >
                          View Record
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* 6. Recent Appointment Activity Section (Phase 7) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Recent Appointment Activity</h3>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Latest patient updates</span>
            </div>

            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">No recent appointment activity recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-700">
                {recentActivity.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {act.service_name || 'Appointment'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}
                          transitioned to{' '}
                          <strong className="text-teal-700 dark:text-teal-300">{act.new_status}</strong>
                        </span>
                        {act.dentist_last_name && (
                          <span className="text-slate-400 dark:text-slate-500"> (Dr. {act.dentist_last_name})</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                      {formatManilaDate(act.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 7. Appointment Cancellation Confirmation Modal (Phase 6) */}
      {cancelModalAppt && (
        <DialogOverlay
          onClose={() => setCancelModalAppt(null)}
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h3 id="cancel-modal-title" className="text-sm font-bold text-[#12304A] dark:text-slate-100">
                  Cancel Appointment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  Clinic Cancellation Policy
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Appointments can be cancelled online up to 24 hours prior to your scheduled consultation.
                  For cancellations within 24 hours, please call the clinic directly at (02) 8123-4567.
                </p>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="cancel-reason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Cancellation
                </label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value="Schedule conflict">Schedule conflict / Work commitment</option>
                  <option value="Feeling unwell / Medical reason">Feeling unwell / Medical reason</option>
                  <option value="Rescheduling to another date">Need to reschedule to another date</option>
                  <option value="Personal / Family emergency">Personal / Family emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setCancelModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* 8. Appointment Details Modal (Phase 6) */}
      {detailModalAppt && (
        <DialogOverlay
          onClose={() => setDetailModalAppt(null)}
          aria-labelledby="detail-modal-title"
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 id="detail-modal-title" className="text-sm font-bold text-[#12304A] dark:text-slate-100">
                  Appointment Details #{detailModalAppt.appointment_number || detailModalAppt.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-100 dark:border-gray-700">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Service</span>
                  <p className="font-bold text-[#12304A] dark:text-slate-100 text-sm mt-0.5">
                    {detailModalAppt.service_name || 'Dental Consultation'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Status</span>
                  <p className="mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        STATUS_BADGE[detailModalAppt.status] || 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-gray-600'
                      }`}
                    >
                      {STATUS_LABELS[detailModalAppt.status] || detailModalAppt.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Doctor</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {detailModalAppt.dentist_first_name
                      ? `Dr. ${detailModalAppt.dentist_first_name} ${detailModalAppt.dentist_last_name}`
                      : 'Attending Clinician'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Operatory</span>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                    {detailModalAppt.operatory_chair || 'Operatory Chair 1'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Scheduled Date & Time</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  {formatManilaDate(detailModalAppt.start_at || detailModalAppt.date)} (
                  {detailModalAppt.service_duration || detailModalAppt.duration_snapshot || 45} mins)
                </p>
              </div>

              {detailModalAppt.chief_complaint && (
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Chief Complaint / Reason for Visit</span>
                  <p className="text-slate-700 dark:text-slate-300 p-2.5 rounded-lg bg-slate-50 dark:bg-gray-900/60 border border-slate-100 dark:border-gray-700 italic">
                    &ldquo;{detailModalAppt.chief_complaint}&rdquo;
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  ToothCare Hub Dental Center • 124 Ayala Avenue, Makati City
                </span>
                <button
                  type="button"
                  onClick={() => setDetailModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default PatientDashboard;
