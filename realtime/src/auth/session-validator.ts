import { VerifiedUserIdentity } from '../events/event-types';
import { PublisherAuth } from '../publisher/publisher-auth';

export interface SessionRevalidationOutcome {
  active: boolean;
  identity?: VerifiedUserIdentity;
  reason?: string;
}

export interface SessionValidator {
  revalidateUser(userId: number, sessionIdHash: string | null): Promise<SessionRevalidationOutcome>;
}

/**
 * Periodically revalidates active socket accounts against PHP /api/v1/internal/realtime/sessions/verify
 * so deactivated accounts or role/permission changes take effect even if a revoke push was missed.
 */
export class PhpSessionValidator implements SessionValidator {
  private readonly verifyPath = '/api/v1/internal/realtime/sessions/verify';

  constructor(
    private readonly backendInternalApiUrl: string,
    private readonly auth: PublisherAuth,
    private readonly timeoutMs: number = 4000
  ) {}

  async revalidateUser(userId: number, sessionIdHash: string | null): Promise<SessionRevalidationOutcome> {
    const rawBody = JSON.stringify({ user_id: userId });
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

      if (res.status >= 500) {
        // Treat upstream 5xx (e.g., PHP-FPM reload or transient DB hiccup) like a transient
        // network error so active sockets are not mass-disconnected during rolling restarts.
        return { active: true };
      }

      if (!res.ok) {
        return { active: false, reason: 'SESSION_REVALIDATION_REJECTED' };
      }

      const json = (await res.json().catch(() => null)) as {
        data?: {
          active?: boolean;
          reason?: string;
          user_id?: number;
          role?: string;
          dentist_id?: number | null;
          permissions?: string[];
        };
      } | null;

      if (!json?.data?.active) {
        return { active: false, reason: json?.data?.reason || 'ACCOUNT_DISABLED' };
      }

      const role = String(json.data.role || '').toUpperCase();
      return {
        active: true,
        identity: {
          userId,
          role: role as VerifiedUserIdentity['role'],
          dentistId: json.data.dentist_id ? Number(json.data.dentist_id) : null,
          permissions: Array.isArray(json.data.permissions)
            ? json.data.permissions.map((p) => String(p))
            : [],
          sessionIdHash,
        },
      };
    } catch {
      // On transient network error during periodic revalidation, keep current socket alive
      // and retry on the next interval rather than mass-disconnecting healthy users.
      return { active: true };
    } finally {
      clearTimeout(timer);
    }
  }
}
