import React, { useState, useEffect, useMemo } from 'react';
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

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
];

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

      setDashboardData(dash);
      setShifts(Array.isArray(s) ? s : []);
      setTimeOffList(Array.isArray(t) ? t : []);
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

      // Refresh time-off list
      const updatedTimeOff = await schedulesApi.getDentistTimeOff(dentistId).catch(() => []);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12304A]">Clinical Practice Overview</h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              <Stethoscope className="w-3 h-3 text-teal-600" />
              Dentist Workspace
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {clinician
              ? `Welcome back, Dr. ${clinician.first_name} ${clinician.last_name} (${clinician.specialization || 'Dental Practitioner'}) • PRC: ${clinician.license_number || 'Registered'}`
              : 'Your assigned daily schedule, patient appointments, and clinical treatment records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Manila Clinic Clock */}
          <div
            title="Clinic Local Time (Asia/Manila)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-medium shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="whitespace-nowrap">{liveClinicTime}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            title="Refresh clinical metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            className="text-xs font-bold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. 4 Live Metric Stat Cards */}
      <div className="portal-grid-4">
        {/* Today's Appointments */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('appointments')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab && onNavigateTab('appointments')}
          aria-label={`Today's Visits: ${metrics.todayCount} scheduled`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s Visits
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              {metrics.todayCount}
            </div>
            <p className="text-[11px] text-teal-700 font-medium mt-1">Scheduled for today</p>
          </div>
        </div>

        {/* Upcoming Confirmed */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('appointments')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab && onNavigateTab('appointments')}
          aria-label={`Upcoming Confirmed: ${metrics.upcomingCount} visits`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Upcoming Confirmed
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              {metrics.upcomingCount}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Confirmed clinical visits</p>
          </div>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('appointments')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab && onNavigateTab('appointments')}
          aria-label={`Awaiting Review: ${metrics.pendingCount} visits`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Awaiting Review
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              {metrics.pendingCount}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">Pending approval</p>
          </div>
        </div>

        {/* Completed Care */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab && onNavigateTab('treatment-records')}
          aria-label={`Completed Care: ${metrics.completedCount} visits`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Completed Care
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              {metrics.completedCount}
            </div>
            <p className="text-[11px] text-blue-700 font-medium mt-1">Treated & documented</p>
          </div>
        </div>
      </div>

      {/* 3. Next Patient / Next Appointment Card */}
      <div className="bg-gradient-to-r from-[#12304A] to-[#1E4D6B] rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-[#12304A]">Weekly Clinical Activity Summary</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">This Week (Mon - Sun)</span>
        </div>

        <div className="portal-grid-4">
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Completed This Week</span>
            <div className="mt-1 text-xl font-extrabold text-[#12304A]">
              {activitySummary.completed_this_week}
            </div>
            <p className="text-[10px] text-teal-700 font-semibold mt-0.5">Visits treated</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Upcoming This Week</span>
            <div className="mt-1 text-xl font-extrabold text-[#12304A]">
              {activitySummary.upcoming_this_week}
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Confirmed visits</p>
          </div>

          <div
            onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activitySummary.pending_documentation_count > 0
                ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
                : 'bg-slate-50/70 border-slate-100'
            }`}
          >
            <span className="text-[11px] font-medium text-slate-500">Pending Documentation</span>
            <div
              className={`mt-1 text-xl font-extrabold ${
                activitySummary.pending_documentation_count > 0 ? 'text-amber-800' : 'text-[#12304A]'
              }`}
            >
              {activitySummary.pending_documentation_count}
            </div>
            <p
              className={`text-[10px] font-semibold mt-0.5 ${
                activitySummary.pending_documentation_count > 0 ? 'text-amber-700' : 'text-slate-400'
              }`}
            >
              {activitySummary.pending_documentation_count > 0
                ? 'Chart notes needed • Click to view'
                : 'All charts signed'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Cancelled / Missed</span>
            <div className="mt-1 text-xl font-extrabold text-slate-700">
              {activitySummary.cancelled_this_week}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Adjusted visits</p>
          </div>
        </div>

        {/* Attention banner if pending documentation exists */}
        {activitySummary.pending_documentation_count > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Clinical Documentation Notice:</strong> You have{' '}
                {activitySummary.pending_documentation_count} completed visit(s) awaiting clinical procedure notes.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
              className="shrink-0 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
            >
              Document Now
            </button>
          </div>
        )}
      </div>

      {/* 5. Today's Appointment Queue & Clinical Sidebar (Grid 2:1) */}
      <div className="portal-split-2-1">
        {/* Today's Queue (2 Cols) */}
        <div data-testid="appointment-queue" className="min-w-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-[#12304A]">Today&apos;s Appointment Queue</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">
                {todayAppts.length} total
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('appointments')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
            >
              <span>View Full Workload</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search today's queue by patient, procedure, chair..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
              {queueSearch && (
                <button
                  type="button"
                  onClick={() => setQueueSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setQueueStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    queueStatusFilter === st
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment Items List */}
          {filteredQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-medium text-slate-600">
                {todayAppts.length === 0
                  ? 'No patient visits scheduled for today.'
                  : 'No appointments match your search or filter.'}
              </p>
              <p className="text-[11px] text-slate-400">
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
                  className="mt-2 text-xs font-bold text-teal-700 underline hover:text-teal-900"
                >
                  Reset Queue Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredQueue.map((appt) => {
                const hasAlerts = Boolean(appt.patient_medical_alerts);
                return (
                  <div
                    key={appt.id}
                    className="py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors cursor-pointer group"
                    onClick={() => onSelectAppointment && onSelectAppointment(appt.id)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#12304A]">
                          {appt.patient_first_name} {appt.patient_last_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            appt.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : appt.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : appt.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-700">
                          {appt.service_name || 'Dental Consultation'}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-teal-700">
                          {formatAppointmentTime(appt.start_at)}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          {appt.operatory_chair || 'Operatory Chair 1'}
                        </span>
                      </p>

                      {hasAlerts && (
                        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F766E] bg-teal-50 hover:bg-teal-100 transition-colors"
                      >
                        <span>Chart / Manage</span>
                        <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Clinical Shortcuts
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('appointments')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40 text-left text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Assigned Appointments</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40 text-left text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Treatment Records</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('shifts')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40 text-left text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>My Shifts & Leaves</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-teal-100 bg-teal-50/50 hover:bg-teal-50 text-left text-xs font-bold text-teal-900 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4 text-teal-700" />
                  <span>Request Leave / Time Off</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Approved Leaves & Vacations Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Approved Leaves
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                {timeOffList.length} total
              </span>
            </div>

            {timeOffList.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-slate-400 italic">No leaves or vacations scheduled.</p>
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  Request Time Off
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {timeOffList.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">{t.reason}</p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          t.approved_by_user_id
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.approved_by_user_id ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {t.start_at?.slice(0, 10)} → {t.end_at?.slice(0, 10)}
                    </p>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="w-full text-center pt-1 text-xs font-bold text-teal-700 hover:underline"
                >
                  + Request New Leave
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Weekly Recurring Operatory Shifts Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-[#12304A]">Weekly Recurring Operatory Shifts</h3>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
            {shifts.length} active shifts
          </span>
        </div>

        <div className="portal-grid-7">
          {DAYS_OF_WEEK.map((day) => {
            const dayShifts = shifts.filter((s) => s.day_of_week === day.id);
            return (
              <div
                key={day.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between min-h-[90px]"
              >
                <span className="text-xs font-bold text-slate-700">{day.name}</span>
                <div className="mt-2 space-y-1">
                  {dayShifts.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Off duty</span>
                  ) : (
                    dayShifts.map((sh) => (
                      <div key={sh.id} className="space-y-0.5">
                        <p className="font-mono text-xs font-bold text-teal-800">
                          {sh.start_time?.slice(0, 5)} - {sh.end_time?.slice(0, 5)}
                        </p>
                        <p className="text-[10px] text-teal-700 font-medium">
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-teal-600" />
                <h3 id="leave-modal-title" className="text-sm font-bold text-[#12304A]">
                  Request Leave / Time Off
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                Submit your practitioner leave request. In compliance with clinic protocol, all leave
                requests require administrative approval before scheduling blocks are finalized.
              </p>

              {leaveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{leaveError}</span>
                </div>
              )}

              {leaveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{leaveSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="leave-reason" className="text-xs font-semibold text-slate-700">Reason / Leave Category</label>
                <input
                  id="leave-reason"
                  type="text"
                  required
                  placeholder="e.g. CME Convention, Annual Vacation, Medical Leave"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="leave-start" className="text-xs font-semibold text-slate-700">Start Date & Time</label>
                  <input
                    id="leave-start"
                    type="datetime-local"
                    required
                    value={leaveForm.start_at}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="leave-end" className="text-xs font-semibold text-slate-700">End Date & Time</label>
                  <input
                    id="leave-end"
                    type="datetime-local"
                    required
                    value={leaveForm.end_at}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors disabled:opacity-50"
                >
                  {leaveSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DentistDashboard;
