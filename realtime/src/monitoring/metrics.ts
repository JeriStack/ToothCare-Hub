/**
 * Prometheus-compatible metrics collector for the Node.js Socket.IO service.
 * Strictly avoids high-cardinality or PII labels (no user IDs, appointment IDs, or emails).
 */
export class RealtimeMetrics {
  private readonly startedAtMs = Date.now();

  public activeConnections = 0;
  public authFailuresTotal = 0;
  public rejectedTicketsTotal = 0;
  public eventsReceivedTotal = 0;
  public eventsDeliveredTotal = 0;
  public eventsRejectedTotal = 0;
  public eventsDuplicateTotal = 0;
  public sessionRevocationsTotal = 0;
  public socketErrorsTotal = 0;
  public unauthorizedClientEventsTotal = 0;
  public connectionsTotal = 0;
  public eventDeliveryDurationMsSum = 0;
  public eventDeliveryDurationCount = 0;

  private readonly deliveredByType = new Map<string, number>();

  recordDelivered(eventType: string, durationMs: number = 0): void {
    this.eventsDeliveredTotal += 1;
    this.eventDeliveryDurationCount += 1;
    this.eventDeliveryDurationMsSum += Math.max(0, durationMs);
    const safeType = eventType.replace(/[^a-zA-Z0-9_.-]/g, '_');
    this.deliveredByType.set(safeType, (this.deliveredByType.get(safeType) ?? 0) + 1);
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAtMs) / 1000);
  }

  renderPrometheus(): string {
    const lines: string[] = [
      '# HELP toothcare_realtime_up Service availability indicator',
      '# TYPE toothcare_realtime_up gauge',
      'toothcare_realtime_up 1',
      '# HELP toothcare_realtime_uptime_seconds Realtime service uptime in seconds',
      '# TYPE toothcare_realtime_uptime_seconds gauge',
      `toothcare_realtime_uptime_seconds ${this.getUptimeSeconds()}`,
      '# HELP toothcare_realtime_active_connections Current active authenticated Socket.IO connections',
      '# TYPE toothcare_realtime_active_connections gauge',
      `toothcare_realtime_active_connections ${this.activeConnections}`,
      '# HELP toothcare_realtime_auth_failures_total Total Socket.IO handshake authentication failures',
      '# TYPE toothcare_realtime_auth_failures_total counter',
      `toothcare_realtime_auth_failures_total ${this.authFailuresTotal}`,
      '# HELP toothcare_realtime_rejected_tickets_total Total rejected connection tickets',
      '# TYPE toothcare_realtime_rejected_tickets_total counter',
      `toothcare_realtime_rejected_tickets_total ${this.rejectedTicketsTotal}`,
      '# HELP toothcare_realtime_events_received_total Total events received by the internal publisher endpoint',
      '# TYPE toothcare_realtime_events_received_total counter',
      `toothcare_realtime_events_received_total ${this.eventsReceivedTotal}`,
      '# HELP toothcare_realtime_events_delivered_total Total events delivered to authorized Socket.IO rooms',
      '# TYPE toothcare_realtime_events_delivered_total counter',
      `toothcare_realtime_events_delivered_total ${this.eventsDeliveredTotal}`,
      '# HELP toothcare_realtime_events_rejected_total Total publisher events rejected due to validation or auth',
      '# TYPE toothcare_realtime_events_rejected_total counter',
      `toothcare_realtime_events_rejected_total ${this.eventsRejectedTotal}`,
      '# HELP toothcare_realtime_events_duplicate_total Total duplicate event IDs suppressed idempotently',
      '# TYPE toothcare_realtime_events_duplicate_total counter',
      `toothcare_realtime_events_duplicate_total ${this.eventsDuplicateTotal}`,
      '# HELP toothcare_realtime_session_revocations_total Total sockets disconnected due to logout, expiration, or revocation',
      '# TYPE toothcare_realtime_session_revocations_total counter',
      `toothcare_realtime_session_revocations_total ${this.sessionRevocationsTotal}`,
      '# HELP toothcare_realtime_socket_errors_total Total Socket.IO runtime or transport errors',
      '# TYPE toothcare_realtime_socket_errors_total counter',
      `toothcare_realtime_socket_errors_total ${this.socketErrorsTotal}`,
      '# HELP toothcare_realtime_unauthorized_client_events_total Total blocked client-emitted privileged or room events',
      '# TYPE toothcare_realtime_unauthorized_client_events_total counter',
      `toothcare_realtime_unauthorized_client_events_total ${this.unauthorizedClientEventsTotal}`,
      '# HELP toothcare_realtime_connections_total Total authenticated Socket.IO connections established since startup',
      '# TYPE toothcare_realtime_connections_total counter',
      `toothcare_realtime_connections_total ${this.connectionsTotal}`,
      '# HELP toothcare_realtime_event_delivery_duration_ms_sum Cumulative event delivery processing duration in milliseconds',
      '# TYPE toothcare_realtime_event_delivery_duration_ms_sum counter',
      `toothcare_realtime_event_delivery_duration_ms_sum ${this.eventDeliveryDurationMsSum.toFixed(2)}`,
      '# HELP toothcare_realtime_event_delivery_duration_ms_count Total event deliveries timed',
      '# TYPE toothcare_realtime_event_delivery_duration_ms_count counter',
      `toothcare_realtime_event_delivery_duration_ms_count ${this.eventDeliveryDurationCount}`,
    ];

    if (this.deliveredByType.size > 0) {
      lines.push('# HELP toothcare_realtime_events_delivered_by_type_total Delivered events by approved event type');
      lines.push('# TYPE toothcare_realtime_events_delivered_by_type_total counter');
      for (const [type, count] of this.deliveredByType.entries()) {
        lines.push(`toothcare_realtime_events_delivered_by_type_total{event_type="${type}"} ${count}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }
}
