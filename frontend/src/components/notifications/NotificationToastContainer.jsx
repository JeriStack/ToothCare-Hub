import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Settings,
  UserPlus,
  X,
} from 'lucide-react';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { REALTIME_EVENTS } from '../../services/realtime/socket-events';

const MAX_VISIBLE_TOASTS = 3;
const AUTO_DISMISS_MS = 6000;

/**
 * Safe, non-PII, non-clinical summary text derived solely from the authorized event contract.
 */
const EVENT_TOAST_META = {
  [REALTIME_EVENTS.APPOINTMENT_REQUESTED]: {
    title: 'New Appointment Request',
    body: 'An appointment request has been submitted and queued for review.',
    tone: 'amber',
    Icon: Clock,
  },
  [REALTIME_EVENTS.APPOINTMENT_CONFIRMED]: {
    title: 'Appointment Confirmed',
    body: 'An appointment schedule has been confirmed.',
    tone: 'teal',
    Icon: CheckCircle2,
  },
  [REALTIME_EVENTS.APPOINTMENT_REJECTED]: {
    title: 'Appointment Declined',
    body: 'An appointment request could not be approved.',
    tone: 'rose',
    Icon: XCircle,
  },
  [REALTIME_EVENTS.APPOINTMENT_CANCELLED]: {
    title: 'Appointment Cancelled',
    body: 'An appointment has been cancelled and schedules updated.',
    tone: 'slate',
    Icon: AlertTriangle,
  },
  [REALTIME_EVENTS.APPOINTMENT_RESCHEDULED]: {
    title: 'Appointment Rescheduled',
    body: 'An appointment has been moved to a new date or time.',
    tone: 'sky',
    Icon: Calendar,
  },
  [REALTIME_EVENTS.APPOINTMENT_UPDATED]: {
    title: 'Appointment Updated',
    body: 'An appointment status has been updated.',
    tone: 'teal',
    Icon: CheckCircle2,
  },
  [REALTIME_EVENTS.SCHEDULE_UPDATED]: {
    title: 'Schedule Updated',
    body: 'Dentist shift or time-off availability has changed.',
    tone: 'sky',
    Icon: Calendar,
  },
  [REALTIME_EVENTS.SERVICE_UPDATED]: {
    title: 'Dental Service Updated',
    body: 'The clinic dental service catalog has been updated.',
    tone: 'teal',
    Icon: Settings,
  },
  [REALTIME_EVENTS.ACCOUNT_CREATED]: {
    title: 'New Account Created',
    body: 'A new user or patient account has been registered.',
    tone: 'teal',
    Icon: UserPlus,
  },
  [REALTIME_EVENTS.ACCOUNT_UPDATED]: {
    title: 'Account Updated',
    body: 'An account status or role permission has been updated.',
    tone: 'amber',
    Icon: UserPlus,
  },
  [REALTIME_EVENTS.NOTIFICATION_CREATED]: {
    title: 'New Notification',
    body: 'You have a new update in your notification center.',
    tone: 'teal',
    Icon: Bell,
  },
};

const TONE_CLASSES = {
  teal: 'border-l-[#0D9488] dark:border-l-teal-400 text-[#0D9488] dark:text-teal-400',
  amber: 'border-l-amber-500 dark:border-l-amber-400 text-amber-600 dark:text-amber-400',
  rose: 'border-l-rose-500 dark:border-l-rose-400 text-rose-600 dark:text-rose-400',
  sky: 'border-l-sky-500 dark:border-l-sky-400 text-sky-600 dark:text-sky-400',
  slate: 'border-l-slate-500 dark:border-l-slate-400 text-slate-600 dark:text-slate-300',
};

/**
 * Non-intrusive, accessible real-time Toast Notification container shared across all 4 roles.
 * Deduplicates by eventId, never displays PII/clinical text, supports dismissal & reduced motion.
 */
export function NotificationToastContainer({ autoDismissMs = AUTO_DISMISS_MS }) {
  const [toasts, setToasts] = useState([]);
  const seenIdsRef = useRef(new Set());
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useRealtimeNotifications({
    onEvent: (eventType, payload) => {
      // Only show toasts for persisted user-facing notifications (skip silent self-sync events)
      if (payload && payload.notificationId === null && eventType !== REALTIME_EVENTS.NOTIFICATION_CREATED) {
        return;
      }

      const dedupKey = payload?.eventId || `${eventType}:${payload?.notificationId || Date.now()}`;
      if (seenIdsRef.current.has(dedupKey)) {
        return;
      }
      if (seenIdsRef.current.size >= 200) {
        const oldest = seenIdsRef.current.values().next().value;
        if (oldest) seenIdsRef.current.delete(oldest);
      }
      seenIdsRef.current.add(dedupKey);

      const meta = EVENT_TOAST_META[eventType] || EVENT_TOAST_META[REALTIME_EVENTS.NOTIFICATION_CREATED];
      const toastId = dedupKey;

      setToasts((prev) => {
        const next = [
          {
            id: toastId,
            eventType,
            title: meta.title,
            body: meta.body,
            tone: meta.tone,
            Icon: meta.Icon,
          },
          ...prev,
        ];
        return next.slice(0, MAX_VISIBLE_TOASTS);
      });

      if (autoDismissMs > 0) {
        const timer = setTimeout(() => {
          dismiss(toastId);
        }, autoDismissMs);
        timersRef.current.set(toastId, timer);
      }
    },
  });

  useEffect(() => {
    const map = timersRef.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Live notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon = toast.Icon;
        const toneClass = TONE_CLASSES[toast.tone] || TONE_CLASSES.teal;
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            data-testid="realtime-notification-toast"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 border-l-4 ${toneClass} shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-200`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#12304A] dark:text-gray-50 leading-snug">
                {toast.title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                {toast.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={`Dismiss ${toast.title}`}
              className="tch-tap inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationToastContainer;
