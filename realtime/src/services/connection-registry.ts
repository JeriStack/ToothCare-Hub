import { Socket } from 'socket.io';
import { VerifiedUserIdentity } from '../events/event-types';

export interface RegisteredSocket {
  socket: Socket;
  identity: VerifiedUserIdentity;
  connectedAtMs: number;
}

/**
 * Server-side registry of active authenticated sockets.
 * Enables targeted disconnect on logout (by sessionIdHash), account deactivation (by userId),
 * or role/DRBAC permission changes (by role).
 */
export class ConnectionRegistry {
  private readonly bySocketId = new Map<string, RegisteredSocket>();
  private readonly byUserId = new Map<number, Set<string>>();

  register(socket: Socket, identity: VerifiedUserIdentity): void {
    this.bySocketId.set(socket.id, {
      socket,
      identity,
      connectedAtMs: Date.now(),
    });

    let set = this.byUserId.get(identity.userId);
    if (!set) {
      set = new Set<string>();
      this.byUserId.set(identity.userId, set);
    }
    set.add(socket.id);
  }

  unregister(socketId: string): void {
    const entry = this.bySocketId.get(socketId);
    if (!entry) return;

    this.bySocketId.delete(socketId);
    const set = this.byUserId.get(entry.identity.userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        this.byUserId.delete(entry.identity.userId);
      }
    }
  }

  countForUser(userId: number): number {
    return this.byUserId.get(userId)?.size ?? 0;
  }

  totalConnections(): number {
    return this.bySocketId.size;
  }

  getAll(): RegisteredSocket[] {
    return Array.from(this.bySocketId.values());
  }

  /**
   * Disconnect sockets for a specific user (optionally scoped to a single sessionIdHash).
   */
  disconnectUser(userId: number, sessionIdHash?: string | null, reason: string = 'SESSION_REVOKED'): number {
    const socketIds = this.byUserId.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return 0;
    }

    let disconnected = 0;
    for (const sid of Array.from(socketIds)) {
      const entry = this.bySocketId.get(sid);
      if (!entry) continue;

      if (sessionIdHash && entry.identity.sessionIdHash && entry.identity.sessionIdHash !== sessionIdHash) {
        continue;
      }

      entry.socket.emit('realtime:revoked', { reason });
      entry.socket.disconnect(true);
      this.unregister(sid);
      disconnected += 1;
    }

    return disconnected;
  }

  /**
   * Disconnect all sockets holding a given role (e.g. when DRBAC permissions change).
   */
  disconnectRole(role: string, reason: string = 'PERMISSIONS_CHANGED'): number {
    const normalized = role.trim().toUpperCase();
    let disconnected = 0;

    for (const [sid, entry] of Array.from(this.bySocketId.entries())) {
      if (entry.identity.role === normalized) {
        entry.socket.emit('realtime:revoked', { reason });
        entry.socket.disconnect(true);
        this.unregister(sid);
        disconnected += 1;
      }
    }

    return disconnected;
  }
}
