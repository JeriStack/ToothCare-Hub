import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, RotateCcw, Ban, AlertTriangle, CheckCircle } from 'lucide-react';
import { emailOutboxApi } from '../emailOutboxApi';

const STATUS_LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SENT: 'Sent',
  FAILED_RETRYABLE: 'Retrying',
  FAILED_PERMANENT: 'Failed',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES = {
  FAILED_RETRYABLE: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
  FAILED_PERMANENT: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800',
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

function Metric({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'text-slate-900 dark:text-slate-100',
    warn: 'text-amber-700 dark:text-amber-300',
    danger: 'text-rose-700 dark:text-rose-300',
    ok: 'text-emerald-700 dark:text-emerald-300',
  }[tone];
  return (
    <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-xl font-bold font-mono ${toneClass}`}>{value ?? 0}</div>
    </div>
  );
}

/**
 * Email delivery health and failed-job recovery (System Health page).
 * Shows only masked recipients and sanitized errors; message content is never fetched.
 */
export function EmailDeliveryPanel() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
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
      const res = await emailOutboxApi.getJobs({ failuresOnly: true, perPage: 10 });
      setJobs(res.data);
      setJobsDenied(false);
    } catch (err) {
      if (err?.response?.status === 403) setJobsDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (job, action) => {
    let confirm = false;
    if (action === 'retry' && job.exhausted) {
      // eslint-disable-next-line no-alert
      confirm = window.confirm(`Job ${job.reference} used all ${job.max_attempts} attempts. Requeue it for 3 more attempts?`);
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
      setMessage({ type: 'success', text: action === 'retry' ? `${job.reference} was queued for another attempt.` : `${job.reference} was abandoned.` });
      await load();
    } catch (err) {
      const status = err?.response?.status;
      const text = status === 403
        ? 'You do not have permission for this action.'
        : err?.message || 'The action failed.';
      setMessage({ type: 'error', text });
    } finally {
      setBusyId(null);
    }
  };

  if (denied) {
    return (
      <section aria-labelledby="email-delivery-heading" className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6">
        <h3 id="email-delivery-heading" className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Email Delivery
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Email delivery monitoring requires the <code className="font-mono">email_outbox.view</code> permission.
        </p>
      </section>
    );
  }

  const mailOk = stats?.mail?.operational;
  return (
    <section aria-labelledby="email-delivery-heading" className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 id="email-delivery-heading" className="font-bold text-base text-slate-900 dark:text-slate-100">Email Delivery</h3>
          {stats && (
            <span className={`ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${mailOk ? STATUS_STYLES.SENT : STATUS_STYLES.FAILED_PERMANENT}`}>
              {mailOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {mailOk ? 'SMTP configured' : stats.mail?.enabled ? 'SMTP misconfigured' : 'Mail disabled'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-gray-600 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="p-6 space-y-5">
        {message && (
          <div role="status" className={`text-sm px-3 py-2 rounded-lg border ${message.type === 'error' ? STATUS_STYLES.FAILED_PERMANENT : STATUS_STYLES.SENT}`}>
            {message.text}
          </div>
        )}
        {stats && !mailOk && stats.mail?.configuration_errors?.length > 0 && (
          <ul className="text-xs text-rose-700 dark:text-rose-300 list-disc pl-5">
            {stats.mail.configuration_errors.map((e) => <li key={e}>{e}</li>)}
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
        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
          <span>Last successful delivery: <strong className="text-slate-700 dark:text-slate-200">{formatDate(stats?.last_sent_at)}</strong></span>
          <span>Average delivery delay: <strong className="text-slate-700 dark:text-slate-200">{stats?.avg_delivery_delay_seconds != null ? `${stats.avg_delivery_delay_seconds}s` : '—'}</strong></span>
          <span>Processing now: <strong className="text-slate-700 dark:text-slate-200">{stats?.processing ?? 0}</strong></span>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Recent delivery failures</h4>
          {jobsDenied ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Viewing failure details requires the <code className="font-mono">email_outbox.view_failures</code> permission.</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No failed email jobs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-2 pr-4">Job</th>
                    <th scope="col" className="py-2 pr-4">Event</th>
                    <th scope="col" className="py-2 pr-4">Recipient</th>
                    <th scope="col" className="py-2 pr-4">Status</th>
                    <th scope="col" className="py-2 pr-4">Attempts</th>
                    <th scope="col" className="py-2 pr-4">Failure</th>
                    <th scope="col" className="py-2 pr-4">Last attempt / next retry</th>
                    <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {jobs.map((job) => (
                    <tr key={job.id} className="align-top">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-200">{job.reference}</td>
                      <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{EVENT_LABELS[job.event_type] || job.event_type}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600 dark:text-slate-300">{job.recipient}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[job.status] || ''}`}>
                          {job.exhausted ? 'Exhausted' : STATUS_LABELS[job.status] || job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{job.attempts}/{job.max_attempts}</td>
                      <td className="py-2 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        <div className="font-semibold">{job.failure_category || '—'} {job.error_code ? `· ${job.error_code}` : ''}</div>
                        <div>{job.error_message}</div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        <div>{formatDate(job.last_attempt_at)}</div>
                        {job.next_attempt_at && <div>Next: {formatDate(job.next_attempt_at)}</div>}
                      </td>
                      <td className="py-2 whitespace-nowrap text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => act(job, 'retry')}
                          disabled={busyId === job.id}
                          aria-label={`Retry ${job.reference}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-teal-200 text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-900/30 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> {job.exhausted ? 'Requeue' : 'Retry'}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(job, 'abandon')}
                          disabled={busyId === job.id}
                          aria-label={`Abandon ${job.reference}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" /> Abandon
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default EmailDeliveryPanel;