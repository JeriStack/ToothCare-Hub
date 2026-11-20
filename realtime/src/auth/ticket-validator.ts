import { VerifiedUserIdentity } from '../events/event-types';
import { PublisherAuth } from '../publisher/publisher-auth';

export interface TicketValidationOutcome {
  valid: boolean;
  identity?: VerifiedUserIdentity;
  errorCode?: string;
}

export interface TicketValidator {
  validateTicket(rawTicket: string): Promise<TicketValidationOutcome>;
}

/**
 * Validates short-lived single-use connection tickets against the protected PHP internal API.
 * Raw tickets are transmitted exclusively in the JSON request body (never in URLs or logs).
 */
export class PhpTicketValidator implements TicketValidator {
  private readonly verifyPath = '/api/v1/internal/realtime/tickets/verify';

  constructor(
    private readonly backendInternalApiUrl: string,
    private readonly auth: PublisherAuth,
    private readonly timeoutMs: number = 4000
  ) {}

  async validateTicket(rawTicket: string): Promise<TicketValidationOutcome> {
    const trimmed = rawTicket.trim();
    if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
      return { valid: false, errorCode: 'TICKET_MALFORMED' };
    }

    const rawBody = JSON.stringify({ ticket: trimmed });
    const signedHeaders = this.auth.signHeaders('POST', this.verifyPath, rawBody);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.backendInternalApiUrl}${this.verifyPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...signedHeaders,
        },
        body: rawBody,
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => null)) as {
        data?: {
          user_id?: number;
          role?: string;
          dentist_id?: number | null;
          permissions?: string[];
          session_id_hash?: string | null;
        };
        error?: { code?: string };
      } | null;

      if (!res.ok || !json?.data || !json.data.user_id || !json.data.role) {
        return {
          valid: false,
          errorCode: json?.error?.code || 'TICKET_INVALID',
        };
      }

      const role = String(json.data.role).toUpperCase();
      if (!['ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT'].includes(role)) {
        return { valid: false, errorCode: 'INVALID_ROLE' };
      }

      return {
        valid: true,
        identity: {
          userId: Number(json.data.user_id),
          role: role as VerifiedUserIdentity['role'],
          dentistId: json.data.dentist_id ? Number(json.data.dentist_id) : null,
          permissions: Array.isArray(json.data.permissions)
            ? json.data.permissions.map((p) => String(p))
            : [],
          sessionIdHash: json.data.session_id_hash ? String(json.data.session_id_hash) : null,
        },
      };
    } catch {
      return { valid: false, errorCode: 'AUTH_SERVICE_UNAVAILABLE' };
    } finally {
      clearTimeout(timer);
    }
  }
}
