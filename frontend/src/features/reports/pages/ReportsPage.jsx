import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Stethoscope,
  Users,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { reportsApi } from '../api';
import { ReportSkeleton } from '../../../components/skeletons';

function formatLocalDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPresetDates(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

const STATUS_META = [
  { key: 'PENDING', label: 'Pending', barClass: 'bg-amber-500 dark:bg-amber-400' },
  { key: 'CONFIRMED', label: 'Confirmed', barClass: 'bg-teal-600 dark:bg-teal-400' },
  { key: 'COMPLETED', label: 'Completed', barClass: 'bg-emerald-600 dark:bg-emerald-400' },
  { key: 'CANCELLED', label: 'Cancelled', barClass: 'bg-slate-400 dark:bg-slate-500' },
  { key: 'REJECTED', label: 'Declined', barClass: 'bg-rose-500 dark:bg-rose-400' },
];

export function ReportsPage() {
  const initial = getPresetDates(30);
  const [presetDays, setPresetDays] = useState('30');
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [validationError, setValidationError] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [apptData, setApptData] = useState(null);
  const [serviceData, setServiceData] = useState(null);
  const [dentistData, setDentistData] = useState(null);
  const [patientData, setPatientData] = useState(null);

  const fetchReports = useCallback(async (from, to) => {
    if (from && to && to < from) {
      setValidationError('End date cannot be earlier than start date.');
      return;
    }
    setValidationError(null);
    setLoading(true);
    setError(null);
    try {
      const params = { start_date: from, end_date: to };
      const [appts, services, dentists, patients] = await Promise.all([
        reportsApi.getAppointmentReports(params),
        reportsApi.getServiceReports(params),
        reportsApi.getDentistReports(params),
        reportsApi.getPatientReports(params),
      ]);

      setApptData(appts);
      setServiceData(services);
      setDentistData(dentists);
      setPatientData(patients);
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to generate clinic operational reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(startDate, endDate);
  }, [fetchReports, startDate, endDate]);

  const handlePresetChange = (value) => {
    setPresetDays(value);
    const days = parseInt(value, 10);
    if (!Number.isNaN(days)) {
      const range = getPresetDates(days);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  if (loading && !apptData) {
    return <ReportSkeleton />;
  }

  const totalAppointments = apptData?.total_appointments || 0;
  const statusDistribution = apptData?.status_distribution || {};
  const dailyTimeline = apptData?.daily_timeline || [];

  // Aggregate daily timeline by date for chart
  const dailyTotalsMap = dailyTimeline.reduce((acc, row) => {
    acc[row.date] = (acc[row.date] || 0) + Number(row.count || 0);
    return acc;
  }, {});
  const dailyTotals = Object.entries(dailyTotalsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  const maxDailyCount = Math.max(1, ...dailyTotals.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Header & Date Range Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-50 tracking-tight">
            Clinic Operational Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Database-driven appointment throughput, dentist workload, service utilization, and patient registrations (Asia/Manila).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="report-preset">Quick date range</label>
          <select
            id="report-preset"
            value={presetDays}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-60"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>

          <label className="sr-only" htmlFor="report-start-date">Start date</label>
          <input
            id="report-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setPresetDays('custom');
              setStartDate(e.target.value);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200"
          />
          <span className="text-xs text-slate-400">to</span>
          <label className="sr-only" htmlFor="report-end-date">End date</label>
          <input
            id="report-end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setPresetDays('custom');
              setEndDate(e.target.value);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200"
          />

          <button
            type="button"
            onClick={() => fetchReports(startDate, endDate)}
            disabled={loading}
            aria-busy={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {validationError && (
        <div role="alert" className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {error ? (
        <div role="alert" className="p-8 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => fetchReports(startDate, endDate)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
          >
            Retry Report
          </button>
        </div>
      ) : (
        <>
          {/* Operational KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Total Bookings
              </span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalAppointments}</div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">
                {apptData?.upcoming_count || 0} upcoming in window
              </span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Completion Rate
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {apptData?.completion_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">
                {apptData?.completed_count || 0} completed appointments
              </span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Cancellation Rate
              </span>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {apptData?.cancellation_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">
                {apptData?.cancelled_count || 0} cancelled appointments
              </span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Registered Patients
              </span>
              <div className="text-3xl font-extrabold text-[#0D9488] dark:text-teal-400">
                {patientData?.total_patients || 0}
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">
                +{patientData?.new_in_period || 0} new in selected range
              </span>
            </div>
          </div>

          {/* Visual Analytics Charts (Status Distribution & Daily Volume) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appointment Status Distribution */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Appointments by Status
              </h2>
              {totalAppointments === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 py-6 text-center">
                  No appointments recorded in the selected date range.
                </p>
              ) : (
                <div className="space-y-3">
                  {STATUS_META.map(({ key, label, barClass }) => {
                    const count = Number(statusDistribution[key] || 0);
                    const pct = totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-gray-200">{label}</span>
                          <span className="font-mono text-slate-600 dark:text-gray-300">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily Appointment Volume */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Daily Appointment Volume
              </h2>
              {dailyTotals.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 py-6 text-center">
                  No daily appointment activity in the selected period.
                </p>
              ) : (
                <div className="flex items-end gap-1.5 h-36 pt-2 overflow-x-auto" role="img" aria-label="Daily appointment volume chart">
                  {dailyTotals.map((d) => {
                    const heightPct = Math.max(8, Math.round((d.count / maxDailyCount) * 100));
                    return (
                      <div key={d.date} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                        <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">{d.count}</span>
                        <div
                          className="w-full rounded-t-md bg-teal-600/85 dark:bg-teal-400/85"
                          style={{ height: `${heightPct}%` }}
                          title={`${d.date}: ${d.count} appointment(s)`}
                        />
                        <span className="text-[9px] font-mono text-slate-400 dark:text-gray-500">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Service Utilization Breakdown (Operational Counts Only) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/60">
              <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Dental Service Utilization
              </h2>
              <span className="text-xs text-slate-500 dark:text-gray-400">
                {serviceData?.services?.length || 0} catalog service(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr role="row" className="bg-slate-50 dark:bg-gray-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700">
                    <th role="columnheader" className="py-3 px-5">Service Name</th>
                    <th role="columnheader" className="py-3 px-4">Category</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Booked</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Upcoming</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Completed</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Cancelled</th>
                    <th role="columnheader" className="py-3 px-5 text-right">Share</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/80">
                  {(!serviceData?.services || serviceData.services.length === 0) ? (
                    <tr role="row">
                      <td role="cell" colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                        No service utilization records available for this period.
                      </td>
                    </tr>
                  ) : (
                    serviceData.services.map((svc) => (
                      <tr role="row" key={svc.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40">
                        <td role="cell" data-label="Service Name" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">{svc.name}</td>
                        <td role="cell" data-label="Category" className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">{svc.category}</td>
                        <td role="cell" data-label="Booked" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200">{svc.total_booked}</td>
                        <td role="cell" data-label="Upcoming" className="py-3 px-4 text-right font-semibold text-sky-700 dark:text-sky-400">{svc.upcoming_count}</td>
                        <td role="cell" data-label="Completed" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">{svc.completed_count}</td>
                        <td role="cell" data-label="Cancelled" className="py-3 px-4 text-right font-semibold text-slate-500 dark:text-gray-400">{svc.cancelled_count}</td>
                        <td role="cell" data-label="Share" className="py-3 px-5 text-right font-mono font-semibold text-teal-700 dark:text-teal-400">
                          {svc.utilization_share_pct}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dentist Clinical Workload */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/60">
              <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Dentist Workload Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr role="row" className="bg-slate-50 dark:bg-gray-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700">
                    <th role="columnheader" className="py-3 px-5">Dentist</th>
                    <th role="columnheader" className="py-3 px-4">Specialization</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Assigned</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Upcoming</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Completed</th>
                    <th role="columnheader" className="py-3 px-5 text-right">Cancelled</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/80">
                  {(!dentistData?.dentists || dentistData.dentists.length === 0) ? (
                    <tr role="row">
                      <td role="cell" colSpan={6} className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                        No dentist workload data available for this period.
                      </td>
                    </tr>
                  ) : (
                    dentistData.dentists.map((doc) => (
                      <tr role="row" key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40">
                        <td role="cell" data-label="Dentist" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">
                          Dr. {doc.first_name} {doc.last_name}
                        </td>
                        <td role="cell" data-label="Specialization" className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">
                          {doc.specialization}
                        </td>
                        <td role="cell" data-label="Assigned" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200">{doc.total_assigned}</td>
                        <td role="cell" data-label="Upcoming" className="py-3 px-4 text-right font-semibold text-sky-700 dark:text-sky-400">{doc.upcoming_count ?? 0}</td>
                        <td role="cell" data-label="Completed" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">{doc.completed_count}</td>
                        <td role="cell" data-label="Cancelled" className="py-3 px-5 text-right font-semibold text-slate-500 dark:text-gray-400">{doc.cancelled_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patient Registration Summary */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100">Patient Directory & Registration Trend</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {patientData?.active_patients || 0} active and {patientData?.inactive_patients || 0} inactive registered patients total.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="font-semibold text-slate-700 dark:text-gray-200">
                {patientData?.new_in_period || 0} new registration(s) from {startDate} to {endDate}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
