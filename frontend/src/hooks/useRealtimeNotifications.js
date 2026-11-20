import { useEffect, useRef } from 'react';
import { useRealtimeContext } from '../contexts/RealtimeProvider';

/**
 * Subscribes a component or hook to deduplicated real-time notification events
 * and reconnect recovery triggers, with automatic listener cleanup on unmount.
 */
export function useRealtimeNotifications({ onEvent, onReconnect } = {}) {
  const ctx = useRealtimeContext();
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!ctx) return undefined;

    const unsubEvent = ctx.subscribe((eventType, payload) => {
      onEventRef.current?.(eventType, payload);
    });
    const unsubReconnect = ctx.onReconnect(() => {
      onReconnectRef.current?.();
    });

    return () => {
      unsubEvent();
      unsubReconnect();
    };
  }, [ctx]);

  return {
    status: ctx?.status || 'disconnected',
    isConnected: Boolean(ctx?.isConnected),
    lastEvent: ctx?.lastEvent || null,
  };
}
