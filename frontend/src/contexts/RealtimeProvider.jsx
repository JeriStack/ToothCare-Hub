import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../features/auth';
import { RealtimeSocketClient, sharedRealtimeClient } from '../services/realtime/socket-client';
import { CONNECTION_STATUS } from '../services/realtime/socket-events';

const RealtimeContext = createContext(null);

const MAX_SEEN_EVENT_IDS = 500;

export function RealtimeProvider({ children, client = sharedRealtimeClient }) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [lastEvent, setLastEvent] = useState(null);

  const clientRef = useRef(client instanceof RealtimeSocketClient ? client : sharedRealtimeClient);
  const seenEventIdsRef = useRef(new Set());
  const eventSubscribersRef = useRef(new Set());
  const reconnectSubscribersRef = useRef(new Set());

  const subscribe = useCallback((handler) => {
    eventSubscribersRef.current.add(handler);
    return () => {
      eventSubscribersRef.current.delete(handler);
    };
  }, []);

  const onReconnect = useCallback((handler) => {
    reconnectSubscribersRef.current.add(handler);
    return () => {
      reconnectSubscribersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    const rtClient = clientRef.current;

    const offStatus = rtClient.onStatusChange((nextStatus) => {
      setStatus(nextStatus);
    });

    const offEvent = rtClient.onEvent((eventType, payload) => {
      const eventId = payload?.eventId;
      if (eventId) {
        if (seenEventIdsRef.current.has(eventId)) {
          return; // Deduplicate at-least-once deliveries
        }
        if (seenEventIdsRef.current.size >= MAX_SEEN_EVENT_IDS) {
          const oldest = seenEventIdsRef.current.values().next().value;
          if (oldest) seenEventIdsRef.current.delete(oldest);
        }
        seenEventIdsRef.current.add(eventId);
      }

      const envelope = { eventType, payload, receivedAt: Date.now() };
      setLastEvent(envelope);

      eventSubscribersRef.current.forEach((fn) => {
        try {
          fn(eventType, payload);
        } catch {
          // Isolate subscriber errors
        }
      });
    });

    const offReconnect = rtClient.onReconnect(() => {
      try {
        window.dispatchEvent(new CustomEvent('toothcare:permissions-refresh'));
      } catch {
        // Ignore in non-browser environments
      }
      reconnectSubscribersRef.current.forEach((fn) => {
        try {
          fn();
        } catch {
          // Isolate subscriber errors
        }
      });
    });

    const handleUnauthorized = () => {
      rtClient.disconnect();
      seenEventIdsRef.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user?.id) {
        if (rtClient.getStatus() === CONNECTION_STATUS.DISCONNECTED) {
          void rtClient.connect();
        } else if (rtClient.getStatus() === CONNECTION_STATUS.CONNECTED) {
          // Reconcile notifications when user returns to tab
          reconnectSubscribersRef.current.forEach((fn) => {
            try {
              fn();
            } catch {
              // Ignore
            }
          });
        }
      }
    };

    window.addEventListener('toothcare:unauthorized', handleUnauthorized);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isAuthenticated && user?.id) {
      void rtClient.connect();
    } else {
      rtClient.disconnect();
      seenEventIdsRef.current.clear();
    }

    return () => {
      offStatus();
      offEvent();
      offReconnect();
      window.removeEventListener('toothcare:unauthorized', handleUnauthorized);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      rtClient.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  const value = useMemo(
    () => ({
      status,
      isConnected: status === CONNECTION_STATUS.CONNECTED,
      lastEvent,
      subscribe,
      onReconnect,
    }),
    [status, lastEvent, subscribe, onReconnect]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}
