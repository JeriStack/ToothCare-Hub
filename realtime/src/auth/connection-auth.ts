import { Socket } from 'socket.io';
import { VerifiedUserIdentity } from '../events/event-types';
import { TicketValidator } from './ticket-validator';
import { RealtimeMetrics } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/logger';
import { ConnectionRegistry } from '../services/connection-registry';

export interface ConnectionAuthResult {
  authenticated: boolean;
  identity?: VerifiedUserIdentity;
  errorCode?: string;
}

/**
 * Enforces strict Socket.IO handshake authentication:
 * - Rejects tickets supplied via URL query parameters (security requirement).
 * - Requires a valid short-lived single-use ticket in `socket.handshake.auth.ticket`.
 * - Enforces per-user concurrent connection limits.
 */
export class ConnectionAuthenticator {
  constructor(
    private readonly ticketValidator: TicketValidator,
    private readonly registry: ConnectionRegistry,
    private readonly metrics: RealtimeMetrics,
    private readonly logger: StructuredLogger,
    private readonly maxConnectionsPerUser: number
  ) {}

  async authenticate(socket: Socket): Promise<ConnectionAuthResult> {
    // Reject any attempt to pass ticket/token in URL query parameters
    if (socket.handshake.query && ('ticket' in socket.handshake.query || 'token' in socket.handshake.query)) {
      this.metrics.authFailuresTotal += 1;
      this.metrics.rejectedTicketsTotal += 1;
      this.logger.warn('Rejected socket handshake with ticket in query string', {
        socketId: socket.id,
      });
      return { authenticated: false, errorCode: 'TICKET_IN_QUERY_FORBIDDEN' };
    }

    const rawTicket =
      socket.handshake.auth && typeof socket.handshake.auth.ticket === 'string'
        ? socket.handshake.auth.ticket
        : '';

    if (!rawTicket) {
      this.metrics.authFailuresTotal += 1;
      this.metrics.rejectedTicketsTotal += 1;
      return { authenticated: false, errorCode: 'TICKET_MISSING' };
    }

    const outcome = await this.ticketValidator.validateTicket(rawTicket);
    if (!outcome.valid || !outcome.identity) {
      this.metrics.authFailuresTotal += 1;
      this.metrics.rejectedTicketsTotal += 1;
      this.logger.warn('Rejected socket handshake due to invalid ticket', {
        socketId: socket.id,
        errorCode: outcome.errorCode || 'TICKET_INVALID',
      });
      return { authenticated: false, errorCode: outcome.errorCode || 'TICKET_INVALID' };
    }

    if (this.registry.countForUser(outcome.identity.userId) >= this.maxConnectionsPerUser) {
      this.metrics.authFailuresTotal += 1;
      return { authenticated: false, errorCode: 'CONNECTION_LIMIT_EXCEEDED' };
    }

    return {
      authenticated: true,
      identity: outcome.identity,
    };
  }
}
