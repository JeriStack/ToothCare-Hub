import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Stethoscope,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  UserCheck,
  Shield,
  Key,
  Activity,
  BarChart3,
  Server,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { dashboardApi } from './api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';

const CLINIC_TIME_ZONE = 'Asia/Manila';

const EMPTY_ADMIN_COUNTS = {
  patients: { total: 0, active: 0, inactive: 0 },
  dentists: { total: 0, active: 0, inactive: 0 },
  services: { total: 0, active: 0, inactive: 0 },
  appointments: {
    total: 0,
    pending: 0,
    confirmed: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0,
    today: 0,
  },
};

const QUICK_ADMIN_ACTIONS = [
  { key: 'users', label: 'User Accounts', subtitle: 'Manage Staff', icon: Users },
  { key: 'roles', label: 'DRBAC Matrix', subtitle: 'Permissions', icon: Key },
  { key: 'audit', label: 'Audit Trail', subtitle: 'Forensic Logs', icon: Activity },
  { key: 'reports', label: 'Reports', subtitle: 'Analytics', icon: BarChart3 },
  { key: 'schedules', label: 'Clinic Hours', subtitle: 'Operating Sched', icon: Clock },
  { key: 'system', label: 'System Health', subtitle: 'Services & Backup', icon: Server },
];

const SCHEDULE_STATUS_MAP = {
  CONFIRMED: {
    label: 'Confirmed',
    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
  },
  COMPLETED: {
    label: 'Completed',
    cls: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30',
  },
  PENDING: {
    label: 'Pending',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    cls: 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600',
  },
  REJECTED: {
    label: 'Declined',
    cls: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30',
  },
};

function getManilaTimeString(date = new Date()) {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleTimeString();
  }
}

function getClinicTodayIso() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatReadableDate(sqlDateOrDateTime, includeYear = true) {
  if (!sqlDateOrDateTime) return '—';
  const datePart = String(sqlDateOrDateTime).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    return new Date(`${datePart}T12:00:00+08:00`).toLocaleDateString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {}),
    });
  } catch {
    return datePart;
  }
}

function formatTime12h(sqlDateTime) {
  if (!sqlDateTime) return '';
  const raw = String(sqlDateTime);
  const timeMatch = raw.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!timeMatch) return '';
  const h = Number(timeMatch[1]);
  const m = Number(timeMatch[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateTimeShort(sqlDateTime) {
  if (!sqlDateTime) return '';
  const dateLabel = formatReadableDate(sqlDateTime, false);
  const timeLabel = formatTime12h(sqlDateTime);
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function getInitials(firstName = '', lastName = '') {
  const f = (firstName || '').trim().charAt(0);
  const l = (lastName || '').trim().charAt(0);
  return (f + l).toUpperCase() || 'PT';
}

function humanizeErrorSummary(summary = '') {
  if (!summary) return 'Operational event';
  return String(summary)
    .replace(/\bAUTH_LOGIN_RATE_LIMITED\b/g, 'Login rate limit triggered')
    .replace(/\bAUTH_LOGIN_FAILED\b/g, 'Failed sign-in attempt')
    .replace(/\bAUTH_LOGIN_BLOCKED\b/g, 'Sign-in temporarily blocked')
    .replace(/\bon users\b/gi, 'on user account');
}

function isAuthOnlyAction(action = '') {
  const upper = String(action).toUpperCase();
  return upper === 'AUTH_LOGIN_SUCCESS' || upper === 'AUTH_LOGOUT' || upper === 'AUTH_TOKEN_REFRESHED';
}

export function AdminDashboard({ onNavigateTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => getManilaTimeString());
  const [selectedTrendDate, setSelectedTrendDate] = useState(null);
  const [activityFilter, setActivityFilter] = useState('ALL'); // 'ALL' | 'CHANGES'

  // Keep live Asia/Manila clock ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getManilaTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMetrics = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await dashboardApi.getMetrics();
      if (data && data.counts) {
        setMetrics(data);
        setError(null);
      } else if (!silent) {
        setError('Dashboard metrics response was empty. Please retry.');
      }
    } catch (err) {
      if (!silent) {
        setError(
          err?.response?.data?.error?.message ||
            err?.message ||
            'Unable to load live clinic metrics from the database.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(false);
  }, [fetchMetrics]);

  useDashboardSync({
    role: 'ADMIN',
    domains: [
      DASHBOARD_SYNC_DOMAINS.ADMIN_DASHBOARD,
      DASHBOARD_SYNC_DOMAINS.APPOINTMENTS,
      DASHBOARD_SYNC_DOMAINS.SERVICES,
      DASHBOARD_SYNC_DOMAINS.SCHEDULES,
      DASHBOARD_SYNC_DOMAINS.ACCOUNTS,
    ],
    onRefresh: () => fetchMetrics(true),
  });

  const counts = metrics?.counts || EMPTY_ADMIN_COUNTS;
  const recent = metrics?.recent || { patients: [], services: [] };
  const todaySchedule = metrics?.today_schedule || [];
  const reviewQueue = metrics?.review_queue_peek || [];
  const recentActivity = metrics?.recent_activity || [];
  const appointmentTrends = metrics?.appointment_trends || [];
  const outboxSummary = metrics?.outbox_summary || {
    email_outbox: { pending: 0, processing: 0, sent: 0, retry_scheduled: 0, failed: 0, abandoned: 0 },
    realtime_outbox: { pending: 0, processing: 0, published: 0, failed_retryable: 0, failed_permanent: 0 },
    totals: { pending: 0, processing: 0, completed: 0, failed: 0 },
  };
  const recentErrors = metrics?.recent_errors || [];
  const systemAlerts = metrics?.system_alerts || {
    pending_triage: 0,
    unverified_users: 0,
    recent_security_events: 0,
    active_rate_limits: 0,
    failed_outbox_jobs: 0,
  };

  const trendStats = useMemo(() => {
    const total14d = appointmentTrends.reduce((sum, d) => sum + Number(d.total || 0), 0);
    const maxDay = Math.max(1, ...appointmentTrends.map((d) => Number(d.total || 0)));
    const activeDay =
      appointmentTrends.find((d) => d.date === selectedTrendDate) ||
      [...appointmentTrends].reverse().find((d) => Number(d.total || 0) > 0) ||
      appointmentTrends[appointmentTrends.length - 1] ||
      null;
    return { total14d, maxDay, activeDay };
  }, [appointmentTrends, selectedTrendDate]);

  const outboxHealth = useMemo(() => {
    const totals = outboxSummary.totals || { pending: 0, processing: 0, completed: 0, failed: 0 };
    const settled = Number(totals.completed || 0) + Number(totals.failed || 0);
    const deliveryRate = settled > 0 ? Math.round((Number(totals.completed || 0) / settled) * 100) : 100;
    const emailSent = Number(outboxSummary.email_outbox?.sent || 0);
    const realtimePublished = Number(outboxSummary.realtime_outbox?.published || 0);
    return { totals, deliveryRate, emailSent, realtimePublished };
  }, [outboxSummary]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === 'CHANGES') {
      return recentActivity.filter((act) => !isAuthOnlyAction(act.action));
    }
    return recentActivity;
  }, [recentActivity, activityFilter]);

  const lifecycleSegments = useMemo(() => {
    const appts = counts.appointments;
    const items = [
      { key: 'completed', label: 'Completed', count: Number(appts.completed || 0), color: 'bg-emerald-500 dark:bg-emerald-400' },
      { key: 'confirmed', label: 'Confirmed', count: Number(appts.confirmed || 0), color: 'bg-teal-500 dark:bg-teal-400' },
      { key: 'pending', label: 'Pending', count: Number(appts.pending || 0), color: 'bg-amber-500 dark:bg-amber-400' },
      { key: 'cancelled', label: 'Cancelled', count: Number(appts.cancelled || 0), color: 'bg-slate-400 dark:bg-slate-500' },
      { key: 'rejected', label: 'Declined', count: Number(appts.rejected || 0), color: 'bg-rose-500 dark:bg-rose-400' },
    ];
    const sum = items.reduce((acc, i) => acc + i.count, 0);
    return { items: items.filter((i) => i.count > 0), sum };
  }, [counts.appointments]);

  const navigateTab = (tab, options) => {
    if (!onNavigateTab) return;
    if (options) {
      onNavigateTab(tab, options);
    } else {
      onNavigateTab(tab);
    }
  };

  if (loading && !metrics) {
    return <DashboardSkeleton role="admin" />;
  }

  if (error && !metrics) {
    return (
      <div
        role="alert"
        className="bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center space-y-3"
      >
        <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" aria-hidden="true" />
        <h2 className="text-base font-bold text-rose-900 dark:text-rose-100">
          Failed to Load Clinic Dashboard
        </h2>
        <p className="text-sm text-rose-700 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={() => fetchMetrics(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const hasAlerts =
    systemAlerts.pending_triage > 0 ||
    systemAlerts.recent_security_events > 0 ||
    systemAlerts.active_rate_limits > 0 ||
    systemAlerts.failed_outbox_jobs > 0;

  const hasSecurityAlerts =
    systemAlerts.recent_security_events > 0 || systemAlerts.active_rate_limits > 0;

  const alertParts = [];
  if (systemAlerts.pending_triage > 0) {
    alertParts.push(
      `${systemAlerts.pending_triage} pending ${systemAlerts.pending_triage === 1 ? 'appointment requires' : 'appointments require'} review`
    );
  }
  if (systemAlerts.failed_outbox_jobs > 0) {
    alertParts.push(
      `${systemAlerts.failed_outbox_jobs} failed outbox ${systemAlerts.failed_outbox_jobs === 1 ? 'job' : 'jobs'}`
    );
  }
  if (systemAlerts.recent_security_events > 0) {
    alertParts.push(
      `${systemAlerts.recent_security_events} security ${systemAlerts.recent_security_events === 1 ? 'event' : 'events'} in the last 24h`
    );
  }
  if (systemAlerts.active_rate_limits > 0) {
    alertParts.push(
      `${systemAlerts.active_rate_limits} active rate ${systemAlerts.active_rate_limits === 1 ? 'limit' : 'limits'}`
    );
  }

  const todayIso = getClinicTodayIso();

  return (
    <div className="space-y-5">
      {/* Executive Header */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#12304A] dark:text-slate-50">
              Clinic Executive Dashboard
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30">
              Admin Control Center
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live clinic operations, triage workload, and delivery health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200/80 dark:border-gray-700 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
            <span className="text-slate-500 dark:text-slate-400">Asia/Manila (UTC+8):</span>
            <strong className="font-mono font-semibold text-slate-800 dark:text-teal-200">{currentTime}</strong>
          </div>
          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard metrics"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Contextual Operational Alerts Banner */}
      {hasAlerts && (
        <div
          role="status"
          className="bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/90 dark:border-amber-700/60 border-l-4 border-l-amber-500 rounded-2xl px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Action Required
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-0.5 leading-relaxed">
                {alertParts.join(' · ')}.
              </p>
            </div>
          </div>
          {onNavigateTab && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {systemAlerts.pending_triage > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTab('triage', { statusFilter: 'PENDING' })}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-xs cursor-pointer"
                >
                  Review Triage
                </button>
              )}
              {systemAlerts.failed_outbox_jobs > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTab('system')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  Inspect Outbox
                </button>
              )}
              {hasSecurityAlerts && (
                <button
                  type="button"
                  onClick={() => navigateTab('audit')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  View Audit Trail
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Administrative Action Bar */}
      <div className="portal-grid-6">
        {QUICK_ADMIN_ACTIONS.map(({ key, label, subtitle, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigateTab(key)}
            className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group cursor-pointer"
          >
            <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-400">{subtitle}</span>
          </button>
        ))}
      </div>

      {/* Core 4 KPI Cards (Interactive Drill-Down) */}
      <div className="portal-grid-4">
        <button
          type="button"
          onClick={() => navigateTab('patients')}
          className="text-left bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-teal-400 dark:hover:border-teal-500/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered Patients
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <Users className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
            {counts.patients.total}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md tabular-nums">
              <UserCheck className="w-3 h-3" aria-hidden="true" />
              {counts.patients.active} active
              {counts.patients.inactive > 0 ? ` · ${counts.patients.inactive} inactive` : ''}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTab('dentists')}
          className="text-left bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-teal-400 dark:hover:border-teal-500/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Dentists
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
            {counts.dentists.active}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md tabular-nums">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              {counts.dentists.total} licensed
              {counts.dentists.inactive > 0 ? ` · ${counts.dentists.inactive} inactive` : ''}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTab('services')}
          className="text-left bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-teal-400 dark:hover:border-teal-500/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Services
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
            {counts.services.active}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 px-2 py-0.5 rounded-md tabular-nums">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {counts.services.total} in catalog
              {counts.services.inactive > 0 ? ` · ${counts.services.inactive} archived` : ''}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTab('triage')}
          className="text-left bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-teal-400 dark:hover:border-teal-500/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Appointments
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <Calendar className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
            {counts.appointments.total}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <span className="font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 px-2 py-0.5 rounded-md">
                {counts.appointments.today} today
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-md">
                {counts.appointments.pending} pending
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
          </div>
        </button>
      </div>

      {/* Interactive Appointment Lifecycle Strip */}
      <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Appointment Lifecycle
          </h3>
          {counts.appointments.rejected > 0 && (
            <button
              type="button"
              onClick={() => navigateTab('triage', { statusFilter: 'REJECTED' })}
              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline tabular-nums cursor-pointer"
            >
              {counts.appointments.rejected} declined
            </button>
          )}
        </div>

        {/* Proportional Distribution Bar */}
        {lifecycleSegments.sum > 0 && (
          <div
            className="h-2 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden flex gap-0.5"
            aria-label="Appointment status proportion bar"
          >
            {lifecycleSegments.items.map((seg) => (
              <div
                key={seg.key}
                className={`${seg.color} h-full transition-all`}
                style={{ width: `${(seg.count / lifecycleSegments.sum) * 100}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => navigateTab('triage', { date: todayIso })}
            className="p-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-left transition-colors shadow-xs cursor-pointer"
          >
            <span className="text-[11px] font-medium text-teal-100 block">Today</span>
            <span className="text-2xl font-extrabold tabular-nums mt-0.5 block">
              {counts.appointments.today}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('triage')}
            className="p-3.5 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/25 hover:border-sky-400 dark:hover:border-sky-400/60 text-left transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 block">
              <span aria-hidden="true">Upcoming</span>
              <span className="sr-only">Upcoming Appointments</span>
            </span>
            <span className="text-2xl font-bold text-sky-900 dark:text-sky-100 tabular-nums mt-0.5 block">
              {counts.appointments.upcoming ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('triage', { statusFilter: 'PENDING' })}
            className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 hover:border-amber-400 dark:hover:border-amber-400/60 text-left transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">Pending</span>
            <span className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums mt-0.5 block">
              {counts.appointments.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('triage', { statusFilter: 'CONFIRMED' })}
            className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-500/25 hover:border-teal-400 dark:hover:border-teal-400/60 text-left transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 block">Confirmed</span>
            <span className="text-2xl font-bold text-teal-900 dark:text-teal-100 tabular-nums mt-0.5 block">
              {counts.appointments.confirmed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('triage', { statusFilter: 'COMPLETED' })}
            className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/25 hover:border-emerald-400 dark:hover:border-emerald-400/60 text-left transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">Completed</span>
            <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums mt-0.5 block">
              {counts.appointments.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('triage', { statusFilter: 'CANCELLED' })}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/65 border border-slate-200/80 dark:border-gray-700 hover:border-slate-400 dark:hover:border-gray-500 text-left transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">Cancelled</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5 block">
              {counts.appointments.cancelled}
            </span>
          </button>
        </div>
      </div>

      {/* Operational Visibility: 14-Day Trend + Outbox & Operational Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 14-Day Appointment Trend (Fixed proportional bar heights + interactive day inspector) */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>14-Day Appointment Trend</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-slate-300 tabular-nums">
              {trendStats.total14d} {trendStats.total14d === 1 ? 'visit' : 'visits'}
            </span>
          </div>

          {appointmentTrends.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">
              No appointment history recorded in the last 14 days.
            </p>
          ) : (
            <div className="space-y-2.5">
              <div
                className="flex items-end gap-1.5 h-28 pt-3 px-1 rounded-xl bg-slate-50/70 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700/60"
                role="img"
                aria-label="14-day daily appointment volume bar chart"
              >
                {appointmentTrends.map((day) => {
                  const total = Number(day.total || 0);
                  const heightPx = total > 0 ? Math.max(12, Math.round((total / trendStats.maxDay) * 76)) : 4;
                  const isActive = trendStats.activeDay?.date === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onMouseEnter={() => setSelectedTrendDate(day.date)}
                      onFocus={() => setSelectedTrendDate(day.date)}
                      onClick={() => setSelectedTrendDate(day.date)}
                      title={`${formatReadableDate(day.date, false)}: ${total} ${total === 1 ? 'visit' : 'visits'}`}
                      aria-label={`${formatReadableDate(day.date, false)}: ${total} visits`}
                      className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 min-w-0 pb-1.5 group cursor-pointer focus:outline-none"
                    >
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          total === 0
                            ? 'bg-slate-200 dark:bg-gray-700/80'
                            : isActive
                            ? 'bg-teal-500 dark:bg-teal-400 ring-2 ring-teal-500/30'
                            : 'bg-teal-500/70 dark:bg-teal-400/65 group-hover:bg-teal-500 dark:group-hover:bg-teal-400'
                        }`}
                        style={{ height: `${heightPx}px` }}
                      />
                      <span
                        className={`text-[9.5px] font-mono tabular-nums leading-none ${
                          isActive
                            ? 'text-teal-700 dark:text-teal-300 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {day.date.slice(8)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {trendStats.activeDay && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-0.5 tabular-nums">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {formatReadableDate(trendStats.activeDay.date, false)}
                  </span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {trendStats.activeDay.total || 0}
                    </strong>{' '}
                    {(trendStats.activeDay.total || 0) === 1 ? 'visit' : 'visits'}
                    {Number(trendStats.activeDay.completed || 0) > 0
                      ? ` · ${trendStats.activeDay.completed} completed`
                      : ''}
                    {Number(trendStats.activeDay.pending || 0) > 0
                      ? ` · ${trendStats.activeDay.pending} pending`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Outbox Delivery Health */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>Outbox Delivery Health</span>
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums ${
                  outboxHealth.totals.failed > 0
                    ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {outboxHealth.deliveryRate}% OK
              </span>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => navigateTab('system')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Inspect
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
              <span className="text-[11px] text-amber-700 dark:text-amber-300 block">Pending / Retry</span>
              <strong className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {outboxHealth.totals.pending}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-500/10 border border-sky-200/60 dark:border-sky-500/20">
              <span className="text-[11px] text-sky-700 dark:text-sky-300 block">Processing</span>
              <strong className="text-lg font-bold text-sky-900 dark:text-sky-100">
                {outboxHealth.totals.processing}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">Delivered</span>
              <strong className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {outboxHealth.totals.completed}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20">
              <span className="text-[11px] text-rose-700 dark:text-rose-300 block">Failed</span>
              <strong className="text-lg font-bold text-rose-900 dark:text-rose-100">
                {outboxHealth.totals.failed}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-gray-700/70 tabular-nums">
            <span>Email sent: <strong className="text-slate-700 dark:text-slate-200">{outboxHealth.emailSent}</strong></span>
            <span>Realtime events: <strong className="text-slate-700 dark:text-slate-200">{outboxHealth.realtimePublished}</strong></span>
          </div>
        </div>

        {/* Recent Safe Operational Errors */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>Operational Errors</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-slate-300 tabular-nums">
                {recentErrors.length} recent
              </span>
              {onNavigateTab && recentErrors.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTab('audit')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Log
                </button>
              )}
            </div>
          </div>

          {recentErrors.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-700 dark:text-emerald-300 flex-1 flex flex-col items-center justify-center">
              <ShieldCheck className="w-6 h-6 mb-1.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>No recent delivery or security errors recorded.</span>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-gray-700/80 text-xs flex-1">
              {recentErrors.slice(0, 4).map((errItem) => {
                const isWarning = String(errItem.severity || '').toUpperCase() === 'WARNING';
                return (
                  <li key={errItem.id} className="py-2 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          isWarning
                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {errItem.severity || 'Error'}
                      </span>
                      <span className="text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {formatDateTimeShort(errItem.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 truncate" title={errItem.summary}>
                      {humanizeErrorSummary(errItem.summary)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Operational Overview: Today's Schedule & Pending Triage Queue */}
      <div className="portal-split-2">
        {/* Today's Clinical Schedule */}
        <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Today's Clinical Schedule
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-slate-300 tabular-nums">
                {todaySchedule.length} {todaySchedule.length === 1 ? 'visit' : 'visits'}
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => navigateTab('triage', { date: todayIso })}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                View schedule
              </button>
            )}
          </div>

          <div className="p-4 flex-1">
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                <Clock className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <p className="text-xs">No appointments scheduled for today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700/80">
                {todaySchedule.map((appt) => {
                  const st = SCHEDULE_STATUS_MAP[appt.status] || {
                    label: appt.status,
                    cls: 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600',
                  };
                  return (
                    <li key={appt.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                          {appt.patient_name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                          {appt.service_name}
                          {appt.dentist_name ? ` · ${appt.dentist_name}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                          {formatTime12h(appt.start_at)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Pending Triage Queue */}
        <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Pending Triage Queue
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 tabular-nums">
                {counts.appointments.pending}
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => navigateTab('triage', { statusFilter: 'PENDING' })}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Open triage
              </button>
            )}
          </div>

          <div className="p-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
                <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                <p className="text-xs">All caught up—no pending booking requests.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700/80">
                {reviewQueue.map((req) => (
                  <li key={req.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                        {req.patient_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate tabular-nums">
                        {req.service_name}
                        {req.dentist_name ? ` · ${req.dentist_name}` : ''}
                        {' · '}
                        {formatDateTimeShort(req.start_at)}
                      </span>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => navigateTab('triage', { statusFilter: 'PENDING' })}
                        className="tch-tap shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-500/25 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recent Streams & Activity Grid */}
      <div className="portal-split-3">
        {/* Recently Registered Patients */}
        <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Recent Patients
              </h3>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => navigateTab('patients')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="p-4 flex-1">
            {recent.patients.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                No patient records registered yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700/80">
                {recent.patients.map((p) => (
                  <li key={p.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900 border border-slate-200/80 dark:border-gray-700 text-[#12304A] dark:text-slate-200 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {getInitials(p.first_name, p.last_name)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                          {p.email}
                        </span>
                      </div>
                    </div>
                    <span className="text-slate-400 dark:text-slate-500 text-[11px] tabular-nums shrink-0">
                      {formatReadableDate(p.created_at, false)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Service Catalog & Fees */}
        <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Service Catalog &amp; Fees
              </h3>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => navigateTab('services')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="p-4 flex-1">
            {recent.services.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                No services cataloged yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700/80">
                {recent.services.map((s) => (
                  <li key={s.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                        {s.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate tabular-nums">
                        {s.category} · {s.duration_minutes}m
                      </span>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        ₱{Number(s.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {!s.is_active && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          Archived
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Activity Stream with Auth Noise Filter */}
        <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                Recent Activity
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="inline-flex rounded-lg bg-slate-100 dark:bg-gray-900 p-0.5 text-[10.5px] font-semibold"
                role="group"
                aria-label="Filter recent activity"
              >
                <button
                  type="button"
                  onClick={() => setActivityFilter('ALL')}
                  aria-pressed={activityFilter === 'ALL'}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    activityFilter === 'ALL'
                      ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('CHANGES')}
                  aria-pressed={activityFilter === 'CHANGES'}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    activityFilter === 'CHANGES'
                      ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Changes
                </button>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => navigateTab('audit')}
                  className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Full Log
                </button>
              )}
            </div>
          </div>

          <div className="p-4 flex-1">
            {filteredActivity.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                {activityFilter === 'CHANGES'
                  ? 'No non-auth changes in the latest events.'
                  : 'No recent audit activity recorded.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700/80">
                {filteredActivity.slice(0, 6).map((act) => {
                  const authEvent = isAuthOnlyAction(act.action);
                  return (
                    <li key={act.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            authEvent
                              ? 'bg-slate-400 dark:bg-slate-500'
                              : 'bg-teal-500 dark:bg-teal-400'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate text-[11.5px]">
                            {act.action?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block">
                            {act.actor_email ? `${act.actor_email} (${act.actor_role})` : 'System'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                        {formatTime12h(act.created_at) || act.created_at?.slice(11, 16)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
