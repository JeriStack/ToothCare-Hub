/**
 * Centralized Real-Time Event Contract shared between PHP, Node.js, and React.
 */

export const ALLOWED_EVENT_TYPES = [
  'appointment.requested',
  'appointment.confirmed',
  'appointment.rejected',
  'appointment.cancelled',
  'notification.created',
] as const;

export type RealtimeEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export interface RealtimeEventPayload {
  eventId: string;
  eventType: RealtimeEventType;
  notificationId: number | null;
  appointmentId: number | null;
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
