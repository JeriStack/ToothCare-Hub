import React, { useState, useEffect, useTransition } from 'react';
import {
  Calendar,
  Clock,
  User,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  ArrowUpDown,
  Stethoscope,
  X,
  Phone,
} from 'lucide-react';
import { appointmentsApi } from '../../appointments/api';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';

export function DentistAppointmentsPage({ onSelectAppointment }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 20, last_page: 1 });

  const [isPending, startTransition] = useTransition();

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: 20,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await appointmentsApi.listDentist(params);
      const items = Array.isArray(res) ? res : res.items || [];
      const resMeta = res.meta || { total: items.length, page, per_page: 20, last_page: 1 };

      setAppointments(items);
      setMeta(resMeta);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load assigned appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAppointments();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Review
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Completed
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <X className="w-3 h-3 text-rose-600" />
            {status === 'REJECTED' ? 'Declined' : 'Cancelled'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12304A]">Assigned Patient Appointments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your clinical caseload, patient consultations, and post-treatment records.
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
        {/* Status Tab Filter */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          {[
            { id: 'ALL', label: 'All Visits' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#0D9488] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, phone, or service..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                  fetchAppointments();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Appointments List / Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 rounded-xl border border-rose-200 text-rose-700">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={fetchAppointments}
            className="mt-3 px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No appointments found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No assigned appointments match the selected filter criteria. Try adjusting your search.'
              : 'You have no assigned appointments on your schedule at this time.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Patient Demographics</th>
                  <th className="py-3 px-4">Procedure & Chair</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {appointments.map((appt) => {
                  const hasAlerts = Boolean(appt.patient_medical_alerts);
                  const isToday =
                    appt.start_at &&
                    new Date(appt.start_at).toDateString() === new Date().toDateString();

                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onSelectAppointment && onSelectAppointment(appt.id)}
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appt.start_at ? appt.start_at.slice(0, 16) : 'Unscheduled'}</span>
                          {isToday && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Duration: {appt.service_duration || appt.duration_snapshot || 45} mins
                        </span>
                      </td>

                      {/* Patient Info */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            {appt.patient_first_name} {appt.patient_last_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {appt.patient_phone && <span>{appt.patient_phone}</span>}
                          {appt.patient_gender && <span>• {appt.patient_gender}</span>}
                        </div>
                        {hasAlerts && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                              {appt.patient_medical_alerts}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Procedure & Chair */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{appt.service_name || 'Dental Service'}</div>
                        <div className="text-[11px] text-slate-500">
                          {appt.operatory_chair || 'Chair 1'}
                        </div>
                        {appt.chief_complaint && (
                          <div className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-xs">
                            &quot;{appt.chief_complaint}&quot;
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(appt.status)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectAppointment) onSelectAppointment(appt.id);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F766E] bg-teal-50 hover:bg-teal-100 transition-colors"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.last_page > 1 && (
            <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing {appointments.length} of {meta.total} appointments
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  Previous
                </button>
                <span className="px-2 font-medium">
                  Page {page} of {meta.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
