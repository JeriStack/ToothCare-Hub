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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical & Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time appointment throughput, cancellation rates, procedure revenue realization, and provider caseloads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs outline-none"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
          <button
            onClick={fetchReports}
            className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </div>
      ) : loading && !apptData ? (
        <div className="p-12 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Executive KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Total Bookings
              </span>
              <div className="text-3xl font-extrabold text-slate-900">{apptData?.total_appointments || 0}</div>
              <span className="text-xs text-slate-400 mt-1 block">In selected period</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Completion Rate
              </span>
              <div className="text-3xl font-extrabold text-emerald-600">
                {apptData?.completion_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Successfully discharged visits</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Cancellation Rate
              </span>
              <div className="text-3xl font-extrabold text-amber-600">
                {apptData?.cancellation_rate || 0}%
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Patient or clinic cancelled</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Realized Revenue
              </span>
              <div className="text-3xl font-extrabold text-[#0D9488]">
                ₱{Number(revenueData?.total_realized_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">From completed appointments</span>
            </div>
          </div>

          {/* Procedure Revenue Realization Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                Procedure & Service Revenue Realization
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="py-3 px-5">Service Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-right">Booked</th>
                    <th className="py-3 px-4 text-right">Completed</th>
                    <th className="py-3 px-5 text-right">Realized Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenueData?.services?.map((svc) => (
                    <tr key={svc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-5 font-semibold text-slate-900">{svc.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{svc.category}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        ₱{svc.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">{svc.total_booked}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{svc.completed_count}</td>
                      <td className="py-3 px-5 text-right font-mono font-bold text-slate-900">
                        ₱{svc.realized_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dentist Caseloads Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                Dentist Caseload & Clinical Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="py-3 px-5">Provider Name</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4 text-right">Total Assigned</th>
                    <th className="py-3 px-4 text-right">Confirmed Upcoming</th>
                    <th className="py-3 px-4 text-right">Completed Visits</th>
                    <th className="py-3 px-5 text-right">Cancellations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dentistData?.dentists?.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-5 font-semibold text-slate-900">
                        Dr. {doc.first_name} {doc.last_name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{doc.specialization}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">{doc.total_assigned}</td>
                      <td className="py-3 px-4 text-right font-semibold text-teal-700">{doc.confirmed_count}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{doc.completed_count}</td>
                      <td className="py-3 px-5 text-right font-semibold text-slate-500">{doc.cancelled_count}</td>
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
