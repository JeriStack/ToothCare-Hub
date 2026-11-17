import React, { useState, useRef, useEffect } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationSkeleton } from '../../../components/skeletons';

function getNotificationIcon(type) {
  switch (type) {
    case 'APPOINTMENT_REQUESTED':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'APPOINTMENT_CONFIRMED':
      return <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />;
    case 'APPOINTMENT_REJECTED':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'APPOINTMENT_CANCELLED':
      return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    case 'APPOINTMENT_COMPLETED':
      return <Sparkles className="w-4 h-4 text-teal-600" />;
    case 'APPOINTMENT_RESCHEDULED':
      return <Calendar className="w-4 h-4 text-sky-500" />;
    default:
      return <Bell className="w-4 h-4 text-[#0D9488]" />;
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function NotificationCenter({ onNavigateToAppointments, onViewAllNotifications }) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications(20000);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on outside click or Escape (returning focus to the bell trigger)
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (notif) => {
    if (!notif.read_at) {
      markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.reference_type === 'appointments' && onNavigateToAppointments) {
      onNavigateToAppointments(notif.reference_id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-panel"
        className="relative inline-flex items-center justify-center min-h-11 min-w-11 p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm motion-safe:animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel: viewport-pinned sheet on phones, anchored popover from sm+ */}
      {isOpen && (
        <div
          id="notification-panel"
          className="fixed left-3 right-3 top-[4.25rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-slate-200/90 dark:border-gray-700 z-50 overflow-hidden text-slate-800 dark:text-gray-100"
        >
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-gray-900/70 border-b border-slate-200/80 dark:border-gray-700 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-bold text-[#12304A] dark:text-gray-50">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-200 whitespace-nowrap">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="min-h-11 sm:min-h-0 text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 rounded-md"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[min(20rem,calc(100dvh-14rem))] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-gray-700/80">
            {loading && notifications.length === 0 ? (
              <NotificationSkeleton variant="compact" count={3} />
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2 stroke-[1.5]" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-600 dark:text-gray-300">No notifications yet</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                  You will receive updates here about your dental appointments.
                </p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleItemClick(notif)}
                    aria-label={`${isUnread ? 'Unread: ' : ''}${notif.title}`}
                    className={`w-full min-h-11 p-3.5 px-4 flex items-start gap-3 text-left cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
                      isUnread
                        ? 'bg-teal-50/40 dark:bg-teal-950/35 hover:bg-teal-50/70 dark:hover:bg-teal-950/55'
                        : 'hover:bg-slate-50 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-700 shadow-sm shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className={`text-xs ${isUnread ? 'font-bold text-[#12304A] dark:text-gray-50' : 'font-medium text-slate-700 dark:text-gray-200'} break-words min-w-0`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 line-clamp-2 leading-relaxed break-words">
                        {notif.message}
                      </p>
                    </div>
                    {isUnread && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-[#0D9488] dark:bg-teal-400 ring-2 ring-white dark:ring-gray-800 shrink-0 mt-1.5"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-1.5 px-4 bg-slate-50 dark:bg-gray-900/70 border-t border-slate-200/80 dark:border-gray-700 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onViewAllNotifications?.();
                }}
                className="min-h-11 text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 rounded-md px-2"
              >
                <span>View all notifications</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
