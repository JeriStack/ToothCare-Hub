import crypto from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { PublisherAuth } from './publisher-auth';
import { validatePublishEnvelope } from '../events/event-validator';
import { RealtimeEventHandler } from '../events/event-handler';
import { ConnectionRegistry } from '../services/connection-registry';
import { RealtimeMetrics } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/logger';
import { RevocationRequest } from '../events/event-types';

const MAX_INTERNAL_BODY_BYTES = 64 * 1024; // 64 KB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_INTERNAL_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Protected internal HTTP endpoints for PHP -> Node.js communication:
 *   POST /internal/publish  (authenticated event publication)
 *   POST /internal/revoke   (authenticated session/user/role revocation)
 */
export class InternalPublisherHandler {
  private windowStartMs = Date.now();
  private windowCount = 0;

  constructor(
    private readonly auth: PublisherAuth,
    private readonly eventHandler: RealtimeEventHandler,
    private readonly registry: ConnectionRegistry,
    private readonly metrics: RealtimeMetrics,
    private readonly logger: StructuredLogger,
    private readonly rateLimitPerMin: number = 600
  ) {}

  async handlePublish(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = crypto.randomUUID();
    this.metrics.eventsReceivedTotal += 1;

    if (!this.checkRateLimit()) {
      this.metrics.eventsRejectedTotal += 1;
      sendJson(res, 429, { ok: false, error: 'RATE_LIMIT_EXCEEDED' });
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readBody(req);
    } catch {
      this.metrics.eventsRejectedTotal += 1;
      sendJson(res, 413, { ok: false, error: 'PAYLOAD_TOO_LARGE' });
      return;
    }

    const authResult = this.auth.verifyIncoming('POST', '/internal/publish', req.headers, rawBody);
    if (!authResult.valid) {
      this.metrics.eventsRejectedTotal += 1;
      this.logger.warn('Rejected unauthenticated internal publish request', {
        correlationId,
        reason: authResult.reason,
      });
      sendJson(res, 401, { ok: false, error: authResult.reason });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      this.metrics.eventsRejectedTotal += 1;
      sendJson(res, 400, { ok: false, error: 'INVALID_JSON' });
      return;
    }

    const validation = validatePublishEnvelope(parsed);
    if (!validation.valid || !validation.envelope) {
      this.metrics.eventsRejectedTotal += 1;
      this.logger.warn('Rejected invalid realtime publish payload', {
        correlationId,
        reason: validation.error,
      });
      sendJson(res, 422, { ok: false, error: validation.error || 'VALIDATION_FAILED' });
      return;
    }

    const result = this.eventHandler.handleValidatedEvent(validation.envelope, correlationId);
    sendJson(res, 200, {
      ok: true,
      delivered: result.delivered,
      duplicate: result.duplicate,
      correlationId,
    });
  }

  async handleRevoke(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = crypto.randomUUID();

    let rawBody: string;
    try {
      rawBody = await readBody(req);
    } catch {
      sendJson(res, 413, { ok: false, error: 'PAYLOAD_TOO_LARGE' });
      return;
    }

    const authResult = this.auth.verifyIncoming('POST', '/internal/revoke', req.headers, rawBody);
    if (!authResult.valid) {
      this.logger.warn('Rejected unauthenticated internal revoke request', {
        correlationId,
        reason: authResult.reason,
      });
      sendJson(res, 401, { ok: false, error: authResult.reason });
      return;
    }

    let parsed: RevocationRequest;
    try {
      parsed = JSON.parse(rawBody) as RevocationRequest;
    } catch {
      sendJson(res, 400, { ok: false, error: 'INVALID_JSON' });
      return;
    }

    const reason = typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : 'SESSION_REVOKED';
    let disconnected = 0;

    if (typeof parsed.userId === 'number' && Number.isInteger(parsed.userId) && parsed.userId > 0) {
      disconnected += this.registry.disconnectUser(parsed.userId, parsed.sessionIdHash ?? null, reason);
    }

    if (typeof parsed.role === 'string' && parsed.role.trim() !== '') {
      disconnected += this.registry.disconnectRole(parsed.role, reason);
    }

    this.metrics.sessionRevocationsTotal += disconnected;
    this.metrics.activeConnections = this.registry.totalConnections();

    this.logger.info('Processed realtime authorization revocation', {
      correlationId,
      reason,
      disconnected,
    });

    sendJson(res, 200, {
      ok: true,
      disconnected,
      correlationId,
    });
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStartMs >= 60_000) {
      this.windowStartMs = now;
      this.windowCount = 0;
    }
    this.windowCount += 1;
    return this.windowCount <= this.rateLimitPerMin;
  }
}
