import { Socket } from 'socket.io';
import { RealtimeMetrics } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/logger';

/**
 * Default-deny authorization middleware for inbound client socket events.
 * Clients are read-only subscribers: they must NEVER join arbitrary rooms or
 * trigger privileged business or notification events over Socket.IO.
 */
const ALLOWED_CLIENT_EVENTS = new Set<string>(['realtime:ping']);

export function attachAuthorizationGuard(
  socket: Socket,
  metrics: RealtimeMetrics,
  logger: StructuredLogger
): void {
  socket.onAny((eventName: string, ...args: unknown[]) => {
    if (ALLOWED_CLIENT_EVENTS.has(eventName)) {
      const ack = args.length > 0 && typeof args[args.length - 1] === 'function'
        ? (args[args.length - 1] as (resp: unknown) => void)
        : null;
      if (ack) {
        ack({ ok: true, timestamp: new Date().toISOString() });
      }
      return;
    }

    metrics.unauthorizedClientEventsTotal += 1;
    logger.warn('Blocked unauthorized client-emitted socket event', {
      socketId: socket.id,
      eventName,
    });

    const ack = args.length > 0 && typeof args[args.length - 1] === 'function'
      ? (args[args.length - 1] as (resp: unknown) => void)
      : null;
    if (ack) {
      ack({ ok: false, error: 'FORBIDDEN_CLIENT_EVENT' });
    }
    socket.emit('realtime:error', {
      code: 'FORBIDDEN_CLIENT_EVENT',
      message: 'Client-initiated room or business events are not permitted.',
    });
  });
}
