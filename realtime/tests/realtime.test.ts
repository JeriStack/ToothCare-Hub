import test from 'node:test';
import assert from 'node:assert/strict';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { loadEnvironment } from '../src/config/environment';
import { createRealtimeService, RealtimeServiceInstance } from '../src/services/socket.service';
import { TicketValidator, TicketValidationOutcome } from '../src/auth/ticket-validator';
import { SessionValidator } from '../src/auth/session-validator';
import { VerifiedUserIdentity } from '../src/events/event-types';
import { validatePublishEnvelope } from '../src/events/event-validator';
import { RoomManager } from '../src/rooms/room-manager';

const TEST_SECRET = 'test-internal-secret-32-bytes-minimum-ok';

class InMemoryTicketValidator implements TicketValidator {
  private readonly tickets = new Map<
    string,
    { identity: VerifiedUserIdentity; expiresAtMs: number; used: boolean; revoked: boolean; inactive?: boolean }
  >();

  register(
    rawTicket: string,
    identity: VerifiedUserIdentity,
    opts: { expiresInMs?: number; revoked?: boolean; inactive?: boolean } = {}
  ): void {
    this.tickets.set(rawTicket, {
      identity,
      expiresAtMs: Date.now() + (opts.expiresInMs ?? 60_000),
      used: false,
      revoked: Boolean(opts.revoked),
      inactive: Boolean(opts.inactive),
    });
  }

  async validateTicket(rawTicket: string): Promise<TicketValidationOutcome> {
    const rec = this.tickets.get(rawTicket);
    if (!rec) return { valid: false, errorCode: 'TICKET_INVALID' };
    if (rec.revoked) return { valid: false, errorCode: 'TICKET_REVOKED' };
    if (rec.used) return { valid: false, errorCode: 'TICKET_ALREADY_USED' };
    if (rec.expiresAtMs <= Date.now()) return { valid: false, errorCode: 'TICKET_EXPIRED' };
    if (rec.inactive) return { valid: false, errorCode: 'ACCOUNT_DISABLED' };
    rec.used = true;
    return { valid: true, identity: rec.identity };
  }
}

class StaticSessionValidator implements SessionValidator {
  async revalidateUser(userId: number, sessionIdHash: string | null) {
    return {
      active: true,
      identity: {
        userId,
        role: 'PATIENT' as const,
        dentistId: null,
        permissions: [],
        sessionIdHash,
      },
    };
  }
}

function makeHexTicket(prefix: string): string {
  return (prefix + '0'.repeat(64)).slice(0, 64);
}

async function startTestServer(): Promise<{
  service: RealtimeServiceInstance;
  port: number;
  tickets: InMemoryTicketValidator;
}> {
  const tickets = new InMemoryTicketValidator();
  const env = loadEnvironment({
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    REALTIME_INTERNAL_SECRET: TEST_SECRET,
    LOG_LEVEL: 'silent',
    SESSION_REVALIDATE_INTERVAL_MS: '600000',
  });
  const service = createRealtimeService(env, {
    ticketValidator: tickets,
    sessionValidator: new StaticSessionValidator(),
  });
  const { port } = await service.start();
  return { service, port, tickets };
}

function connectSocket(port: number, auth?: Record<string, unknown>, query?: Record<string, string>): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}`, {
      path: '/socket.io/',
      transports: ['websocket'],
      reconnection: false,
      auth,
      query,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

test('RoomManager computes strictly authorized server-controlled rooms per role', () => {
  const patientRooms = RoomManager.computeAuthorizedRooms({
    userId: 10,
    role: 'PATIENT',
    dentistId: null,
    permissions: ['appointments.book'],
    sessionIdHash: null,
  });
  assert.deepEqual(patientRooms.sort(), ['role:patient', 'user:10']);

  const dentistRooms = RoomManager.computeAuthorizedRooms({
    userId: 20,
    role: 'DENTIST',
    dentistId: 7,
    permissions: ['appointments.view'],
    sessionIdHash: null,
  });
  assert.deepEqual(dentistRooms.sort(), ['dentist:7', 'role:dentist', 'user:20']);

  const receptionistWithPerm = RoomManager.computeAuthorizedRooms({
    userId: 30,
    role: 'RECEPTIONIST',
    dentistId: null,
    permissions: ['appointments.view'],
    sessionIdHash: null,
  });
  assert.ok(receptionistWithPerm.includes('receptionist:notifications'));
  assert.ok(!receptionistWithPerm.includes('admin:notifications'));

  const receptionistWithoutPerm = RoomManager.computeAuthorizedRooms({
    userId: 31,
    role: 'RECEPTIONIST',
    dentistId: null,
    permissions: [],
    sessionIdHash: null,
  });
  assert.ok(!receptionistWithoutPerm.includes('receptionist:notifications'));
});

test('Event validator enforces allowlist and rejects clinical/PII payload fields', () => {
  const valid = validatePublishEnvelope({
    eventId: 'evt-12345678',
    eventType: 'appointment.confirmed',
    recipientUserId: 10,
    payload: {
      eventId: 'evt-12345678',
      eventType: 'appointment.confirmed',
      notificationId: 55,
      appointmentId: 99,
      status: 'confirmed',
      occurredAt: '2026-11-20T10:30:00Z',
    },
  });
  assert.equal(valid.valid, true);

  const forged = validatePublishEnvelope({
    eventId: 'evt-12345678',
    eventType: 'appointment.hacked',
    recipientUserId: 10,
    payload: {
      eventId: 'evt-12345678',
      eventType: 'appointment.hacked',
      notificationId: 55,
      appointmentId: 99,
      status: 'confirmed',
      occurredAt: '2026-11-20T10:30:00Z',
    },
  });
  assert.equal(forged.valid, false);

  const withClinicalLeak = validatePublishEnvelope({
    eventId: 'evt-12345678',
    eventType: 'appointment.confirmed',
    recipientUserId: 10,
    payload: {
      eventId: 'evt-12345678',
      eventType: 'appointment.confirmed',
      notificationId: 55,
      appointmentId: 99,
      status: 'confirmed',
      occurredAt: '2026-11-20T10:30:00Z',
      diagnosis: 'Acute pulpitis',
    },
  });
  assert.equal(withClinicalLeak.valid, false);

  const schedValid = validatePublishEnvelope({
    eventId: 'evt-sched-0001',
    eventType: 'schedule.updated',
    recipientUserId: 12,
    payload: {
      eventId: 'evt-sched-0001',
      eventType: 'schedule.updated',
      eventVersion: '1.0',
      notificationId: 88,
      appointmentId: null,
      entityType: 'schedules',
      entityId: 45,
      status: 'updated',
      occurredAt: '2026-11-23T12:00:00Z',
    },
  });
  assert.equal(schedValid.valid, true);
  assert.equal(schedValid.envelope?.payload.eventVersion, '1.0');
  assert.equal(schedValid.envelope?.payload.entityType, 'schedules');
  assert.equal(schedValid.envelope?.payload.entityId, 45);

  const withSmtpLeak = validatePublishEnvelope({
    eventId: 'evt-cred-0001',
    eventType: 'account.updated',
    recipientUserId: 12,
    payload: {
      eventId: 'evt-cred-0001',
      eventType: 'account.updated',
      notificationId: null,
      appointmentId: null,
      smtp_password: 'secret',
      occurredAt: '2026-11-23T12:00:00Z',
    },
  });
  assert.equal(withSmtpLeak.valid, false);
});

test('Socket.IO handshake authentication enforces single-use, unexpired, unrevoked, non-query tickets', async () => {
  const { service, port, tickets } = await startTestServer();
  try {
    // 1. Missing ticket rejected
    await assert.rejects(() => connectSocket(port, {}), /TICKET_MISSING/);

    // 2. Invalid ticket rejected
    await assert.rejects(() => connectSocket(port, { ticket: makeHexTicket('deadbeef') }), /TICKET_INVALID/);

    // 3. Query string ticket rejected even if valid
    const qTicket = makeHexTicket('aaaa1111');
    tickets.register(qTicket, { userId: 1, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 's1' });
    await assert.rejects(() => connectSocket(port, { ticket: qTicket }, { ticket: qTicket }), /TICKET_IN_QUERY_FORBIDDEN/);

    // 4. Expired ticket rejected
    const expTicket = makeHexTicket('bbbb2222');
    tickets.register(expTicket, { userId: 1, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 's1' }, { expiresInMs: -1000 });
    await assert.rejects(() => connectSocket(port, { ticket: expTicket }), /TICKET_EXPIRED/);

    // 5. Revoked ticket rejected
    const revTicket = makeHexTicket('cccc3333');
    tickets.register(revTicket, { userId: 1, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 's1' }, { revoked: true });
    await assert.rejects(() => connectSocket(port, { ticket: revTicket }), /TICKET_REVOKED/);

    // 6. Inactive user rejected
    const inactiveTicket = makeHexTicket('dddd4444');
    tickets.register(inactiveTicket, { userId: 2, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 's2' }, { inactive: true });
    await assert.rejects(() => connectSocket(port, { ticket: inactiveTicket }), /ACCOUNT_DISABLED/);

    // 7. Valid ticket succeeds once, second reuse is rejected
    const validTicket = makeHexTicket('eeee5555');
    tickets.register(validTicket, { userId: 10, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 's10' });
    const client = await connectSocket(port, { ticket: validTicket });
    assert.equal(client.connected, true);
    await assert.rejects(() => connectSocket(port, { ticket: validTicket }), /TICKET_ALREADY_USED/);
    client.close();
  } finally {
    await service.close();
  }
});

test('Room isolation, signed publishing, replay protection, idempotency, client event blocking, and revocation', async () => {
  const { service, port, tickets } = await startTestServer();
  let clientA: ClientSocket | null = null;
  let clientB: ClientSocket | null = null;

  try {
    const ticketA = makeHexTicket('1111aaaa');
    const ticketB = makeHexTicket('2222bbbb');
    tickets.register(ticketA, { userId: 101, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 'sess-a' });
    tickets.register(ticketB, { userId: 202, role: 'PATIENT', dentistId: null, permissions: [], sessionIdHash: 'sess-b' });

    clientA = await connectSocket(port, { ticket: ticketA });
    clientB = await connectSocket(port, { ticket: ticketB });

    // Client attempting arbitrary room join is blocked
    const joinAck = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      clientA!.emit('join', { room: 'user:202' }, (ack: { ok: boolean; error?: string }) => resolve(ack));
    });
    assert.equal(joinAck.ok, false);
    assert.equal(joinAck.error, 'FORBIDDEN_CLIENT_EVENT');

    // Unauthenticated publish rejected (401)
    const unauthRes = await fetch(`http://127.0.0.1:${port}/internal/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt-unauth-01' }),
    });
    assert.equal(unauthRes.status, 401);

    // Signed publish delivers exclusively to Patient A (user 101), never to Patient B (user 202)
    const receivedByA: unknown[] = [];
    const receivedByB: unknown[] = [];
    clientA.on('appointment.confirmed', (p) => receivedByA.push(p));
    clientB.on('appointment.confirmed', (p) => receivedByB.push(p));

    const envelope = {
      eventId: 'evt-confirm-0001',
      eventType: 'appointment.confirmed',
      recipientUserId: 101,
      payload: {
        eventId: 'evt-confirm-0001',
        eventType: 'appointment.confirmed',
        notificationId: 77,
        appointmentId: 501,
        status: 'confirmed',
        occurredAt: '2026-11-20T10:30:00Z',
      },
    };
    const rawBody = JSON.stringify(envelope);
    const headers1 = service.publisherAuth.signHeaders('POST', '/internal/publish', rawBody);

    const pubRes1 = await fetch(`http://127.0.0.1:${port}/internal/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers1 },
      body: rawBody,
    });
    assert.equal(pubRes1.status, 200);
    const pubJson1 = (await pubRes1.json()) as { ok: boolean; duplicate: boolean };
    assert.equal(pubJson1.ok, true);
    assert.equal(pubJson1.duplicate, false);

    // Replaying exact same signed nonce is rejected (401 REPLAYED_NONCE)
    const replayRes = await fetch(`http://127.0.0.1:${port}/internal/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers1 },
      body: rawBody,
    });
    assert.equal(replayRes.status, 401);

    // Fresh signature with duplicate eventId is suppressed idempotently
    const headers2 = service.publisherAuth.signHeaders('POST', '/internal/publish', rawBody);
    const dupRes = await fetch(`http://127.0.0.1:${port}/internal/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers2 },
      body: rawBody,
    });
    assert.equal(dupRes.status, 200);
    const dupJson = (await dupRes.json()) as { duplicate: boolean };
    assert.equal(dupJson.duplicate, true);

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(receivedByA.length, 1);
    assert.equal(receivedByB.length, 0);

    // Revoking Patient A's session disconnects Client A while leaving Client B connected
    const disconnectedPromise = new Promise<void>((resolve) => {
      clientA!.once('disconnect', () => resolve());
    });
    const revokeBody = JSON.stringify({ userId: 101, sessionIdHash: 'sess-a', reason: 'LOGOUT' });
    const revokeHeaders = service.publisherAuth.signHeaders('POST', '/internal/revoke', revokeBody);
    const revokeRes = await fetch(`http://127.0.0.1:${port}/internal/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...revokeHeaders },
      body: revokeBody,
    });
    assert.equal(revokeRes.status, 200);
    await disconnectedPromise;

    assert.equal(clientA.connected, false);
    assert.equal(clientB.connected, true);

    // Health and Prometheus metrics endpoints respond cleanly without PII
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthRes.status, 200);
    const metricsRes = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(metricsRes.status, 200);
    const metricsText = await metricsRes.text();
    assert.ok(metricsText.includes('toothcare_realtime_active_connections 1'));
    assert.ok(metricsText.includes('toothcare_realtime_events_delivered_total 1'));
    assert.ok(metricsText.includes('toothcare_realtime_events_duplicate_total 1'));
  } finally {
    clientA?.close();
    clientB?.close();
    await service.close();
  }
});

test('Realtime CORS allows private LAN dev origins in development but rejects them in production', async () => {
  const { isAllowedRealtimeOrigin } = await import('../src/config/socket.config');

  const devEnv = loadEnvironment({
    NODE_ENV: 'development',
    REALTIME_INTERNAL_SECRET: 'dev_test_secret_1234567890123456789012',
    ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  });

  assert.equal(isAllowedRealtimeOrigin('http://localhost:5173', devEnv), true);
  assert.equal(isAllowedRealtimeOrigin('http://192.168.1.56:5173', devEnv), true);
  assert.equal(isAllowedRealtimeOrigin('http://10.0.0.12:5173', devEnv), true);
  assert.equal(isAllowedRealtimeOrigin('http://localhost:5174', devEnv), true);
  assert.equal(isAllowedRealtimeOrigin('https://evil.example.com', devEnv), false);

  const prodEnv = loadEnvironment({
    NODE_ENV: 'production',
    REALTIME_INTERNAL_SECRET: 'prod_test_secret_123456789012345678901',
    ALLOWED_ORIGINS: 'https://clinic.toothcare.example',
  });

  assert.equal(isAllowedRealtimeOrigin('https://clinic.toothcare.example', prodEnv), true);
  assert.equal(isAllowedRealtimeOrigin('http://192.168.1.56:5173', prodEnv), false);
  assert.equal(isAllowedRealtimeOrigin('http://localhost:5173', prodEnv), false);
});

test('Messaging realtime events validate non-PII conversationId, reject message bodies, and report authenticated presence', async () => {
  const safeChatEnvelope = validatePublishEnvelope({
    eventId: 'msg-event-0001-ok',
    eventType: 'message.created',
    recipientUserId: 201,
    payload: {
      eventId: 'msg-event-0001-ok',
      eventType: 'message.created',
      eventVersion: '1.0',
      notificationId: null,
      appointmentId: null,
      conversationId: 42,
      entityType: 'messages',
      entityId: 901,
      status: 'sent',
      occurredAt: new Date().toISOString(),
    },
  });
  assert.equal(safeChatEnvelope.valid, true);
  assert.equal(safeChatEnvelope.envelope?.payload.conversationId, 42);

  // Privacy guard: message text body MUST NEVER pass through the real-time event payload
  const leakyEnvelope = validatePublishEnvelope({
    eventId: 'msg-event-0002-bad',
    eventType: 'message.created',
    recipientUserId: 201,
    payload: {
      eventId: 'msg-event-0002-bad',
      eventType: 'message.created',
      eventVersion: '1.0',
      notificationId: null,
      appointmentId: null,
      conversationId: 42,
      entityType: 'messages',
      entityId: 902,
      status: 'sent',
      body: 'Private patient symptom text must never be broadcast',
      occurredAt: new Date().toISOString(),
    },
  });
  assert.equal(leakyEnvelope.valid, false);

  const { service, port, tickets } = await startTestServer();
  let clientOnline: ClientSocket | null = null;
  try {
    const tOnline = makeHexTicket('presence201');
    tickets.register(tOnline, {
      userId: 201,
      role: 'DENTIST',
      dentistId: 7,
      permissions: ['messages.view', 'messages.send'],
      sessionIdHash: 'sess-201',
    });
    clientOnline = await connectSocket(port, { ticket: tOnline });

    // Unauthenticated presence request is rejected
    const unauthRes = await fetch(`http://127.0.0.1:${port}/internal/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [201, 999] }),
    });
    assert.equal(unauthRes.status, 401);

    // Signed internal presence lookup accurately identifies online vs offline users
    const body = JSON.stringify({ userIds: [201, 999] });
    const headers = service.publisherAuth.signHeaders('POST', '/internal/presence', body);
    const presenceRes = await fetch(`http://127.0.0.1:${port}/internal/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
    assert.equal(presenceRes.status, 200);
    const presenceJson = (await presenceRes.json()) as { ok: boolean; onlineUserIds: number[] };
    assert.equal(presenceJson.ok, true);
    assert.deepEqual(presenceJson.onlineUserIds, [201]);
  } finally {
    clientOnline?.close();
    await service.close();
  }
});
