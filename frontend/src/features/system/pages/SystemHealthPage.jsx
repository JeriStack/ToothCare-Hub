import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  Cpu,
  Shield,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Settings,
  Save,
  Clock,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { systemApi } from '../api';
import { SystemHealthSkeleton } from '../../../components/skeletons';
import { EmailDeliveryPanel } from '../components/EmailDeliveryPanel';

export function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hData, sData] = await Promise.all([
        systemApi.getHealth(),
        systemApi.getSettings(),
      ]);

      setHealth(hData);
      setSettings(sData);

      setSettingsForm({
        clinic_name: sData.clinic_name?.value || 'ToothCare Hub',
        clinic_tagline: sData.clinic_tagline?.value || '',
        clinic_phone: sData.clinic_phone?.value || '',
        clinic_email: sData.clinic_email?.value || '',
        clinic_address: sData.clinic_address?.value || '',
        booking_advance_days_max: sData.booking_advance_days_max?.value || 60,
        cancellation_cutoff_hours: sData.cancellation_cutoff_hours?.value || 24,
        slot_duration_default_minutes: sData.slot_duration_default_minutes?.value || 30,
      });
    } catch {
      showToast('Failed to retrieve system health diagnostics.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await systemApi.updateSettings(settingsForm);
      showToast('Clinic configuration parameters updated.');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const services = health?.services || {};

  if (loading && !health) {
    return <SystemHealthSkeleton />;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Health & Clinic Configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor container topologies, database latency, background services, and configure global clinic operating rules.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-gray-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </button>
      </div>

      {/* Health Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Status */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MySQL 8.0 Primary</span>
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {services.database?.status === 'healthy' ? 'Operational' : 'Degraded'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Latency: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.database?.latency_ms || 0} ms</strong></div>
            <div>Threads: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.database?.threads_connected || 1}</strong></div>
            <div>Database Size: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.database?.size_mb || 0} MB</strong></div>
          </div>
        </div>

        {/* PHP-FPM Status */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">PHP-FPM Runtime</span>
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">v{services.php_fpm?.version?.split('-')[0] || '8.5'}</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Memory In-Use: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.php_fpm?.memory_usage_mb || 0} MB</strong></div>
            <div>Memory Peak: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.php_fpm?.memory_peak_mb || 0} MB</strong></div>
            <div>Environment: <strong className="text-slate-700 dark:text-slate-200 uppercase font-mono">{health?.environment || 'DEV'}</strong></div>
          </div>
        </div>

        {/* Realtime Service */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Realtime Service</span>
            <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
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
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              {services.realtime?.status === 'healthy'
                ? 'Operational'
                : services.realtime?.status === 'disabled'
                ? 'Disabled'
                : services.realtime?.status || 'Unverified'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Target: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.realtime?.host || 'realtime'}:{services.realtime?.port || 4000}</strong></div>
            <div>
              Transport: <strong className="text-slate-700 dark:text-slate-200">WebSocket / Socket.IO</strong>
              {typeof services.realtime?.active_connections === 'number' && (
                <> · <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.realtime.active_connections}</strong> active</>
              )}
            </div>
            <div>
              Reachability:{' '}
              <strong
                className={
                  services.realtime?.status === 'healthy'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : services.realtime?.status === 'unreachable'
                    ? 'text-rose-700 dark:text-rose-400'
                    : services.realtime?.status === 'disabled'
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {services.realtime?.status === 'healthy'
                  ? `Connected${typeof services.realtime?.latency_ms === 'number' ? ` (${services.realtime.latency_ms} ms)` : ''}`
                  : services.realtime?.status === 'unreachable'
                  ? 'Unreachable'
                  : services.realtime?.status === 'disabled'
                  ? 'Disabled'
                  : 'Unverified'}
              </strong>
            </div>
          </div>
        </div>

        {/* Backups & Persistence */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Backups</span>
            <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
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
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {services.backups?.status === 'available'
                ? 'Snapshots Ready'
                : services.backups?.status === 'no_snapshots'
                ? 'No Local Snapshots'
                : 'Persistent Volume'}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Volume: <strong className="text-slate-700 dark:text-slate-200 font-mono">{services.backups?.volume_name || 'mysql-data'}</strong></div>
            <div>
              Snapshots:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-mono">
                {services.backups?.directory_accessible
                  ? `${services.backups?.backup_files_count ?? 0} file(s)`
                  : 'Host-managed'}
              </strong>
            </div>
            <div>
              Last Snapshot:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {services.backups?.last_backup
                  ? new Date(services.backups.last_backup).toLocaleString()
                  : services.backups?.directory_accessible
                  ? 'None recorded'
                  : 'Managed on host'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 13: Email outbox delivery health and failed-job recovery */}
      <EmailDeliveryPanel />

      {/* Global Clinic Configuration Management */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Global Clinic Operating Settings</h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">Synchronized across Patient & Receptionist portals</span>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Clinic Display Name</label>
              <input
                type="text"
                value={settingsForm.clinic_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, clinic_name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Tagline / Motto</label>
              <input
                type="text"
                value={settingsForm.clinic_tagline}
                onChange={(e) => setSettingsForm({ ...settingsForm, clinic_tagline: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Official Telephone / Mobile</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settingsForm.clinic_phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, clinic_phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Official Contact Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={settingsForm.clinic_email}
                  onChange={(e) => setSettingsForm({ ...settingsForm, clinic_email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Clinic Physical Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settingsForm.clinic_address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, clinic_address: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-gray-700">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              Booking & Clinical Compliance Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Max Booking Advance (Days)
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={settingsForm.booking_advance_days_max}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, booking_advance_days_max: parseInt(e.target.value, 10) || 60 })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Cancellation Cutoff (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={settingsForm.cancellation_cutoff_hours}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, cancellation_cutoff_hours: parseInt(e.target.value, 10) || 24 })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Default Slot Duration (Mins)
                </label>
                <input
                  type="number"
                  min="15"
                  max="120"
                  step="15"
                  value={settingsForm.slot_duration_default_minutes}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      slot_duration_default_minutes: parseInt(e.target.value, 10) || 30,
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-gray-700">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SystemHealthPage;
