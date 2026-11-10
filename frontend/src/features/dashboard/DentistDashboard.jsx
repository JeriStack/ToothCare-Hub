import React, { useState, useEffect } from 'react';
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

export function DentistDashboard({ dentistId = 1, onNavigateTab, onSelectAppointment }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [timeOffList, setTimeOffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
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
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [dentistId]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12304A]">Clinical Practice Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {clinician
              ? `Welcome back, Dr. ${clinician.first_name} ${clinician.last_name} (${clinician.specialization}) • PRC: ${clinician.license_number}`
              : 'Your assigned daily schedule, patient appointments, and clinical treatment records.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDashboard}
            title="Refresh clinical metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
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
            onClick={fetchDashboard}
            className="text-xs font-bold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Live Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Appointments */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('appointments')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
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
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
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
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
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

        {/* Completed Treatments */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('treatment-records')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
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

      {/* Today's Schedule Timeline & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule Timeline (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-[#12304A]">Today&apos;s Clinical Schedule</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('appointments')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayAppts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-medium text-slate-600">No patient visits scheduled for today.</p>
              <p className="text-[11px] text-slate-400">
                Check upcoming visits in your assigned appointments tab.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayAppts.map((appt) => {
                const hasAlerts = Boolean(appt.patient_medical_alerts);
                return (
                  <div
                    key={appt.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-xl transition-colors cursor-pointer"
                    onClick={() => onSelectAppointment && onSelectAppointment(appt.id)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {appt.patient_first_name} {appt.patient_last_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            appt.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : appt.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {appt.service_name || 'Dental Consultation'} •{' '}
                        <span className="font-medium text-slate-700">{appt.start_at?.slice(11, 16) || 'Today'}</span> •{' '}
                        {appt.operatory_chair || 'Chair 1'}
                      </p>
                      {hasAlerts && (
                        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{appt.patient_medical_alerts}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectAppointment) onSelectAppointment(appt.id);
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F766E] bg-teal-50 hover:bg-teal-100 transition-colors"
                    >
                      <span>Chart / Manage</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Working Shifts (1 Col) */}
        <div className="space-y-6">
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
                  <span>Working Shifts & Leaves</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Approved Time-Off Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Approved Leaves
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                {timeOffList.length}
              </span>
            </div>

            {timeOffList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No leaves or vacations scheduled.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {timeOffList.slice(0, 2).map((t) => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-amber-50/40 border border-amber-100">
                    <p className="font-semibold text-slate-800">{t.reason}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t.start_at?.slice(0, 10)} → {t.end_at?.slice(0, 10)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Shifts Grid */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {DAYS_OF_WEEK.map((day) => {
            const dayShifts = shifts.filter((s) => s.day_of_week === day.id);
            return (
              <div
                key={day.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-slate-700">{day.name}</span>
                <div className="mt-2">
                  {dayShifts.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Off duty</span>
                  ) : (
                    dayShifts.map((sh) => (
                      <div key={sh.id} className="space-y-0.5">
                        <p className="font-mono text-xs font-bold text-teal-800">
                          {sh.start_time?.slice(0, 5)} - {sh.end_time?.slice(0, 5)}
                        </p>
                        <p className="text-[10px] text-teal-700 font-medium">{sh.operatory_chair}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DentistDashboard;
