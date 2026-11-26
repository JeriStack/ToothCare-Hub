import React, { useEffect, useState, useCallback } from 'react';
import {
  History,
  X,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { historyApi } from '../api';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';

const RESULT_BADGE = {
  SUCCESS: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  WARNING: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  FAILED: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
  DENIED: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
};

function formatDiffVal(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ') || '(none)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Reusable Individual Record History Timeline Modal (Phase 3.3 & 3.4)
 * Displays chronological lifecycle events with Asia/Manila timestamps, preserved actor
 * attribution (even when archived), and Before -> After field comparisons.
 */
export function RecordHistoryModal({ entityType, entityId, title, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTimeline = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const normalized = String(entityType).toLowerCase();
      let res = null;
      if (normalized === 'patient' || normalized === 'patients') {
        res = await historyApi.getPatientTimeline(entityId);
      } else if (normalized === 'dentist' || normalized === 'dentists') {
        res = await historyApi.getDentistTimeline(entityId);
      } else if (normalized === 'appointment' || normalized === 'appointments') {
        res = await historyApi.getAppointmentTimeline(entityId);
      } else {
        res = await historyApi.getStaffTimeline(entityId);
      }
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Unable to load record history timeline.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const events = data?.events || [];
  const subject = data?.subject || null;

  return (
    <DialogOverlay
      onClose={onClose}
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50/75 dark:bg-gray-900/55 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/80 dark:border-teal-500/30 text-[#0F766E] dark:text-teal-300 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                {title || subject?.name || `${String(entityType).toUpperCase()} #${entityId} History`}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chronological lifecycle timeline · Timestamps in Asia/Manila (PHT)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadTimeline}
              disabled={loading}
              aria-label="Refresh timeline"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close record history timeline"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subject Banner */}
        {subject && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-gray-700/80 bg-white dark:bg-gray-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {subject.name || subject.reference}
              </span>
              {subject.email && (
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {subject.email}
                </span>
              )}
              {subject.role && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-200">
                  {subject.role}
                </span>
              )}
              {subject.is_active === false && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  <Archive className="w-3 h-3" aria-hidden="true" />
                  Archived / Inactive
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {events.length} event{events.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Timeline Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-gray-700/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={loadTimeline} className="font-semibold underline cursor-pointer">
                Retry
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
              No chronological history events recorded for this record yet.
            </div>
          ) : (
            <ol className="relative border-l-2 border-slate-200 dark:border-gray-700 ml-3 space-y-4">
              {events.map((evt, idx) => {
                const badgeClass = RESULT_BADGE[evt.result] || RESULT_BADGE.SUCCESS;
                const changes = Array.isArray(evt.changes) ? evt.changes : [];
                return (
                  <li key={`${evt.source}-${evt.id}-${idx}`} className="ml-5">
                    <span className="absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-[#0D9488] flex items-center justify-center">
                      {evt.result === 'FAILED' || evt.result === 'DENIED' ? (
                        <ShieldAlert className="w-2.5 h-2.5 text-rose-500" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-2.5 h-2.5 text-[#0D9488]" aria-hidden="true" />
                      )}
                    </span>

                    <div className="rounded-xl border border-slate-200/90 dark:border-gray-700/80 bg-slate-50/60 dark:bg-gray-900/45 p-3.5 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                            {evt.event_ref}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {evt.action_label || evt.action}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                            {evt.result}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {evt.timestamp_manila || evt.created_at}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="font-semibold">{evt.actor_name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-gray-700 text-[10px] font-semibold">
                          {evt.actor_role}
                        </span>
                        {evt.actor_is_active === false && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                            Archived Actor
                          </span>
                        )}
                      </div>

                      {evt.reason && (
                        <p className="text-slate-600 dark:text-slate-300 italic">
                          “{evt.reason}”
                        </p>
                      )}

                      {changes.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 dark:border-gray-700/70 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Field Changes
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {changes.map((c) => (
                              <div
                                key={c.field}
                                className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-[11px]"
                              >
                                <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">
                                  {c.field}:
                                </span>
                                <span className="line-through text-rose-600 dark:text-rose-400">
                                  {formatDiffVal(c.before)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  {formatDiffVal(c.after)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </DialogOverlay>
  );
}

export default RecordHistoryModal;
