import { useRealtimeContext } from '../contexts/RealtimeProvider';
import { CONNECTION_STATUS } from '../services/realtime/socket-events';

/**
 * Exposes current Socket.IO connection status safely even when rendered outside RealtimeProvider.
 */
export function useRealtimeConnection() {
  const ctx = useRealtimeContext();
  if (!ctx) {
    return {
      status: CONNECTION_STATUS.DISCONNECTED,
      isConnected: false,
    };
  }
  return {
    status: ctx.status,
    isConnected: ctx.isConnected,
  };
}
