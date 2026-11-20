import { io } from 'socket.io-client';
import apiClient from '../../lib/apiClient';
import { CONNECTION_STATUS, SUBSCRIBED_REALTIME_EVENTS } from './socket-events';

/**
 * Request a fresh short-lived, single-use Socket.IO connection ticket from PHP.
 * Tickets are kept strictly in ephemeral memory — never stored in localStorage/sessionStorage.
 */
export async function fetchRealtimeTicket() {
  const res = await apiClient.post('/realtime/ticket', {}, { background: true, skipGlobalLoading: true });
  return res.data?.data || null;
}

/**
 * Resolve the Socket.IO server origin.
 * Defaults to same-origin (proxied by Nginx / Vite `/socket.io/`) unless VITE_REALTIME_URL is explicitly set.
 */
export function resolveRealtimeUrl() {
  const explicit = import.meta.env?.VITE_REALTIME_URL;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }
  return undefined;
}

/**
 * Centralized Socket.IO Connection Manager.
 * - Single shared socket instance per authenticated session.
 * - Acquires a fresh single-use ticket before every connect/reconnect attempt.
 * - Bounded exponential backoff with jitter to avoid reconnect storms.
 * - Cleans up all listeners cleanly on disconnect/logout.
 */
export class RealtimeSocketClient {
  constructor(options = {}) {
    this.createSocket = options.createSocket || io;
    this.fetchTicket = options.fetchTicket || fetchRealtimeTicket;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs || 30000;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs || 1500;

    this.socket = null;
    this.status = CONNECTION_STATUS.DISCONNECTED;
    this.shouldMaintainConnection = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.hasConnectedOnce = false;
    this.isConnecting = false;

    this.statusListeners = new Set();
    this.eventListeners = new Set();
    this.reconnectListeners = new Set();
    this.revokedListeners = new Set();
  }

  getStatus() {
    return this.status;
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onEvent(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onReconnect(listener) {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  onRevoked(listener) {
    this.revokedListeners.add(listener);
    return () => this.revokedListeners.delete(listener);
  }

  setStatus(nextStatus) {
    if (this.status === nextStatus) return;
    this.status = nextStatus;
    this.statusListeners.forEach((fn) => {
      try {
        fn(nextStatus);
      } catch {
        // Isolate subscriber errors
      }
    });
  }

  async connect() {
    this.shouldMaintainConnection = true;
    this.clearReconnectTimer();

    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.setStatus(this.hasConnectedOnce ? CONNECTION_STATUS.RECONNECTING : CONNECTION_STATUS.CONNECTING);

    try {
      const ticketData = await this.fetchTicket();
      if (!this.shouldMaintainConnection) {
        this.isConnecting = false;
        this.setStatus(CONNECTION_STATUS.DISCONNECTED);
        return;
      }

      if (!ticketData?.ticket) {
        throw new Error('No realtime connection ticket returned');
      }

      this.teardownSocket();

      const socketPath = ticketData.socket_path || '/socket.io/';
      const targetUrl = resolveRealtimeUrl();

      const socket = this.createSocket(targetUrl, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: false, // Managed manually so every reconnect acquires a fresh single-use ticket
        auth: {
          ticket: ticketData.ticket,
        },
      });

      this.socket = socket;

      socket.on('connect', () => {
        const wasReconnect = this.hasConnectedOnce;
        this.hasConnectedOnce = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.setStatus(CONNECTION_STATUS.CONNECTED);

        if (wasReconnect) {
          this.reconnectListeners.forEach((fn) => {
            try {
              fn();
            } catch {
              // Isolate subscriber errors
            }
          });
        }
      });

      socket.on('connect_error', (err) => {
        this.isConnecting = false;
        const errCode = err?.data?.code || err?.message || '';
        this.teardownSocket();

        if (['ACCOUNT_DISABLED', 'AUTHENTICATION_REQUIRED'].includes(errCode)) {
          this.shouldMaintainConnection = false;
          this.setStatus(CONNECTION_STATUS.DISCONNECTED);
          return;
        }

        if (this.shouldMaintainConnection) {
          this.scheduleReconnect();
        } else {
          this.setStatus(CONNECTION_STATUS.DISCONNECTED);
        }
      });

      socket.on('disconnect', (reason) => {
        this.isConnecting = false;
        this.teardownSocket();

        if (!this.shouldMaintainConnection || reason === 'io client disconnect') {
          this.setStatus(CONNECTION_STATUS.DISCONNECTED);
          return;
        }

        this.scheduleReconnect();
      });

      socket.on('realtime:revoked', (payload) => {
        const reason = payload?.reason || 'SESSION_REVOKED';
        if (reason === 'LOGOUT' || reason === 'ACCOUNT_DEACTIVATED') {
          this.disconnect();
        } else {
          // Role/permission changed — disconnect and re-authenticate with fresh ticket
          this.teardownSocket();
          if (this.shouldMaintainConnection) {
            this.scheduleReconnect(500);
          }
        }
        this.revokedListeners.forEach((fn) => {
          try {
            fn(reason);
          } catch {
            // Isolate subscriber errors
          }
        });
      });

      for (const eventName of SUBSCRIBED_REALTIME_EVENTS) {
        socket.on(eventName, (payload) => {
          this.eventListeners.forEach((fn) => {
            try {
              fn(eventName, payload);
            } catch {
              // Isolate subscriber errors
            }
          });
        });
      }
    } catch (err) {
      this.isConnecting = false;
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        this.shouldMaintainConnection = false;
        this.setStatus(CONNECTION_STATUS.DISCONNECTED);
        return;
      }

      if (this.shouldMaintainConnection) {
        this.scheduleReconnect();
      } else {
        this.setStatus(CONNECTION_STATUS.DISCONNECTED);
      }
    }
  }

  disconnect() {
    this.shouldMaintainConnection = false;
    this.isConnecting = false;
    this.hasConnectedOnce = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.teardownSocket();
    this.setStatus(CONNECTION_STATUS.DISCONNECTED);
  }

  scheduleReconnect(explicitDelayMs = null) {
    if (!this.shouldMaintainConnection) return;
    this.clearReconnectTimer();
    this.setStatus(CONNECTION_STATUS.RECONNECTING);

    const attempt = this.reconnectAttempts;
    this.reconnectAttempts += 1;
    const expDelay = Math.min(this.maxReconnectDelayMs, this.baseReconnectDelayMs * Math.pow(2, Math.min(attempt, 5)));
    const jitter = Math.floor(Math.random() * 400);
    const delay = explicitDelayMs !== null ? explicitDelayMs : expDelay + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldMaintainConnection) {
        void this.connect();
      }
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  teardownSocket() {
    if (!this.socket) return;
    try {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    } catch {
      // Safe cleanup
    }
    this.socket = null;
  }
}

export const sharedRealtimeClient = new RealtimeSocketClient();
