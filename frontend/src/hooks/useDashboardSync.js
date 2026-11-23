import { useEffect, useRef } from 'react';
import { useRealtimeContext } from '../contexts/RealtimeProvider';
import {
  dashboardSyncMetrics,
  isValidRealtimeEvent,
  resolveAffectedDomains,
} from '../services/realtime/dashboardSync';

const MAX_SEEN_SYNC_EVENTS = 250;

/**
 * Centralized Real-Time Dashboard Synchronization Hook.
 *
 * Subscribes a dashboard or live view to its authorized data domains, validates incoming
 * event contracts, deduplicates at-least-once deliveries, batches rapid event bursts via
 * debouncing, guards against stale overlapping requests, and refreshes on reconnect.
 *
 * Never triggers full-page reloads.
 */
export function useDashboardSync({
  domains = [],
  onRefresh,
  role = null,
  debounceMs = 250,
  refreshOnReconnect = true,
  enabled = true,
} = {}) {
  const ctx = useRealtimeContext();
  const subscribe = ctx?.subscribe;
  const onReconnect = ctx?.onReconnect;
  const resolvedRole = role || null;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const domainsKey = Array.isArray(domains) ? domains.join('|') : '';
  const seenEventIdsRef = useRef(new Set());
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !subscribe || !domainsKey) {
      return undefined;
    }

    const subscribedSet = new Set(domainsKey.split('|').filter(Boolean));

    const scheduleRefresh = (reason, meta = {}) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const execute = async () => {
        timerRef.current = null;
        const callSeq = ++seqRef.current;
        dashboardSyncMetrics.refreshesTriggered += 1;
        try {
          await onRefreshRef.current?.({ reason, seq: callSeq, ...meta });
        } catch {
          dashboardSyncMetrics.refreshFailures += 1;
        }
      };

      if (debounceMs <= 0) {
        void execute();
      } else {
        timerRef.current = setTimeout(() => {
          void execute();
        }, debounceMs);
      }
    };

    const unsubEvent = subscribe((eventType, payload) => {
      if (!isValidRealtimeEvent(eventType, payload)) {
        return;
      }

      const eventId = payload?.eventId;
      if (eventId) {
        if (seenEventIdsRef.current.has(eventId)) {
          dashboardSyncMetrics.duplicatesSuppressed += 1;
          return;
        }
        if (seenEventIdsRef.current.size >= MAX_SEEN_SYNC_EVENTS) {
          const oldest = seenEventIdsRef.current.values().next().value;
          if (oldest) seenEventIdsRef.current.delete(oldest);
        }
        seenEventIdsRef.current.add(eventId);
      }

      const affected = resolveAffectedDomains(eventType, resolvedRole);
      const matched = affected.filter((d) => subscribedSet.has(d));
      if (matched.length === 0) {
        return;
      }

      dashboardSyncMetrics.eventsProcessed += 1;
      scheduleRefresh('event', { eventType, payload, domains: matched });
    });

    const unsubReconnect =
      refreshOnReconnect && onReconnect
        ? onReconnect(() => {
            scheduleRefresh('reconnect', { domains: Array.from(subscribedSet) });
          })
        : () => {};

    return () => {
      unsubEvent();
      unsubReconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [subscribe, onReconnect, domainsKey, resolvedRole, debounceMs, refreshOnReconnect, enabled]);

  return {
    status: ctx?.status || 'disconnected',
    isConnected: Boolean(ctx?.isConnected),
  };
}

export default useDashboardSync;
