import crypto from 'crypto';
import { IncomingHttpHeaders } from 'http';

export interface SignedHeaders {
  'X-Realtime-Timestamp': string;
  'X-Realtime-Nonce': string;
  'X-Realtime-Signature': string;
}

export interface VerificationResult {
  valid: boolean;
  reason: string;
}

/**
 * HMAC-SHA256 service-to-service request signer and verifier with replay protection.
 * Canonical string: "{timestamp}.{nonce}.{METHOD}.{path}.{rawBody}"
 */
export class PublisherAuth {
  private readonly seenNonces = new Map<string, number>();

  constructor(
    private readonly secret: string,
    private readonly replayWindowSeconds: number = 300
  ) {}

  computeSignature(
    timestamp: string,
    nonce: string,
    method: string,
    path: string,
    rawBody: string
  ): string {
    const canonical = [timestamp, nonce, method.toUpperCase(), path, rawBody].join('.');
    return crypto.createHmac('sha256', this.secret).update(canonical, 'utf8').digest('hex');
  }

  signHeaders(method: string, path: string, rawBody: string, nowSec?: number): SignedHeaders {
    const timestamp = String(nowSec ?? Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = this.computeSignature(timestamp, nonce, method, path, rawBody);

    return {
      'X-Realtime-Timestamp': timestamp,
      'X-Realtime-Nonce': nonce,
      'X-Realtime-Signature': signature,
    };
  }

  verifyIncoming(
    method: string,
    path: string,
    headers: IncomingHttpHeaders,
    rawBody: string,
    nowSec?: number
  ): VerificationResult {
    if (!this.secret) {
      return { valid: false, reason: 'INTERNAL_SECRET_NOT_CONFIGURED' };
    }

    const timestamp = String(headers['x-realtime-timestamp'] || '').trim();
    const nonce = String(headers['x-realtime-nonce'] || '').trim();
    const signature = String(headers['x-realtime-signature'] || '').trim().toLowerCase();

    if (!timestamp || !nonce || !signature) {
      return { valid: false, reason: 'MISSING_AUTH_HEADERS' };
    }

    if (!/^\d+$/.test(timestamp)) {
      return { valid: false, reason: 'INVALID_TIMESTAMP' };
    }

    const current = nowSec ?? Math.floor(Date.now() / 1000);
    const tsInt = Number.parseInt(timestamp, 10);
    if (Math.abs(current - tsInt) > this.replayWindowSeconds) {
      return { valid: false, reason: 'TIMESTAMP_OUT_OF_WINDOW' };
    }

    if (nonce.length < 16 || nonce.length > 128) {
      return { valid: false, reason: 'INVALID_NONCE' };
    }

    this.pruneNonces(current);
    if (this.seenNonces.has(nonce)) {
      return { valid: false, reason: 'REPLAYED_NONCE' };
    }

    const expected = this.computeSignature(timestamp, nonce, method, path, rawBody);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }

    this.seenNonces.set(nonce, current + this.replayWindowSeconds);
    return { valid: true, reason: 'OK' };
  }

  private pruneNonces(nowSec: number): void {
    for (const [k, exp] of this.seenNonces.entries()) {
      if (exp <= nowSec) {
        this.seenNonces.delete(k);
      }
    }
  }
}
