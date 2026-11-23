import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
  RefreshCw,
  Settings,
  UserPlus,
} from 'lucide-react';
import notificationsApi from '../api';
import { NotificationSkeleton } from '../../../components/skeletons';
import { ConnectionStatus } from '../../../components/notifications/ConnectionStatus';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';

function getNotificationIcon(type) {
  switch (type) {
    case 'APPOINTMENT_REQUESTED':
      return <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    case 'APPOINTMENT_CONFIRMED':
    case 'APPOINTMENT_UPDATED':
      return <CheckCircle2 className="w-5 h-5 text-[#0D9488] dark:text-[#2DD4BF]" />;
    case 'APPOINTMENT_REJECTED':
      return <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
    case 'APPOINTMENT_CANCELLED':
      return <AlertTriangle className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
    case 'APPOINTMENT_COMPLETED':
      return <Sparkles className="w-5 h-5 text-teal-600 dark:text-[#2DD4BF]" />;
    case 'APPOINTMENT_RESCHEDULED':
    case 'SCHEDULE_UPDATED':
      return <Calendar className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
    case 'SERVICE_UPDATED':
      return <Settings className="w-5 h-5 text-[#0D9488] dark:text-[#2DD4BF]" />;
    case 'ACCOUNT_CREATED':
    case 'ACCOUNT_UPDATED':
      return <UserPlus className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    default:
      return <Bell className="w-5 h-5 text-[#0D9488] dark:text-[#2DD4BF]" />;
  }
}

export function PatientNotificationsPage({ onNavigateToAppointments, onSelectNotification }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' or 'UNREAD'
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = useCallback(async (pageNum = 1, silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await notificationsApi.getNotifications(
        { page: pageNum, per_page: 15 },
        silent ? { background: true } : undefined
      );
      setNotifications(res.items || []);
      setTotal(res.total || 0);
      setUnreadCount(res.unread_count || 0);
      setPage(res.page || 1);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load notifications.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchList(page);
  }, [fetchList, page]);

  useRealtimeNotifications({
    onEvent: () => {
      void fetchList(page, true);
    },
    onReconnect: () => {
      void fetchList(page, true);
    },
  });

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      fetchList(page);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
    } catch {
      fetchList(page);
    }
  };

  const displayedNotifications =
    filter === 'UNREAD' ? notifications.filter((n) => !n.read_at) : notifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-50">Notifications</h2>
            <ConnectionStatus />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time status updates and appointment alerts for your clinical visits.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 hover:text-[#0D9488] dark:hover:text-[#2DD4BF] hover:border-teal-200 dark:hover:border-teal-700 text-xs font-semibold shadow-sm transition-colors"
          >
            <CheckCheck className="w-4 h-4 text-[#0D9488] dark:text-[#2DD4BF]" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-gray-700 pb-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'ALL'
              ? 'bg-[#12304A] dark:bg-[#0F766E] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          All Notifications ({total})
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-[#12304A] dark:bg-[#0F766E] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <NotificationSkeleton variant="page" count={4} />
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchList(page)}
            className="px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-900/70 text-rose-800 dark:text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700 p-12 text-center shadow-xs transition-colors">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-base font-bold text-[#12304A] dark:text-slate-50">
            {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {filter === 'UNREAD'
              ? 'You are all caught up! Switch to "All Notifications" to view your historical alerts.'
              : 'Updates regarding your requested, confirmed, and completed appointments will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map((notif) => {
            const isUnread = !notif.read_at;
            return (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUnread
                    ? 'bg-teal-50/30 dark:bg-teal-950/25 border-teal-200/80 dark:border-teal-800/70 shadow-xs'
                    : 'bg-white dark:bg-gray-800 border-slate-200/90 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 shadow-2xs shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#12304A] dark:text-slate-50">{notif.title}</h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#0D9488] dark:bg-[#2DD4BF]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{notif.created_at}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-slate-50 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-[#0D9488] dark:text-[#2DD4BF]" />
                      <span>Mark read</span>
                    </button>
                  )}
                  {notif.reference_id && (onSelectNotification || (notif.reference_type === 'appointments' && onNavigateToAppointments)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnread) handleMarkAsRead(notif.id);
                        if (onSelectNotification) {
                          onSelectNotification(notif);
                        } else {
                          onNavigateToAppointments?.(notif.reference_id);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-teal-600 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>{notif.reference_type === 'appointments' ? 'View Visit' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-gray-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
