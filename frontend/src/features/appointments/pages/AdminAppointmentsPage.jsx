import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  History,
  AlertTriangle,
  Phone,
  Mail,
  DollarSign,
} from 'lucide-react';
import { appointmentsApi } from '../api';
import { dentistsApi } from '../../dentists/api';
import { STATUS_STYLES } from '../components/AppointmentCard';

export function AdminAppointmentsPage() {
  // State
  const [appointments, setAppointments] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 15, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dentists, setDentists] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState(''); // '' = ALL
  const [search, setSearch] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Success Notification
  const [notification, setNotification] = useState(null);

  // Action Modals State
  const [detailModalAppt, setDetailModalAppt] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [confirmModalAppt, setConfirmModalAppt] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  const [rejectModalAppt, setRejectModalAppt] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  const [completeModalAppt, setCompleteModalAppt] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  const [cancelModalAppt, setCancelModalAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Load Dentists List once for filter dropdown
  useEffect(() => {
    dentistsApi
      .getPublicDentists()
      .then((data) => setDentists(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch paginated admin appointments
  const fetchAppointments = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 15,
    };
    if (statusFilter) params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    if (dentistId) params.dentist_id = dentistId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    appointmentsApi
      .listAdmin(params)
      .then((res) => {
        setAppointments(res.data || []);
        if (res.meta) setMeta(res.meta);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load appointments.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, statusFilter, search, dentistId, dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Open Details Modal
  const handleOpenDetails = async (appt) => {
    setDetailModalAppt(appt);
    setLoadingDetails(true);
    try {
      const full = await appointmentsApi.getAdminById(appt.id);
      setDetailModalAppt(full);
    } catch {
      // Keep initial summary if full fetch fails
    } finally {
      setLoadingDetails(false);
    }
  };

  // Confirm Action Handler
  const handleConfirmAction = async () => {
    if (!confirmModalAppt) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await appointmentsApi.confirm(confirmModalAppt.id);
      setConfirmModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${confirmModalAppt.id} successfully approved and confirmed.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setConfirmError(err.response?.data?.error?.message || err.message || 'Failed to confirm appointment.');
    } finally {
      setConfirming(false);
    }
  };

  // Reject Action Handler
  const handleRejectAction = async () => {
    if (!rejectModalAppt) return;
    if (!rejectReason.trim()) {
      setRejectError('A reason is required to reject an appointment request.');
      return;
    }
    setRejecting(true);
    setRejectError(null);
    try {
      await appointmentsApi.reject(rejectModalAppt.id, rejectReason.trim());
      setRejectModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${rejectModalAppt.id} has been declined.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setRejectError(err.response?.data?.error?.message || err.message || 'Failed to reject appointment.');
    } finally {
      setRejecting(false);
    }
  };

  // Complete Action Handler
  const handleCompleteAction = async () => {
    if (!completeModalAppt) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await appointmentsApi.complete(completeModalAppt.id);
      setCompleteModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${completeModalAppt.id} marked as completed.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCompleteError(err.response?.data?.error?.message || err.message || 'Failed to complete appointment.');
    } finally {
      setCompleting(false);
    }
  };

  // Admin Cancel Action Handler
  const handleCancelAction = async () => {
    if (!cancelModalAppt) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await appointmentsApi.cancel(cancelModalAppt.id, cancelReason.trim() || 'Administrative cancellation');
      setCancelModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${cancelModalAppt.id} was cancelled.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelError(err.response?.data?.error?.message || err.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSearch('');
    setDentistId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">Appointment Triage & Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Review incoming requests, manage confirmed bookings, and oversee clinic schedule flow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Filter and Triage Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: '', label: 'All Statuses' },
            { id: 'PENDING', label: 'Pending Review' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled' },
            { id: 'REJECTED', label: 'Declined' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#CCFBF1] text-[#0F766E] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Select Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search patient, email, ref #..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          {/* Dentist Select */}
          <div>
            <select
              value={dentistId}
              onChange={(e) => {
                setDentistId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white text-slate-700"
            >
              <option value="">All Dentists</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] text-slate-700"
              placeholder="From Date"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] text-slate-700"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Clear Filters CTA if active */}
        {(statusFilter || search || dentistId || dateFrom || dateTo) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Filters currently applied</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[#0D9488] font-semibold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table List View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Ref #</th>
                <th className="py-3.5 px-4">Patient Details</th>
                <th className="py-3.5 px-4">Service & Fee</th>
                <th className="py-3.5 px-4">Dentist & Room</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0D9488]" />
                    Loading appointment records...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No appointments matched the current filter criteria.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => {
                  const sInfo = STATUS_STYLES[appt.status] || STATUS_STYLES.PENDING;
                  const SIcon = sInfo.icon;
                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        #{appt.id}
                        {appt.rescheduled_from_id && (
                          <span className="block text-[10px] text-sky-600 font-normal">
                            from #{appt.rescheduled_from_id}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {appt.patient_first_name} {appt.patient_last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {appt.patient_phone && <span>📞 {appt.patient_phone}</span>}
                          {appt.patient_email && <span>✉️ {appt.patient_email}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{appt.service_name}</div>
                        <div className="text-[11px] text-[#0D9488] font-bold mt-0.5">
                          ₱{Number(appt.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          <span className="text-slate-400 font-normal ml-1">
                            ({appt.duration_snapshot || 30}m)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          Dr. {appt.dentist_first_name} {appt.dentist_last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {appt.dentist_room_number || 'Chair 1'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {appt.start_at ? appt.start_at.substring(0, 10) : 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {appt.start_at ? appt.start_at.substring(11, 16) : ''} –{' '}
                          {appt.end_at ? appt.end_at.substring(11, 16) : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sInfo.bg} ${sInfo.text} ${sInfo.border}`}
                        >
                          <SIcon className="w-3 h-3" />
                          {sInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Details Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(appt)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                            title="View Full Details & History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Pending Actions: Confirm & Reject */}
                          {appt.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModalAppt(appt);
                                  setConfirmError(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1"
                                title="Approve Appointment"
                              >
                                <Check className="w-3 h-3" /> Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalAppt(appt);
                                  setRejectReason('');
                                  setRejectError(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold text-[11px] flex items-center gap-1"
                                title="Decline Appointment"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}

                          {/* Confirmed Actions: Complete & Cancel */}
                          {appt.status === 'CONFIRMED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setCompleteModalAppt(appt);
                                  setCompleteError(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-[11px] flex items-center gap-1"
                                title="Mark as Completed"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalAppt(appt);
                                  setCancelReason('');
                                  setCancelError(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-semibold text-[11px]"
                                title="Cancel Appointment"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-900">
              {appointments.length > 0 ? (meta.page - 1) * meta.per_page + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-900">
              {Math.min(meta.page * meta.per_page, meta.total)}
            </span>{' '}
            of <span className="font-semibold text-slate-900">{meta.total}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={meta.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-2">
              Page {meta.page} of {meta.last_page || 1}
            </span>
            <button
              type="button"
              disabled={meta.page >= (meta.last_page || 1) || loading}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL / AUDIT DRAWER MODAL */}
      {detailModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Admin Audit & Triage
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Appointment #{detailModalAppt.id} — {detailModalAppt.service_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Patient Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Patient Information</span>
                <div className="font-bold text-slate-900 text-sm mt-1">
                  {detailModalAppt.patient_first_name} {detailModalAppt.patient_last_name}
                </div>
                <div className="mt-1 text-slate-600 flex flex-wrap gap-4">
                  {detailModalAppt.patient_phone && <span>📞 {detailModalAppt.patient_phone}</span>}
                  {detailModalAppt.patient_email && <span>✉️ {detailModalAppt.patient_email}</span>}
                </div>
              </div>

              {/* Consultation Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-medium">Attending Dentist</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    Dr. {detailModalAppt.dentist_first_name} {detailModalAppt.dentist_last_name}
                  </p>
                  <p className="text-slate-500">{detailModalAppt.dentist_room_number || 'Chair 1'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Price Snapshot</span>
                  <p className="font-bold text-[#0D9488] mt-0.5">
                    ₱{Number(detailModalAppt.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-slate-400">{detailModalAppt.duration_snapshot || 30} minutes</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Start Time</span>
                  <p className="font-bold text-slate-800 mt-0.5">{detailModalAppt.start_at}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">End Time</span>
                  <p className="font-bold text-slate-800 mt-0.5">{detailModalAppt.end_at}</p>
                </div>
              </div>

              {/* Chief Complaint */}
              {detailModalAppt.chief_complaint && (
                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider">
                    Chief Complaint / Notes
                  </span>
                  <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 italic">
                    "{detailModalAppt.chief_complaint}"
                  </p>
                </div>
              )}

              {/* Immutable Status History Timeline */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Audit Trail & Status Transitions
                </h4>
                {loadingDetails ? (
                  <div className="text-slate-400 animate-pulse">Loading transition log...</div>
                ) : detailModalAppt.status_history && detailModalAppt.status_history.length > 0 ? (
                  <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {detailModalAppt.status_history.map((h, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#0D9488] ring-4 ring-white" />
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>
                              {h.from_status ? `${h.from_status} → ` : ''}
                              {h.to_status}
                            </span>
                            <span className="text-slate-400 text-[10px]">{h.created_at}</span>
                          </div>
                          {h.reason && <p className="text-slate-600 italic">"{h.reason}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No transition history recorded yet.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close Audit Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Approve Appointment #{confirmModalAppt.id}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Confirm booking for <strong>{confirmModalAppt.patient_first_name} {confirmModalAppt.patient_last_name}</strong> with Dr. {confirmModalAppt.dentist_last_name} on {confirmModalAppt.start_at}?
                </p>
              </div>
            </div>

            {confirmError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {confirmError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalAppt(null)}
                disabled={confirming}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirming}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {confirming ? 'Confirming...' : 'Approve & Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Decline Appointment #{rejectModalAppt.id}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify a reason for declining this appointment request. The patient will be notified.
                </p>
              </div>
            </div>

            {rejectError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {rejectError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Decline Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Dentist called in for emergency surgery, clinic closure..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalAppt(null)}
                disabled={rejecting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleRejectAction}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-sm transition-all disabled:opacity-50"
              >
                {rejecting ? 'Declining...' : 'Decline Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {completeModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Complete Appointment #{completeModalAppt.id}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Mark consultation for <strong>{completeModalAppt.patient_first_name} {completeModalAppt.patient_last_name}</strong> as completed?
                </p>
              </div>
            </div>

            {completeError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {completeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCompleteModalAppt(null)}
                disabled={completing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteAction}
                disabled={completing}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
              >
                {completing ? 'Completing...' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CANCEL MODAL */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Admin Cancel #{cancelModalAppt.id}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cancel confirmed visit for {cancelModalAppt.patient_first_name} {cancelModalAppt.patient_last_name}?
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cancellation Reason
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for administrative cancellation..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelAction}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 shadow-sm transition-all disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
