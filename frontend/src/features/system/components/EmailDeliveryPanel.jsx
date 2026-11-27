import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, RotateCcw, Ban, AlertTriangle, CheckCircle, Clock, Cpu } from 'lucide-react';
import { emailOutboxApi } from '../emailOutboxApi';
import { ServerTableFooter } from '../../../components/ui/ServerTableControls';

const STATUS_LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SENT: 'Sent',
  FAILED_RETRYABLE: 'Retrying',
  FAILED_PERMANENT: 'Failed',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES = {
  FAILED_RETRYABLE:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
  FAILED_PERMANENT:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800',
  SENT: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800',
};

const EVENT_LABELS = {
  EMAIL_VERIFICATION: 'Email verification',
  PASSWORD_RESET: 'Password reset',
  APPOINTMENT_REQUESTED: 'Booking received',
  APPOINTMENT_CONFIRMED: 'Appointment confirmed',
  APPOINTMENT_REJECTED: 'Appointment declined',
  APPOINTMENT_CANCELLED: 'Appointment cancelled',
  APPOINTMENT_COMPLETED: 'Visit completed',
  APPOINTMENT_REMINDER: 'Appointment reminder',
  LEGACY: 'Legacy email',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function formatDelay(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const num = Number(seconds);
  if (num < 60) {
    return `${seconds}s`;
  }
  const totalSec = Math.round(num);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const remSec = totalSec % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'text-slate-900 dark:text-slate-100',
    warn: 'text-amber-700 dark:text-amber-300',
    danger: 'text-rose-700 dark:text-rose-300',
    ok: 'text-emerald-700 dark:text-emerald-400',
  }[tone];
  const borderClass = {
    default: 'border-slate-200/80 dark:border-gray-700/80 bg-slate-50/70 dark:bg-gray-900/50',
    warn: 'border-amber-200/90 dark:border-amber-500/35 bg-amber-50/50 dark:bg-amber-950/25',
    danger: 'border-rose-200/90 dark:border-rose-500/35 bg-rose-50/50 dark:bg-rose-950/25',
    ok: 'border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20',
  }[tone];
  return (
    <div className={`p-3.5 rounded-xl border ${borderClass} transition-colors`}>
      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-extrabold font-mono tabular-nums ${toneClass}`}>
        {value ?? 0}
      </div>
    </div>
  );
}

/**
 * Email delivery health and failed-job recovery (System Health page).
 * Shows only masked recipients and sanitized errors; message content is never fetched.
 */
export function EmailDeliveryPanel({ refreshSignal = 0 }) {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [jobsMeta, setJobsMeta] = useState({ total: 0, page: 1, per_page: 5, last_page: 1 });
  const [denied, setDenied] = useState(false);
  const [jobsDenied, setJobsDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await emailOutboxApi.getStats());
      setDenied(false);
    } catch (err) {
      if (err?.response?.status === 403) setDenied(true);
      else setMessage({ type: 'error', text: 'Could not load email delivery statistics.' });
    }
    try {
      const res = await emailOutboxApi.getJobs({ failuresOnly: true, page, perPage });
      const rows = res?.data || [];
      const m = res?.meta || {};
      const total = Number(m.filtered_records ?? m.total ?? rows.length);
      const lastPage = Math.max(1, Number(m.total_pages ?? m.last_page ?? Math.ceil(total / perPage)));
      if (page > lastPage) {
        setPage(lastPage);
      }
      setJobs(rows);
      setJobsMeta({
        total,
        total_records: Number(m.total_records ?? total),
        filtered_records: total,
        page: Number(m.current_page ?? m.page ?? page),
        per_page: Number(m.per_page ?? perPage),
        last_page: lastPage,
      });
      setJobsDenied(false);
    } catch (err) {
      if (err?.response?.status === 403) setJobsDenied(true);
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const act = async (job, action) => {
    let confirm = false;
    if (action === 'retry' && job.exhausted) {
      // eslint-disable-next-line no-alert
      confirm = window.confirm(
        `Job ${job.reference} used all ${job.max_attempts} attempts. Requeue it for 3 more attempts?`
      );
      if (!confirm) return;
    }
    if (action === 'abandon') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Abandon ${job.reference}? It will not be sent.`)) return;
    }
    setBusyId(job.id);
    setMessage(null);
    try {
      if (action === 'retry') await emailOutboxApi.retry(job.id, { confirm });
      else await emailOutboxApi.abandon(job.id);
      setMessage({
        type: 'success',
        text:
          action === 'retry'
            ? `${job.reference} was queued for another attempt.`
            : `${job.reference} was abandoned.`,
      });
      await load();
    } catch (err) {
      const status = err?.response?.status;
      const text =
        status === 403 ? 'You do not have permission for this action.' : err?.message || 'The action failed.';
      setMessage({ type: 'error', text });
    } finally {
      setBusyId(null);
    }
  };

  if (denied) {
    return (
      <section
        aria-labelledby="email-delivery-heading"
        className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs"
      >
        <h3
          id="email-delivery-heading"
          className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2"
        >
          <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Email Delivery
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Email delivery monitoring requires the <code className="font-mono">email_outbox.view</code> permission.
        </p>
      </section>
    );
  }

  const mailOk = stats?.mail?.operational;
  const workerOk = stats?.worker?.configuration_valid !== false && stats?.worker?.enabled !== false;
  const total = Number(stats?.total || 0);
  const sent = Number(stats?.sent || 0);
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 100;

  return (
    <section
      aria-labelledby="email-delivery-heading"
      className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-xs overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-gray-900/55">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0">
            <Mail className="w-4 h-4" aria-hidden="true" />
          </span>
          <h3 id="email-delivery-heading" className="font-bold text-base text-slate-900 dark:text-slate-100">
            Email Delivery
          </h3>
          {stats && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                mailOk ? STATUS_STYLES.SENT : STATUS_STYLES.FAILED_PERMANENT
              }`}
            >
              {mailOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {mailOk ? 'SMTP configured' : stats.mail?.enabled ? 'SMTP misconfigured' : 'Mail disabled'}
            </span>
          )}
          {stats?.worker && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                workerOk
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30'
                  : STATUS_STYLES.FAILED_RETRYABLE
              }`}
            >
              <Cpu className="w-3 h-3" aria-hidden="true" />
              {workerOk ? 'Worker active' : 'Worker paused'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500/60 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="p-6 space-y-5">
        {message && (
          <div
            role="status"
            className={`text-sm px-3.5 py-2.5 rounded-xl border ${
              message.type === 'error' ? STATUS_STYLES.FAILED_PERMANENT : STATUS_STYLES.SENT
            }`}
          >
            {message.text}
          </div>
        )}
        {stats && !mailOk && stats.mail?.configuration_errors?.length > 0 && (
          <ul className="text-xs text-rose-700 dark:text-rose-300 list-disc pl-5 space-y-1">
            {stats.mail.configuration_errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Queued total" value={stats?.total} />
          <Metric label="Pending" value={stats?.pending} />
          <Metric label="Retrying" value={stats?.retrying} tone={stats?.retrying ? 'warn' : 'default'} />
          <Metric label="Sent" value={stats?.sent} tone="ok" />
          <Metric label="Failed" value={stats?.failed} tone={stats?.failed ? 'danger' : 'default'} />
          <Metric label="Exhausted" value={stats?.exhausted} tone={stats?.exhausted ? 'danger' : 'default'} />
        </div>

        {/* Delivery Rate & Telemetry Strip */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-gray-900/55 border border-slate-200/70 dark:border-gray-700/70 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Outbox Delivery Success Rate
            </span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {deliveryRate}% ({sent} / {total})
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-6 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              Last successful delivery:{' '}
              <strong className="text-slate-700 dark:text-slate-200">{formatDate(stats?.last_sent_at)}</strong>
            </span>
            <span
              title={
                stats?.avg_delivery_delay_seconds != null
                  ? `Exact average delay: ${stats.avg_delivery_delay_seconds}s`
                  : undefined
              }
            >
              Average delivery delay:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-mono">
                {formatDelay(stats?.avg_delivery_delay_seconds)}
              </strong>
            </span>
            <span>
              Processing now:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-mono">{stats?.processing ?? 0}</strong>
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
            Recent delivery failures
          </h4>
          {jobsDenied ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Viewing failure details requires the{' '}
              <code className="font-mono">email_outbox.view_failures</code> permission.
            </p>
          ) : jobs.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-gray-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>No failed email jobs.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-gray-700/80">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-gray-900/70 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-gray-700">
                    <th scope="col" className="py-2.5 px-4">
                      Job
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Event
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Recipient
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Status
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Attempts
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Failure
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      Last attempt / next retry
                    </th>
                    <th scope="col" className="py-2.5 px-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70">
                  {jobs.map((job) => (
                    <tr key={job.id} className="align-top hover:bg-slate-50/50 dark:hover:bg-gray-700/30">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {job.reference}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-700 dark:text-slate-200">
                        {EVENT_LABELS[job.event_type] || job.event_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {job.recipient}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[job.status] || ''
                          }`}
                        >
                          {job.exhausted ? 'Exhausted' : STATUS_LABELS[job.status] || job.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums">
                        {job.attempts}/{job.max_attempts}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                        <div className="font-semibold">
                          {job.failure_category || '—'} {job.error_code ? `· ${job.error_code}` : ''}
                        </div>
                        <div>{job.error_message}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>{formatDate(job.last_attempt_at)}</div>
                        {job.next_attempt_at && <div>Next: {formatDate(job.next_attempt_at)}</div>}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => act(job, 'retry')}
                          disabled={busyId === job.id}
                          aria-label={`Retry ${job.reference}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-teal-200 text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-900/30 disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> {job.exhausted ? 'Requeue' : 'Retry'}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(job, 'abandon')}
                          disabled={busyId === job.id}
                          aria-label={`Abandon ${job.reference}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" /> Abandon
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ServerTableFooter
                page={jobsMeta.page}
                perPage={jobsMeta.per_page}
                totalRecords={jobsMeta.total_records ?? jobsMeta.total}
                filteredRecords={jobsMeta.filtered_records ?? jobsMeta.total}
                totalPages={jobsMeta.last_page}
                onPageChange={(nextPage) => setPage(nextPage)}
                onPerPageChange={(nextSize) => {
                  setPerPage(nextSize);
                  setPage(1);
                }}
                pageSizeOptions={[5, 10, 15, 25]}
                loading={loading}
                itemLabel="failed jobs"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default EmailDeliveryPanel;
