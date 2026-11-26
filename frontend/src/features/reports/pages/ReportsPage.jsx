import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Stethoscope,
  Users,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Filter,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Download,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { reportsApi } from '../api';
import { ReportSkeleton } from '../../../components/skeletons';

const COLLAPSE_STORAGE_KEY = 'toothcare_reports_collapsed_cards';
const ALL_CARD_KEYS = ['status', 'volume', 'services', 'dentists', 'appointments', 'patients'];

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

function escapeCsvCell(value) {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

const PRESET_OPTIONS = [
  { id: '7', label: 'Last 7 Days' },
  { id: '30', label: 'Last 30 Days' },
  { id: '90', label: 'Last 90 Days' },
];

const STATUS_META = [
  {
    key: 'PENDING',
    label: 'Pending',
    barClass: 'bg-amber-500 dark:bg-amber-400',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass:
      'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
  },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    barClass: 'bg-teal-600 dark:bg-teal-400',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
    badgeClass:
      'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/80',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    barClass: 'bg-emerald-600 dark:bg-emerald-400',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
  },
  {
    key: 'CANCELLED',
    label: 'Cancelled',
    barClass: 'bg-slate-400 dark:bg-slate-500',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    badgeClass:
      'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-slate-300 border-slate-200 dark:border-gray-600',
  },
  {
    key: 'REJECTED',
    label: 'Declined',
    barClass: 'bg-rose-500 dark:bg-rose-400',
    dotClass: 'bg-rose-500 dark:bg-rose-400',
    badgeClass:
      'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
  },
];

function CollapsibleReportCard({
  cardKey,
  title,
  icon: Icon,
  summaryBadge,
  headerRight,
  isMinimized,
  onToggleMinimize,
  noBodyPadding = false,
  className = '',
  bodyClassName = '',
  children,
}) {
  return (
    <section
      aria-label={title}
      className={`bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden transition-all flex flex-col ${className}`}
    >
      <div
        className={`px-5 py-3.5 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-gray-900/55 shrink-0 ${
          isMinimized ? '' : 'border-b border-slate-100 dark:border-gray-700/80'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0">
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-sm text-slate-900 dark:text-gray-100 truncate">{title}</h2>
            {summaryBadge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700 tabular-nums">
                {summaryBadge}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isMinimized && headerRight}
          <button
            type="button"
            onClick={() => onToggleMinimize(cardKey)}
            aria-expanded={!isMinimized}
            aria-label={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
            title={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:border-teal-400 dark:hover:border-teal-500/60 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
          >
            {isMinimized ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Minimize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className={`flex-1 ${noBodyPadding ? '' : 'p-5'} ${bodyClassName}`}>{children}</div>
      )}
    </section>
  );
}

export function ReportsPage() {
  const initial = getPresetDates(30);
  const [presetDays, setPresetDays] = useState('30');
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [dentistFilter, setDentistFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('');
  const [page, setPage] = useState(1);
  const [validationError, setValidationError] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [apptData, setApptData] = useState(null);
  const [serviceData, setServiceData] = useState(null);
  const [dentistData, setDentistData] = useState(null);
  const [patientData, setPatientData] = useState(null);

  // Interactive day selection in Daily Volume chart
  const [selectedVolumeDate, setSelectedVolumeDate] = useState(null);

  // Collapsible/minimizable cards state (persisted per user browser)
  const [minimizedCards, setMinimizedCards] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // Ignore storage access errors
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(minimizedCards));
    } catch {
      // Ignore storage access errors
    }
  }, [minimizedCards]);

  // Debounce patient search input so typing doesn't spam API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const toggleCardMinimize = useCallback((key) => {
    setMinimizedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const allCardsMinimized = useMemo(
    () => ALL_CARD_KEYS.every((k) => Boolean(minimizedCards[k])),
    [minimizedCards]
  );

  const toggleMinimizeAll = () => {
    if (allCardsMinimized) {
      setMinimizedCards({});
    } else {
      const next = {};
      ALL_CARD_KEYS.forEach((k) => {
        next[k] = true;
      });
      setMinimizedCards(next);
    }
  };

  const fetchReports = useCallback(async (from, to, filters = {}) => {
    if (from && to && to < from) {
      setValidationError('End date cannot be earlier than start date.');
      return;
    }
    setValidationError(null);
    setLoading(true);
    setError(null);
    try {
      const dateParams = { start_date: from, end_date: to };
      const apptParams = { ...dateParams };
      if (filters.dentistId) apptParams.dentist_id = filters.dentistId;
      if (filters.serviceId) apptParams.service_id = filters.serviceId;
      if (filters.status) apptParams.status = filters.status;
      if (filters.patientQuery && filters.patientQuery.trim()) {
        const q = filters.patientQuery.trim();
        if (/^\d+$/.test(q)) {
          apptParams.patient_id = q;
        } else {
          apptParams.search = q;
        }
      }
      if (filters.page && filters.page > 1) apptParams.page = filters.page;

      const [appts, services, dentists, patients] = await Promise.all([
        reportsApi.getAppointmentReports(apptParams),
        reportsApi.getServiceReports(dateParams),
        reportsApi.getDentistReports(dateParams),
        reportsApi.getPatientReports(dateParams),
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
    fetchReports(startDate, endDate, {
      dentistId: dentistFilter,
      serviceId: serviceFilter,
      status: statusFilter,
      patientQuery: debouncedPatientSearch,
      page,
    });
  }, [fetchReports, startDate, endDate, dentistFilter, serviceFilter, statusFilter, debouncedPatientSearch, page]);

  const handlePresetChange = (value) => {
    setPresetDays(value);
    setPage(1);
    setSelectedVolumeDate(null);
    const days = parseInt(value, 10);
    if (!Number.isNaN(days)) {
      const range = getPresetDates(days);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const handleClearFilters = () => {
    setDentistFilter('');
    setServiceFilter('');
    setStatusFilter('');
    setPatientSearch('');
    setDebouncedPatientSearch('');
    setSelectedVolumeDate(null);
    setPage(1);
  };

  const handleExportCsv = () => {
    const rows = apptData?.appointments || [];
    const headers = ['Ref #', 'Date & Time', 'Patient', 'Dentist', 'Service', 'Status'];
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((appt) => {
        const statusObj = STATUS_META.find((s) => s.key === appt.status) || STATUS_META[0];
        const patientName =
          `${appt.patient_first_name || ''} ${appt.patient_last_name || ''}`.trim() ||
          `Patient #${appt.patient_id}`;
        const dentistName = appt.dentist_last_name
          ? `Dr. ${appt.dentist_first_name || ''} ${appt.dentist_last_name}`.trim()
          : `Dentist #${appt.dentist_id}`;
        return [
          `#${appt.id}`,
          appt.start_at ? String(appt.start_at).slice(0, 16) : 'N/A',
          patientName,
          dentistName,
          appt.service_name || `Service #${appt.service_id}`,
          statusObj.label,
        ]
          .map(escapeCsvCell)
          .join(',');
      }),
    ];

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `toothcare-operational-report-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const totalAppointments = apptData?.total_appointments || 0;
  const statusDistribution = apptData?.status_distribution || {};
  const dailyTimeline = apptData?.daily_timeline || [];

  // Aggregate daily timeline by date with per-status breakdown
  const dailySeries = useMemo(() => {
    const map = {};
    dailyTimeline.forEach((row) => {
      const date = row.date;
      if (!date) return;
      if (!map[date]) {
        map[date] = { date, count: 0, completed: 0, pending: 0, confirmed: 0, cancelled: 0, rejected: 0 };
      }
      const c = Number(row.count || 0);
      map[date].count += c;
      const st = String(row.status || '').toUpperCase();
      if (st === 'COMPLETED') map[date].completed += c;
      else if (st === 'PENDING') map[date].pending += c;
      else if (st === 'CONFIRMED') map[date].confirmed += c;
      else if (st === 'CANCELLED') map[date].cancelled += c;
      else if (st === 'REJECTED') map[date].rejected += c;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyTimeline]);

  const maxDailyCount = useMemo(
    () => Math.max(1, ...dailySeries.map((d) => d.count)),
    [dailySeries]
  );

  const peakDay = useMemo(() => {
    if (dailySeries.length === 0) return null;
    return dailySeries.reduce((best, item) => (item.count > best.count ? item : best), dailySeries[0]);
  }, [dailySeries]);

  const avgDailyCount = useMemo(() => {
    if (dailySeries.length === 0) return 0;
    const sum = dailySeries.reduce((acc, d) => acc + d.count, 0);
    return (sum / dailySeries.length).toFixed(1);
  }, [dailySeries]);

  const activeVolumeDay = useMemo(() => {
    if (selectedVolumeDate) {
      return dailySeries.find((d) => d.date === selectedVolumeDate) || peakDay;
    }
    return peakDay;
  }, [dailySeries, selectedVolumeDate, peakDay]);

  const registrationTimeline = patientData?.registration_timeline || [];
  const maxRegCount = useMemo(
    () => Math.max(1, ...registrationTimeline.map((r) => Number(r.registrations || 0))),
    [registrationTimeline]
  );

  const hasFilters = Boolean(dentistFilter || serviceFilter || statusFilter || patientSearch.trim());

  const activeDentistName = useMemo(() => {
    if (!dentistFilter) return '';
    const found = (dentistData?.dentists || []).find((d) => String(d.id) === String(dentistFilter));
    return found ? `Dr. ${found.first_name} ${found.last_name}` : `Dentist #${dentistFilter}`;
  }, [dentistFilter, dentistData]);

  const activeServiceName = useMemo(() => {
    if (!serviceFilter) return '';
    const found = (serviceData?.services || []).find((s) => String(s.id) === String(serviceFilter));
    return found ? found.name : `Service #${serviceFilter}`;
  }, [serviceFilter, serviceData]);

  const activeStatusLabel = useMemo(() => {
    if (!statusFilter) return '';
    return STATUS_META.find((s) => s.key === statusFilter)?.label || statusFilter;
  }, [statusFilter]);

  if (loading && !apptData) {
    return <ReportSkeleton />;
  }

  const totalPatients = patientData?.total_patients || 0;
  const activePatients = patientData?.active_patients || 0;
  const activePatientPct = totalPatients > 0 ? Math.round((activePatients / totalPatients) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Executive Header Card */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              Clinic Operational Reports &amp; Analytics
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30 tabular-nums">
              <Calendar className="w-3 h-3" aria-hidden="true" />
              {startDate} → {endDate}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Database-driven appointment throughput, dentist workload, service utilization, patient registrations (Asia/Manila).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleMinimizeAll}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
          >
            {allCardsMinimized ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>Expand All</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>Minimize All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !(apptData?.appointments?.length > 0)}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#12304A] dark:bg-[#0F766E] hover:bg-[#1e496e] dark:hover:bg-[#0D9488] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() =>
              fetchReports(startDate, endDate, {
                dentistId: dentistFilter,
                serviceId: serviceFilter,
                status: statusFilter,
                patientQuery: patientSearch,
                page,
              })
            }
            disabled={loading}
            aria-busy={loading}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh reports"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Dedicated Analytical Filter Bar */}
      <div className="bg-white dark:bg-gray-800/95 p-4 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs space-y-3.5">
        {/* Top Row: Segmented Range Presets + Date Window (aligned to Row 2 columns & height) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-center">
          <div
            role="group"
            aria-label="Quick date range"
            className="w-full h-10 grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700/80"
          >
            {PRESET_OPTIONS.map((opt) => {
              const active = presetDays === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  disabled={loading}
                  onClick={() => handlePresetChange(opt.id)}
                  className={`h-full px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center disabled:opacity-60 ${
                    active
                      ? 'bg-white dark:bg-gray-800 text-[#0F766E] dark:text-teal-300 shadow-2xs ring-1 ring-slate-200/80 dark:ring-gray-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="hidden xl:block xl:col-span-2" aria-hidden="true" />

          <div className="w-full h-10 flex items-center gap-2">
            <label className="sr-only" htmlFor="report-start-date">
              Start date
            </label>
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPresetDays('custom');
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-0 h-10 px-2.5 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-400 shrink-0">to</span>
            <label className="sr-only" htmlFor="report-end-date">
              End date
            </label>
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setPresetDays('custom');
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-0 h-10 px-2.5 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer"
            />
          </div>
        </div>

        {/* Bottom Row: Dimension Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Dentist Filter */}
          <div className="relative">
            <label className="sr-only" htmlFor="report-dentist-filter">
              Filter report by dentist
            </label>
            <Stethoscope
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="report-dentist-filter"
              value={dentistFilter}
              onChange={(e) => {
                setDentistFilter(e.target.value);
                setPage(1);
              }}
              disabled={loading}
              className="w-full h-10 appearance-none pl-9 pr-8 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer disabled:opacity-60"
            >
              <option value="">All Dentists</option>
              {(dentistData?.dentists || []).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.first_name} {doc.last_name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Service Filter */}
          <div className="relative">
            <label className="sr-only" htmlFor="report-service-filter">
              Filter report by service
            </label>
            <Sparkles
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="report-service-filter"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              disabled={loading}
              className="w-full h-10 appearance-none pl-9 pr-8 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer disabled:opacity-60"
            >
              <option value="">All Services</option>
              {(serviceData?.services || []).map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <label className="sr-only" htmlFor="report-status-filter">
              Filter report by status
            </label>
            <Filter
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="report-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              disabled={loading}
              className="w-full h-10 appearance-none pl-9 pr-8 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] cursor-pointer disabled:opacity-60"
            >
              <option value="">All Statuses</option>
              {STATUS_META.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Patient Search */}
          <div className="relative">
            <label className="sr-only" htmlFor="report-patient-filter">
              Filter report by patient
            </label>
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="report-patient-filter"
              type="text"
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Patient name or ID..."
              className="w-full h-10 pl-9 pr-8 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488]"
            />
            {patientSearch && (
              <button
                type="button"
                onClick={() => {
                  setPatientSearch('');
                  setDebouncedPatientSearch('');
                  setPage(1);
                }}
                aria-label="Clear patient search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Dimension Filter Chips */}
        {hasFilters && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Active Filters:
            </span>
            {dentistFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30 font-semibold">
                {activeDentistName}
                <button
                  type="button"
                  onClick={() => {
                    setDentistFilter('');
                    setPage(1);
                  }}
                  aria-label="Remove dentist filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {serviceFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/30 font-semibold">
                {activeServiceName}
                <button
                  type="button"
                  onClick={() => {
                    setServiceFilter('');
                    setPage(1);
                  }}
                  aria-label="Remove service filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 font-semibold">
                Status: {activeStatusLabel}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('');
                    setPage(1);
                  }}
                  aria-label="Remove status filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {patientSearch.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-500/30 font-semibold">
                Patient: “{patientSearch.trim()}”
                <button
                  type="button"
                  onClick={() => {
                    setPatientSearch('');
                    setDebouncedPatientSearch('');
                    setPage(1);
                  }}
                  aria-label="Remove patient filter"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {validationError && (
        <div
          role="alert"
          className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="p-8 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-3"
        >
          <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => fetchReports(startDate, endDate)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            Retry Report
          </button>
        </div>
      ) : (
        <>
          {/* Modern Operational KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Bookings */}
            <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Bookings
                </span>
                <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {totalAppointments}
              </div>
              <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-gray-700/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{apptData?.upcoming_count || 0} upcoming in window</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                  {avgDailyCount}/day
                </span>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Completion Rate
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {apptData?.completion_rate || 0}%
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, Number(apptData?.completion_rate || 0))}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block tabular-nums">
                  {apptData?.completed_count || 0} completed appointments
                </span>
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cancellation Rate
                </span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200/70 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {apptData?.cancellation_rate || 0}%
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all"
                    style={{ width: `${Math.min(100, Number(apptData?.cancellation_rate || 0))}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block tabular-nums">
                  {apptData?.cancelled_count || 0} cancelled appointments
                </span>
              </div>
            </div>

            {/* Registered Patients */}
            <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Registered Patients
                </span>
                <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300">
                  <Users className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-[#0D9488] dark:text-teal-400 tabular-nums">
                {totalPatients}
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0D9488] dark:bg-teal-400 transition-all"
                    style={{ width: `${activePatientPct}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block tabular-nums">
                  +{patientData?.new_in_period || 0} new in selected range
                </span>
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts (Status Distribution & Fixed Interactive Daily Volume) */}
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${
              !minimizedCards.status && !minimizedCards.volume ? 'items-stretch' : 'items-start'
            }`}
          >
            {/* Appointment Status Distribution */}
            <CollapsibleReportCard
              cardKey="status"
              title="Appointments by Status"
              icon={BarChart3}
              summaryBadge={`${totalAppointments} total`}
              isMinimized={Boolean(minimizedCards.status)}
              onToggleMinimize={toggleCardMinimize}
              className={!minimizedCards.status && !minimizedCards.volume ? 'h-full' : ''}
              bodyClassName="flex flex-col justify-between"
            >
              {totalAppointments === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 py-8 text-center">
                  No appointments recorded in the selected date range.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Stacked Proportion Overview Bar */}
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden flex gap-0.5 p-0.5">
                      {STATUS_META.map(({ key, label, barClass }) => {
                        const count = Number(statusDistribution[key] || 0);
                        if (count === 0) return null;
                        const pct = (count / totalAppointments) * 100;
                        return (
                          <div
                            key={`seg-${key}`}
                            className={`h-full first:rounded-l-full last:rounded-r-full ${barClass} transition-all`}
                            style={{ width: `${pct}%` }}
                            title={`${label}: ${count} (${Math.round(pct)}%)`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Click any status row below to filter the operational report.
                    </p>
                  </div>

                  {/* Interactive Status Breakdown Rows */}
                  <div className="space-y-2">
                    {STATUS_META.map(({ key, label, barClass, dotClass }) => {
                      const count = Number(statusDistribution[key] || 0);
                      const pct = totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0;
                      const isSelected = statusFilter === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setStatusFilter((prev) => (prev === key ? '' : key));
                            setPage(1);
                          }}
                          className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-teal-50/70 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500/60'
                              : 'bg-slate-50/50 dark:bg-gray-900/40 border-transparent hover:border-slate-200 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-gray-200">
                              <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden="true" />
                              <span>{label}</span>
                            </span>
                            <span className="font-mono text-slate-600 dark:text-gray-300 tabular-nums">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200/70 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barClass} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CollapsibleReportCard>

            {/* Daily Appointment Volume (Fixed Bar Heights + Interactive Day Inspector) */}
            <CollapsibleReportCard
              cardKey="volume"
              title="Daily Appointment Volume"
              icon={TrendingUp}
              summaryBadge={
                dailySeries.length > 0
                  ? `${dailySeries.length} active ${dailySeries.length === 1 ? 'day' : 'days'}`
                  : '0 days'
              }
              isMinimized={Boolean(minimizedCards.volume)}
              onToggleMinimize={toggleCardMinimize}
              className={!minimizedCards.status && !minimizedCards.volume ? 'h-full' : ''}
              bodyClassName="flex flex-col"
            >
              {dailySeries.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 py-8 text-center my-auto">
                  No daily appointment activity in the selected period.
                </p>
              ) : (
                <div className="flex-1 flex flex-col justify-between gap-4">
                  {/* Active / Peak Day Insight Banner */}
                  {activeVolumeDay && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30">
                          {selectedVolumeDate ? 'Selected Day' : 'Peak Day'}
                        </span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                          {activeVolumeDay.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                        <span className="font-bold text-slate-800 dark:text-white">
                          {activeVolumeDay.count} {activeVolumeDay.count === 1 ? 'booking' : 'bookings'}
                        </span>
                        {activeVolumeDay.completed > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            · {activeVolumeDay.completed} completed
                          </span>
                        )}
                        {activeVolumeDay.pending > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            · {activeVolumeDay.pending} pending
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Column Chart with Explicit Pixel Heights */}
                  <div className="flex-1 flex flex-col justify-end pt-2">
                    <div
                      className="flex items-end gap-2 h-56 px-1 pb-1 overflow-x-auto border-b border-slate-200/80 dark:border-gray-700/80"
                      role="img"
                      aria-label="Daily appointment volume chart"
                    >
                      {dailySeries.map((d) => {
                        const barPx = Math.max(16, Math.round((d.count / maxDailyCount) * 164));
                        const completedPx =
                          d.count > 0 && d.completed > 0
                            ? Math.max(4, Math.round((d.completed / d.count) * barPx))
                            : 0;
                        const isSelected = activeVolumeDay?.date === d.date;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() =>
                              setSelectedVolumeDate((prev) => (prev === d.date ? null : d.date))
                            }
                            title={`${d.date}: ${d.count} appointment(s) (${d.completed} completed)`}
                            className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-1.5 group cursor-pointer focus:outline-none"
                          >
                            <span
                              className={`text-[10px] font-mono font-bold tabular-nums transition-colors ${
                                isSelected
                                  ? 'text-[#0F766E] dark:text-teal-300'
                                  : 'text-slate-500 dark:text-slate-400 group-hover:text-teal-500'
                              }`}
                            >
                              {d.count}
                            </span>
                            <div
                              className={`w-full max-w-[32px] rounded-t-lg relative overflow-hidden transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-t from-teal-600 to-teal-400 ring-2 ring-teal-400/50'
                                  : 'bg-gradient-to-t from-teal-700/80 to-teal-500/80 dark:from-teal-500/75 dark:to-teal-400/80 group-hover:from-teal-600 group-hover:to-teal-400'
                              }`}
                              style={{ height: `${barPx}px` }}
                            >
                              {completedPx > 0 && (
                                <div
                                  className="absolute bottom-0 inset-x-0 bg-emerald-400/90 dark:bg-emerald-300/85"
                                  style={{ height: `${completedPx}px` }}
                                />
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isSelected
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {d.date.slice(5)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" aria-hidden="true" />
                          Total volume
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" aria-hidden="true" />
                          Completed share
                        </span>
                      </div>
                      <span className="tabular-nums">Avg {avgDailyCount} bookings / active day</span>
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleReportCard>
          </div>

          {/* Service Utilization Breakdown */}
          <CollapsibleReportCard
            cardKey="services"
            title="Dental Service Utilization"
            icon={Sparkles}
            summaryBadge={`${serviceData?.services?.length || 0} catalog service(s)`}
            isMinimized={Boolean(minimizedCards.services)}
            onToggleMinimize={toggleCardMinimize}
            noBodyPadding
          >
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr
                    role="row"
                    className="bg-slate-50 dark:bg-gray-900/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-gray-700"
                  >
                    <th role="columnheader" className="py-3 px-5">
                      Service Name
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Category
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Booked
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Upcoming
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Completed
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Cancelled
                    </th>
                    <th role="columnheader" className="py-3 px-5 text-right">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/75">
                  {!serviceData?.services || serviceData.services.length === 0 ? (
                    <tr role="row">
                      <td role="cell" colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                        No service utilization records available for this period.
                      </td>
                    </tr>
                  ) : (
                    serviceData.services.map((svc) => {
                      const isActive = String(serviceFilter) === String(svc.id);
                      return (
                        <tr
                          role="row"
                          key={svc.id}
                          onClick={() => {
                            setServiceFilter((prev) => (String(prev) === String(svc.id) ? '' : String(svc.id)));
                            setPage(1);
                          }}
                          title="Click to filter appointment report by this service"
                          className={`transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-teal-50/70 dark:bg-teal-500/10'
                              : 'hover:bg-slate-50/70 dark:hover:bg-gray-700/35'
                          }`}
                        >
                          <td role="cell" data-label="Service Name" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">
                            <span className="inline-flex items-center gap-2">
                              <span>{svc.name}</span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-500/20 text-[#0F766E] dark:text-teal-300">
                                  Filtered
                                </span>
                              )}
                            </span>
                          </td>
                          <td role="cell" data-label="Category" className="py-3 px-4 text-xs">
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700 text-slate-600 dark:text-slate-300 font-medium">
                              {svc.category}
                            </span>
                          </td>
                          <td role="cell" data-label="Booked" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200 tabular-nums">
                            {svc.total_booked}
                          </td>
                          <td role="cell" data-label="Upcoming" className="py-3 px-4 text-right font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                            {svc.upcoming_count}
                          </td>
                          <td role="cell" data-label="Completed" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {svc.completed_count}
                          </td>
                          <td role="cell" data-label="Cancelled" className="py-3 px-4 text-right font-semibold text-slate-500 dark:text-gray-400 tabular-nums">
                            {svc.cancelled_count}
                          </td>
                          <td role="cell" data-label="Share" className="py-3 px-5 text-right">
                            <div className="inline-flex items-center justify-end gap-2.5 min-w-[110px]">
                              <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#0D9488] dark:bg-teal-400"
                                  style={{ width: `${Math.min(100, Number(svc.utilization_share_pct || 0))}%` }}
                                />
                              </div>
                              <span className="font-mono font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                                {svc.utilization_share_pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleReportCard>

          {/* Dentist Clinical Workload */}
          <CollapsibleReportCard
            cardKey="dentists"
            title="Dentist Workload Breakdown"
            icon={Stethoscope}
            summaryBadge={`${dentistData?.dentists?.length || 0} provider(s)`}
            isMinimized={Boolean(minimizedCards.dentists)}
            onToggleMinimize={toggleCardMinimize}
            noBodyPadding
          >
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr
                    role="row"
                    className="bg-slate-50 dark:bg-gray-900/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-gray-700"
                  >
                    <th role="columnheader" className="py-3 px-5">
                      Dentist
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Specialization
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Assigned
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Upcoming
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Completed
                    </th>
                    <th role="columnheader" className="py-3 px-4 text-right">
                      Cancelled
                    </th>
                    <th role="columnheader" className="py-3 px-5 text-right">
                      Completion
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/75">
                  {!dentistData?.dentists || dentistData.dentists.length === 0 ? (
                    <tr role="row">
                      <td role="cell" colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                        No dentist workload data available for this period.
                      </td>
                    </tr>
                  ) : (
                    dentistData.dentists.map((doc) => {
                      const isActive = String(dentistFilter) === String(doc.id);
                      const docCompPct =
                        doc.total_assigned > 0
                          ? Math.round((Number(doc.completed_count || 0) / Number(doc.total_assigned)) * 100)
                          : 0;
                      return (
                        <tr
                          role="row"
                          key={doc.id}
                          onClick={() => {
                            setDentistFilter((prev) => (String(prev) === String(doc.id) ? '' : String(doc.id)));
                            setPage(1);
                          }}
                          title="Click to filter appointment report by this dentist"
                          className={`transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-teal-50/70 dark:bg-teal-500/10'
                              : 'hover:bg-slate-50/70 dark:hover:bg-gray-700/35'
                          }`}
                        >
                          <td role="cell" data-label="Dentist" className="py-3 px-5 font-semibold text-slate-900 dark:text-gray-100">
                            <span className="inline-flex items-center gap-2">
                              <span>
                                Dr. {doc.first_name} {doc.last_name}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-500/20 text-[#0F766E] dark:text-teal-300">
                                  Filtered
                                </span>
                              )}
                            </span>
                          </td>
                          <td role="cell" data-label="Specialization" className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">
                            {doc.specialization}
                          </td>
                          <td role="cell" data-label="Assigned" className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-gray-200 tabular-nums">
                            {doc.total_assigned}
                          </td>
                          <td role="cell" data-label="Upcoming" className="py-3 px-4 text-right font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                            {doc.upcoming_count ?? 0}
                          </td>
                          <td role="cell" data-label="Completed" className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {doc.completed_count}
                          </td>
                          <td role="cell" data-label="Cancelled" className="py-3 px-4 text-right font-semibold text-slate-500 dark:text-gray-400 tabular-nums">
                            {doc.cancelled_count}
                          </td>
                          <td role="cell" data-label="Completion" className="py-3 px-5 text-right">
                            <div className="inline-flex items-center justify-end gap-2 min-w-[96px]">
                              <div className="hidden sm:block w-14 h-1.5 rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                                  style={{ width: `${docCompPct}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {docCompPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleReportCard>

          {/* Filtered Appointment Report List */}
          <CollapsibleReportCard
            cardKey="appointments"
            title="Filtered Appointment Report List"
            icon={FileText}
            summaryBadge={`${totalAppointments} matching`}
            headerRight={
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 tabular-nums">
                <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>
                  {startDate} to {endDate}
                </span>
              </span>
            }
            isMinimized={Boolean(minimizedCards.appointments)}
            onToggleMinimize={toggleCardMinimize}
            noBodyPadding
          >
            <div className="overflow-x-auto">
              <table role="table" className="tch-responsive-table w-full text-left border-collapse text-sm">
                <thead role="rowgroup">
                  <tr
                    role="row"
                    className="bg-slate-50 dark:bg-gray-900/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-gray-700"
                  >
                    <th role="columnheader" className="py-3 px-5">
                      Ref #
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Date &amp; Time
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Patient
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Dentist
                    </th>
                    <th role="columnheader" className="py-3 px-4">
                      Service
                    </th>
                    <th role="columnheader" className="py-3 px-5 text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/75">
                  {!apptData?.appointments || apptData.appointments.length === 0 ? (
                    <tr role="row">
                      <td role="cell" colSpan={6} className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                        No appointments match the selected date, dentist, service, and status filters.
                      </td>
                    </tr>
                  ) : (
                    apptData.appointments.map((appt) => {
                      const statusObj = STATUS_META.find((s) => s.key === appt.status) || STATUS_META[0];
                      return (
                        <tr
                          role="row"
                          key={appt.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-gray-700/35 transition-colors"
                        >
                          <td role="cell" data-label="Ref #" className="py-3 px-5 font-mono text-xs font-semibold text-slate-600 dark:text-gray-300">
                            #{appt.id}
                          </td>
                          <td role="cell" data-label="Date & Time" className="py-3 px-4 text-xs text-slate-700 dark:text-gray-200 font-mono tabular-nums whitespace-nowrap">
                            {appt.start_at ? String(appt.start_at).slice(0, 16) : 'N/A'}
                          </td>
                          <td role="cell" data-label="Patient" className="py-3 px-4 font-semibold text-slate-900 dark:text-gray-100">
                            {`${appt.patient_first_name || ''} ${appt.patient_last_name || ''}`.trim() ||
                              `Patient #${appt.patient_id}`}
                          </td>
                          <td role="cell" data-label="Dentist" className="py-3 px-4 text-xs text-slate-700 dark:text-gray-200">
                            {appt.dentist_last_name
                              ? `Dr. ${appt.dentist_first_name || ''} ${appt.dentist_last_name}`.trim()
                              : `Dentist #${appt.dentist_id}`}
                          </td>
                          <td role="cell" data-label="Service" className="py-3 px-4 text-xs text-slate-700 dark:text-gray-200">
                            {appt.service_name || `Service #${appt.service_id}`}
                          </td>
                          <td role="cell" data-label="Status" className="py-3 px-5 text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusObj.badgeClass}`}
                            >
                              {statusObj.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {apptData?.appointments_meta?.last_page > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50/40 dark:bg-gray-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                <span className="tabular-nums">
                  Page {apptData.appointments_meta.page} of {apptData.appointments_meta.last_page} (
                  {apptData.appointments_meta.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={apptData.appointments_meta.page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 cursor-pointer"
                    aria-label="Previous report page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={apptData.appointments_meta.page >= apptData.appointments_meta.last_page || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 cursor-pointer"
                    aria-label="Next report page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </CollapsibleReportCard>

          {/* Patient Directory & Registration Trend */}
          <CollapsibleReportCard
            cardKey="patients"
            title="Patient Directory & Registration Trend"
            icon={Users}
            summaryBadge={`+${patientData?.new_in_period || 0} new`}
            isMinimized={Boolean(minimizedCards.patients)}
            onToggleMinimize={toggleCardMinimize}
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white tabular-nums">{activePatients}</strong> active and{' '}
                    <strong className="text-slate-900 dark:text-white tabular-nums">
                      {patientData?.inactive_patients || 0}
                    </strong>{' '}
                    inactive registered patients total ({activePatientPct}% active).
                  </p>
                  <div className="h-2 w-full sm:w-64 rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0D9488] dark:bg-teal-400 transition-all"
                      style={{ width: `${activePatientPct}%` }}
                    />
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700/80 text-xs">
                  <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-slate-700 dark:text-gray-200 tabular-nums">
                    {patientData?.new_in_period || 0} new registration(s) from {startDate} to {endDate}
                  </span>
                </div>
              </div>

              {registrationTimeline.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-gray-700/70">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                    Daily New Registrations
                  </span>
                  <div className="flex items-end gap-2 h-24 overflow-x-auto px-1">
                    {registrationTimeline.map((item) => {
                      const regCount = Number(item.registrations || 0);
                      const barPx = Math.max(10, Math.round((regCount / maxRegCount) * 56));
                      return (
                        <div
                          key={item.date}
                          className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-1"
                          title={`${item.date}: ${regCount} new registration(s)`}
                        >
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            {regCount}
                          </span>
                          <div
                            className="w-full max-w-[28px] rounded-t-md bg-sky-500/85 dark:bg-sky-400/85"
                            style={{ height: `${barPx}px` }}
                          />
                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                            {String(item.date).slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleReportCard>
        </>
      )}
    </div>
  );
}
