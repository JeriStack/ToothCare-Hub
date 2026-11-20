import { Server } from 'socket.io';
import { InternalPublishEnvelope } from './event-types';
import { RoomManager } from '../rooms/room-manager';
import { RealtimeMetrics } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/logger';

export interface EventDeliveryResult {
  delivered: boolean;
  duplicate: boolean;
  targetRoom: string;
}

/**
 * Delivers validated server-side events to authorized user rooms with bounded TTL deduplication.
 * Prevents duplicate broadcasts when an outbox worker retries an event that was already delivered.
 */
export class RealtimeEventHandler {
  private readonly seenEvents = new Map<string, number>();

  constructor(
    private readonly io: Server,
    private readonly metrics: RealtimeMetrics,
    private readonly logger: StructuredLogger,
    private readonly dedupTtlMs: number = 300000,
    private readonly dedupMaxSize: number = 10000
  ) {}

  handleValidatedEvent(envelope: InternalPublishEnvelope, correlationId: string): EventDeliveryResult {
    const now = Date.now();
    this.pruneDedupCache(now);

    const targetRoom = RoomManager.userRoom(envelope.recipientUserId);

    if (this.seenEvents.has(envelope.eventId)) {
      this.metrics.eventsDuplicateTotal += 1;
      this.logger.debug('Suppressed duplicate realtime event', {
        correlationId,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      });
      return { delivered: true, duplicate: true, targetRoom };
    }

    // Bound memory usage strictly
    if (this.seenEvents.size >= this.dedupMaxSize) {
      const oldestKey = this.seenEvents.keys().next().value;
      if (oldestKey) {
        this.seenEvents.delete(oldestKey);
      }
    }
    this.seenEvents.set(envelope.eventId, now + this.dedupTtlMs);

    // Emit the specific event type AND notify listeners subscribed to the normalized contract
    this.io.to(targetRoom).emit(envelope.eventType, envelope.payload);
    this.metrics.recordDelivered(envelope.eventType);

    this.logger.info('Delivered realtime event to authorized user room', {
      correlationId,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
    });

    return { delivered: true, duplicate: false, targetRoom };
  }

  private pruneDedupCache(now: number): void {
    for (const [eventId, expiresAt] of this.seenEvents.entries()) {
      if (expiresAt <= now) {
        this.seenEvents.delete(eventId);
      }
    }
  }
}
