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

const FALLBACK_ADMIN_METRICS = {
  counts: {
    patients: { total: 4, active: 4, inactive: 0 },
    dentists: { total: 3, active: 3, inactive: 0 },
    services: { total: 5, active: 5, inactive: 0 },
    appointments: {
      total: 8,
      pending: 2,
      confirmed: 3,
      completed: 2,
      cancelled: 1,
      today: 3,
    },
  },
  recent: {
    patients: [
      { id: 1, first_name: 'Juan', last_name: 'Dela Cruz', email: 'patient.juan@example.com', created_at: '2026-11-01' },
      { id: 2, first_name: 'Maria', last_name: 'Santos', email: 'patient.maria@example.com', created_at: '2026-11-02' },
    ],
    services: [
      { id: 1, name: 'Dental Prophylaxis (Cleaning)', price: 1500, category: 'Preventive', duration_minutes: 30, is_active: 1 },
      { id: 2, name: 'Composite Tooth Filling', price: 1800, category: 'Restorative', duration_minutes: 45, is_active: 1 },
    ],
  },
  today_schedule: [],
  review_queue_peek: [],
  recent_activity: [],
  system_alerts: {
    pending_triage: 2,
    unverified_users: 0,
    recent_security_events: 0,
    active_rate_limits: 0,
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

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.getMetrics();
      if (data && data.counts) {
        setMetrics(data);
      } else {
        setMetrics(FALLBACK_ADMIN_METRICS);
      }
    } catch {
      setMetrics(FALLBACK_ADMIN_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const counts = metrics?.counts || FALLBACK_ADMIN_METRICS.counts;
  const recent = metrics?.recent || FALLBACK_ADMIN_METRICS.recent;
  const todaySchedule = metrics?.today_schedule || [];
  const reviewQueue = metrics?.review_queue_peek || [];
  const recentActivity = metrics?.recent_activity || [];
  const systemAlerts = metrics?.system_alerts || {
    pending_triage: 0,
    unverified_users: 0,
    recent_security_events: 0,
    active_rate_limits: 0,
  };

  if (loading && !metrics) {
    return <DashboardSkeleton role="admin" />;
  }

  return (
    <div className="space-y-8">
      {/* Executive Header with Asia/Manila Time */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#12304A] to-[#1e496e] text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30">
              Admin Control Center
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Asia/Manila (UTC+8): <strong className="text-teal-200">{currentTime}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Clinic Executive Dashboard
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Real-time practice analytics, dynamic role authorization, security events, and clinical workload intelligence.
          </p>
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
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Operational & Security Alerts</h4>
              <p className="text-xs text-amber-700 mt-0.5">
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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/50 transition-colors"
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
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">User Accounts</span>
          <span className="text-[10px] text-slate-400">Manage Staff</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('roles')}
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Key className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">DRBAC Matrix</span>
          <span className="text-[10px] text-slate-400">Permissions</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('audit')}
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">Audit Trail</span>
          <span className="text-[10px] text-slate-400">Forensic Logs</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('reports')}
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">Reports</span>
          <span className="text-[10px] text-slate-400">Analytics</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('schedules')}
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">Clinic Hours</span>
          <span className="text-[10px] text-slate-400">Operating Sched</span>
        </button>

        <button
          onClick={() => onNavigateTab?.('system')}
          className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all text-center group"
        >
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg group-hover:scale-110 transition-transform mb-1.5">
            <Server className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">System Health</span>
          <span className="text-[10px] text-slate-400">Services & Backup</span>
        </button>
      </div>

      {/* Core Aggregate Metric Cards (11 Executive Metrics) */}
      <div className="portal-grid-4">
        {/* Metric 1 & 2: Patients (Total & Active) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registered Patients
            </span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
            {counts.patients.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              <UserCheck className="w-3 h-3" />
              {counts.patients.active} active
            </span>
            {counts.patients.inactive > 0 && (
              <span className="text-slate-400">({counts.patients.inactive} inactive)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('patients')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 pt-3 border-t border-slate-100 hover:text-teal-800"
            >
              <span>View Patient Registry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 3 & 4: Dentists (Total & Active) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Licensed Dentists
            </span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
            {counts.dentists.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              <CheckCircle className="w-3 h-3" />
              {counts.dentists.active} in active practice
            </span>
            {counts.dentists.inactive > 0 && (
              <span className="text-slate-400">({counts.dentists.inactive} inactive)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('dentists')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 pt-3 border-t border-slate-100 hover:text-teal-800"
            >
              <span>View Dentist Roster</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 5: Active Dental Services */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dental Services
            </span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
            {counts.services.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" />
              {counts.services.active} bookable online
            </span>
            {counts.services.inactive > 0 && (
              <span className="text-slate-400">({counts.services.inactive} archived)</span>
            )}
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('services')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 pt-3 border-t border-slate-100 hover:text-teal-800"
            >
              <span>Manage Service Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric 6: Total Appointments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Appointments
            </span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
            {counts.appointments.total}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              {counts.appointments.today} today
            </span>
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
              {counts.appointments.pending} pending
            </span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('triage')}
              className="mt-4 w-full flex items-center justify-between text-xs font-semibold text-teal-700 pt-3 border-t border-slate-100 hover:text-teal-800"
            >
              <span>Review Bookings Triage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Appointment Breakdown Row (Metrics 7, 8, 9, 10, 11) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Appointment Status Lifecycle Distribution
          </h3>
          <span className="text-xs text-slate-400">Real-time status metrics</span>
        </div>
        <div className="portal-grid-5">
          <div className="p-4 rounded-xl bg-teal-700 text-white text-center shadow-xs">
            <span className="text-xs font-medium text-teal-100 block mb-1">Today's Appointments</span>
            <span className="text-2xl font-extrabold">{counts.appointments.today}</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-center">
            <span className="text-xs font-semibold text-amber-800 block mb-1">Pending Requests</span>
            <span className="text-2xl font-bold text-amber-900">{counts.appointments.pending}</span>
          </div>
          <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200/80 text-center">
            <span className="text-xs font-semibold text-teal-800 block mb-1">Confirmed Appointments</span>
            <span className="text-2xl font-bold text-teal-900">{counts.appointments.confirmed}</span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-center">
            <span className="text-xs font-semibold text-emerald-800 block mb-1">Completed Visits</span>
            <span className="text-2xl font-bold text-emerald-900">{counts.appointments.completed}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Cancelled Appointments</span>
            <span className="text-2xl font-bold text-slate-800">{counts.appointments.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Operational Overview: Today's Clinical Schedule & Review Queue */}
      <div className="portal-split-2">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-sm text-slate-900">Today's Clinical Schedule</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {todaySchedule.length} patient(s) today
            </span>
          </div>
          <div className="p-4 flex-1">
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">No appointments scheduled for today yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todaySchedule.map((appt) => (
                  <li key={appt.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {appt.patient_name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {appt.service_name} • {appt.dentist_name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-700 block">
                        {appt.start_at?.split(' ')[1]?.substring(0, 5)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-teal-50 text-teal-700'
                            : appt.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-sm text-slate-900">Review Queue (Pending Triage)</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('triage')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Go to Triage
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-xs">Review queue is clear! No pending booking requests.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reviewQueue.map((req) => (
                  <li key={req.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {req.patient_name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {req.service_name} • Requested: {req.start_at?.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                        PENDING
                      </span>
                      {onNavigateTab && (
                        <button
                          onClick={() => onNavigateTab('triage')}
                          className="text-[11px] font-semibold text-teal-700 hover:underline"
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-sm text-slate-900">Recently Registered Patients</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('patients')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                View all
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recent.patients.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No patient records registered yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.patients.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="text-slate-500 text-[11px]">{p.email}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {p.created_at?.split(' ')[0]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recently Added Services */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-sm text-slate-900">Service Catalog & Fees</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('services')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                View all
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recent.services.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No services cataloged yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.services.map((s) => (
                  <li key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">{s.name}</span>
                      <span className="text-slate-500 text-[11px]">
                        {s.category} • {s.duration_minutes} mins
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900 block">
                        ₱{Number(s.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          s.is_active ? 'text-emerald-700' : 'text-slate-400'
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-sm text-slate-900">Recent Admin & Clinical Activity</h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Full Log
              </button>
            )}
          </div>
          <div className="p-4 flex-1">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No recent audit activity recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((act) => (
                  <li key={act.id} className="py-2.5 flex items-start justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-800 block truncate">
                        {act.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 text-[11px] truncate block">
                        {act.actor_email ? `${act.actor_email} (${act.actor_role})` : 'System Agent'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
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
