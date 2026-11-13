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

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        className="relative p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-slate-200/90 dark:border-gray-700 z-50 overflow-hidden text-slate-800 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-gray-900/70 border-b border-slate-200/80 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#12304A] dark:text-gray-50">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-200">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-700/80">
            {loading && notifications.length === 0 ? (
              <NotificationSkeleton variant="compact" count={3} />
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-600 dark:text-gray-300">No notifications yet</p>
                <p className="text-[11px] text-slate-400 dark:text-gray-400 mt-0.5">
                  You will receive updates here about your dental appointments.
                </p>
              </div>
            ) : (
              notifications.slice(0, 5).map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 px-4 flex items-start gap-3 cursor-pointer transition-colors ${
                      isUnread
                        ? 'bg-teal-50/40 dark:bg-teal-950/35 hover:bg-teal-50/70 dark:hover:bg-teal-950/55'
                        : 'hover:bg-slate-50 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-700 shadow-2xs shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs ${isUnread ? 'font-bold text-[#12304A] dark:text-gray-50' : 'font-medium text-slate-700 dark:text-gray-200'} truncate`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-gray-400 whitespace-nowrap shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#0D9488] dark:bg-teal-400 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 px-4 bg-slate-50 dark:bg-gray-900/70 border-t border-slate-200/80 dark:border-gray-700 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onViewAllNotifications?.();
                }}
                className="text-xs font-semibold text-[#0D9488] dark:text-teal-400 hover:text-[#0F766E] dark:hover:text-teal-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View all notifications</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
