import React from 'react';
import { useRealtimeConnection } from '../../hooks/useRealtimeConnection';
import { CONNECTION_STATUS } from '../../services/realtime/socket-events';

const STATUS_META = {
  [CONNECTION_STATUS.CONNECTED]: {
    label: 'Live',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    pillClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/70',
  },
  [CONNECTION_STATUS.CONNECTING]: {
    label: 'Connecting',
    dotClass: 'bg-amber-500 dark:bg-amber-400 motion-safe:animate-pulse',
    pillClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/70',
  },
  [CONNECTION_STATUS.RECONNECTING]: {
    label: 'Reconnecting',
    dotClass: 'bg-amber-500 dark:bg-amber-400 motion-safe:animate-pulse',
    pillClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/70',
  },
  [CONNECTION_STATUS.DISCONNECTED]: {
    label: 'Sync mode',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    pillClass: 'bg-slate-100 dark:bg-gray-700/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-600',
  },
};

/**
 * Subtle, non-alarming real-time connection status indicator.
 * Works across Light and Dark modes and mobile/desktop layouts.
 */
export function ConnectionStatus({ className = '' }) {
  const { status } = useRealtimeConnection();
  const meta = STATUS_META[status] || STATUS_META[CONNECTION_STATUS.DISCONNECTED];

  return (
    <span
      data-testid="realtime-connection-status"
      data-status={status}
      title={`Real-time updates: ${meta.label}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide whitespace-nowrap ${meta.pillClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export default ConnectionStatus;
