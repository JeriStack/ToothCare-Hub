/**
 * Centralized Real-Time Event Contract (matches PHP RealtimeOutboxService & Node.js Socket.IO).
 */

export const REALTIME_EVENTS = Object.freeze({
  APPOINTMENT_REQUESTED: 'appointment.requested',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_REJECTED: 'appointment.rejected',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  NOTIFICATION_CREATED: 'notification.created',
});

export const SUBSCRIBED_REALTIME_EVENTS = Object.freeze(Object.values(REALTIME_EVENTS));

export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
});
