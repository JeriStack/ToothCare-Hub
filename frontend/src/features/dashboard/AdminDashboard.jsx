import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Stethoscope,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Shield,
  Key,
  Activity,
  BarChart3,
  Server,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { dashboardApi } from './api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';

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

export function AdminDashboard({ onNavigateTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  // Keep live Asia/Manila clock ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) {
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
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
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

  if (loading && !metrics) {
    return <DashboardSkeleton role="admin" />;
  }

  if (error && !metrics) {
    return (
      <div
        role="alert"
        className="bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center space-y-3"
      >
        <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-rose-900 dark:text-rose-100">
          Failed to Load Clinic Dashboard
        </h2>
        <p className="text-sm text-rose-700 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={fetchMetrics}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Executive Header with Asia/Manila Time */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#12304A] to-[#1e496e] dark:from-[#0f2438] dark:to-[#173a53] dark:border dark:border-slate-700/80 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Clinic Executive Dashboard
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30">
              Admin Control Center
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Asia/Manila (UTC+8): <strong className="text-teal-200">{currentTime}</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {metrics?.generated_at && (
            <span className="text-xs text-slate-300 font-mono hidden md:inline">
              Updated: {new Date(metrics.generated_at).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-[#12304A] bg-teal-400 hover:bg-teal-300 transition-colors shadow-sm disabled:opacity-50 font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Intelligence
          </button>
        </div>
      </div>

      {/* System Health & Security Alerts Banner */}
      {(systemAlerts.pending_triage > 0 || systemAlerts.recent_security_events > 0 || systemAlerts.active_rate_limits > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/45 border border-amber-200/80 dark:border-amber-800/70 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Operational & Security Alerts</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {systemAlerts.pending_triage > 0 && `${systemAlerts.pending_triage} pending appointment(s) require review. `}
                {systemAlerts.recent_security_events > 0 && `${systemAlerts.recent_security_events} failed login/lockout attempt(s) in last 24h. `}
                {systemAlerts.active_rate_limits > 0 && `${systemAlerts.active_rate_limits} IP/account(s) currently throttled.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {systemAlerts.pending_triage > 0 && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('triage')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Review Triage
              </button>
            )}
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('audit')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors"
              >
                View Audit Trail
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Administrative Action Bar */}
      <div className="portal-grid-6">
        <button
          onClick={() => onNavigateTab?.('users')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">User Accounts</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Manage Staff</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('roles')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Key className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">DRBAC Matrix</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Permissions</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('audit')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Audit Trail</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Forensic Logs</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('reports')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Reports</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Analytics</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('schedules')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Clinic Hours</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Operating Sched</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('system')}
          className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Server className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">System Health</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400">Services & Backup</span>
        </button>
      </div>

      {/* Core Aggregate Metric Cards (11 Executive Metrics) */}
      <div className="portal-grid-4">
        {/* Metric 1 & 2: Patients (Total & Active) */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-600 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered Patients
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
            {counts.patients.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
              <UserCheck className="w-3 h-3" />
              {counts.patients.active} active
            </span>
            {counts.patients.inactive > 0 && (
              <span className="text-slate-400 dark:text-slate-500">({counts.patients.inactive} inactive)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('patients')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 dark:text-teal-400 pt-3 border-t border-slate-100 dark:border-gray-700 hover:text-teal-800 dark:hover:text-teal-300"
            >
              <span>View Patient Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 2: Active Dentists */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-600 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Dentists
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-xl group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
            {counts.dentists.active}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
              <CheckCircle className="w-3 h-3" />
              {counts.dentists.total} total licensed
            </span>
            {counts.dentists.inactive > 0 && (
              <span className="text-slate-400 dark:text-slate-500">({counts.dentists.inactive} inactive)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('dentists')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 dark:text-teal-400 pt-3 border-t border-slate-100 dark:border-gray-700 hover:text-teal-800 dark:hover:text-teal-300"
            >
              <span>View Dentist Roster</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 3: Active Dental Services */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-600 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Services
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
            {counts.services.active}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/50 px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" />
              {counts.services.total} total catalog
            </span>
            {counts.services.inactive > 0 && (
              <span className="text-slate-400 dark:text-slate-500">({counts.services.inactive} archived)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('services')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 dark:text-teal-400 pt-3 border-t border-slate-100 dark:border-gray-700 hover:text-teal-800 dark:hover:text-teal-300"
            >
              <span>Manage Service Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 6: Total Appointments */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-600 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Appointments
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-xl group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
            {counts.appointments.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/50 px-2 py-0.5 rounded-md">
              {counts.appointments.today} today
            </span>
            <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/50 px-2 py-0.5 rounded-md font-semibold">
              {counts.appointments.pending} pending
            </span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('triage')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 dark:text-teal-400 pt-3 border-t border-slate-100 dark:border-gray-700 hover:text-teal-800 dark:hover:text-teal-300"
            >
              <span>Review Bookings Triage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Appointment Breakdown Row (Metrics 7, 8, 9, 10, 11) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Appointment Status Lifecycle Distribution
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">Real-time status metrics</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-teal-700 text-white text-center shadow-xs">
            <span className="text-xs font-medium text-teal-100 block mb-1">Today's Appointments</span>
            <span className="text-2xl font-extrabold">{counts.appointments.today}</span>
          </div>
          <div className="p-4 rounded-xl bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/70 text-center">
            <span className="text-xs font-semibold text-sky-800 dark:text-sky-300 block mb-1">Upcoming Appointments</span>
            <span className="text-2xl font-bold text-sky-900 dark:text-sky-200">{counts.appointments.upcoming ?? 0}</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/70 text-center">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block mb-1">Pending Requests</span>
            <span className="text-2xl font-bold text-amber-900 dark:text-amber-200">{counts.appointments.pending}</span>
          </div>
          <div className="p-4 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/70 text-center">
            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 block mb-1">Confirmed Appointments</span>
            <span className="text-2xl font-bold text-teal-900 dark:text-teal-200">{counts.appointments.confirmed}</span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 text-center">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-1">Completed Visits</span>
            <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">{counts.appointments.completed}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-center">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Cancelled Appointments</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{counts.appointments.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Operational Visibility: 14-Day Trend + Outbox & Safe Error Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-Day Appointment Trend */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              14-Day Appointment Trend
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Asia/Manila</span>
          </div>
          {appointmentTrends.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
              No appointment history recorded in the last 14 days.
            </p>
          ) : (
            (() => {
              const maxDay = Math.max(1, ...appointmentTrends.map((d) => d.total || 0));
              return (
                <div className="flex items-end gap-1.5 h-28 pt-2" role="img" aria-label="14-day daily appointment volume bar chart">
                  {appointmentTrends.map((day) => {
                    const pct = Math.max(6, Math.round(((day.total || 0) / maxDay) * 100));
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full rounded-t-md bg-teal-500/80 dark:bg-teal-400/80 transition-all"
                          style={{ height: `${day.total > 0 ? pct : 4}%` }}
                          title={`${day.date}: ${day.total} appointment(s)`}
                        />
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate">
                          {day.date.slice(8)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        {/* Outbox Delivery Health */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Outbox Delivery Health
            </h3>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('system')}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                Inspect
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50">
              <span className="text-amber-700 dark:text-amber-300 block">Pending / Retry</span>
              <strong className="text-lg text-amber-900 dark:text-amber-200">{outboxSummary.totals.pending}</strong>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/50">
              <span className="text-sky-700 dark:text-sky-300 block">Processing</span>
              <strong className="text-lg text-sky-900 dark:text-sky-200">{outboxSummary.totals.processing}</strong>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
              <span className="text-emerald-700 dark:text-emerald-300 block">Delivered</span>
              <strong className="text-lg text-emerald-900 dark:text-emerald-200">{outboxSummary.totals.completed}</strong>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/50">
              <span className="text-rose-700 dark:text-rose-300 block">Failed</span>
              <strong className="text-lg text-rose-900 dark:text-rose-200">{outboxSummary.totals.failed}</strong>
            </div>
          </div>
        </div>

        {/* Recent Safe Operational Errors */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Operational Errors
            </h3>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {recentErrors.length} recent
            </span>
          </div>
          {recentErrors.length === 0 ? (
            <div className="py-6 text-center text-xs text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-6 h-6 mx-auto mb-1.5 text-emerald-600 dark:text-emerald-400" />
              No recent delivery or security errors recorded.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-gray-700 text-xs">
              {recentErrors.slice(0, 4).map((errItem) => (
                <li key={errItem.id} className="py-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-rose-700 dark:text-rose-300 uppercase text-[10px]">
                      {errItem.module} • {errItem.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {errItem.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{errItem.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Operational Overview: Today's Clinical Schedule & Review Queue */}
      <div className="portal-split-2">
        {/* Today's Schedule */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Today's Clinical Schedule</h3>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              {todaySchedule.length} patient(s) today
            </span>
          </div>
          <div className="p-4 flex-1">
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">No appointments scheduled for today yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                {todaySchedule.map((appt) => (
                  <li key={appt.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                        {appt.patient_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {appt.service_name} • {appt.dentist_name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 block">
                        {appt.start_at?.split(' ')[1]?.substring(0, 5)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-teal-50 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300'
                            : appt.status === 'COMPLETED'
                            ? 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Review Queue Peek (Pending Requests) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Review Queue (Pending Triage)</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('triage')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                Go to Triage
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400 dark:text-emerald-500" />
                <p className="text-xs">Review queue is clear! No pending booking requests.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                {reviewQueue.map((req) => (
                  <li key={req.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                        {req.patient_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {req.service_name} • Requested: {req.start_at?.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                        PENDING
                      </span>
                      {onNavigateTab && (
                        <button
                          onClick={() => onNavigateTab('triage')}
                          className="tch-tap text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                        >
                          Review
                        </button>
                      )}
                    </div>
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Recently Registered Patients</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('patients')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                View all
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recent.patients.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No patient records registered yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                {recent.patients.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">{p.email}</span>
                    </div>
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {p.created_at?.split(' ')[0]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recently Added Services */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Service Catalog & Fees</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('services')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                View all
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recent.services.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No services cataloged yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                {recent.services.map((s) => (
                  <li key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">{s.name}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {s.category} • {s.duration_minutes} mins
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        ₱{Number(s.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          s.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {s.is_active ? 'Active' : 'Archived'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Administrative & Clinical Activity Stream */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Recent Admin & Clinical Activity</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('audit')}
                className="tch-tap text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                Full Log
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No recent audit activity recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                {recentActivity.map((act) => (
                  <li key={act.id} className="py-2.5 flex items-start justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                        {act.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block">
                        {act.actor_email ? `${act.actor_email} (${act.actor_role})` : 'System Agent'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                      {act.created_at?.split(' ')[1]?.substring(0, 5) || act.created_at?.split('T')[1]?.substring(0, 5)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
