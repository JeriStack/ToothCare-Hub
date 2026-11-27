import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  Search,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  X,
  Phone,
} from 'lucide-react';
import { appointmentsApi } from '../../appointments/api';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';
import { useDashboardSync } from '../../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../../services/realtime/dashboardSync';

const CLINIC_TIME_ZONE = 'Asia/Manila';

const EMPTY_ALERT_PLACEHOLDERS = new Set([
  'none',
  'none recorded',
  'none reported',
  'no allergies',
  'no known allergies',
  'n/a',
  'na',
  'nil',
  '-',
]);

const STATUS_BADGE_MAP = {
  CONFIRMED: {
    label: 'Confirmed',
    pill: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/25',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  PENDING: {
    label: 'Pending Review',
    pill: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/25',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600',
    dot: 'bg-slate-400',
  },
  REJECTED: {
    label: 'Declined',
    pill: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/25',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

function hasMeaningfulMedicalAlert(raw) {
  const normalized = String(raw || '').trim();
  if (!normalized) return false;
  return !EMPTY_ALERT_PLACEHOLDERS.has(normalized.toLowerCase());
}

function getInitials(firstName = '', lastName = '') {
  const f = (firstName || '').trim().charAt(0);
  const l = (lastName || '').trim().charAt(0);
  return (f + l).toUpperCase() || 'PT';
}

function formatGender(raw) {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'MALE') return 'Male';
  if (upper === 'FEMALE') return 'Female';
  if (upper === 'OTHER') return 'Other';
  return '';
}

function getClinicTodayIso() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatReadableDate(sqlDateTime) {
  if (!sqlDateTime) return 'Unscheduled';
  const datePart = String(sqlDateTime).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    return new Date(`${datePart}T12:00:00+08:00`).toLocaleDateString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return datePart;
  }
}

function formatTime12h(sqlDateTime) {
  if (!sqlDateTime || String(sqlDateTime).length < 16) return '';
  const hhmm = String(sqlDateTime).slice(11, 16);
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function DentistAppointmentsPage({ initialStatus = 'ALL', onSelectAppointment }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [meta, setMeta] = useState({ total: 0, total_records: 0, filtered_records: 0, page: 1, per_page: 10, last_page: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    setStatusFilter(initialStatus || 'ALL');
    setPage(1);
  }, [initialStatus]);

  // Debounce search input for smooth live filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 240);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAppointments = useCallback(async (overrideSearch = null) => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const effectiveSearch = overrideSearch !== null ? overrideSearch : debouncedSearch;
      const params = {
        page,
        per_page: perPage,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (effectiveSearch.trim()) {
        params.search = effectiveSearch.trim();
      }

      const res = await appointmentsApi.listDentist(params);
      if (seq !== requestSeqRef.current) return;

      const items = Array.isArray(res) ? res : res?.items || [];
      const resMeta = res?.meta || { total: items.length, total_records: items.length, filtered_records: items.length, page, per_page: perPage, last_page: 1 };

      setAppointments(items);
      setMeta(resMeta);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err.response?.data?.error?.message || 'Failed to load assigned appointments.');
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter, debouncedSearch, page, perPage, refreshKey]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useDashboardSync({
    role: 'DENTIST',
    domains: [DASHBOARD_SYNC_DOMAINS.APPOINTMENTS],
    debounceMs: 300,
    onRefresh: () => setRefreshKey((k) => k + 1),
  });

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setDebouncedSearch(trimmed);
    setPage(1);
    fetchAppointments(trimmed);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchQuery.trim() || statusFilter !== 'ALL');
  const clinicTodayIso = getClinicTodayIso();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              Assigned Patient Appointments
            </h2>
            {!loading && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/25 tabular-nums">
                {meta.total} {meta.total === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review your scheduled patient consultations, clinical alerts, and post-treatment records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Status Filter Bar */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs space-y-2.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <label htmlFor="dentist-appt-search" className="sr-only">
              Search patient, phone, service, or ref #
            </label>
            <Search
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="dentist-appt-search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search patient, phone, service, or ref #..."
              className="w-full min-h-11 sm:min-h-0 pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-600/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] dark:focus:border-teal-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setPage(1);
                  fetchAppointments('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="sm:w-48 shrink-0">
            <label htmlFor="dentist-appt-status" className="sr-only">
              Filter appointments by status
            </label>
            <select
              id="dentist-appt-status"
              aria-label="Filter appointments by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-11 sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 cursor-pointer"
            >
              <option value="ALL">All Visits</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REJECTED">Declined</option>
            </select>
          </div>

          <button
            type="submit"
            className="min-h-11 sm:min-h-0 px-4 py-2.5 bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            Search
          </button>
        </form>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Filters applied</span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-[#0D9488] dark:text-teal-400 hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Appointments Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-2">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => fetchAppointments()}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
              <Calendar className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">No appointments found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No assigned appointments match the selected filter criteria.'
                : 'You have no assigned appointments on your schedule at this time.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-1 inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0F766E] dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
                <thead role="rowgroup">
                  <tr
                    role="row"
                    className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    <th role="columnheader" className="py-3.5 px-5">Date &amp; Time</th>
                    <th role="columnheader" className="py-3.5 px-4">Patient</th>
                    <th role="columnheader" className="py-3.5 px-4">Procedure &amp; Chair</th>
                    <th role="columnheader" className="py-3.5 px-4">Status</th>
                    <th role="columnheader" className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
                  {appointments.map((appt) => {
                    const hasAlerts = hasMeaningfulMedicalAlert(appt.patient_medical_alerts);
                    const datePart = appt.start_at ? String(appt.start_at).slice(0, 10) : '';
                    const isToday = Boolean(datePart && datePart === clinicTodayIso);
                    const durationMins = appt.service_duration || appt.duration_snapshot || 45;
                    const genderLabel = formatGender(appt.patient_gender);
                    const badge = STATUS_BADGE_MAP[appt.status] || {
                      label: appt.status,
                      pill: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600',
                      dot: 'bg-slate-400',
                    };

                    return (
                      <tr
                        role="row"
                        key={appt.id}
                        className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                        onClick={() => onSelectAppointment && onSelectAppointment(appt.id)}
                      >
                        {/* Date & Time */}
                        <td role="cell" data-label="Date & Time" className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            <span>{formatReadableDate(appt.start_at)}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-600 text-white">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                            <span>{formatTime12h(appt.start_at) || 'TBD'}</span>
                            <span className="text-slate-300 dark:text-gray-600">·</span>
                            <span>{durationMins}m</span>
                          </div>
                        </td>

                        {/* Patient */}
                        <td role="cell" data-label="Patient" className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[11px] font-semibold shrink-0">
                              {getInitials(appt.patient_first_name, appt.patient_last_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-50 truncate">
                                {appt.patient_first_name} {appt.patient_last_name}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap tabular-nums">
                                {appt.patient_phone && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                                    {appt.patient_phone}
                                  </span>
                                )}
                                {appt.patient_phone && genderLabel && (
                                  <span className="text-slate-300 dark:text-gray-600">·</span>
                                )}
                                {genderLabel && <span>{genderLabel}</span>}
                              </div>
                              {hasAlerts && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30">
                                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    <span className="truncate max-w-[220px]">{appt.patient_medical_alerts}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Procedure & Chair */}
                        <td role="cell" data-label="Procedure & Chair" className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {appt.service_name || 'Dental Service'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {appt.operatory_chair || 'Chair 1'}
                          </div>
                        </td>

                        {/* Status */}
                        <td role="cell" data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.pill}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
                            {badge.label}
                          </span>
                        </td>

                        {/* Action */}
                        <td role="cell" data-label="Action" className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectAppointment) onSelectAppointment(appt.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0F766E] dark:text-teal-300 bg-teal-50/80 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/25 hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
                          >
                            <span>Manage</span>
                            <ChevronRight
                              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Unified Server-Side Pagination Footer */}
            <ServerTableFooter
              page={meta.current_page || meta.page || page}
              perPage={meta.per_page || perPage}
              totalRecords={meta.total_records ?? meta.total ?? appointments.length}
              filteredRecords={meta.filtered_records ?? meta.total ?? appointments.length}
              totalPages={meta.total_pages || meta.last_page || 1}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPerPageChange={(nextSize) => {
                setPerPage(nextSize);
                setPage(1);
              }}
              pageSizeOptions={[5, 10, 15, 25, 50]}
              loading={loading}
              itemLabel="visits"
            />
          </>
        )}
      </div>
    </div>
  );
}
