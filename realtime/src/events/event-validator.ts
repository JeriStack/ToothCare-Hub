import {
  ALLOWED_ENTITY_TYPES,
  ALLOWED_EVENT_TYPES,
  EVENT_CONTRACT_VERSION,
  InternalPublishEnvelope,
  RealtimeEntityType,
  RealtimeEventType,
} from './event-types';

const ALLOWED_SET = new Set<string>(ALLOWED_EVENT_TYPES);
const ALLOWED_ENTITY_SET = new Set<string>(ALLOWED_ENTITY_TYPES);

/**
 * Fields that MUST NEVER appear in a real-time event payload (privacy & security guard).
 */
const FORBIDDEN_FIELDS = new Set<string>([
  'password',
  'password_hash',
  'passwordHash',
  'smtp_password',
  'smtpPassword',
  'token',
  'ticket',
  'session_id',
  'sessionId',
  'diagnosis',
  'procedure_notes',
  'procedureNotes',
  'clinical_notes',
  'clinicalNotes',
  'treatment_notes',
  'treatmentNotes',
  'prescription_notes',
  'prescriptionNotes',
  'chief_complaint',
  'chiefComplaint',
  'medical_alerts',
  'medicalAlerts',
  'email',
  'phone',
  'address',
]);

export interface EventValidationResult {
  valid: boolean;
  error?: string;
  envelope?: InternalPublishEnvelope;
}

export function validatePublishEnvelope(raw: unknown): EventValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Envelope must be a JSON object.' };
  }

  const obj = raw as Record<string, unknown>;
  const eventId = typeof obj.eventId === 'string' ? obj.eventId.trim() : '';
  if (eventId.length < 8 || eventId.length > 64) {
    return { valid: false, error: 'eventId must be a string between 8 and 64 characters.' };
  }

  const eventType = typeof obj.eventType === 'string' ? obj.eventType.trim() : '';
  if (!ALLOWED_SET.has(eventType)) {
    return { valid: false, error: `Disallowed eventType: ${eventType || '(empty)'}` };
  }

  const recipientUserId = Number(obj.recipientUserId);
  if (!Number.isInteger(recipientUserId) || recipientUserId <= 0) {
    return { valid: false, error: 'recipientUserId must be a positive integer.' };
  }

  const payloadRaw = obj.payload;
  if (!payloadRaw || typeof payloadRaw !== 'object' || Array.isArray(payloadRaw)) {
    return { valid: false, error: 'payload must be a JSON object.' };
  }

  const payload = payloadRaw as Record<string, unknown>;

  // Reject any forbidden clinical, credential, or PII field at top-level of payload
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      return { valid: false, error: `Forbidden sensitive field in payload: ${key}` };
    }
  }

  const payloadEventId = typeof payload.eventId === 'string' ? payload.eventId.trim() : '';
  if (payloadEventId !== eventId) {
    return { valid: false, error: 'payload.eventId must match envelope.eventId.' };
  }

  const payloadEventType = typeof payload.eventType === 'string' ? payload.eventType.trim() : '';
  if (payloadEventType !== eventType) {
    return { valid: false, error: 'payload.eventType must match envelope.eventType.' };
  }

  const eventVersion =
    typeof payload.eventVersion === 'string' && payload.eventVersion.trim() !== ''
      ? payload.eventVersion.trim()
      : EVENT_CONTRACT_VERSION;

  const notificationId =
    payload.notificationId === null || payload.notificationId === undefined
      ? null
      : Number(payload.notificationId);
  if (notificationId !== null && (!Number.isInteger(notificationId) || notificationId <= 0)) {
    return { valid: false, error: 'payload.notificationId must be a positive integer or null.' };
  }

  const appointmentId =
    payload.appointmentId === null || payload.appointmentId === undefined
      ? null
      : Number(payload.appointmentId);
  if (appointmentId !== null && (!Number.isInteger(appointmentId) || appointmentId <= 0)) {
    return { valid: false, error: 'payload.appointmentId must be a positive integer or null.' };
  }

  const rawEntityType =
    typeof payload.entityType === 'string' && payload.entityType.trim() !== ''
      ? payload.entityType.trim().toLowerCase()
      : appointmentId !== null
      ? 'appointments'
      : 'notifications';
  if (!ALLOWED_ENTITY_SET.has(rawEntityType)) {
    return { valid: false, error: `Disallowed payload.entityType: ${rawEntityType}` };
  }

  const entityId =
    payload.entityId === null || payload.entityId === undefined
      ? (appointmentId ?? notificationId)
      : Number(payload.entityId);
  if (entityId !== null && (!Number.isInteger(entityId) || entityId <= 0)) {
    return { valid: false, error: 'payload.entityId must be a positive integer or null.' };
  }

  const status =
    payload.status === null || payload.status === undefined
      ? null
      : typeof payload.status === 'string'
      ? payload.status.trim().toLowerCase()
      : null;

  const occurredAt = typeof payload.occurredAt === 'string' ? payload.occurredAt.trim() : '';
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    return { valid: false, error: 'payload.occurredAt must be a valid ISO-8601 timestamp.' };
  }

  // Construct strictly sanitized minimal payload
  return {
    valid: true,
    envelope: {
      eventId,
      eventType: eventType as RealtimeEventType,
      recipientUserId,
      payload: {
        eventId,
        eventType: eventType as RealtimeEventType,
        eventVersion,
        notificationId,
        appointmentId,
        entityType: rawEntityType as RealtimeEntityType,
        entityId,
        status,
        occurredAt,
      },
    },
  };
}
