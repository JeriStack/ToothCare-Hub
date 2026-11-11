import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-[#CCFBF1] text-[#0F766E] border-teal-200',
  COMPLETED: 'bg-sky-100 text-sky-800 border-sky-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
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

// Live real-time Manila clock formatter
function formatLiveManilaDateTime(date = new Date()) {
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

  // Live Manila Clock
  const [liveClock, setLiveClock] = useState(() => formatLiveManilaDateTime());

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
      setLiveClock(formatLiveManilaDateTime());
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

  const patientName = user?.patient?.first_name
    ? user.patient.first_name
    : user?.first_name
    ? user.first_name
    : dashboardData?.patient?.first_name
    ? dashboardData.patient.first_name
    : 'Patient';

  // Current clinic date banner string
  const currentManilaDateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  const now = new Date();

  // Compute live filtered lists
  const upcomingConfirmedList = useMemo(() => {
    // If backend dashboard provides next_appointment and additional_upcoming, prefer real records
    return appointments
      .filter((a) => {
        if (a.status !== 'CONFIRMED') return false;
        const d = new Date((a.start_at || a.date || '').replace(' ', 'T'));
        return isNaN(d.getTime()) || d >= now;
      })
      .sort((a, b) => {
        const da = new Date((a.start_at || a.date || '').replace(' ', 'T')).getTime() || 0;
        const db = new Date((b.start_at || b.date || '').replace(' ', 'T')).getTime() || 0;
        return da - db;
      });
  }, [appointments, now]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0D9488] mb-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{currentManilaDateStr} • Clinic Time (Asia/Manila)</span>
            <span className="hidden md:inline px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px]">
              {liveClock}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">
            Welcome back, {patientName}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Track your appointments, discover clinical services, and manage your oral health profile.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            title="Refresh appointments"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            aria-label="Refresh appointments"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onNavigateToBook}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            <Plus className="w-4 h-4" />
            <span>Book an Appointment</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert State */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            className="px-3 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveListTab('upcoming')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveListTab('upcoming')}
              aria-label={`Upcoming Visits: ${metrics.upcomingCount} confirmed scheduled`}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'upcoming'
                  ? 'bg-teal-50/70 border-[#0D9488] shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Upcoming Visits
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-[#0F766E] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {metrics.upcomingCount}
                </span>
                <span className="text-xs text-slate-500">Confirmed scheduled</span>
              </div>
            </div>

            <div
              onClick={() => setActiveListTab('pending')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveListTab('pending')}
              aria-label={`Pending Requests: ${metrics.pendingCount} awaiting triage`}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'pending'
                  ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pending Requests
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {metrics.pendingCount}
                </span>
                <span className="text-xs text-slate-500">Awaiting triage</span>
              </div>
            </div>

            <div
              onClick={() => setActiveListTab('completed')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveListTab('completed')}
              aria-label={`Completed Treatments: ${metrics.completedCount} past dental visits`}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'completed'
                  ? 'bg-sky-50/70 border-sky-400 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Completed Treatments
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {metrics.completedCount}
                </span>
                <span className="text-xs text-slate-500">Past dental visits</span>
              </div>
            </div>
          </div>

          {/* 3. Next Confirmed Visit Hero Card */}
          {nextVisit ? (
            <div className="bg-gradient-to-r from-[#12304A] to-[#1E4D6B] rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-teal-500/10 rounded-l-full pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Next Confirmed Visit
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/20">
                      Confirmed #{nextVisit.appointment_number || nextVisit.id}
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    {/* Dentist Avatar Initials */}
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/30 border border-teal-300/40 flex items-center justify-center text-teal-100 font-bold text-lg shrink-0 shadow-inner">
                      {(nextVisit.dentist_first_name?.[0] || 'D') + (nextVisit.dentist_last_name?.[0] || '')}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white">
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

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1">
                        <span className="flex items-center gap-1 text-teal-300 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatManilaDate(nextVisit.start_at || nextVisit.date)}
                        </span>
                        <span>•</span>
                        <span>{nextVisit.service_duration || nextVisit.duration_snapshot || 45} mins</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3 h-3 text-teal-400" />
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
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-teal-400 text-slate-900 hover:bg-teal-300 active:scale-95 transition-all shadow-sm"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalAppt(nextVisit);
                      setCancelReason('Schedule conflict');
                      setCancelError(null);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 text-slate-300 border border-white/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Visit</span>
                  </button>
                </div>
              </div>

              {/* Additional upcoming appointments compact preview if multiple exist */}
              {additionalUpcoming.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                    Other Upcoming:
                  </span>
                  {additionalUpcoming.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setDetailModalAppt(item)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer flex items-center gap-2 transition-colors"
                    >
                      <span className="font-medium text-white">{item.service_name}</span>
                      <span className="text-slate-400">• {formatManilaDate(item.start_at || item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-teal-50/70 to-slate-50 rounded-2xl border border-teal-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#12304A]">
                    No upcoming confirmed appointments
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                    Keep your smile healthy and radiant. Check available dates and book your next consultation in minutes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToBook}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
              >
                <span>Book now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 4. Quick Discovery Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={onNavigateToServices}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    Explore Services
                  </h4>
                  <p className="text-[11px] text-slate-400">Procedures, pricing & duration</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>

            <button
              type="button"
              onClick={onNavigateToDentists}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    Our Dentists
                  </h4>
                  <p className="text-[11px] text-slate-400">Credentials, specialties & chairs</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>

            <button
              type="button"
              onClick={onNavigateToProfile}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    My Medical Profile
                  </h4>
                  <p className="text-[11px] text-slate-400">Allergies & contact information</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>
          </div>

          {/* 5. Appointments Multi-Tab Panel & Queue */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveListTab('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'upcoming'
                      ? 'bg-teal-50 text-[#0D9488] font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Upcoming ({upcomingConfirmedList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'pending'
                      ? 'bg-amber-50 text-amber-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pending Requests ({pendingList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeListTab === 'completed'
                      ? 'bg-sky-50 text-sky-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Completed ({completedList.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onNavigateToAppointments}
                className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1 transition-colors self-start sm:self-auto shrink-0"
              >
                <span>View full history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Tab Content */}
            {activeListTab === 'upcoming' && (
              upcomingConfirmedList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No upcoming visits scheduled</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You have no active confirmed appointments. Schedule your next dental checkup now.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateToBook}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Book Appointment</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingConfirmedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A]">
                            {appt.service_name || 'Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
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
                            STATUS_BADGE[appt.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailModalAppt(appt)}
                            className="text-xs font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 transition-colors"
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
                            className="text-xs font-medium text-slate-400 hover:text-rose-600 px-2 py-1 transition-colors"
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
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No pending requests</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All your booking requests have been processed by clinic administration.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingList.map((appt) => (
                    <div key={appt.id} className="p-5 hover:bg-slate-50/80 transition-colors space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                            #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-[#12304A]">
                              {appt.service_name || 'Requested Dental Service'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Preferred Doctor:{' '}
                              <strong>
                                {appt.dentist_first_name
                                  ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                                  : 'First Available Clinician'}
                              </strong>{' '}
                              • Requested for: {formatManilaDate(appt.start_at || appt.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Awaiting Review
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalAppt(appt);
                              setCancelReason('Patient withdrew request');
                              setCancelError(null);
                            }}
                            className="text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline px-2 py-1"
                          >
                            Withdraw Request
                          </button>
                        </div>
                      </div>

                      {/* 3-Stage Progress Stepper */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Request Lifecycle Progress
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {/* Step 1 */}
                          <div className="flex flex-col items-center gap-1 text-teal-700 font-semibold">
                            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                            <span className="text-[11px]">1. Submitted</span>
                          </div>

                          {/* Step 2 */}
                          <div className="flex flex-col items-center gap-1 text-amber-700 font-semibold">
                            <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold animate-pulse">
                              2
                            </div>
                            <span className="text-[11px]">2. Clinic Review</span>
                          </div>

                          {/* Step 3 */}
                          <div className="flex flex-col items-center gap-1 text-slate-400 font-medium">
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
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
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No past treatments recorded</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Your completed appointments and dental care history will be shown here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {completedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A]">
                            {appt.service_name || 'Completed Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Attending Doctor:{' '}
                            <strong>
                              {appt.dentist_first_name
                                ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                                : 'Attending Dentist'}
                            </strong>{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                          Completed
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailModalAppt(appt)}
                          className="text-xs font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 transition-colors"
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
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-[#12304A]">Recent Appointment Activity</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Latest patient updates</span>
            </div>

            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No recent appointment activity recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800">
                          {act.service_name || 'Appointment'}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          transitioned to{' '}
                          <strong className="text-teal-700">{act.new_status}</strong>
                        </span>
                        {act.dentist_last_name && (
                          <span className="text-slate-400"> (Dr. {act.dentist_last_name})</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-mono">
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 id="cancel-modal-title" className="text-sm font-bold text-[#12304A]">
                  Cancel Appointment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Clinic Cancellation Policy
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Appointments can be cancelled online up to 24 hours prior to your scheduled consultation.
                  For cancellations within 24 hours, please call the clinic directly at (02) 8123-4567.
                </p>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="cancel-reason" className="text-xs font-semibold text-slate-700">
                  Reason for Cancellation
                </label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value="Schedule conflict">Schedule conflict / Work commitment</option>
                  <option value="Feeling unwell / Medical reason">Feeling unwell / Medical reason</option>
                  <option value="Rescheduling to another date">Need to reschedule to another date</option>
                  <option value="Personal / Family emergency">Personal / Family emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
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
        </div>
      )}

      {/* 8. Appointment Details Modal (Phase 6) */}
      {detailModalAppt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-600" />
                <h3 id="detail-modal-title" className="text-sm font-bold text-[#12304A]">
                  Appointment Details #{detailModalAppt.appointment_number || detailModalAppt.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium">Service</span>
                  <p className="font-bold text-[#12304A] text-sm mt-0.5">
                    {detailModalAppt.service_name || 'Dental Consultation'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status</span>
                  <p className="mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        STATUS_BADGE[detailModalAppt.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {STATUS_LABELS[detailModalAppt.status] || detailModalAppt.status}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Doctor</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {detailModalAppt.dentist_first_name
                      ? `Dr. ${detailModalAppt.dentist_first_name} ${detailModalAppt.dentist_last_name}`
                      : 'Attending Clinician'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Operatory</span>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {detailModalAppt.operatory_chair || 'Operatory Chair 1'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Scheduled Date & Time</span>
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600" />
                  {formatManilaDate(detailModalAppt.start_at || detailModalAppt.date)} (
                  {detailModalAppt.service_duration || detailModalAppt.duration_snapshot || 45} mins)
                </p>
              </div>

              {detailModalAppt.chief_complaint && (
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Chief Complaint / Reason for Visit</span>
                  <p className="text-slate-700 p-2.5 rounded-lg bg-slate-50 border border-slate-100 italic">
                    &ldquo;{detailModalAppt.chief_complaint}&rdquo;
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ToothCare Hub Dental Center • 124 Ayala Avenue, Makati City
                </span>
                <button
                  type="button"
                  onClick={() => setDetailModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientDashboard;
