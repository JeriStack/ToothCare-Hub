import React, { useState, useEffect, useCallback } from 'react';
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
  Filter
} from 'lucide-react';
import { auditApi } from '../api';
import { TableSkeleton } from '../../../components/skeletons';

export function AuditTrailPage() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'security'
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 25, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Payload Inspector Modal
  const [inspectingLog, setInspectingLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: 25 };
      if (search.trim()) params.search = search.trim();
      if (targetType) params.target_type = targetType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      if (activeTab === 'security') {
        const events = await auditApi.getSecurityEvents(params);
        setLogs(events);
        setMeta({ total: events.length, page: 1, per_page: 50, last_page: 1 });
      } else {
        const res = await auditApi.getLogs(params);
        setLogs(res.data || []);
        setMeta(res.meta || { total: 0, page: 1, per_page: 25, last_page: 1 });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load audit records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search, targetType, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (targetType) params.target_type = targetType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      await auditApi.exportCsv(params);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'CSV Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeStyle = (action) => {
    if (action?.includes('FAILED') || action?.includes('RATE_LIMITED') || action?.includes('DEACTIVATED')) {
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70';
    }
    if (action?.includes('CREATED') || action?.includes('ACTIVATED') || action?.includes('CONFIRMED')) {
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';
    }
    if (action?.includes('UPDATED') || action?.includes('AMENDED')) {
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70';
    }
    return 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Audit Trail & Security Events</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Append-only forensic history tracking clinical actions, authorization modifications, and login attempts.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          aria-busy={exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#12304A] dark:bg-[#0F766E] hover:bg-[#1e496e] dark:hover:bg-[#0D9488] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400 dark:text-teal-200" />
          ) : (
            <Download className="w-4 h-4 text-teal-400 dark:text-teal-200" />
          )}
          {exporting ? 'Exporting CSV...' : 'Export CSV Log'}
        </button>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-gray-700 pb-3">
        <button
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'all'
              ? 'bg-[#CCFBF1] dark:bg-teal-950/70 text-[#0F766E] dark:text-teal-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          All Audit Events
        </button>
        <button
          onClick={() => {
            setActiveTab('security');
            setPage(1);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'security'
              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Security & Failed Logins
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, actor email, or IP..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:bg-white dark:focus:bg-gray-700"
          />
        </div>

        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
        >
          <option value="">All Modules</option>
          <option value="users">Users & Auth</option>
          <option value="patients">Patients</option>
          <option value="dentists">Dentists</option>
          <option value="appointments">Appointments</option>
          <option value="services">Services</option>
          <option value="roles">Roles & DRBAC</option>
          <option value="clinic_settings">Clinic Settings</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
          title="Start Date"
        />

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
            title="End Date"
          />
          <button
            onClick={fetchLogs}
            className="p-2 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : loading && logs.length === 0 ? (
          <TableSkeleton rows={6} cols={6} />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No audit trail events match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">{log.actor_email}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{log.actor_role}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeStyle(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {log.target_type} {log.target_id ? `#${log.target_id}` : ''}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{log.ip_address}</td>
                    <td className="py-3.5 px-5 text-right">
                      {log.payload ? (
                        <button
                          onClick={() => setInspectingLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect
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

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700 bg-slate-50/40 dark:bg-gray-900/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>
              Page <strong className="text-slate-900 dark:text-slate-100">{meta.page}</strong> of <strong className="text-slate-900 dark:text-slate-100">{meta.last_page}</strong> ({meta.total} entries)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payload Inspector Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-[#12304A] dark:bg-gray-900 text-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">Audit Payload Details (#{inspectingLog.id})</h3>
              </div>
              <button
                onClick={() => setInspectingLog(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200/70 dark:border-gray-700">
                  <span className="text-slate-400 dark:text-slate-500 block">Action</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{inspectingLog.action}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200/70 dark:border-gray-700">
                  <span className="text-slate-400 dark:text-slate-500 block">Actor</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{inspectingLog.actor_email}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200/70 dark:border-gray-700">
                  <span className="text-slate-400 dark:text-slate-500 block">Target</span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">
                    {inspectingLog.target_type} #{inspectingLog.target_id || 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200/70 dark:border-gray-700">
                  <span className="text-slate-400 dark:text-slate-500 block">Client IP</span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">{inspectingLog.ip_address}</span>
                </div>
              </div>

              {(inspectingLog.payload?.before || inspectingLog.payload?.after) && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1.5">
                    Before vs. After Change Comparison
                  </span>
                  <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="px-3 py-2">Field</th>
                          <th className="px-3 py-2">Before</th>
                          <th className="px-3 py-2">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70">
                        {Array.from(
                          new Set([
                            ...Object.keys(inspectingLog.payload?.before || {}),
                            ...Object.keys(inspectingLog.payload?.after || {}),
                          ])
                        ).map((field) => {
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
                            <tr key={field} className="bg-white dark:bg-gray-800">
                              <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{field}</td>
                              <td className="px-3 py-2 text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/40 break-all">{beforeVal}</td>
                              <td className="px-3 py-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/40 font-medium break-all">
                                {afterVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1.5">Sanitized Event Data</span>
                <pre className="p-4 bg-slate-900 dark:bg-gray-950 text-emerald-300 rounded-xl text-xs font-mono overflow-x-auto max-h-60 border border-slate-800 dark:border-gray-700">
                  {JSON.stringify(inspectingLog.payload, null, 2)}
                </pre>
              </div>

              {inspectingLog.user_agent && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <strong>User-Agent:</strong> {inspectingLog.user_agent}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInspectingLog(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditTrailPage;
