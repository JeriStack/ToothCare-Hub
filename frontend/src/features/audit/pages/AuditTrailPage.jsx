import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  Download,
  RefreshCw,
  ShieldAlert,
  Eye,
  X,
  AlertTriangle,
  CheckCircle,
  Calendar,
  ChevronDown,
  Copy,
  Check,
  ArrowUpDown,
  RotateCcw,
  Clock,
  Globe,
  Layers,
  User,
} from 'lucide-react';
import { auditApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'users', label: 'Users & Auth' },
  { value: 'patients', label: 'Patients' },
  { value: 'dentists', label: 'Dentists' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'treatment_records', label: 'Treatment Records' },
  { value: 'services', label: 'Services' },
  { value: 'roles', label: 'Roles & DRBAC' },
  { value: 'legal_documents', label: 'Legal Documents' },
  { value: 'email_outbox', label: 'Email Outbox' },
  { value: 'clinic_settings', label: 'Clinic Settings' },
  { value: 'audit_logs', label: 'Audit Logs' },
  { value: 'archives', label: 'Archives' },
];

const DATE_PRESETS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
];

function formatLocalDateIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateWindow(selectedDate, datePreset) {
  if (selectedDate) {
    return { date_from: selectedDate, date_to: selectedDate };
  }
  if (datePreset === 'today') {
    const today = formatLocalDateIso(new Date());
    return { date_from: today, date_to: today };
  }
  if (datePreset === '7d' || datePreset === '30d') {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (datePreset === '7d' ? 6 : 29));
    return { date_from: formatLocalDateIso(start), date_to: formatLocalDateIso(end) };
  }
  return {};
}

function getActionBadgeStyle(action = '') {
  if (
    action.includes('FAILED') ||
    action.includes('RATE_LIMITED') ||
    action.includes('BLOCKED') ||
    action.includes('DEACTIVATED') ||
    action.includes('LOCKOUT') ||
    action.includes('DELETED') ||
    action.includes('REJECTED')
  ) {
    return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70';
  }
  if (
    action.includes('CREATED') ||
    action.includes('ACTIVATED') ||
    action.includes('CONFIRMED') ||
    action.includes('COMPLETED') ||
    action.includes('PUBLISHED')
  ) {
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';
  }
  if (
    action.includes('UPDATED') ||
    action.includes('AMENDED') ||
    action.includes('RESCHEDULED') ||
    action.includes('CANCELLED')
  ) {
    return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70';
  }
  if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('EXPORT')) {
    return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60';
  }
  return 'bg-slate-100 dark:bg-gray-700/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600';
}

function getRoleBadgeStyle(role = '') {
  switch (String(role).toUpperCase()) {
    case 'ADMIN':
      return 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30';
    case 'DENTIST':
      return 'bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border-teal-200/80 dark:border-teal-500/30';
    case 'RECEPTIONIST':
      return 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30';
    case 'PATIENT':
      return 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30';
    default:
      return 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600';
  }
}

export function AuditTrailPage() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'security'
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ total: 0, total_records: 0, filtered_records: 0, page: 1, per_page: 10, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters (single calendar + quick date presets)
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | '7d' | '30d' | 'custom'
  const [sortDir, setSortDir] = useState('DESC'); // 'DESC' | 'ASC'
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Payload Inspector Modal
  const [inspectingLog, setInspectingLog] = useState(null);
  const [diffPage, setDiffPage] = useState(1);
  const [diffPerPage, setDiffPerPage] = useState(6);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    setDiffPage(1);
  }, [inspectingLog]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCopy = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      showToast('Unable to copy to clipboard.', 'error');
    }
  };

  const buildQueryParams = useCallback(
    (includePaging = true) => {
      const params = {};
      if (includePaging) {
        params.page = page;
        params.per_page = perPage;
        params.sort_dir = sortDir;
      }
      if (search.trim()) params.search = search.trim();
      if (targetType) params.target_type = targetType;

      const dateWindow = getDateWindow(selectedDate, datePreset);
      if (dateWindow.date_from) params.date_from = dateWindow.date_from;
      if (dateWindow.date_to) params.date_to = dateWindow.date_to;

      return params;
    },
    [page, perPage, sortDir, search, targetType, selectedDate, datePreset]
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams(true);

      if (activeTab === 'security') {
        const res = await auditApi.getSecurityEvents(params);
        if (Array.isArray(res)) {
          setLogs(res);
          setMeta({ total: res.length, page: 1, per_page: perPage, last_page: 1 });
        } else {
          setLogs(res?.data || []);
          setMeta(res?.meta || { total: 0, page: 1, per_page: perPage, last_page: 1 });
        }
      } else {
        const res = await auditApi.getLogs(params);
        setLogs(res?.data || []);
        setMeta(res?.meta || { total: 0, page: 1, per_page: perPage, last_page: 1 });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load audit records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQueryParams, perPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = buildQueryParams(false);
      if (activeTab === 'security') {
        params.security_only = 1;
      }
      await auditApi.exportCsv(params);
      showToast('Audit log CSV export downloaded.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'CSV export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleSelectDate = (value) => {
    setSelectedDate(value);
    setDatePreset(value ? 'custom' : 'all');
    setPage(1);
  };

  const handleSelectPreset = (presetId) => {
    setDatePreset(presetId);
    if (presetId === 'today') {
      setSelectedDate(formatLocalDateIso(new Date()));
    } else {
      setSelectedDate('');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTargetType('');
    setSelectedDate('');
    setDatePreset('all');
    setActiveTab('all');
    setSortDir('DESC');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() || targetType || selectedDate || datePreset !== 'all' || activeTab === 'security'
  );

  const selectedModuleLabel = useMemo(
    () => MODULE_OPTIONS.find((m) => m.value === targetType)?.label || targetType,
    [targetType]
  );

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          )}
          <span className="tch-wrap-anywhere">{toast.message}</span>
        </div>
      )}

      {/* Executive Header Card */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              System Audit Trail &amp; Security Events
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30 tabular-nums">
              <Activity className="w-3 h-3" aria-hidden="true" />
              {Number(meta.total || 0).toLocaleString()} {meta.total === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Append-only forensic history tracking clinical actions, authorization modifications, and login attempts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="min-h-10 inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh audit trail"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            aria-busy={exporting}
            className="min-h-10 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#12304A] dark:bg-[#0F766E] hover:bg-[#1e496e] dark:hover:bg-[#0D9488] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-teal-300" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4 text-teal-300" aria-hidden="true" />
            )}
            <span>{exporting ? 'Exporting CSV...' : 'Export CSV Log'}</span>
          </button>
        </div>
      </div>

      {/* Filters & Stream Controls Card (Single Calendar Filter) */}
      <div className="bg-white dark:bg-gray-800/95 p-4 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs space-y-3.5">
        {/* Top Row: Stream Tabs + Quick Time Presets + Sort */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Audit event stream"
            className="inline-flex flex-wrap max-w-full p-1 rounded-xl bg-slate-100 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700/80 self-start gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-gray-800 text-[#0F766E] dark:text-teal-300 shadow-2xs ring-1 ring-slate-200/80 dark:ring-gray-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
              <span>All Audit Events</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'security'}
              onClick={() => {
                setActiveTab('security');
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-white dark:bg-gray-800 text-rose-700 dark:text-rose-300 shadow-2xs ring-1 ring-slate-200/80 dark:ring-gray-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Security &amp; Failed Logins</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="Quick date range presets"
              className="inline-flex flex-wrap max-w-full items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700/80 gap-1"
            >
              {DATE_PRESETS.map((preset) => {
                const active = datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`min-h-11 sm:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-gray-800 text-[#0F766E] dark:text-teal-300 shadow-2xs ring-1 ring-slate-200/80 dark:ring-gray-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setSortDir((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
                setPage(1);
              }}
              title={sortDir === 'DESC' ? 'Sorted newest first — click for oldest first' : 'Sorted oldest first — click for newest first'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-gray-700/80 bg-slate-50/80 dark:bg-gray-900/70 text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500/60 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>{sortDir === 'DESC' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Search + Module + Single Calendar + Per-Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-5">
            <label htmlFor="audit-trail-search" className="sr-only">
              Search action, email, or IP
            </label>
            <Search
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="audit-trail-search"
              type="text"
              placeholder="Search action, email, or IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Select */}
          <div className="relative lg:col-span-3">
            <label htmlFor="audit-trail-module" className="sr-only">
              Filter by module
            </label>
            <Layers
              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="audit-trail-module"
              aria-label="Filter by module"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setPage(1);
              }}
              className="w-full appearance-none pl-9 pr-8 py-2 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer"
            >
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Single Calendar Date Filter */}
          <div className="relative lg:col-span-2">
            <label htmlFor="audit-trail-date" className="sr-only">
              Filter by date
            </label>
            <input
              id="audit-trail-date"
              type="date"
              aria-label="Filter by date"
              value={selectedDate}
              onChange={(e) => handleSelectDate(e.target.value)}
              title="Filter logs by a specific date"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer"
            />
          </div>

          {/* Rows per page */}
          <div className="relative lg:col-span-2">
            <label htmlFor="audit-trail-per-page" className="sr-only">
              Rows per page
            </label>
            <select
              id="audit-trail-per-page"
              aria-label="Rows per page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Active Filters:
            </span>
            {activeTab === 'security' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30 font-semibold">
                Security Stream
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setPage(1);
                  }}
                  aria-label="Remove security stream filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30 font-semibold">
                Query: “{search.trim()}”
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  aria-label="Remove search filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {targetType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/30 font-semibold">
                Module: {selectedModuleLabel}
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('');
                    setPage(1);
                  }}
                  aria-label="Remove module filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(selectedDate || datePreset !== 'all') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 font-semibold tabular-nums">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {selectedDate
                  ? `Date: ${selectedDate}`
                  : DATE_PRESETS.find((p) => p.id === datePreset)?.label}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setDatePreset('all');
                    setPage(1);
                  }}
                  aria-label="Remove date filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{error}</p>
            <button
              type="button"
              onClick={fetchLogs}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : loading && logs.length === 0 ? (
          <TableSkeleton rows={6} cols={6} />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <Activity className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No audit trail events match your filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 text-xs font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table role="table" className="tch-responsive-table w-full text-left border-collapse">
              <thead role="rowgroup">
                <tr
                  role="row"
                  className="bg-slate-50/90 dark:bg-gray-900/70 border-b border-slate-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  <th role="columnheader" className="py-3.5 px-5">
                    Timestamp
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">
                    Actor
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">
                    Action
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">
                    Target Entity
                  </th>
                  <th role="columnheader" className="py-3.5 px-4">
                    IP Address
                  </th>
                  <th role="columnheader" className="py-3.5 px-5 text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70 text-xs">
                {logs.map((log) => (
                  <tr
                    role="row"
                    key={log.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-gray-700/35 transition-colors"
                  >
                    <td
                      role="cell"
                      data-label="Timestamp"
                      className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums"
                    >
                      {log.created_at}
                    </td>
                    <td role="cell" data-label="Actor" className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (log.actor_email && log.actor_email !== 'System / Anonymous') {
                            setSearch(log.actor_email);
                            setPage(1);
                          }
                        }}
                        title={
                          log.actor_email && log.actor_email !== 'System / Anonymous'
                            ? `Filter logs by ${log.actor_email}`
                            : undefined
                        }
                        className={`font-semibold text-slate-800 dark:text-slate-100 block text-left ${
                          log.actor_email && log.actor_email !== 'System / Anonymous'
                            ? 'hover:text-[#0F766E] dark:hover:text-teal-300 cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        {log.actor_email}
                      </button>
                      <span
                        className={`mt-1 inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(
                          log.actor_role
                        )}`}
                      >
                        {log.actor_role}
                      </span>
                    </td>
                    <td role="cell" data-label="Action" className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeStyle(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td
                      role="cell"
                      data-label="Target Entity"
                      className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100/80 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700/80 text-[11px]">
                        <span>{log.target_type}</span>
                        {log.target_id ? (
                          <span className="text-slate-400 dark:text-slate-500">#{log.target_id}</span>
                        ) : null}
                      </span>
                    </td>
                    <td role="cell" data-label="IP Address" className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (log.ip_address) {
                            setSearch(log.ip_address);
                            setPage(1);
                          }
                        }}
                        title={log.ip_address ? `Filter logs by IP ${log.ip_address}` : undefined}
                        className="hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
                      >
                        {log.ip_address}
                      </button>
                    </td>
                    <td role="cell" data-label="Details" className="py-3.5 px-5 text-right">
                      {log.payload ? (
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-gray-700/90 hover:bg-teal-50 dark:hover:bg-teal-500/20 text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-teal-300 border border-slate-200/80 dark:border-gray-600/80 hover:border-teal-300 dark:hover:border-teal-500/40 rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Inspect</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unified Server-Side Pagination */}
        {meta.total > 0 && (
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
            pageSizeOptions={[5, 10, 25, 50, 100]}
            loading={loading}
            itemLabel="entries"
          />
        )}
      </div>

      {/* Payload Inspector Modal */}
      {inspectingLog && (
        <DialogOverlay
          onClose={() => setInspectingLog(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-gray-900/90 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0">
                  <Activity className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-50 truncate">
                    Audit Payload Details (#{inspectingLog.id})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{inspectingLog.created_at}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                aria-label="Close payload inspector"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-slate-200/80 dark:border-gray-700/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Action
                  </span>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeStyle(
                      inspectingLog.action
                    )}`}
                  >
                    {inspectingLog.action}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-slate-200/80 dark:border-gray-700/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Actor
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {inspectingLog.actor_email}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${getRoleBadgeStyle(
                        inspectingLog.actor_role
                      )}`}
                    >
                      {inspectingLog.actor_role}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-slate-200/80 dark:border-gray-700/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Target Entity
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">
                    {inspectingLog.target_type} #{inspectingLog.target_id || 'N/A'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-slate-200/80 dark:border-gray-700/80 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Client IP
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>{inspectingLog.ip_address}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(inspectingLog.ip_address, 'ip')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-400 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'ip' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* DRBAC Explicit Added / Removed Summary Pills */}
              {(Array.isArray(inspectingLog.payload?.added) || Array.isArray(inspectingLog.payload?.removed)) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/80 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Permission Grant Delta
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(inspectingLog.payload?.added || []).map((slug) => (
                      <span
                        key={`add-${slug}`}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30"
                      >
                        + {slug}
                      </span>
                    ))}
                    {(inspectingLog.payload?.removed || []).map((slug) => (
                      <span
                        key={`rem-${slug}`}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30"
                      >
                        - {slug}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Before vs. After Change Comparison */}
              {(inspectingLog.payload?.before || inspectingLog.payload?.after) && (() => {
                const diffFields = Array.from(
                  new Set([
                    ...Object.keys(inspectingLog.payload?.before || {}),
                    ...Object.keys(inspectingLog.payload?.after || {}),
                  ])
                );
                const diffTotalPages = Math.max(1, Math.ceil(diffFields.length / diffPerPage));
                const safeDiffPage = Math.min(diffPage, diffTotalPages);
                const visibleDiffFields = diffFields.slice(
                  (safeDiffPage - 1) * diffPerPage,
                  safeDiffPage * diffPerPage
                );
                return (
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-2">
                    Before vs. After Change Comparison
                  </span>
                  <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table role="table" className="tch-responsive-table w-full text-left text-xs">
                      <thead
                        role="rowgroup"
                        className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-semibold"
                      >
                        <tr>
                          <th role="columnheader" className="px-3 py-2">
                            Field
                          </th>
                          <th role="columnheader" className="px-3 py-2">
                            Before
                          </th>
                          <th role="columnheader" className="px-3 py-2">
                            After
                          </th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
                        {visibleDiffFields.map((field) => {
                          const formatVal = (val) => {
                            if (val === undefined) return '—';
                            if (val === null) return 'null';
                            if (Array.isArray(val)) return val.join(', ') || '(none)';
                            if (typeof val === 'object') return JSON.stringify(val);
                            return String(val);
                          };
                          const beforeVal = formatVal(inspectingLog.payload?.before?.[field]);
                          const afterVal = formatVal(inspectingLog.payload?.after?.[field]);
                          return (
                            <tr role="row" key={field} className="bg-white dark:bg-gray-800">
                              <td
                                role="cell"
                                data-label="Field"
                                className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200"
                              >
                                {field}
                              </td>
                              <td
                                role="cell"
                                data-label="Before"
                                className="px-3 py-2 text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/40 break-all"
                              >
                                {beforeVal}
                              </td>
                              <td
                                role="cell"
                                data-label="After"
                                className="px-3 py-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/40 font-medium break-all"
                              >
                                {afterVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {diffFields.length > diffPerPage && (
                      <ServerTableFooter
                        page={safeDiffPage}
                        perPage={diffPerPage}
                        totalRecords={diffFields.length}
                        filteredRecords={diffFields.length}
                        totalPages={diffTotalPages}
                        onPageChange={(nextPage) => setDiffPage(nextPage)}
                        onPerPageChange={(nextSize) => {
                          setDiffPerPage(nextSize);
                          setDiffPage(1);
                        }}
                        pageSizeOptions={[6, 12, 25]}
                        itemLabel="fields"
                      />
                    )}
                  </div>
                </div>
                );
              })()}

              {/* Raw Sanitized Payload JSON */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Sanitized Event Data
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(inspectingLog.payload, null, 2), 'json')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/70 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-400 cursor-pointer"
                  >
                    {copiedKey === 'json' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 dark:bg-gray-950 text-emerald-300 rounded-xl text-xs font-mono overflow-x-auto max-h-60 border border-slate-800 dark:border-gray-700">
                  {JSON.stringify(inspectingLog.payload, null, 2)}
                </pre>
              </div>

              {inspectingLog.user_agent && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700/70 text-[11px] text-slate-500 dark:text-slate-400 break-all">
                  <strong className="text-slate-700 dark:text-slate-300">User-Agent:</strong> {inspectingLog.user_agent}
                </div>
              )}
            </div>

            {/* Pinned Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/60 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (inspectingLog.actor_email && inspectingLog.actor_email !== 'System / Anonymous') {
                    setSearch(inspectingLog.actor_email);
                    setPage(1);
                    setInspectingLog(null);
                  }
                }}
                disabled={!inspectingLog.actor_email || inspectingLog.actor_email === 'System / Anonymous'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 disabled:opacity-40 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filter by Actor</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 bg-slate-200/80 dark:bg-gray-700 hover:bg-slate-300/80 dark:hover:bg-gray-600 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default AuditTrailPage;
