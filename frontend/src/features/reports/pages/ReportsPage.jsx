import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  DollarSign,
  Stethoscope,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { reportsApi } from '../api';
import { ReportSkeleton } from '../../../components/skeletons';

export function ReportsPage() {
  const [dateRange, setDateRange] = useState('30'); // '7' | '30' | '90'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [apptData, setApptData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [dentistData, setDentistData] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = parseInt(dateRange, 10) || 30;
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);

      const params = {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
      };

      const [appts, rev, dentists] = await Promise.all([
        reportsApi.getAppointmentReports(params),
        reportsApi.getRevenueReports(params),
        reportsApi.getDentistReports(params),
      ]);

      setApptData(appts);
      setRevenueData(rev);
      setDentistData(dentists);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to generate clinic reports.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading && !apptData) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-50 tracking-tight">Clinical & Financial Reports</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Real-time appointment throughput, cancellation rates, procedure revenue realization, and provider caseloads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            disabled={loading}
            aria-busy={loading}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 shadow-xs outline-none disabled:opacity-60"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
          <button
            onClick={fetchReports}
            disabled={loading}
            aria-busy={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
        </div>
      ) : (
        <>
          {/* Executive KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Total Bookings
              </span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{apptData?.total_appointments || 0}</div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">In selected period</span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Completion Rate
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {apptData?.completion_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">Successfully discharged visits</span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Cancellation Rate
              </span>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {apptData?.cancellation_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">Patient or clinic cancelled</span>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Realized Revenue
              </span>
              <div className="text-3xl font-extrabold text-[#0D9488] dark:text-teal-400">
                ₱{Number(revenueData?.total_realized_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-400 dark:text-gray-400 mt-1 block">From completed appointments</span>
            </div>
          </div>

          {/* Procedure Revenue Realization Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/60">
              <h3 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Procedure & Service Revenue Realization
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr role="row" className="bg-slate-50 dark:bg-gray-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700">
                    <th role="columnheader" className="py-3 px-5">Service Name</th>
                    <th role="columnheader" className="py-3 px-4">Category</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Unit Price</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Booked</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Completed</th>
                    <th role="columnheader" className="py-3 px-5 text-right">Realized Revenue</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/80">
                  {revenueData?.services?.map((svc) => (
                    <tr role="row" key={svc.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40">
                      <td role="cell" data-label="Service Name" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">{svc.name}</td>
                      <td role="cell" data-label="Category" className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">{svc.category}</td>
                      <td role="cell" data-label="Unit Price" className="py-3 px-4 text-right font-mono text-slate-700 dark:text-gray-200">
                        ₱{svc.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td role="cell" data-label="Booked" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200">{svc.total_booked}</td>
                      <td role="cell" data-label="Completed" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">{svc.completed_count}</td>
                      <td role="cell" data-label="Realized Revenue" className="py-3 px-5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₱{svc.realized_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dentist Caseloads Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/60">
              <h3 className="font-bold text-sm text-slate-900 dark:text-gray-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Dentist Caseload & Clinical Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr role="row" className="bg-slate-50 dark:bg-gray-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700">
                    <th role="columnheader" className="py-3 px-5">Provider Name</th>
                    <th role="columnheader" className="py-3 px-4">Specialization</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Total Assigned</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Confirmed Upcoming</th>
                    <th role="columnheader" className="py-3 px-4 text-right">Completed Visits</th>
                    <th role="columnheader" className="py-3 px-5 text-right">Cancellations</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/80">
                  {dentistData?.dentists?.map((doc) => (
                    <tr role="row" key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40">
                      <td role="cell" data-label="Provider Name" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">
                        Dr. {doc.first_name} {doc.last_name}
                      </td>
                      <td role="cell" data-label="Specialization" className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">{doc.specialization}</td>
                      <td role="cell" data-label="Total Assigned" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200">{doc.total_assigned}</td>
                      <td role="cell" data-label="Confirmed Upcoming" className="py-3 px-4 text-right font-semibold text-teal-700 dark:text-teal-300">{doc.confirmed_count}</td>
                      <td role="cell" data-label="Completed Visits" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">{doc.completed_count}</td>
                      <td role="cell" data-label="Cancellations" className="py-3 px-5 text-right font-semibold text-slate-500 dark:text-gray-400">{doc.cancelled_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReportsPage;
