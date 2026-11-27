import { useState, useEffect, useCallback } from 'react';
import { messagesApi } from '../api';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import { REALTIME_EVENTS } from '../../../services/realtime/socket-events';

/**
 * Lightweight unread messages badge sync for Patient & Dentist portal sidebars.
 * Strictly inert for Admin, Receptionist, and unauthenticated sessions.
 */
export function useUnreadMessagesBadge(isAuthenticated, role) {
  const normalizedRole = String(role || '').toUpperCase();
  const isEligible = Boolean(isAuthenticated && (normalizedRole === 'PATIENT' || normalizedRole === 'DENTIST'));
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isEligible) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await messagesApi.getUnreadCount();
      setUnreadCount(Number(count) || 0);
    } catch {
      // Non-fatal badge fetch
    }
  }, [isEligible]);

  useEffect(() => {
    if (!isEligible) {
      setUnreadCount(0);
      return undefined;
    }
    void refresh();

    const handleLocalUpdate = (event) => {
      const next = Number(event?.detail?.unreadCount);
      if (!Number.isNaN(next) && next >= 0) {
        setUnreadCount(next);
      }
    };
    window.addEventListener('toothcare:messages-unread', handleLocalUpdate);
    return () => {
      window.removeEventListener('toothcare:messages-unread', handleLocalUpdate);
    };
  }, [isEligible, refresh]);

  useRealtimeNotifications({
    onEvent: (eventType) => {
      if (!isEligible) return;
      if (eventType === REALTIME_EVENTS.MESSAGE_CREATED || eventType === REALTIME_EVENTS.MESSAGE_READ) {
        void refresh();
      }
    },
    onReconnect: () => {
      if (isEligible) {
        void refresh();
      }
    },
  });

  return isEligible ? unreadCount : 0;
}

export default useUnreadMessagesBadge;
