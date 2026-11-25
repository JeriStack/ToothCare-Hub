/**
 * Centralized Real-Time Event Contract (v1.0) shared between PHP, Node.js, and React.
 */

export const EVENT_CONTRACT_VERSION = '1.0';

export const REALTIME_EVENTS = Object.freeze({
  APPOINTMENT_REQUESTED: 'appointment.requested',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_REJECTED: 'appointment.rejected',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
  APPOINTMENT_UPDATED: 'appointment.updated',
  SCHEDULE_UPDATED: 'schedule.updated',
  SERVICE_UPDATED: 'service.updated',
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  NOTIFICATION_CREATED: 'notification.created',
});

export const SUBSCRIBED_REALTIME_EVENTS = Object.freeze(Object.values(REALTIME_EVENTS));

export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
});
