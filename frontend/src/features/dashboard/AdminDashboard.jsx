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
  UserCheck
} from 'lucide-react';
import { dashboardApi } from './api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';

export function AdminDashboard({ onNavigateTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError(
        err.response?.data?.error?.message ||
          'Failed to load operational metrics from MySQL database.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const counts = metrics?.counts || {
    patients: { total: 0, active: 0, inactive: 0 },
    dentists: { total: 0, active: 0, inactive: 0 },
    services: { total: 0, active: 0, inactive: 0 },
    appointments: {
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      today: 0,
    },
  };

  const recent = metrics?.recent || { patients: [], services: [] };

  if (loading && !metrics) {
    return <DashboardSkeleton role="admin" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Clinic Executive Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time clinical metrics, provider availability, procedure catalog, and patient records computed directly from MySQL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {metrics?.generated_at && (
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Updated: {new Date(metrics.generated_at).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchMetrics}
            className="text-xs font-semibold underline text-rose-800 hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Core Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Patients Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-teal-300 transition-all">
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
              <span className="text-slate-400">({counts.patients.inactive} disabled)</span>
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

        {/* Dentists Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-teal-300 transition-all">
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

        {/* Services Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-teal-300 transition-all">
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

        {/* Total Appointments Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Appointments
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

      {/* Appointment Breakdown Row */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Appointment Status Lifecycle Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-center">
            <span className="text-xs font-semibold text-amber-800 block mb-1">Awaiting Review</span>
            <span className="text-2xl font-bold text-amber-900">{counts.appointments.pending}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/60 text-center">
            <span className="text-xs font-semibold text-teal-800 block mb-1">Confirmed</span>
            <span className="text-2xl font-bold text-teal-900">{counts.appointments.confirmed}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-center">
            <span className="text-xs font-semibold text-emerald-800 block mb-1">Completed</span>
            <span className="text-2xl font-bold text-emerald-900">{counts.appointments.completed}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Cancelled</span>
            <span className="text-2xl font-bold text-slate-800">{counts.appointments.cancelled}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-teal-700 text-white text-center shadow-sm">
            <span className="text-xs font-medium text-teal-100 block mb-1">Today's Schedule</span>
            <span className="text-2xl font-extrabold">{counts.appointments.today}</span>
          </div>
        </div>
      </div>

      {/* Recent Streams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Registered Patients */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="font-semibold text-sm text-slate-900">Active Service Catalog</h3>
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
      </div>
    </div>
  );
}

export default AdminDashboard;

