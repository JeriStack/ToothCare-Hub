import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Archive,
  Search,
  RefreshCw,
  Download,
  Eye,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Calendar,
  FileText,
  Users,
  Stethoscope,
  Sparkles,
  User,
  Fingerprint,
  History,
  Shield,
} from 'lucide-react';
import { archivesApi } from '../api';
import { RecordHistoryModal } from '../../history/components/RecordHistoryModal';
import { useOptionalAuth } from '../../auth/context/AuthContext';
import { TableSkeleton } from '../../../components/skeletons/TableSkeleton';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';
import { SortableColumnHeader, ServerTableFooter } from '../../../components/ui/ServerTableControls';

const ENTITY_META = {
  appointment: {
    label: 'Appointments',
    singular: 'Appointment',
    icon: Calendar,
    pill: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30',
  },
  treatment_record: {
    label: 'Clinical Charts',
    singular: 'Clinical Chart',
    icon: FileText,
    pill: 'bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border-teal-200/80 dark:border-teal-500/30',
  },
  patient: {
    label: 'Patients',
    singular: 'Patient',
    icon: User,
    pill: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30',
  },
  dentist: {
    label: 'Dentists',
    singular: 'Dentist',
    icon: Stethoscope,
    pill: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
  },
  service: {
    label: 'Services',
    singular: 'Service',
    icon: Sparkles,
    pill: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
  },
  user: {
    label: 'User Accounts',
    singular: 'User Account',
    icon: Users,
    pill: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-500/30',
  },
};

const STATUS_BADGE = {
  ARCHIVED: {
    label: 'Archived',
    pill: 'bg-slate-100 dark:bg-gray-700/80 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-gray-600',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  LOCKED_RETENTION: {
    label: 'Locked Retention',
    pill: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30',
    dot: 'bg-indigo-500 dark:bg-indigo-400',
  },
  RESTORED: {
    label: 'Restored',
    pill: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
};

const RETENTION_LABELS = {
  CLINICAL_7Y: 'Clinical · 7 Years',
  OPERATIONAL_3Y: 'Operational · 3 Years',
  ACCOUNT_5Y: 'Account · 5 Years',
  CATALOG_LEGACY: 'Legacy Catalog · 3 Years',
};

const ROLE_COPY = {
  ADMIN: {
    title: 'Compliance Archive Vault',
    subtitle: 'Centralized retention vault covering appointments, 24h-locked clinical charts, inactive patients, retired dentists, discontinued services, and offboarded accounts.',
  },
  RECEPTIONIST: {
    title: 'Front-Desk Operational Archive',
    subtitle: 'Audit resolved appointments, archived patient profiles, and legacy catalog services without cluttering active clinic queues.',
  },
  DENTIST: {
    title: 'Clinical & Treatment Archive',
    subtitle: 'Review your compliance-locked clinical charts and archived assigned patient appointments with SHA-256 integrity verification.',
  },
  PATIENT: {
    title: 'My Visit & Clinical Archive',
    subtitle: 'Read-only personal archive of your completed or past dental visits and compliance-preserved clinical summaries.',
  },
};

function formatSnapshotValue(val) {
  if (val === undefined || val === null || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ') || '(none)';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function ArchiveCenterPage() {
  const auth = useOptionalAuth();
  const role = String(auth?.user?.role || 'ADMIN').toUpperCase();
  const roleCopy = ROLE_COPY[role] || ROLE_COPY.ADMIN;

  // Table & Summary State
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
    sorting: { sort_by: 'archived_at', sort_dir: 'desc' },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Filters, Sorting & Pagination
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [accountType, setAccountType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retentionFilter, setRetentionFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [includeExamples, setIncludeExamples] = useState(true);
  const [sortBy, setSortBy] = useState('archived_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [inspectRecord, setInspectRecord] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [snapshotPage, setSnapshotPage] = useState(1);
  const [cycleHistoryModal, setCycleHistoryModal] = useState(null);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [timelineTarget, setTimelineTarget] = useState(null);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveForm, setArchiveForm] = useState({
    entity_type: 'appointment',
    entity_id: '',
    retention_category: '',
    reason: '',
  });
  const [archiving, setArchiving] = useState(false);
  const [archiveFormError, setArchiveFormError] = useState(null);
  const [eligibilityInfo, setEligibilityInfo] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  const requestSeqRef = useRef(0);
  const inspectSeqRef = useRef(0);
  const toastTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Debounce text search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load role-scoped summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await archivesApi.getSummary();
      setSummary(data);
      if (Array.isArray(data?.creatable_entity_types) && data.creatable_entity_types.length > 0) {
        setArchiveForm((prev) => ({
          ...prev,
          entity_type: data.creatable_entity_types.includes(prev.entity_type)
            ? prev.entity_type
            : data.creatable_entity_types[0],
        }));
      }
    } catch {
      // Keep graceful defaults if summary endpoint is temporarily unavailable
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  // Server-side paginated listing with AbortController + sequence guard
  const fetchArchives = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    const params = {
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_dir: sortDir,
      include_examples: includeExamples ? 'true' : 'false',
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (entityType) params.entity_type = entityType;
    if (accountType) params.account_type = accountType;
    if (statusFilter) params.status = statusFilter;
    if (retentionFilter) params.retention_category = retentionFilter;
    if (selectedDate) {
      params.date_from = selectedDate;
      params.date_to = selectedDate;
    }

    archivesApi
      .list(params, { signal: controller.signal })
      .then((res) => {
        if (seq !== requestSeqRef.current || controller.signal.aborted) return;
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
        if (seq !== requestSeqRef.current || controller.signal.aborted || err?.name === 'AbortError' || err?.isCancelled) {
          return;
        }
        setRecords([]);
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to load archived records.');
      })
      .finally(() => {
        if (seq === requestSeqRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, [page, perPage, sortBy, sortDir, debouncedSearch, entityType, accountType, statusFilter, retentionFilter, selectedDate, includeExamples, refreshKey]);

  useEffect(() => {
    fetchArchives();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchArchives]);

  const handleSort = useCallback((columnKey) => {
    setSortBy((prevCol) => {
      if (prevCol === columnKey) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevCol;
      }
      setSortDir('asc');
      return columnKey;
    });
    setPage(1);
  }, []);

  const handleInspect = async (row) => {
    const seq = ++inspectSeqRef.current;
    setInspectRecord({ ...row, integrity_verified: undefined });
    setSnapshotPage(1);
    setLoadingDetail(true);
    try {
      const full = await archivesApi.getDetail(row.id);
      if (seq !== inspectSeqRef.current) return;
      if (full) setInspectRecord(full);
    } catch (err) {
      if (seq !== inspectSeqRef.current) return;
      showToast(err?.response?.data?.error?.message || 'Unable to load archive snapshot.', 'error');
    } finally {
      if (seq === inspectSeqRef.current) {
        setLoadingDetail(false);
      }
    }
  };

  const handleOpenCycleHistory = async (row) => {
    setCycleHistoryModal({ record: row, cycles: [] });
    setLoadingCycles(true);
    try {
      const res = await archivesApi.getCycleHistory(row.id);
      setCycleHistoryModal({ record: row, ...(res || { cycles: [] }) });
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Unable to load archive cycle history.', 'error');
    } finally {
      setLoadingCycles(false);
    }
  };

  const handleCheckEligibility = async () => {
    const idNum = Number(archiveForm.entity_id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      setArchiveFormError('Enter a valid positive numeric Record ID first to check eligibility.');
      return;
    }
    setArchiveFormError(null);
    setCheckingEligibility(true);
    try {
      const res = await archivesApi.checkEligibility(archiveForm.entity_type, idNum);
      setEligibilityInfo(res);
    } catch (err) {
      setEligibilityInfo(null);
      setArchiveFormError(err?.response?.data?.error?.message || 'Unable to validate archival eligibility.');
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleCreateArchive = async (e) => {
    e.preventDefault();
    setArchiveFormError(null);
    const idNum = Number(archiveForm.entity_id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      setArchiveFormError('Please enter a valid positive numeric Record ID.');
      return;
    }
    if (archiveForm.reason.trim().length < 5) {
      setArchiveFormError('Please enter an audit reason (at least 5 characters).');
      return;
    }

    setArchiving(true);
    try {
      const payload = {
        entity_type: archiveForm.entity_type,
        entity_id: idNum,
        reason: archiveForm.reason.trim(),
      };
      if (archiveForm.retention_category) {
        payload.retention_category = archiveForm.retention_category;
      }
      const created = await archivesApi.archiveEntity(payload);
      setShowArchiveModal(false);
      setEligibilityInfo(null);
      setArchiveForm((prev) => ({ ...prev, entity_id: '', reason: '', retention_category: '' }));
      showToast(`Archived successfully under ${created?.reference_code || 'archive vault'}.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const apiErr = err?.response?.data?.error;
      if (apiErr?.details?.blocking_appointments) {
        setEligibilityInfo({
          eligible: false,
          blockers: [{ code: apiErr.code || 'UNRESOLVED_APPOINTMENTS_EXIST', message: apiErr.message }],
          blocking_appointments: apiErr.details.blocking_appointments,
          consequences: [],
        });
      }
      setArchiveFormError(
        apiErr?.message || err?.message || 'Failed to archive record.'
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreTarget) return;
    if (restoreReason.trim().length < 5) {
      setRestoreError('Please provide an audit reason for restoration (at least 5 characters).');
      return;
    }
    setRestoring(true);
    setRestoreError(null);
    try {
      await archivesApi.restore(restoreTarget.id, restoreReason.trim());
      showToast(`${restoreTarget.reference_code} has been restored to active operations.`);
      setRestoreTarget(null);
      setRestoreReason('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setRestoreError(err?.response?.data?.error?.message || err?.message || 'Unable to restore archive record.');
    } finally {
      setRestoring(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = { include_examples: includeExamples ? 'true' : 'false' };
      if (debouncedSearch) params.search = debouncedSearch;
      if (entityType) params.entity_type = entityType;
      if (statusFilter) params.status = statusFilter;
      if (retentionFilter) params.retention_category = retentionFilter;
      if (selectedDate) {
        params.date_from = selectedDate;
        params.date_to = selectedDate;
      }
      await archivesApi.exportCsv(params);
      showToast('Archive audit CSV downloaded.');
    } catch (err) {
      showToast(err?.message || 'CSV export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setEntityType('');
    setAccountType('');
    setStatusFilter('');
    setRetentionFilter('');
    setSelectedDate('');
    setIncludeExamples(true);
    setPage(1);
  };

  const allowedTypes = summary?.allowed_entity_types || ['appointment', 'treatment_record'];
  const creatableTypes = summary?.creatable_entity_types || [];
  const canArchive = Boolean(summary?.capabilities?.can_archive);
  const canExport = Boolean(summary?.capabilities?.can_export);
  const hasActiveFilters = Boolean(searchInput || entityType || accountType || statusFilter || retentionFilter || selectedDate || !includeExamples);

  return (
    <div className="space-y-5">
      {/* Toast Banner */}
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
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
              <Archive className="w-4 h-4" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              {roleCopy.title}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-gray-700">
              <ShieldCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              SHA-256 Verified
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {roleCopy.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canArchive && (
            <button
              type="button"
              onClick={() => {
                setArchiveFormError(null);
                setShowArchiveModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Archive Record</span>
            </button>
          )}
          {canExport && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            aria-label="Refresh archive list"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Row */}
      {role === 'ADMIN' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Archived
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
              {summary?.total_records ?? meta.total_records ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {summary?.locked_retention ?? 0} clinical locked
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEntityType('');
              setAccountType(accountType === 'PATIENT' ? '' : 'PATIENT');
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-colors cursor-pointer ${
              accountType === 'PATIENT'
                ? 'bg-indigo-50/70 dark:bg-indigo-500/15 border-indigo-400'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-indigo-400/70'
            }`}
          >
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Archived Patients
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
              {summary?.by_account_type?.PATIENT ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Patient Archives
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntityType('');
              setAccountType(accountType === 'DENTIST' ? '' : 'DENTIST');
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-colors cursor-pointer ${
              accountType === 'DENTIST'
                ? 'bg-emerald-50/70 dark:bg-emerald-500/15 border-emerald-400'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-emerald-400/70'
            }`}
          >
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Archived Dentists
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {summary?.by_account_type?.DENTIST ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Dentist Archives
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntityType('');
              setAccountType(accountType === 'RECEPTIONIST' ? '' : 'RECEPTIONIST');
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-colors cursor-pointer ${
              accountType === 'RECEPTIONIST'
                ? 'bg-sky-50/70 dark:bg-sky-500/15 border-sky-400'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-sky-400/70'
            }`}
          >
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Receptionists
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-sky-700 dark:text-sky-300">
              {summary?.by_account_type?.RECEPTIONIST ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Receptionist Archives
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntityType('');
              setAccountType(accountType === 'ADMIN' ? '' : 'ADMIN');
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-colors cursor-pointer ${
              accountType === 'ADMIN'
                ? 'bg-purple-50/70 dark:bg-purple-500/15 border-purple-400'
                : 'bg-white dark:bg-gray-800/95 border-slate-200/90 dark:border-gray-700/80 hover:border-purple-400/70'
            }`}
          >
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <Shield className="w-3 h-3" aria-hidden="true" />
              Administrators
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-purple-700 dark:text-purple-300">
              {summary?.by_account_type?.ADMIN ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Admin Archives
            </div>
          </button>

          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-teal-200/70 dark:border-teal-500/25 p-4 shadow-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-300">
              Restored
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#0F766E] dark:text-teal-300">
              {summary?.restored_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Returned to active use
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Archived
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
              {summary?.total_records ?? meta.total_records ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {summary?.active_archived ?? 0} reversible active
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-indigo-200/70 dark:border-indigo-500/25 p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
              <Lock className="w-3 h-3" aria-hidden="true" />
              Locked Clinical
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
              {summary?.locked_retention ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Immutable 7-year retention
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-emerald-200/70 dark:border-emerald-500/25 p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Restored
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {summary?.restored_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Returned to active clinic use
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Example Records
            </div>
            <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-teal-700 dark:text-teal-300">
              {summary?.example_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Seeded audit templates
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-4 shadow-xs space-y-3">
        {/* Domain Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEntityType('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              entityType === ''
                ? 'bg-[#0D9488] text-white border-[#0D9488]'
                : 'bg-slate-50 dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:border-teal-400'
            }`}
          >
            All Domains
          </button>
          {allowedTypes.map((typeKey) => {
            const info = ENTITY_META[typeKey] || { label: typeKey };
            const active = entityType === typeKey;
            const count = summary?.by_entity_type?.[typeKey];
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => {
                  setEntityType(active ? '' : typeKey);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0D9488] text-white border-[#0D9488]'
                    : 'bg-slate-50 dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:border-teal-400'
                }`}
              >
                <span>{info.label}</span>
                {typeof count === 'number' && (
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-gray-800 text-slate-500 dark:text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          <div className="relative lg:col-span-2">
            <label htmlFor="archive-search-input" className="sr-only">
              Search archive reference, title, or reason
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="archive-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search reference code, title, or reason..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear archive search"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by archive status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          >
            <option value="">All Statuses</option>
            <option value="ARCHIVED">Archived (Reversible)</option>
            <option value="LOCKED_RETENTION">Locked Clinical Retention</option>
            <option value="RESTORED">Restored</option>
          </select>

          <select
            aria-label="Filter by retention policy"
            value={retentionFilter}
            onChange={(e) => {
              setRetentionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          >
            <option value="">All Retention Policies</option>
            <option value="CLINICAL_7Y">Clinical (7 Years)</option>
            <option value="OPERATIONAL_3Y">Operational (3 Years)</option>
            <option value="ACCOUNT_5Y">Account (5 Years)</option>
            <option value="CATALOG_LEGACY">Legacy Catalog (3 Years)</option>
          </select>

          <input
            type="date"
            aria-label="Filter by archive date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeExamples}
              onChange={(e) => {
                setIncludeExamples(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
            />
            <span>Show seeded example audit records</span>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[#0D9488] dark:text-teal-400 font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchArchives}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Archive Data Table */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
            <thead role="rowgroup">
              <tr role="row" className="bg-slate-50/75 dark:bg-gray-900/45 border-b border-slate-100 dark:border-gray-700/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <SortableColumnHeader
                  columnKey="reference_code"
                  label="Reference"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                  className="pl-5 pr-4"
                />
                <SortableColumnHeader
                  columnKey="entity_type"
                  label="Domain"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableColumnHeader
                  columnKey="title"
                  label="Archived Record"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableColumnHeader
                  columnKey="retention_until"
                  label="Retention"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableColumnHeader
                  columnKey="archived_at"
                  label="Archived At"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableColumnHeader
                  columnKey="status"
                  label="Status"
                  activeSortBy={sortBy}
                  activeSortDir={sortDir}
                  onSort={handleSort}
                />
                <th role="columnheader" className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700/70">
              {loading ? (
                <TableSkeleton.Rows count={6} columns={7} />
              ) : records.length === 0 ? (
                <tr>
                  <td role="cell" colSpan={7} className="py-12 px-4 text-center">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                      <Archive className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                      No archived records matched your filters.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {hasActiveFilters
                        ? 'Try clearing active filters or enabling example audit records.'
                        : 'Archived records will appear here with tamper-evident snapshots.'}
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((row) => {
                  const entityInfo = ENTITY_META[row.entity_type] || {
                    label: row.entity_type,
                    singular: row.entity_type,
                    pill: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const statusInfo = STATUS_BADGE[row.status] || STATUS_BADGE.ARCHIVED;

                  return (
                    <tr
                      role="row"
                      key={row.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td role="cell" data-label="Reference" className="py-3.5 px-5 font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <div>{row.reference_code}</div>
                        {row.is_example && (
                          <span className="mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-500/30">
                            Example
                          </span>
                        )}
                      </td>

                      <td role="cell" data-label="Domain" className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${entityInfo.pill}`}>
                          {row.account_type ? `${row.account_type.charAt(0) + row.account_type.slice(1).toLowerCase()} Account` : entityInfo.singular}
                        </span>
                      </td>

                      <td role="cell" data-label="Archived Record" className="py-3.5 px-4 max-w-[300px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={row.title}>
                          {row.title}
                        </div>
                        {row.archived_email && (
                          <div className="text-[10.5px] font-mono text-teal-700 dark:text-teal-300 truncate mt-0.5">
                            {row.archived_email}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={row.archive_reason}>
                          {row.archive_reason}
                        </div>
                      </td>

                      <td role="cell" data-label="Retention" className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          {RETENTION_LABELS[row.retention_category] || row.retention_category}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                          Until {row.retention_until || '—'}
                        </div>
                      </td>

                      <td role="cell" data-label="Archived At" className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                          {row.archived_at ? String(row.archived_at).slice(0, 16) : '—'}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          By {row.archived_by_role}
                        </div>
                      </td>

                      <td role="cell" data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusInfo.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} aria-hidden="true" />
                          {statusInfo.label}
                        </span>
                      </td>

                      <td role="cell" data-label="Actions" className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInspect(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-teal-300 font-semibold text-[11px] transition-colors cursor-pointer"
                            aria-label={`Inspect ${row.reference_code}`}
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Inspect</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenCycleHistory(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold text-[11px] transition-colors cursor-pointer"
                            aria-label={`Archive history for ${row.reference_code}`}
                          >
                            <History className="w-3 h-3" aria-hidden="true" />
                            <span>History</span>
                          </button>

                          {row.can_restore && (
                            <button
                              type="button"
                              onClick={() => {
                                setRestoreTarget(row);
                                setRestoreReason('');
                                setRestoreError(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200/80 dark:border-emerald-500/30 font-semibold text-[11px] transition-colors cursor-pointer"
                              aria-label={`Restore ${row.reference_code}`}
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              <span>Restore</span>
                            </button>
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

        {/* Unified Compact Pagination Footer */}
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
          pageSizeOptions={[5, 10, 15, 25, 50]}
          loading={loading}
          itemLabel="archived records"
        />
      </div>

      {/* INSPECT SNAPSHOT MODAL */}
      {inspectRecord && (() => {
        const snapshotEntries = Object.entries(inspectRecord.snapshot || {});
        const snapPerPage = 6;
        const snapTotalPages = Math.max(1, Math.ceil(snapshotEntries.length / snapPerPage));
        const safeSnapPage = Math.min(snapshotPage, snapTotalPages);
        const visibleEntries = snapshotEntries.slice(
          (safeSnapPage - 1) * snapPerPage,
          safeSnapPage * snapPerPage
        );

        return (
          <DialogOverlay
            onClose={() => setInspectRecord(null)}
            className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                    {inspectRecord.reference_code} · {ENTITY_META[inspectRecord.entity_type]?.singular || inspectRecord.entity_type} #{inspectRecord.entity_id}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate mt-0.5">
                    {inspectRecord.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectRecord(null)}
                  aria-label="Close snapshot inspector"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Integrity Digest Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    inspectRecord.integrity_verified === false
                      ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
                      : inspectRecord.integrity_verified === true
                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-gray-900/60 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {inspectRecord.integrity_verified === false ? (
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Fingerprint className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-bold">
                      {inspectRecord.integrity_verified === false
                        ? 'Integrity Check Warning — Snapshot Digest Mismatch'
                        : inspectRecord.integrity_verified === true
                          ? 'Tamper-Evident SHA-256 Integrity Verified'
                          : 'Verifying SHA-256 Snapshot Digest...'}
                    </div>
                    <div className="font-mono text-[10.5px] opacity-85 break-all">
                      {inspectRecord.snapshot_sha256 || 'Computing...'}
                    </div>
                  </div>
                </div>

                {/* Provenance Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/55 border border-slate-200/80 dark:border-gray-700">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Archived At</div>
                    <div className="font-mono font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {inspectRecord.archived_at}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retention Schedule</div>
                    <div className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {RETENTION_LABELS[inspectRecord.retention_category] || inspectRecord.retention_category} (until {inspectRecord.retention_until || '—'})
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audit Reason</div>
                    <div className="text-slate-700 dark:text-slate-200 mt-0.5">{inspectRecord.archive_reason}</div>
                  </div>
                  {inspectRecord.restored_at && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/80 dark:border-gray-700">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Restored At {inspectRecord.restored_at}
                      </div>
                      <div className="text-slate-700 dark:text-slate-200 mt-0.5">
                        {inspectRecord.restore_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Snapshot Fields Table */}
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Point-in-Time Snapshot Details
                  </div>
                  {loadingDetail && snapshotEntries.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">Loading verified snapshot...</div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                      <table role="table" className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3.5 py-2">Field</th>
                            <th className="px-3.5 py-2">Preserved Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70">
                          {visibleEntries.map(([k, v]) => (
                            <tr key={k} className="bg-white dark:bg-gray-800">
                              <td className="px-3.5 py-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {k}
                              </td>
                              <td className="px-3.5 py-2 text-slate-800 dark:text-slate-100 break-words">
                                {formatSnapshotValue(v)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {snapshotEntries.length > snapPerPage && (
                        <ServerTableFooter
                          page={safeSnapPage}
                          perPage={snapPerPage}
                          totalRecords={snapshotEntries.length}
                          filteredRecords={snapshotEntries.length}
                          totalPages={snapTotalPages}
                          onPageChange={(nextP) => setSnapshotPage(nextP)}
                          itemLabel="fields"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogOverlay>
        );
      })()}

      {/* ARCHIVE LIVE RECORD MODAL */}
      {showArchiveModal && (
        <DialogOverlay
          onClose={() => setShowArchiveModal(false)}
          className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-50">Archive Clinic Record</h3>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                aria-label="Close archive modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateArchive} className="p-5 space-y-4 text-xs">
              {archiveFormError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200">
                  {archiveFormError}
                </div>
              )}

              <div>
                <label htmlFor="archive-entity-type" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Record Domain
                </label>
                <select
                  id="archive-entity-type"
                  value={archiveForm.entity_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setArchiveForm((p) => ({
                      ...p,
                      entity_type: nextType,
                      retention_category: nextType === 'treatment_record' ? 'CLINICAL_7Y' : p.retention_category,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100"
                >
                  {creatableTypes.map((t) => (
                    <option key={t} value={t}>
                      {ENTITY_META[t]?.singular || t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="archive-entity-id" className="block font-semibold text-slate-700 dark:text-slate-200">
                    Record ID
                  </label>
                  <button
                    type="button"
                    onClick={handleCheckEligibility}
                    disabled={checkingEligibility}
                    className="text-[11px] font-semibold text-[#0F766E] dark:text-teal-300 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {checkingEligibility ? 'Checking...' : 'Check Eligibility'}
                  </button>
                </div>
                <input
                  id="archive-entity-id"
                  type="number"
                  min={1}
                  required
                  value={archiveForm.entity_id}
                  onChange={(e) => {
                    setEligibilityInfo(null);
                    setArchiveForm((p) => ({ ...p, entity_id: e.target.value }));
                  }}
                  placeholder="e.g., 1042"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100"
                />
              </div>

              {eligibilityInfo && (
                <div
                  className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
                    eligibilityInfo.eligible
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="font-bold">
                    {eligibilityInfo.eligible ? 'Eligible for Safe Archival' : 'Archival Blocked — Action Required'}
                  </div>
                  {Array.isArray(eligibilityInfo.blockers) && eligibilityInfo.blockers.map((b, i) => (
                    <div key={i}>• {b.message}</div>
                  ))}
                  {Array.isArray(eligibilityInfo.blocking_appointments) && eligibilityInfo.blocking_appointments.length > 0 && (
                    <div className="pt-1 font-mono text-[10.5px]">
                      Blocking appointments: {eligibilityInfo.blocking_appointments.map((a) => `#${a.id} (${a.status} · ${String(a.start_at).slice(0, 16)})`).join(', ')}
                    </div>
                  )}
                  {eligibilityInfo.eligible && Array.isArray(eligibilityInfo.consequences) && eligibilityInfo.consequences.map((c, i) => (
                    <div key={i} className="opacity-90">• {c}</div>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="archive-retention" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Retention Policy {archiveForm.entity_type === 'treatment_record' ? '(Mandatory Clinical Lock)' : '(Optional)'}
                </label>
                <select
                  id="archive-retention"
                  value={archiveForm.entity_type === 'treatment_record' ? 'CLINICAL_7Y' : archiveForm.retention_category}
                  disabled={archiveForm.entity_type === 'treatment_record'}
                  onChange={(e) => setArchiveForm((p) => ({ ...p, retention_category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 disabled:opacity-75"
                >
                  <option value="">Use Default Compliance Schedule</option>
                  <option value="CLINICAL_7Y">Clinical (7 Years)</option>
                  <option value="OPERATIONAL_3Y">Operational (3 Years)</option>
                  <option value="ACCOUNT_5Y">Account (5 Years)</option>
                  <option value="CATALOG_LEGACY">Legacy Catalog (3 Years)</option>
                </select>
                {archiveForm.entity_type === 'treatment_record' && (
                  <p className="mt-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Clinical charts are permanently sealed as Locked Retention (7 years) and cannot be restored.</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="archive-reason" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  id="archive-reason"
                  rows={3}
                  required
                  value={archiveForm.reason}
                  onChange={(e) => setArchiveForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Explain why this record is being archived..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiving}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {archiving ? 'Archiving...' : 'Confirm Archive'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* RESTORE RECORD MODAL (ADMIN ONLY) */}
      {restoreTarget && (
        <DialogOverlay
          onClose={() => setRestoreTarget(null)}
          className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-50">
                Restore {restoreTarget.reference_code}
              </h3>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                aria-label="Close restore modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRestore} className="p-5 space-y-4 text-xs">
              {restoreError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200">
                  {restoreError}
                </div>
              )}
              <p className="text-slate-600 dark:text-slate-300">
                Restoring <strong>{restoreTarget.title}</strong> marks the archive entry as restored, reactivates eligible accounts/services, and appends a forensic <code className="font-mono">RECORD_RESTORED</code> audit entry.
              </p>
              <div>
                <label htmlFor="restore-reason-input" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Mandatory Restore Reason
                </label>
                <textarea
                  id="restore-reason-input"
                  rows={3}
                  required
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Document authorization and reason for restoring..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restoring}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {restoring ? 'Restoring...' : 'Confirm Restore'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
      {/* MULTI-CYCLE ARCHIVE HISTORY MODAL */}
      {cycleHistoryModal && (
        <DialogOverlay
          onClose={() => setCycleHistoryModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-xl max-h-[85dvh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {cycleHistoryModal.record?.reference_code} · Archival & Restoration Cycles
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 truncate">
                  {cycleHistoryModal.record?.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCycleHistoryModal(null)}
                aria-label="Close archive cycle history"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {loadingCycles ? (
                <div className="py-8 text-center text-slate-400">Loading archive cycle ledger...</div>
              ) : (cycleHistoryModal.cycles || []).length === 0 ? (
                <div className="py-8 text-center text-slate-400">No archive cycle events recorded.</div>
              ) : (
                <ol className="space-y-2.5">
                  {cycleHistoryModal.cycles.map((c) => (
                    <li key={c.id} className="p-3 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/45 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {c.event_type} · {c.reference_code}
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-500 dark:text-slate-400">
                          {c.created_at}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        By <strong>{c.actor_name}</strong> ({c.actor_role})
                      </div>
                      <div className="text-slate-700 dark:text-slate-200">{c.reason}</div>
                    </li>
                  ))}
                </ol>
              )}

              {['patient', 'dentist', 'user', 'appointment'].includes(String(cycleHistoryModal.record?.entity_type || '')) && !cycleHistoryModal.record?.is_example && (
                <div className="pt-2 border-t border-slate-100 dark:border-gray-700 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const rec = cycleHistoryModal.record;
                      setCycleHistoryModal(null);
                      setTimelineTarget({
                        entityType: rec.entity_type === 'user' ? 'staff' : rec.entity_type,
                        entityId: rec.entity_id,
                        title: `${rec.title} — Full Record History`,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Open Full Account History</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* FULL RECORD LIFECYCLE TIMELINE MODAL */}
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

export default ArchiveCenterPage;
