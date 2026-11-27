/**
 * Centralized Real-Time Event Contract (v1.0) shared between PHP, Node.js, and React.
 */

export const EVENT_CONTRACT_VERSION = '1.0';

export const ALLOWED_EVENT_TYPES = [
  'appointment.requested',
  'appointment.confirmed',
  'appointment.rejected',
  'appointment.cancelled',
  'appointment.rescheduled',
  'appointment.updated',
  'schedule.updated',
  'service.updated',
  'account.created',
  'account.updated',
  'notification.created',
  'message.created',
  'message.delivered',
  'message.read',
  'message.typing',
] as const;

export type RealtimeEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export const ALLOWED_ENTITY_TYPES = [
  'appointments',
  'schedules',
  'services',
  'accounts',
  'notifications',
  'messages',
] as const;

export type RealtimeEntityType = (typeof ALLOWED_ENTITY_TYPES)[number];

export interface RealtimeEventPayload {
  eventId: string;
  eventType: RealtimeEventType;
  eventVersion: string;
  notificationId: number | null;
  appointmentId: number | null;
  conversationId?: number | null;
  entityType: RealtimeEntityType;
  entityId: number | null;
  status: string | null;
  occurredAt: string;
}

export interface InternalPublishEnvelope {
  eventId: string;
  eventType: RealtimeEventType;
  recipientUserId: number;
  payload: RealtimeEventPayload;
}

export interface VerifiedUserIdentity {
  userId: number;
  role: 'ADMIN' | 'RECEPTIONIST' | 'DENTIST' | 'PATIENT';
  dentistId: number | null;
  permissions: string[];
  sessionIdHash: string | null;
}

export interface RevocationRequest {
  userId?: number;
  sessionIdHash?: string | null;
  role?: string;
  reason: string;
}
