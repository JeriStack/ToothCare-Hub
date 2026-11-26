import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server,
  Database,
  Cpu,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Settings,
  Save,
  Clock,
  Mail,
  Phone,
  MapPin,
  Activity,
  RotateCcw,
  Radio,
  Building2,
} from 'lucide-react';
import { systemApi } from '../api';
import { broadcastClinicSettingsUpdate } from '../useClinicSettings';
import { SystemHealthSkeleton } from '../../../components/skeletons';
import { EmailDeliveryPanel } from '../components/EmailDeliveryPanel';

const SLOT_DURATION_PRESETS = [15, 30, 45, 60];

function formatUptime(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  const total = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function parseMemoryLimitMb(limitStr) {
  if (!limitStr || String(limitStr).trim() === '-1') return null;
  const match = String(limitStr).trim().match(/^(\d+(?:\.\d+)?)\s*([KMG])?$/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'M').toUpperCase();
  if (unit === 'G') return val * 1024;
  if (unit === 'K') return val / 1024;
  return val;
}

function getLatencyBadge(ms) {
  if (ms == null) return null;
  if (ms <= 15) {
    return {
      label: 'Optimal',
      cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
    };
  }
  if (ms <= 60) {
    return {
      label: 'Normal',
      cls: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30',
    };
  }
  return {
    label: 'Elevated',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
  };
}

export function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [emailRefreshTick, setEmailRefreshTick] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);

  const [settingsForm, setSettingsForm] = useState({
    clinic_name: '',
    clinic_tagline: '',
    clinic_phone: '',
    clinic_email: '',
    clinic_address: '',
    booking_advance_days_max: 60,
    cancellation_cutoff_hours: 24,
    slot_duration_default_minutes: 30,
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const mapSettingsPayload = (sData = {}) => ({
    clinic_name: sData.clinic_name?.value ?? 'ToothCare Hub',
    clinic_tagline: sData.clinic_tagline?.value ?? '',
    clinic_phone: sData.clinic_phone?.value ?? '',
    clinic_email: sData.clinic_email?.value ?? '',
    clinic_address: sData.clinic_address?.value ?? '',
    booking_advance_days_max: Number(sData.booking_advance_days_max?.value ?? 60),
    cancellation_cutoff_hours: Number(sData.cancellation_cutoff_hours?.value ?? 24),
    slot_duration_default_minutes: Number(sData.slot_duration_default_minutes?.value ?? 30),
  });

  const fetchDiagnosticsOnly = useCallback(async () => {
    try {
      const hData = await systemApi.getHealth();
      setHealth(hData);
      setLastCheckedAt(new Date());
      setEmailRefreshTick((n) => n + 1);
    } catch {
      // Silent during background poll
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hData, sData] = await Promise.all([
        systemApi.getHealth(),
        systemApi.getSettings(),
      ]);

      setHealth(hData);
      setLastCheckedAt(new Date());
      setEmailRefreshTick((n) => n + 1);

      const normalized = mapSettingsPayload(sData);
      setSavedSettings(normalized);
      setSettingsForm(normalized);
      setFormErrors({});
    } catch {
      showToast('Failed to retrieve system health diagnostics.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optional 30s live health polling without clobbering unsaved settings form edits
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      fetchDiagnosticsOnly();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDiagnosticsOnly]);

  const isFormDirty = useMemo(() => {
    if (!savedSettings) return false;
    return Object.keys(savedSettings).some(
      (k) => String(settingsForm[k] ?? '') !== String(savedSettings[k] ?? '')
    );
  }, [savedSettings, settingsForm]);

  const validateSettings = () => {
    const errs = {};
    if (!String(settingsForm.clinic_name || '').trim()) {
      errs.clinic_name = 'Clinic display name is required.';
    }
    const email = String(settingsForm.clinic_email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.clinic_email = 'Enter a valid official contact email address.';
    }
    const advance = Number(settingsForm.booking_advance_days_max);
    if (Number.isNaN(advance) || advance < 7 || advance > 365) {
      errs.booking_advance_days_max = 'Must be between 7 and 365 days.';
    }
    const cutoff = Number(settingsForm.cancellation_cutoff_hours);
    if (Number.isNaN(cutoff) || cutoff < 0 || cutoff > 168) {
      errs.cancellation_cutoff_hours = 'Must be between 0 and 168 hours.';
    }
    const duration = Number(settingsForm.slot_duration_default_minutes);
    if (Number.isNaN(duration) || duration < 15 || duration > 120 || duration % 5 !== 0) {
      errs.slot_duration_default_minutes = 'Must be 15–120 mins (5-min steps).';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!validateSettings()) {
      showToast('Please fix the highlighted configuration errors.', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      const payload = {
        ...settingsForm,
        clinic_name: String(settingsForm.clinic_name || '').trim(),
        clinic_tagline: String(settingsForm.clinic_tagline || '').trim(),
        clinic_phone: String(settingsForm.clinic_phone || '').trim(),
        clinic_email: String(settingsForm.clinic_email || '').trim(),
        clinic_address: String(settingsForm.clinic_address || '').trim(),
        booking_advance_days_max: Number(settingsForm.booking_advance_days_max),
        cancellation_cutoff_hours: Number(settingsForm.cancellation_cutoff_hours),
        slot_duration_default_minutes: Number(settingsForm.slot_duration_default_minutes),
      };
      const updated = await systemApi.updateSettings(payload);
      const normalized = updated && typeof updated === 'object' ? mapSettingsPayload(updated) : payload;
      setSavedSettings(normalized);
      setSettingsForm(normalized);
      setFormErrors({});
      broadcastClinicSettingsUpdate(normalized);
      showToast('Global clinic operating settings saved and synchronized.');
    } catch (err) {
      const serverErrors = err.response?.data?.error?.details;
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped = {};
        Object.entries(serverErrors).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFormErrors(mapped);
      }
      showToast(err.response?.data?.error?.message || 'Failed to update settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetForm = () => {
    if (savedSettings) {
      setSettingsForm(savedSettings);
      setFormErrors({});
    }
  };

  const services = health?.services || {};

  if (loading && !health) {
    return <SystemHealthSkeleton />;
  }

  const isSystemOperational = health?.system_status !== 'degraded' && services.database?.status === 'healthy';
  const dbLatencyBadge = getLatencyBadge(services.database?.latency_ms);
  const dbUptime = formatUptime(services.database?.uptime_seconds);
  const memLimitMb = parseMemoryLimitMb(services.php_fpm?.memory_limit);
  const memPeakMb = Number(services.php_fpm?.memory_peak_mb || 0);
  const memUsagePct = memLimitMb && memLimitMb > 0 ? Math.min(100, Math.round((memPeakMb / memLimitMb) * 100)) : null;

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

      {/* Executive Monitoring Header Card */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              System Health &amp; Clinic Configuration
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                isSystemOperational
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                  : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSystemOperational ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
                aria-hidden="true"
              />
              {isSystemOperational ? 'All Systems Operational' : 'Degraded Service Detected'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Monitor container topologies, database latency, background services, and configure global clinic operating rules.
          </p>
          {lastCheckedAt && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5 pt-0.5">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>Last checked: {lastCheckedAt.toLocaleTimeString()}</span>
              {health?.environment && <span>· Env: {String(health.environment).toUpperCase()}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={autoRefresh}
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`min-h-10 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              autoRefresh
                ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500/60 text-[#0F766E] dark:text-teal-300'
                : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
            }`}
            title="Automatically re-check health telemetry every 30 seconds"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-teal-500' : ''}`} aria-hidden="true" />
            <span>{autoRefresh ? 'Live Poll: 30s' : 'Auto-Refresh: Off'}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="min-h-10 inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Run Health Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Infrastructure Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Status */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                MySQL 8.0 Primary
              </span>
              <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300">
                <Database className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    services.database?.status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  {services.database?.status === 'healthy' ? 'Operational' : 'Degraded'}
                </span>
              </div>
              {dbLatencyBadge && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${dbLatencyBadge.cls}`}>
                  {dbLatencyBadge.label}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700/70 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span>Latency</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.database?.latency_ms ?? 0} ms
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Threads Connected</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.database?.threads_connected ?? 1}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Database Size</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.database?.size_mb ?? 0} MB
              </strong>
            </div>
            {dbUptime && (
              <div className="flex items-center justify-between">
                <span>Uptime</span>
                <strong className="text-slate-800 dark:text-slate-100 font-mono">{dbUptime}</strong>
              </div>
            )}
          </div>
        </div>

        {/* PHP-FPM Status */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                PHP-FPM Runtime
              </span>
              <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                <Cpu className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  v{services.php_fpm?.version?.split('-')[0] || '8.5'}
                </span>
              </div>
              {typeof services.php_fpm?.opcache_enabled === 'boolean' && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    services.php_fpm.opcache_enabled
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600'
                  }`}
                >
                  {services.php_fpm.opcache_enabled ? 'OPcache On' : 'OPcache Off'}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700/70 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span>Memory In-Use</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.php_fpm?.memory_usage_mb ?? 0} MB
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Memory Peak</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.php_fpm?.memory_peak_mb ?? 0} MB
                {services.php_fpm?.memory_limit ? ` / ${services.php_fpm.memory_limit}` : ''}
              </strong>
            </div>
            {memUsagePct !== null && (
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                  style={{ width: `${Math.max(4, memUsagePct)}%` }}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Environment</span>
              <strong className="text-slate-800 dark:text-slate-100 uppercase font-mono">
                {health?.environment || 'DEV'}
              </strong>
            </div>
          </div>
        </div>

        {/* Realtime Service */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Realtime Service
              </span>
              <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/15 border border-sky-200/70 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-300">
                <Server className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    services.realtime?.status === 'healthy'
                      ? 'bg-emerald-500'
                      : services.realtime?.status === 'unreachable'
                      ? 'bg-rose-500'
                      : services.realtime?.status === 'disabled'
                      ? 'bg-slate-400'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-50 capitalize">
                  {services.realtime?.status === 'healthy'
                    ? 'Operational'
                    : services.realtime?.status === 'disabled'
                    ? 'Disabled'
                    : services.realtime?.status || 'Unverified'}
                </span>
              </div>
              {typeof services.realtime?.active_connections === 'number' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-500/30 tabular-nums">
                  {services.realtime.active_connections} live
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700/70 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span>Target</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.realtime?.host || 'realtime'}:{services.realtime?.port || 4000}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Reachability</span>
              <strong
                className={
                  services.realtime?.status === 'healthy'
                    ? 'text-emerald-700 dark:text-emerald-400 font-mono'
                    : services.realtime?.status === 'unreachable'
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {services.realtime?.status === 'healthy'
                  ? `Connected${
                      typeof services.realtime?.latency_ms === 'number'
                        ? ` (${services.realtime.latency_ms} ms)`
                        : ''
                    }`
                  : services.realtime?.status === 'unreachable'
                  ? 'Unreachable'
                  : services.realtime?.status === 'disabled'
                  ? 'Disabled'
                  : 'Unverified'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Outbox Queue</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.realtime?.outbox_pending ?? 0} pending
                {(services.realtime?.outbox_failed ?? 0) > 0 && (
                  <span className="text-rose-500"> · {services.realtime.outbox_failed} failed</span>
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* Data Backups & Protection */}
        <div className="bg-white dark:bg-gray-800/95 p-5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Backups &amp; Protection
              </span>
              <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200/70 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
                <HardDrive className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  services.backups?.status === 'available'
                    ? 'bg-emerald-500'
                    : services.backups?.status === 'no_snapshots'
                    ? 'bg-amber-400'
                    : 'bg-teal-500'
                }`}
              />
              <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {services.backups?.status === 'available'
                  ? 'Snapshots Ready'
                  : services.backups?.status === 'no_snapshots'
                  ? 'No Local Snapshots'
                  : 'Persistent Volume'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700/70 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span>Volume</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.backups?.volume_name || 'mysql-data'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Snapshots</span>
              <strong className="text-slate-800 dark:text-slate-100 font-mono">
                {services.backups?.directory_accessible
                  ? `${services.backups?.backup_files_count ?? 0} file(s)`
                  : 'Host-managed'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-500" aria-hidden="true" />
                Rate Limiter
              </span>
              <strong
                className={`font-mono ${
                  (services.rate_limiter?.throttled_targets ?? 0) > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {services.rate_limiter?.throttled_targets ?? 0} throttled
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Email Outbox Delivery Health */}
      <EmailDeliveryPanel refreshSignal={emailRefreshTick} />

      {/* Global Clinic Operating Settings */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60 dark:bg-gray-900/55">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0">
              <Settings className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Global Clinic Operating Settings
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Enforced live across booking availability, cancellation policies, emails, and patient portals.
              </p>
            </div>
          </div>
          {isFormDirty ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 self-start sm:self-auto">
              <Activity className="w-3 h-3" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 self-start sm:self-auto">
              <CheckCircle className="w-3 h-3" aria-hidden="true" />
              Synced &amp; Operational
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-6" noValidate>
          {/* Live Identity Preview Banner */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {settingsForm.clinic_name || 'ToothCare Hub'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {settingsForm.clinic_tagline || 'No tagline configured'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              {settingsForm.clinic_phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 text-teal-500" aria-hidden="true" />
                  {settingsForm.clinic_phone}
                </span>
              )}
              {settingsForm.clinic_email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3 text-teal-500" aria-hidden="true" />
                  {settingsForm.clinic_email}
                </span>
              )}
            </div>
          </div>

          {/* Identity & Contact Fields */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3.5">
              Clinic Identity &amp; Public Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="setting-clinic-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Clinic Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="setting-clinic-name"
                  type="text"
                  value={settingsForm.clinic_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, clinic_name: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                />
                {formErrors.clinic_name && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.clinic_name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="setting-clinic-tagline"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Tagline / Motto
                </label>
                <input
                  id="setting-clinic-tagline"
                  type="text"
                  value={settingsForm.clinic_tagline}
                  onChange={(e) => setSettingsForm({ ...settingsForm, clinic_tagline: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="setting-clinic-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Official Telephone / Mobile
                </label>
                <div className="relative">
                  <Phone
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="setting-clinic-phone"
                    type="text"
                    value={settingsForm.clinic_phone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clinic_phone: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="setting-clinic-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Official Contact Email
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="setting-clinic-email"
                    type="email"
                    value={settingsForm.clinic_email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clinic_email: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                  />
                </div>
                {formErrors.clinic_email && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.clinic_email}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="setting-clinic-address"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Clinic Physical Address
                </label>
                <div className="relative">
                  <MapPin
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="setting-clinic-address"
                    type="text"
                    value={settingsForm.clinic_address}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clinic_address: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Booking & Clinical Compliance Rules */}
          <div className="pt-5 border-t border-slate-100 dark:border-gray-700/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3.5">
              Booking &amp; Clinical Compliance Rules
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80 space-y-2">
                <label
                  htmlFor="setting-advance-days"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Max Booking Advance (Days)
                </label>
                <input
                  id="setting-advance-days"
                  type="number"
                  min="7"
                  max="365"
                  value={settingsForm.booking_advance_days_max}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      booking_advance_days_max: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                />
                {formErrors.booking_advance_days_max ? (
                  <p className="text-[11px] text-rose-500">{formErrors.booking_advance_days_max}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enforced live by the booking calendar &amp; availability engine (7–365 days).
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80 space-y-2">
                <label
                  htmlFor="setting-cutoff-hours"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Cancellation Cutoff (Hours)
                </label>
                <input
                  id="setting-cutoff-hours"
                  type="number"
                  min="0"
                  max="168"
                  value={settingsForm.cancellation_cutoff_hours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      cancellation_cutoff_hours: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                />
                {formErrors.cancellation_cutoff_hours ? (
                  <p className="text-[11px] text-rose-500">{formErrors.cancellation_cutoff_hours}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Locks patient cancellation &amp; reschedule of confirmed visits within this window.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-gray-900/50 border border-slate-200/80 dark:border-gray-700/80 space-y-2">
                <label
                  htmlFor="setting-slot-duration"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Default Slot Duration (Mins)
                </label>
                <input
                  id="setting-slot-duration"
                  type="number"
                  min="15"
                  max="120"
                  step="5"
                  value={settingsForm.slot_duration_default_minutes}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      slot_duration_default_minutes: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-10 px-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-slate-100 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#0D9488]/25 focus:border-[#0D9488] outline-none"
                />
                <div className="flex items-center gap-1.5">
                  {SLOT_DURATION_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setSettingsForm({ ...settingsForm, slot_duration_default_minutes: mins })
                      }
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        Number(settingsForm.slot_duration_default_minutes) === mins
                          ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-400 dark:border-teal-500 text-[#0F766E] dark:text-teal-300'
                          : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:border-teal-400'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                {formErrors.slot_duration_default_minutes ? (
                  <p className="text-[11px] text-rose-500">{formErrors.slot_duration_default_minutes}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Used as default duration for new dental services &amp; fallback slot sizing.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-gray-700/80">
            {isFormDirty && (
              <button
                type="button"
                onClick={handleResetForm}
                disabled={savingSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Changes</span>
              </button>
            )}
            <button
              type="submit"
              disabled={savingSettings || !isFormDirty}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{savingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SystemHealthPage;
