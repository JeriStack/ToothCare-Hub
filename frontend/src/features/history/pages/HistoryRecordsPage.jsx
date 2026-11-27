import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldAlert,
  Users,
  Calendar,
  Activity,
  UserCheck,
  Shield,
} from 'lucide-react';
import { historyApi } from '../api';
import { RecordHistoryModal } from '../components/RecordHistoryModal';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';
import { SortableColumnHeader, ServerTableFooter } from '../../../components/ui/ServerTableControls';

const RESULT_BADGE = {
  SUCCESS: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
  WARNING: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
  FAILED: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30',
  DENIED: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30',
};

const ROLE_BADGE = {
  ADMIN: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-500/30',
  RECEPTIONIST: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30',
  DENTIST: 'bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border-teal-200/80 dark:border-teal-500/30',
  PATIENT: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30',
  SYSTEM: 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600',
};

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'patients', label: 'Patients' },
  { value: 'dentists', label: 'Dentists & Schedules' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'users', label: 'User Accounts' },
  { value: 'roles', label: 'Roles & DRBAC' },
  { value: 'archives', label: 'Archive Management' },
  { value: 'security', label: 'Security & Auth' },
  { value: 'clinical', label: 'Clinical Events' },
  { value: 'services', label: 'Services' },
  { value: 'settings', label: 'Clinic Settings' },
];

function formatValue(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ') || '(none)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Centralized History Records Module (Phase 3)
 * Distinct from forensic Audit Trail & Archive Management: focuses on chronological
 * account lifecycles, business record changes, and sanitized Before -> After comparisons.
 */
export function HistoryRecordsPage() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    total_records: 0,
    filtered_records: 0,
    page: 1,
    current_page: 1,
    per_page: 10,
    last_page: 1,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters, sorting, pagination
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  // Detail & Individual Timeline Modals
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [timelineTarget, setTimelineTarget] = useState(null);

  const seqRef = useRef(0);
  const abortRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    historyApi
      .getSummary()
      .then((res) => {
        if (active) setSummary(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const fetchHistory = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    const params = {
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (category) params.category = category;
    if (actorRole) params.actor_role = actorRole;
    if (moduleFilter) params.module = moduleFilter;
    if (resultFilter) params.result = resultFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    historyApi
      .list(params, { signal: controller.signal })
      .then((res) => {
        if (seq !== seqRef.current || controller.signal.aborted) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        const rawMeta = res?.meta || {};
        const filtered = Number(rawMeta.filtered_records ?? rawMeta.total ?? rows.length);
        const totalAll = Number(rawMeta.total_records ?? filtered);
        const curPage = Number(rawMeta.current_page ?? rawMeta.page ?? page);
        const curPerPage = Number(rawMeta.per_page ?? perPage);
        const totalPages = Math.max(1, Number(rawMeta.total_pages ?? rawMeta.last_page ?? 1));

        setRecords(rows);
        setMeta({
          ...rawMeta,
          total: filtered,
          total_records: totalAll,
          filtered_records: filtered,
          page: curPage,
          current_page: curPage,
          per_page: curPerPage,
          last_page: totalPages,
          total_pages: totalPages,
        });
      })
      .catch((err) => {
        if (seq !== seqRef.current || controller.signal.aborted || err?.name === 'AbortError' || err?.isCancelled) {
          return;
        }
        setRecords([]);
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to load history records.');
      })
      .finally(() => {
        if (seq === seqRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, [page, perPage, sortBy, sortDir, debouncedSearch, category, actorRole, moduleFilter, resultFilter, dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchHistory]);

  const handleSort = useCallback((colKey) => {
    setSortBy((prev) => {
      if (prev === colKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return colKey;
    });
    setPage(1);
  }, []);

  const handleInspect = async (row) => {
    setSelectedEvent(row);
    setLoadingDetail(true);
    try {
      const full = await historyApi.getDetail(row.id);
      if (full) setSelectedEvent(full);
    } catch {
      // Keep summary row visible
    } finally {
      setLoadingDetail(false);
    }
  };

  const canOpenTimeline = (affected) => {
    if (!affected || !affected.id) return false;
    const t = String(affected.type || '').toLowerCase();
    return ['patient', 'patients', 'dentist', 'dentists', 'user', 'users', 'appointment', 'appointments'].includes(t);
  };

  const openTimelineForAffected = (affected) => {
    if (!canOpenTimeline(affected)) return;
    const t = String(affected.type).toLowerCase();
    const mapped = t.startsWith('patient')
      ? 'patient'
      : t.startsWith('dentist')
        ? 'dentist'
        : t.startsWith('appointment')
          ? 'appointment'
          : 'staff';
    setTimelineTarget({
      entityType: mapped,
      entityId: affected.id,
      title: `${affected.reference} — Lifecycle Timeline`,
    });
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategory('');
    setActorRole('');
    setModuleFilter('');
    setResultFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchInput || category || actorRole || moduleFilter || resultFilter || dateFrom || dateTo);

  const kpiCards = [
    { key: '', label: 'Total Activities', value: summary?.total_activities ?? meta.total_records ?? 0, icon: Activity, tone: 'text-slate-900 dark:text-slate-50' },
    { key: 'PATIENT', label: 'Patient Activities', value: summary?.patient_activities ?? 0, icon: UserCheck, tone: 'text-indigo-700 dark:text-indigo-300' },
    { key: 'STAFF', label: 'Staff Activities', value: summary?.staff_activities ?? 0, icon: Users, tone: 'text-teal-700 dark:text-teal-300' },
    { key: 'APPOINTMENT', label: 'Appointments', value: summary?.appointment_activities ?? 0, icon: Calendar, tone: 'text-sky-700 dark:text-sky-300' },
    { key: 'SECURITY', label: 'Security Events', value: summary?.security_activities ?? 0, icon: ShieldAlert, tone: 'text-rose-700 dark:text-rose-300' },
    { key: 'ADMIN', label: 'Admin Actions', value: summary?.administrative_activities ?? 0, icon: Shield, tone: 'text-purple-700 dark:text-purple-300' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              History Records
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700">
              <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              Asia/Manila (PHT)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Chronological lifecycle tracking across patients, dentists, receptionists, administrators, appointments, and security operations with previous-to-updated value comparisons.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          aria-label="Refresh history records"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0 self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {/* 6 Database-Backed Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const active = category === card.key && card.key !== '';
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                setCategory(card.key === category ? '' : card.key);
                setPage(1);
              }}
              className={`text-left rounded-2xl border p-4 shadow-xs transition-colors cursor-pointer ${
                active
                  ? 'bg-teal-50/70 dark:bg-teal-500/15 border-[#0D9488] dark:border-teal-400'
                  : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-teal-400/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span className="truncate">{card.label}</span>
                <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
              </div>
              <div className={`mt-1.5 text-2xl font-extrabold font-mono tabular-nums ${card.tone}`}>
                {card.value}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="relative lg:col-span-2">
            <label htmlFor="history-search-input" className="sr-only">
              Search actor, event ID, action, or affected record
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="history-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actor, HIS-ID, action, or record..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear history search"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by actor role"
            value={actorRole}
            onChange={(e) => {
              setActorRole(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Administrator</option>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="DENTIST">Dentist</option>
            <option value="PATIENT">Patient</option>
            <option value="SYSTEM">System</option>
          </select>

          <select
            aria-label="Filter by module"
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100"
          >
            {MODULE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by result"
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100"
          >
            <option value="">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning / Cancelled</option>
            <option value="FAILED">Failed</option>
            <option value="DENIED">Denied</option>
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="History start date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100"
            />
            <input
              type="date"
              aria-label="History end date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={fetchHistory} className="text-xs font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* 9-Column Server-Side Data Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
            <thead role="rowgroup">
              <tr role="row" className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <SortableColumnHeader columnKey="id" label="Event ID" activeSortBy={sortBy} activeSortDir={sortDir} onSort={handleSort} className="pl-5 pr-3" />
                <th role="columnheader" className="py-3.5 px-3">Actor</th>
                <SortableColumnHeader columnKey="actor_role" label="Role" activeSortBy={sortBy} activeSortDir={sortDir} onSort={handleSort} />
                <SortableColumnHeader columnKey="action" label="Action" activeSortBy={sortBy} activeSortDir={sortDir} onSort={handleSort} />
                <SortableColumnHeader columnKey="module" label="Module" activeSortBy={sortBy} activeSortDir={sortDir} onSort={handleSort} />
                <th role="columnheader" className="py-3.5 px-3">Affected Record</th>
                <SortableColumnHeader columnKey="created_at" label="Timestamp (PHT)" activeSortBy={sortBy} activeSortDir={sortDir} onSort={handleSort} />
                <th role="columnheader" className="py-3.5 px-3">Result</th>
                <th role="columnheader" className="py-3.5 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
              {loading ? (
                <TableSkeleton.Rows count={6} columns={9} />
              ) : records.length === 0 ? (
                <tr>
                  <td role="cell" colSpan={9} className="py-12 px-4 text-center">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                      No history records matched your filters.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Try adjusting your date range, role, or module filters.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.id} role="row" className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors">
                    <td role="cell" data-label="Event ID" className="py-3.5 pl-5 pr-3 font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {row.event_ref}
                    </td>

                    <td role="cell" data-label="Actor" className="py-3.5 px-3 max-w-[180px]">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {row.actor_name}
                      </div>
                      {row.actor_is_active === false && (
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30">
                          Archived Actor
                        </span>
                      )}
                    </td>

                    <td role="cell" data-label="Role" className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${ROLE_BADGE[row.actor_role] || ROLE_BADGE.SYSTEM}`}>
                        {row.actor_role}
                      </span>
                    </td>

                    <td role="cell" data-label="Action" className="py-3.5 px-3 max-w-[200px]">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {row.action_label}
                      </div>
                      {row.changes?.length > 0 && (
                        <div className="text-[10.5px] text-teal-700 dark:text-teal-300">
                          {row.changes.length} field change{row.changes.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>

                    <td role="cell" data-label="Module" className="py-3.5 px-3 whitespace-nowrap capitalize text-slate-600 dark:text-slate-300">
                      {row.module}
                    </td>

                    <td role="cell" data-label="Affected Record" className="py-3.5 px-3 whitespace-nowrap">
                      {canOpenTimeline(row.affected_record) ? (
                        <button
                          type="button"
                          onClick={() => openTimelineForAffected(row.affected_record)}
                          className="font-mono text-[11px] font-semibold text-[#0F766E] dark:text-teal-300 hover:underline cursor-pointer"
                        >
                          {row.affected_record.reference}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {row.affected_record?.reference || 'SYSTEM'}
                        </span>
                      )}
                    </td>

                    <td role="cell" data-label="Timestamp" className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                      {row.timestamp_manila || row.created_at}
                    </td>

                    <td role="cell" data-label="Result" className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${RESULT_BADGE[row.result] || RESULT_BADGE.SUCCESS}`}>
                        {row.result}
                      </span>
                    </td>

                    <td role="cell" data-label="Details" className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleInspect(row)}
                        aria-label={`View details for ${row.event_ref}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-teal-300 font-semibold text-[11px] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ServerTableFooter
          page={meta.current_page || meta.page || page}
          perPage={meta.per_page || perPage}
          totalRecords={meta.total_records ?? meta.total ?? 0}
          filteredRecords={meta.filtered_records ?? meta.total ?? 0}
          totalPages={meta.total_pages || meta.last_page || 1}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPerPageChange={(nextSize) => {
            setPerPage(nextSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
          itemLabel="history events"
        />
      </div>

      {/* EVENT DETAIL & BEFORE/AFTER VALUE COMPARISON MODAL */}
      {selectedEvent && (
        <DialogOverlay
          onClose={() => setSelectedEvent(null)}
          className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/75 dark:bg-gray-900/50 flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {selectedEvent.event_ref} · {selectedEvent.module}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {selectedEvent.action_label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close history event detail"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actor</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedEvent.actor_name} ({selectedEvent.actor_role})
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timestamp (Asia/Manila)</div>
                  <div className="font-mono font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                    {selectedEvent.timestamp_manila || selectedEvent.created_at}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Affected Record</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedEvent.affected_record?.reference || 'SYSTEM'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outcome</div>
                  <div className="mt-0.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${RESULT_BADGE[selectedEvent.result] || RESULT_BADGE.SUCCESS}`}>
                      {selectedEvent.result}
                    </span>
                  </div>
                </div>
                {selectedEvent.reason && (
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorded Reason</div>
                    <div className="text-slate-700 dark:text-slate-200 mt-0.5">{selectedEvent.reason}</div>
                  </div>
                )}
              </div>

              {/* Historical Value Comparison (Before -> After) */}
              {Array.isArray(selectedEvent.changes) && selectedEvent.changes.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Previous vs. Updated Values
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table role="table" className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="px-3.5 py-2">Field</th>
                          <th className="px-3.5 py-2">Previous Value</th>
                          <th className="px-3.5 py-2">Updated Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70">
                        {selectedEvent.changes.map((c) => (
                          <tr key={c.field} className="bg-white dark:bg-gray-800">
                            <td className="px-3.5 py-2 font-mono font-semibold text-slate-600 dark:text-slate-300">
                              {c.field}
                            </td>
                            <td className="px-3.5 py-2 text-rose-700 dark:text-rose-300">
                              {formatValue(c.before)}
                            </td>
                            <td className="px-3.5 py-2 font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{formatValue(c.after)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {loadingDetail ? (
                <div className="text-center text-slate-400 py-3">Loading full event metadata...</div>
              ) : selectedEvent.payload && Object.keys(selectedEvent.payload).length > 0 ? (
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Sanitized Event Context (Passwords & Clinical Notes Redacted)
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              ) : null}

              {canOpenTimeline(selectedEvent.affected_record) && (
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedEvent.affected_record;
                      setSelectedEvent(null);
                      openTimelineForAffected(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Open Full Record Timeline</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* INDIVIDUAL RECORD TIMELINE MODAL */}
      {timelineTarget && (
        <RecordHistoryModal
          entityType={timelineTarget.entityType}
          entityId={timelineTarget.entityId}
          title={timelineTarget.title}
          onClose={() => setTimelineTarget(null)}
        />
      )}
    </div>
  );
}

export default HistoryRecordsPage;
