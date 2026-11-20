import { Socket } from 'socket.io';
import { ConnectionAuthenticator } from '../auth/connection-auth';

/**
 * Socket.IO connection-level authentication middleware.
 * Attaches verified identity to `socket.data.identity` or rejects the handshake.
 */
export function createAuthenticationMiddleware(authenticator: ConnectionAuthenticator) {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    try {
      const result = await authenticator.authenticate(socket);
      if (!result.authenticated || !result.identity) {
        const err = new Error(result.errorCode || 'UNAUTHORIZED') as Error & { data?: { code: string } };
        err.data = { code: result.errorCode || 'UNAUTHORIZED' };
        next(err);
        return;
      }

      socket.data.identity = result.identity;
      next();
    } catch {
      const err = new Error('AUTHENTICATION_ERROR') as Error & { data?: { code: string } };
      err.data = { code: 'AUTHENTICATION_ERROR' };
      next(err);
    }
  };
}
