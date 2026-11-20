import { Socket } from 'socket.io';
import { VerifiedUserIdentity } from '../events/event-types';

/**
 * Server-Controlled Room Manager.
 * Clients NEVER specify or request room membership; rooms are computed strictly
 * from the verified PHP identity, role, and DRBAC permissions.
 */
export class RoomManager {
  /**
   * Compute the authoritative list of rooms for a verified user identity.
   */
  static computeAuthorizedRooms(identity: VerifiedUserIdentity): string[] {
    const rooms = new Set<string>();

    // Private per-user room (primary targeted delivery channel)
    rooms.add(RoomManager.userRoom(identity.userId));

    const roleLower = identity.role.toLowerCase();
    rooms.add(`role:${roleLower}`);

    if (identity.role === 'DENTIST' && identity.dentistId && identity.dentistId > 0) {
      rooms.add(`dentist:${identity.dentistId}`);
    }

    if (
      identity.role === 'RECEPTIONIST' &&
      identity.permissions.includes('appointments.view')
    ) {
      rooms.add('receptionist:notifications');
    }

    if (
      identity.role === 'ADMIN' &&
      (identity.permissions.includes('dashboard.view') || identity.permissions.includes('appointments.view'))
    ) {
      rooms.add('admin:notifications');
    }

    return Array.from(rooms);
  }

  static userRoom(userId: number): string {
    return `user:${userId}`;
  }

  /**
   * Join the socket strictly into its server-computed authorized rooms.
   */
  static async assignAuthorizedRooms(socket: Socket, identity: VerifiedUserIdentity): Promise<string[]> {
    const rooms = RoomManager.computeAuthorizedRooms(identity);
    for (const room of rooms) {
      await socket.join(room);
    }
    return rooms;
  }
}
