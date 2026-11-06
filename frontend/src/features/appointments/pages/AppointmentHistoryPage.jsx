import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  History,
  DollarSign,
  AlertTriangle,
  X,
  CalendarCheck,
} from 'lucide-react';
import { appointmentsApi } from '../api';
import { AppointmentCard, STATUS_STYLES } from '../components/AppointmentCard';
import { AvailabilitySlotPicker } from '../../schedules/components/AvailabilitySlotPicker';

export function AppointmentHistoryPage({ onNavigateToBook }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, UPCOMING, PENDING, COMPLETED, CANCELLED
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [detailModalAppt, setDetailModalAppt] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancelModalAppt, setCancelModalAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const [rescheduleModalAppt, setRescheduleModalAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);
  const [rescheduleConflict, setRescheduleConflict] = useState(false);

  // Success toast / banner
  const [notification, setNotification] = useState(null);

  // Fetch appointments on mount or refresh
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    appointmentsApi
      .list()
      .then((data) => {
        if (!isMounted) return;
        setAppointments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.response?.data?.error?.message || err.message || 'Failed to load appointments.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // Open details and load full record (including status history)
  const handleOpenDetails = async (appt) => {
    setDetailModalAppt(appt);
    setLoadingDetails(true);
    try {
      const full = await appointmentsApi.getById(appt.id);
      setDetailModalAppt(full);
    } catch {
      // Keep initial appointment info if full fetch fails
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open cancel modal
  const handleOpenCancel = (appt) => {
    setCancelModalAppt(appt);
    setCancelReason('');
    setCancelError(null);
  };

  // Confirm cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalAppt) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await appointmentsApi.cancel(cancelModalAppt.id, cancelReason);
      setCancelModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${cancelModalAppt.id} has been cancelled successfully.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelError(err.response?.data?.error?.message || err.message || 'Failed to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  // Open reschedule modal
  const handleOpenReschedule = (appt) => {
    setRescheduleModalAppt(appt);
    // default date: tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setRescheduleDate(d.toISOString().split('T')[0]);
    setRescheduleSlot(null);
    setRescheduleReason('');
    setRescheduleError(null);
    setRescheduleConflict(false);
  };

  // Confirm reschedule
  const handleConfirmReschedule = async () => {
    if (!rescheduleModalAppt || !rescheduleSlot) {
      setRescheduleError('Please select a valid new appointment time slot.');
      return;
    }

    setRescheduling(true);
    setRescheduleError(null);
    setRescheduleConflict(false);

    try {
      const payload = {
        new_start_at: rescheduleSlot.start || rescheduleSlot.start_at,
        reason: rescheduleReason || 'Patient requested schedule adjustment.',
      };
      const result = await appointmentsApi.reschedule(rescheduleModalAppt.id, payload);
      setRescheduleModalAppt(null);
      setNotification({
        type: 'success',
        message: `Appointment #${rescheduleModalAppt.id} successfully rescheduled to #${result.id} for ${payload.new_start_at}.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message || 'Failed to reschedule appointment.';
      if (status === 409) {
        setRescheduleConflict(true);
        setRescheduleError('The selected time slot is no longer available. Please select another slot.');
      } else {
        setRescheduleError(msg);
      }
    } finally {
      setRescheduling(false);
    }
  };

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    return appointments.filter((appt) => {
      // Tab filter
      if (activeTab === 'UPCOMING') {
        const isFuture = appt.start_at >= nowStr;
        const isActiveStatus = ['PENDING', 'CONFIRMED'].includes(appt.status);
        if (!isFuture || !isActiveStatus) return false;
      } else if (activeTab === 'PENDING') {
        if (appt.status !== 'PENDING') return false;
      } else if (activeTab === 'COMPLETED') {
        if (appt.status !== 'COMPLETED') return false;
      } else if (activeTab === 'CANCELLED') {
        if (!['CANCELLED', 'REJECTED'].includes(appt.status)) return false;
      }

      // Search query filter (service, dentist, id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const srv = (appt.service_name || '').toLowerCase();
        const dnt = `${appt.dentist_first_name || ''} ${appt.dentist_last_name || ''}`.toLowerCase();
        const idStr = String(appt.id);
        if (!srv.includes(q) && !dnt.includes(q) && !idStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, activeTab, searchQuery]);

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
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">My Appointments</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track your consultations, view booking history, and manage upcoming clinic visits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh appointments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onNavigateToBook && (
            <button
              type="button"
              onClick={onNavigateToBook}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Book Appointment
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: 'ALL', label: 'All Visits' },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'PENDING', label: 'Pending Review' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled / Declined' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#CCFBF1] text-[#0F766E] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by dentist, service name, or booking reference..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
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
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Appointment Cards List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3"></div>
              <div className="h-16 bg-slate-50 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No appointments found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? 'No bookings matched your search query. Try clearing the filter or search term.'
                : activeTab === 'ALL'
                ? "You haven't scheduled any dental appointments yet."
                : `There are no appointments under the "${activeTab}" category.`}
            </p>
          </div>
          {onNavigateToBook && (
            <button
              type="button"
              onClick={onNavigateToBook}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] text-white font-semibold text-xs hover:bg-[#0F766E] shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Book First Appointment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onViewDetails={handleOpenDetails}
              onCancel={handleOpenCancel}
              onReschedule={handleOpenReschedule}
              role="PATIENT"
            />
          ))}
        </div>
      )}

      {/* DETAIL MODAL / DRAWER */}
      {detailModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Appointment Overview
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Ref #{detailModalAppt.id} — {detailModalAppt.service_name}
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

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {/* Status Header */}
              {(() => {
                const sInfo = STATUS_STYLES[detailModalAppt.status] || STATUS_STYLES.PENDING;
                const SIcon = sInfo.icon;
                return (
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${sInfo.bg} ${sInfo.border}`}>
                    <SIcon className={`w-5 h-5 ${sInfo.text}`} />
                    <div>
                      <h4 className={`font-bold text-xs ${sInfo.text}`}>Status: {sInfo.label}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {detailModalAppt.status === 'PENDING' &&
                          'Our clinic staff is verifying schedule availability and chair allocation.'}
                        {detailModalAppt.status === 'CONFIRMED' &&
                          'Your appointment is locked into the clinic calendar. Please arrive 10 minutes early.'}
                        {detailModalAppt.status === 'COMPLETED' &&
                          'This visit has concluded. Treatment notes and history are securely archived.'}
                        {detailModalAppt.status === 'CANCELLED' &&
                          `This appointment was cancelled. Reason: ${detailModalAppt.cancellation_reason || 'Not specified'}.`}
                        {detailModalAppt.status === 'REJECTED' &&
                          `Declined by clinic. Reason: ${detailModalAppt.cancellation_reason || 'Dentist unavailable'}.`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Attending Dentist</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    Dr. {detailModalAppt.dentist_first_name} {detailModalAppt.dentist_last_name}
                  </p>
                  <p className="text-xs text-slate-500">{detailModalAppt.dentist_specialization || 'General Dentistry'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Operatory Room</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {detailModalAppt.dentist_room_number || 'Chair 1 — Main Operatory'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Date & Time</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {detailModalAppt.start_at ? detailModalAppt.start_at.substring(0, 16) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Duration: {detailModalAppt.duration_snapshot || 30} minutes
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Fee Snapshot</span>
                  <p className="font-bold text-[#0D9488] mt-0.5">
                    ₱{Number(detailModalAppt.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400">Locked at booking time</p>
                </div>
              </div>

              {/* Chief Complaint */}
              {detailModalAppt.chief_complaint && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Chief Complaint / Notes
                  </span>
                  <p className="mt-1 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    "{detailModalAppt.chief_complaint}"
                  </p>
                </div>
              )}

              {/* Reschedule Trace */}
              {detailModalAppt.rescheduled_from_id && (
                <div className="text-xs text-slate-600 bg-sky-50 p-3 rounded-lg border border-sky-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    Rescheduled from prior appointment reference <strong>#{detailModalAppt.rescheduled_from_id}</strong>.
                  </span>
                </div>
              )}

              {/* Status Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Lifecycle History Timeline
                </h4>
                {loadingDetails ? (
                  <div className="text-xs text-slate-400 animate-pulse">Loading status timeline...</div>
                ) : detailModalAppt.status_history && detailModalAppt.status_history.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {detailModalAppt.status_history.map((h, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#0D9488] ring-4 ring-white" />
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              {h.from_status ? `${h.from_status} → ` : ''}
                              {h.to_status}
                            </span>
                            <span className="text-slate-400 text-[11px]">{h.created_at}</span>
                          </div>
                          {h.reason && <p className="text-slate-600 italic">"{h.reason}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No transition history recorded yet.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailModalAppt(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cancel Appointment #{cancelModalAppt.id}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to cancel this visit with Dr. {cancelModalAppt.dentist_last_name}?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Clinic Cancellation Policy:</p>
              <p>
                Appointments cancelled will release the time slot back to the clinic roster. If you need to change your
                time instead, consider <strong>Rescheduling</strong>.
              </p>
            </div>

            {cancelError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please let us know why you need to cancel..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#0D9488] uppercase tracking-wider">
                  Reschedule Appointment
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Adjust Visit Ref #{rescheduleModalAppt.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalAppt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <p className="text-xs text-slate-500">Currently Scheduled For:</p>
                <p className="font-bold text-slate-800">
                  {rescheduleModalAppt.service_name} with Dr. {rescheduleModalAppt.dentist_first_name} {rescheduleModalAppt.dentist_last_name}
                </p>
                <p className="text-xs text-slate-600">
                  Existing slot: <strong>{rescheduleModalAppt.start_at}</strong>
                </p>
              </div>

              {rescheduleError && (
                <div className={`p-3 rounded-lg text-xs ${rescheduleConflict ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
                  {rescheduleError}
                </div>
              )}

              {/* Date Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select New Consultation Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleSlot(null);
                  }}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              {/* Dynamic Availability Slot Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select New Time Slot
                </label>
                <AvailabilitySlotPicker
                  dentistId={rescheduleModalAppt.dentist_id}
                  serviceId={rescheduleModalAppt.service_id}
                  selectedDate={rescheduleDate}
                  selectedSlot={rescheduleSlot}
                  onSelectSlot={(slot) => {
                    setRescheduleSlot(slot);
                    setRescheduleConflict(false);
                    setRescheduleError(null);
                  }}
                />
              </div>

              {/* Reschedule Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for rescheduling <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g., Work conflict, personal emergency..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRescheduleModalAppt(null)}
                disabled={rescheduling}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={rescheduling || !rescheduleSlot}
                className="px-5 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
