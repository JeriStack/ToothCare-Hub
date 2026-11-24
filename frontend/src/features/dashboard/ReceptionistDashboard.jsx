import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Plus,
  UserPlus,
  Search,
  Filter,
  ArrowRight,
  Phone,
  ShieldAlert,
  ChevronRight,
  Eye,
  AlertTriangle,
  Stethoscope,
  Sparkles,
  Timer,
  X
} from 'lucide-react';
import { receptionistApi } from '../receptionist/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

function formatClockTime(dateTimeStr) {
  if (!dateTimeStr) return '--:--';
  const match = String(dateTimeStr).match(/(\d{2}):(\d{2})/);
  if (!match) return String(dateTimeStr).substring(11, 16) || '--:--';
  const hours24 = parseInt(match[1], 10);
  const mins = match[2];
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins} ${period}`;
}

function formatShortSlot(dateTimeStr) {
  if (!dateTimeStr) return '—';
  const normalized = String(dateTimeStr).replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateTimeStr).substring(0, 16);
  }
  const datePart = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${datePart} · ${formatClockTime(dateTimeStr)}`;
}

function getInitials(firstName, lastName) {
  const f = String(firstName || '').trim().charAt(0);
  const l = String(lastName || '').trim().charAt(0);
  return (f + l).toUpperCase() || 'PT';
}

const LIFECYCLE_STYLES = {
  CONFIRMED: {
    label: 'Confirmed',
    badge: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-500/25',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  PENDING: {
    label: 'Pending',
    badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-600/40',
    dot: 'bg-slate-400 dark:bg-slate-400',
  },
  REJECTED: {
    label: 'Declined',
    badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

const DESK_STATE_STYLES = {
  NOT_ARRIVED: {
    label: 'Not Arrived',
    badge: 'bg-slate-100/90 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600/70',
    dot: 'bg-slate-400',
  },
  CHECKED_IN: {
    label: 'Checked In',
    badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  WAITING: {
    label: 'Waiting',
    badge: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-500/25',
    dot: 'bg-teal-500 dark:bg-teal-400',
  },
  IN_CONSULTATION: {
    label: 'In Chair',
    badge: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/25',
    dot: 'bg-indigo-500 dark:bg-indigo-400',
  },
  FINISHED: {
    label: 'Finished',
    badge: 'bg-slate-100 dark:bg-gray-700/80 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-gray-600',
    dot: 'bg-slate-500 dark:bg-slate-300',
  },
  NO_SHOW: {
    label: 'No Show',
    badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

export function ReceptionistDashboard({ user, onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters for Today's Schedule
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');

  // Modals state
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [attendanceModalTarget, setAttendanceModalTarget] = useState(null);
  const [attendanceStatusChoice, setAttendanceStatusChoice] = useState('WAITING');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'OTHER',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_alerts: '',
  });
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState(null);
  const [registerErrorMsg, setRegisterErrorMsg] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const summary = await receptionistApi.getDashboard();
      setData(summary);
    } catch (err) {
      console.error('Failed to load receptionist dashboard:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load front desk dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useDashboardSync({
    role: 'RECEPTIONIST',
    domains: [
      DASHBOARD_SYNC_DOMAINS.RECEPTIONIST_DASHBOARD,
      DASHBOARD_SYNC_DOMAINS.APPOINTMENTS,
      DASHBOARD_SYNC_DOMAINS.SCHEDULES,
      DASHBOARD_SYNC_DOMAINS.SERVICES,
      DASHBOARD_SYNC_DOMAINS.ACCOUNTS,
    ],
    onRefresh: () => fetchDashboardData(true),
  });

  // Handle Quick Check-In
  const handlePerformCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInTarget) return;

    setIsCheckingIn(true);
    try {
      await receptionistApi.checkIn(checkInTarget.id, checkInNotes || null);
      triggerToast(`Checked in ${checkInTarget.patient_first_name} ${checkInTarget.patient_last_name} successfully.`);
      setCheckInTarget(null);
      setCheckInNotes('');
      fetchDashboardData(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to record check-in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Attendance Status Transition
  const handleUpdateAttendanceStatus = async (e) => {
    e.preventDefault();
    if (!attendanceModalTarget) return;

    setIsUpdatingAttendance(true);
    try {
      await receptionistApi.updateAttendance(attendanceModalTarget.id, attendanceStatusChoice, attendanceNotes || null);
      triggerToast(`Attendance updated for ${attendanceModalTarget.patient_first_name} ${attendanceModalTarget.patient_last_name}.`);
      setAttendanceModalTarget(null);
      setAttendanceNotes('');
      fetchDashboardData(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to update attendance.');
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  // Handle Front-Desk Walk-In Patient Intake
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setIsSubmittingRegister(true);
    setRegisterSuccessMsg(null);
    setRegisterErrorMsg(null);

    try {
      const res = await receptionistApi.registerPatient(registerForm);
      setRegisterSuccessMsg(res.message || 'Patient successfully registered!');
      triggerToast(`Patient ${registerForm.first_name} ${registerForm.last_name} registered.`);
      setRegisterForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: 'OTHER',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_alerts: '',
      });
      setTimeout(() => {
        setIsRegisterOpen(false);
        setRegisterSuccessMsg(null);
      }, 1500);
      fetchDashboardData(true);
    } catch (err) {
      setRegisterErrorMsg(err.response?.data?.error?.message || err.message || 'Registration failed.');
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  if (loading && !data) {
    return <DashboardSkeleton role="receptionist" />;
  }

  const counts = data?.counts || {
    today_total: 0,
    pending_requests: 0,
    confirmed_today: 0,
    checked_in: 0,
    waiting: 0,
    in_consultation: 0,
    completed_today: 0,
    cancelled_today: 0,
  };

  const schedule = data?.today_schedule || [];
  const waitingList = data?.waiting_list || [];
  const pendingReview = data?.pending_review || [];

  // Filter schedule based on search and status
  const filteredSchedule = schedule.filter((item) => {
    const fullName = `${item.patient_first_name || ''} ${item.patient_last_name || ''}`.toLowerCase();
    const serviceName = (item.service_name || '').toLowerCase();
    const doctorName = `${item.dentist_first_name || ''} ${item.dentist_last_name || ''}`.toLowerCase();
    const phone = (item.patient_phone || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(q) || serviceName.includes(q) || doctorName.includes(q) || phone.includes(q);
    const matchesFilter = attendanceFilter === 'ALL' || item.attendance_status === attendanceFilter;

    return matchesSearch && matchesFilter;
  });

  const receptionistName =
    user?.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : user?.display_name && !String(user.display_name).includes('@')
      ? user.display_name
      : 'Front Desk Specialist';

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12304A] dark:bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-teal-500/30 dark:border-teal-400/30 text-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12304A] to-[#1E3A8A] dark:from-[#0f2438] dark:to-[#172c64] dark:border dark:border-slate-700/80 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Front Desk Operations
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Desk
              </span>
            </div>
            <p className="text-slate-300 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Clinic Time: {data?.clinic_time || 'Asia/Manila (PST)'}</span>
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {receptionistName}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm shadow-sm transition-all focus:ring-2 focus:ring-teal-400/50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </button>
            <button
              onClick={() => onNavigateTab?.('triage')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 transition-all"
            >
              <Calendar className="w-4 h-4 text-teal-300" />
              <span>Review Queue ({counts.pending_requests})</span>
            </button>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 transition-all disabled:opacity-50"
              title="Refresh Clinic Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to refresh dashboard data</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 7 Operational KPI Summary Cards */}
      <div className="portal-grid-7">
        {[
          {
            key: 'today_total',
            label: "Today's Visits",
            value: counts.today_total,
            subtitle: 'Total scheduled',
            Icon: Calendar,
            topBar: 'from-slate-400 via-indigo-400 to-slate-500',
            glow: 'bg-indigo-400/15 dark:bg-indigo-400/15',
            iconBox:
              'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700/80 dark:to-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-600/70',
            valueColor: 'text-[#12304A] dark:text-white',
            borderHover: 'hover:border-slate-300 dark:hover:border-gray-600',
          },
          {
            key: 'pending_requests',
            label: 'Pending Review',
            value: counts.pending_requests,
            subtitle: 'Awaiting triage',
            Icon: Clock,
            topBar: 'from-amber-400 via-orange-400 to-amber-500',
            glow: 'bg-amber-400/20 dark:bg-amber-400/15',
            iconBox:
              'bg-gradient-to-br from-amber-500/15 to-orange-500/10 dark:from-amber-400/20 dark:to-orange-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-700/70',
            valueColor: 'text-amber-600 dark:text-amber-400',
            borderHover: 'border-amber-200/90 dark:border-amber-700/60 hover:border-amber-400 dark:hover:border-amber-500',
            onClick: () => onNavigateTab?.('triage'),
            highlightPulse: counts.pending_requests > 0,
          },
          {
            key: 'confirmed_today',
            label: 'Confirmed',
            value: counts.confirmed_today,
            subtitle: 'Ready for arrival',
            Icon: CheckCircle2,
            topBar: 'from-blue-400 via-indigo-500 to-blue-500',
            glow: 'bg-blue-400/20 dark:bg-blue-400/15',
            iconBox:
              'bg-gradient-to-br from-blue-500/15 to-indigo-500/10 dark:from-blue-400/20 dark:to-indigo-500/10 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-700/70',
            valueColor: 'text-blue-600 dark:text-blue-400',
            borderHover: 'hover:border-blue-300 dark:hover:border-blue-600/70',
          },
          {
            key: 'checked_in',
            label: 'Checked In',
            value: counts.checked_in,
            subtitle: 'At the clinic',
            Icon: UserCheck,
            topBar: 'from-emerald-400 via-green-500 to-emerald-500',
            glow: 'bg-emerald-400/20 dark:bg-emerald-400/15',
            iconBox:
              'bg-gradient-to-br from-emerald-500/15 to-green-500/10 dark:from-emerald-400/20 dark:to-green-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-700/70',
            valueColor: 'text-emerald-600 dark:text-emerald-400',
            borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-600/70',
          },
          {
            key: 'waiting',
            label: 'Waiting Room',
            value: counts.waiting,
            subtitle: counts.in_consultation > 0 ? `Queued · ${counts.in_consultation} in chair` : 'Queued',
            Icon: Timer,
            topBar: 'from-teal-400 via-[#0D9488] to-cyan-500',
            glow: 'bg-teal-400/20 dark:bg-teal-400/15',
            iconBox:
              'bg-gradient-to-br from-teal-500/15 to-cyan-500/10 dark:from-teal-400/20 dark:to-cyan-500/10 text-[#0F766E] dark:text-teal-300 border-teal-200/80 dark:border-teal-700/70',
            valueColor: 'text-[#0D9488] dark:text-teal-400',
            borderHover: 'hover:border-teal-300 dark:hover:border-teal-600/70',
          },
          {
            key: 'completed_today',
            label: 'Completed',
            value: counts.completed_today,
            subtitle: 'Visits finished',
            Icon: CheckCircle2,
            topBar: 'from-sky-400 via-cyan-500 to-blue-500',
            glow: 'bg-sky-400/20 dark:bg-sky-400/15',
            iconBox:
              'bg-gradient-to-br from-sky-500/15 to-cyan-500/10 dark:from-sky-400/20 dark:to-cyan-500/10 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-700/70',
            valueColor: 'text-slate-800 dark:text-slate-100',
            borderHover: 'hover:border-sky-300 dark:hover:border-sky-600/70',
          },
          {
            key: 'cancelled_today',
            label: 'Cancelled',
            value: counts.cancelled_today,
            subtitle: 'No-show / cancelled',
            Icon: XCircle,
            topBar: 'from-rose-400 via-pink-500 to-rose-500',
            glow: 'bg-rose-400/20 dark:bg-rose-400/15',
            iconBox:
              'bg-gradient-to-br from-rose-500/15 to-pink-500/10 dark:from-rose-400/20 dark:to-pink-500/10 text-rose-600 dark:text-rose-300 border-rose-200/80 dark:border-rose-700/70',
            valueColor: 'text-rose-600 dark:text-rose-400',
            borderHover: 'hover:border-rose-300 dark:hover:border-rose-600/70',
          },
        ].map(({ key, label, value, subtitle, Icon, topBar, glow, iconBox, valueColor, borderHover, onClick, highlightPulse }) => {
          const isInteractive = typeof onClick === 'function';
          const Wrapper = isInteractive ? 'button' : 'div';
          return (
            <Wrapper
              key={key}
              {...(isInteractive ? { type: 'button', onClick } : {})}
              className={`group relative overflow-hidden w-full text-left bg-white dark:bg-gray-800/90 rounded-2xl p-4 border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:shadow-md dark:hover:shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between gap-3 ${borderHover} ${
                isInteractive ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400' : ''
              }`}
            >
              {/* Top Gradient Accent Bar */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topBar} transition-opacity duration-200 ${
                  highlightPulse ? 'opacity-100' : 'opacity-65 group-hover:opacity-100'
                }`}
              />

              {/* Subtle Corner Ambient Glow */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-300 ${glow} ${
                  highlightPulse ? 'opacity-90' : 'opacity-0 group-hover:opacity-80'
                }`}
              />

              {/* Top Row: Label + Framed Icon */}
              <div className="relative flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  {highlightPulse && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    {label}
                  </span>
                </div>
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconBox}`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>

              {/* Bottom Row: Numeral + Subtitle */}
              <div className="relative">
                <span className={`block text-3xl font-extrabold tracking-tight tabular-nums leading-none ${valueColor}`}>
                  {value}
                </span>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                  {subtitle}
                </p>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Main Grid: Waiting List & Today's Schedule */}
      <div className="portal-split-1-2 items-start">
        {/* Left Column: Live Waiting Room Queue & Pending Review (1 Col) */}
        <div className="min-w-0 space-y-5">
          {/* Waiting Room Queue */}
          <section
            aria-label="Waiting Room Queue"
            className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                    Waiting Room Queue
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Patients on-site awaiting treatment
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 tabular-nums ${
                  waitingList.length > 0
                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-500/25'
                    : 'bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-gray-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    waitingList.length > 0 ? 'bg-teal-500 dark:bg-teal-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span>{waitingList.length} Active</span>
              </span>
            </div>

            <div className="p-4">
              {waitingList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/35 py-8 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                    <UserCheck className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    No patients waiting
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                    Checked-in patients will appear here automatically with live wait times.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-700/70 -my-1">
                  {waitingList.map((item) => {
                    const isInChair = item.status === 'IN_CONSULTATION';
                    return (
                      <div key={item.id} className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
                            {getInitials(item.patient_first_name, item.patient_last_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                                {item.patient_first_name} {item.patient_last_name}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isInChair
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/25'
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isInChair ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                                  aria-hidden="true"
                                />
                                {isInChair ? 'In Chair' : 'Waiting'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {item.service_name} · Dr. {item.dentist_first_name} {item.dentist_last_name}
                            </p>
                            <div className="flex items-center gap-2.5 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                                <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                                {item.waiting_minutes !== null ? `${item.waiting_minutes}m wait` : 'Just checked in'}
                              </span>
                              <span className="text-slate-300 dark:text-gray-600" aria-hidden="true">•</span>
                              <span>{formatClockTime(item.start_at)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceModalTarget(item);
                            setAttendanceStatusChoice(isInChair ? 'FINISHED' : 'IN_CONSULTATION');
                          }}
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors shrink-0 cursor-pointer ${
                            isInChair
                              ? 'border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200'
                              : 'bg-[#0D9488] hover:bg-[#0F766E] text-white'
                          }`}
                        >
                          {isInChair ? 'Finish Visit' : 'Call to Chair'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Pending Review Queue */}
          <section
            aria-label="Pending Review Queue"
            className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  Pending Review Queue
                </h3>
                {pendingReview.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25 tabular-nums">
                    {pendingReview.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.('triage')}
                className="group tch-tap text-xs text-[#0F766E] dark:text-teal-400 hover:text-[#0D9488] dark:hover:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>

            {pendingReview.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No pending appointment requests to review.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-700/70">
                {pendingReview.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigateTab?.('triage')}
                    className="group w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-gray-700/35 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {getInitials(item.patient_first_name, item.patient_last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {item.patient_first_name} {item.patient_last_name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.service_name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                          {formatShortSlot(item.start_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden="true" />
                        Pending
                      </span>
                      <ChevronRight
                        className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Today's Front Desk Schedule (2 Cols) */}
        <div className="min-w-0">
          <section
            aria-label="Today's Clinic Schedule"
            className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col"
          >
            {/* Header with Inline Search and Status Dropdown */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700/80 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      Today's Clinic Schedule
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                      {schedule.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage arrivals, check-ins, and consultation progress
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full xl:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <label htmlFor="receptionist-schedule-search" className="sr-only">
                    Search patient or service
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="receptionist-schedule-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patient or service..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-600/90 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 bg-slate-50/70 dark:bg-gray-900/60 focus:bg-white dark:focus:bg-gray-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear schedule search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="sm:w-40 shrink-0">
                  <label htmlFor="receptionist-schedule-status" className="sr-only">
                    Filter schedule by desk status
                  </label>
                  <select
                    id="receptionist-schedule-status"
                    aria-label="Filter schedule by desk status"
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-600/90 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 bg-slate-50/70 dark:bg-gray-900/60 text-slate-700 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="NOT_ARRIVED">Not Arrived</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="WAITING">Waiting</option>
                    <option value="IN_CONSULTATION">In Chair</option>
                    <option value="FINISHED">Finished</option>
                    <option value="NO_SHOW">No Show</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Schedule Table / List */}
            <div className="overflow-x-auto">
              {filteredSchedule.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/35 py-12 px-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                      <Calendar className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      No appointments found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {searchQuery || attendanceFilter !== 'ALL'
                        ? 'Try clearing your search or status filter.'
                        : 'No appointments scheduled for today.'}
                    </p>
                    {(searchQuery || attendanceFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setAttendanceFilter('ALL');
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
                  <thead role="rowgroup">
                    <tr
                      role="row"
                      className="border-b border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/45 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]"
                    >
                      <th role="columnheader" className="py-3 px-5">Time</th>
                      <th role="columnheader" className="py-3 px-4">Patient</th>
                      <th role="columnheader" className="py-3 px-4">Service &amp; Provider</th>
                      <th role="columnheader" className="py-3 px-4">Lifecycle</th>
                      <th role="columnheader" className="py-3 px-4">Desk State</th>
                      <th role="columnheader" className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
                    {filteredSchedule.map((apt) => {
                      const startTime = formatClockTime(apt.start_at);
                      const endTime = formatClockTime(apt.end_at);
                      const isArrived = apt.attendance_status && apt.attendance_status !== 'NOT_ARRIVED';
                      const lifecycle = LIFECYCLE_STYLES[apt.appointment_status] || {
                        label: apt.appointment_status || 'Unknown',
                        badge: 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600',
                        dot: 'bg-slate-400',
                      };
                      const deskState = DESK_STATE_STYLES[apt.attendance_status] || DESK_STATE_STYLES.NOT_ARRIVED;

                      return (
                        <tr
                          role="row"
                          key={apt.id}
                          className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          {/* Time */}
                          <td role="cell" data-label="Time" className="py-3.5 px-5 whitespace-nowrap tabular-nums">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {startTime}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              – {endTime}
                            </span>
                          </td>

                          {/* Patient */}
                          <td role="cell" data-label="Patient" className="py-3.5 px-4">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
                                {getInitials(apt.patient_first_name, apt.patient_last_name)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                  {apt.patient_first_name} {apt.patient_last_name}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 tabular-nums">
                                  <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                                  {apt.patient_phone || 'No phone'}
                                </span>
                                {apt.patient_medical_alerts && apt.patient_medical_alerts !== 'None recorded' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full mt-1 border border-rose-200/80 dark:border-rose-500/25">
                                    <ShieldAlert className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                    {apt.patient_medical_alerts}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Service & Provider */}
                          <td role="cell" data-label="Service & Provider" className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                              {apt.service_name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                              Dr. {apt.dentist_first_name} {apt.dentist_last_name}
                              <span className="mx-1.5 text-slate-300 dark:text-gray-600" aria-hidden="true">·</span>
                              <span className="text-slate-400 dark:text-slate-500">{apt.operatory_chair || 'Chair 1'}</span>
                            </span>
                          </td>

                          {/* Lifecycle Status */}
                          <td role="cell" data-label="Lifecycle" className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${lifecycle.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${lifecycle.dot}`} aria-hidden="true" />
                              {lifecycle.label}
                            </span>
                          </td>

                          {/* Attendance Status */}
                          <td role="cell" data-label="Desk State" className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${deskState.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${deskState.dot}`} aria-hidden="true" />
                              {deskState.label}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td role="cell" data-label="Action" className="py-3.5 px-5 text-right whitespace-nowrap">
                            {!isArrived && apt.appointment_status === 'CONFIRMED' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInTarget(apt);
                                  setCheckInNotes('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                              >
                                Check In
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAttendanceModalTarget(apt);
                                  setAttendanceStatusChoice(apt.attendance_status || 'WAITING');
                                  setAttendanceNotes(apt.attendance_notes || '');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                              >
                                Manage
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Subtle Schedule Footer */}
            {schedule.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-900/35 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">
                  Showing <strong className="font-semibold text-slate-700 dark:text-slate-200">{filteredSchedule.length}</strong> of{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">{schedule.length}</strong> scheduled today
                </span>
                {(searchQuery || attendanceFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setAttendanceFilter('ALL');
                    }}
                    className="font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* MODAL 1: Quick Check-In Modal */}
      {checkInTarget && (
        <DialogOverlay
          onClose={() => setCheckInTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Patient Arrival</h3>
              </div>
              <button
                onClick={() => setCheckInTarget(null)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Confirm check-in for <strong className="text-slate-900 dark:text-slate-100">{checkInTarget.patient_first_name} {checkInTarget.patient_last_name}</strong>?
              </p>
              <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl space-y-1 text-xs border border-slate-200/70 dark:border-gray-700">
                <p><span className="text-slate-400 dark:text-slate-500">Service:</span> {checkInTarget.service_name}</p>
                <p><span className="text-slate-400 dark:text-slate-500">Dentist:</span> Dr. {checkInTarget.dentist_first_name} {checkInTarget.dentist_last_name}</p>
                <p><span className="text-slate-400 dark:text-slate-500">Scheduled Time:</span> {checkInTarget.start_at ? checkInTarget.start_at.substring(11, 16) : ''}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Desk Arrival Notes (Optional)
                </label>
                <input
                  type="text"
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="e.g. Arrived on time, ID verified, health declaration completed."
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckInTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformCheckIn}
                disabled={isCheckingIn}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 dark:bg-teal-700 hover:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {isCheckingIn ? 'Checking in...' : 'Confirm Check-In'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* MODAL 2: Manage Attendance State Modal */}
      {attendanceModalTarget && (
        <DialogOverlay
          onClose={() => setAttendanceModalTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Update Attendance State</h3>
              <button
                onClick={() => setAttendanceModalTarget(null)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Patient: <strong className="text-slate-900 dark:text-slate-100">{attendanceModalTarget.patient_first_name} {attendanceModalTarget.patient_last_name}</strong>
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Attendance Status</label>
                <select
                  value={attendanceStatusChoice}
                  onChange={(e) => setAttendanceStatusChoice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="CHECKED_IN">Checked In (Front Desk)</option>
                  <option value="WAITING">Waiting in Lobby</option>
                  <option value="IN_CONSULTATION">In Chair / In Consultation</option>
                  <option value="FINISHED">Visit Finished</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={attendanceNotes}
                  onChange={(e) => setAttendanceNotes(e.target.value)}
                  placeholder="e.g. Sent to Operatory Chair 1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAttendanceModalTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateAttendanceStatus}
                disabled={isUpdatingAttendance}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#12304A] dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {isUpdatingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* MODAL 3: Walk-In Patient Registration Modal */}
      {isRegisterOpen && (
        <DialogOverlay
          onClose={() => setIsRegisterOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 max-h-[90dvh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Walk-In Patient Intake</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            {registerSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                {registerSuccessMsg}
              </div>
            )}

            {registerErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                {registerErrorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.first_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.last_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="+639171234567"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={registerForm.date_of_birth}
                    onChange={(e) => setRegisterForm({ ...registerForm, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={registerForm.gender}
                    onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={registerForm.address}
                  onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                  placeholder="Street, City, Metro Manila"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={registerForm.emergency_contact_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={registerForm.emergency_contact_phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Medical Alerts / Allergies</label>
                <input
                  type="text"
                  value={registerForm.medical_alerts}
                  onChange={(e) => setRegisterForm({ ...registerForm, medical_alerts: e.target.value })}
                  placeholder="e.g. Penicillin allergy, Hypertension (or 'None recorded')"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRegister}
                  className="px-5 py-2 font-semibold rounded-xl bg-teal-600 dark:bg-teal-700 hover:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
                >
                  {isSubmittingRegister ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default ReceptionistDashboard;
