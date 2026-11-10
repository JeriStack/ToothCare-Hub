import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import notificationsApi from '../api';

function getNotificationIcon(type) {
  switch (type) {
    case 'APPOINTMENT_REQUESTED':
      return <Clock className="w-5 h-5 text-amber-500" />;
    case 'APPOINTMENT_CONFIRMED':
      return <CheckCircle2 className="w-5 h-5 text-[#0D9488]" />;
    case 'APPOINTMENT_REJECTED':
      return <XCircle className="w-5 h-5 text-rose-500" />;
    case 'APPOINTMENT_CANCELLED':
      return <AlertTriangle className="w-5 h-5 text-slate-500" />;
    case 'APPOINTMENT_COMPLETED':
      return <Sparkles className="w-5 h-5 text-teal-600" />;
    case 'APPOINTMENT_RESCHEDULED':
      return <Calendar className="w-5 h-5 text-sky-500" />;
    default:
      return <Bell className="w-5 h-5 text-[#0D9488]" />;
  }
}

export function PatientNotificationsPage({ onNavigateToAppointments }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' or 'UNREAD'
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.getNotifications({ page: pageNum, per_page: 15 });
      setNotifications(res.items || []);
      setTotal(res.total || 0);
      setUnreadCount(res.unread_count || 0);
      setPage(res.page || 1);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(page);
  }, [page]);

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
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time status updates and appointment alerts for your clinical visits.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#0D9488] hover:border-teal-200 text-xs font-semibold shadow-2xs transition-colors"
          >
            <CheckCheck className="w-4 h-4 text-[#0D9488]" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'ALL'
              ? 'bg-[#12304A] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Notifications ({total})
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-[#12304A] text-white'
              : 'text-slate-600 hover:bg-slate-100'
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchList(page)}
            className="px-3 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold"
          >
            Retry
          </button>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-base font-bold text-[#12304A]">
            {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                    ? 'bg-teal-50/30 border-teal-200/80 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#12304A]">{notif.title}</h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
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
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                      <span>Mark read</span>
                    </button>
                  )}
                  {notif.reference_type === 'appointments' && notif.reference_id && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnread) handleMarkAsRead(notif.id);
                        onNavigateToAppointments?.(notif.reference_id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>View Visit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
