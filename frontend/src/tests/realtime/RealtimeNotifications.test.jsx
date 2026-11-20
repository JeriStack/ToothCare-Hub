import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { RealtimeSocketClient } from '../../services/realtime/socket-client';
import { RealtimeProvider } from '../../contexts/RealtimeProvider';
import { ConnectionStatus } from '../../components/notifications/ConnectionStatus';
import { useNotifications } from '../../features/notifications/hooks/useNotifications';
import { CONNECTION_STATUS } from '../../services/realtime/socket-events';
import notificationsApi from '../../features/notifications/api';

const mockAuthState = {
  user: { id: 42, role: 'PATIENT' },
  isAuthenticated: true,
};

vi.mock('../../features/auth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../features/notifications/api', () => ({
  default: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

function createMockSocket() {
  const listeners = new Map();
  return {
    connected: false,
    on: vi.fn((event, handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    }),
    removeAllListeners: vi.fn(() => listeners.clear()),
    disconnect: vi.fn(function () {
      this.connected = false;
    }),
    trigger(event, ...args) {
      if (event === 'connect') this.connected = true;
      if (event === 'disconnect') this.connected = false;
      const set = listeners.get(event);
      if (set) {
        set.forEach((fn) => fn(...args));
      }
    },
    listenerCount() {
      let total = 0;
      listeners.forEach((set) => {
        total += set.size;
      });
      return total;
    },
  };
}

function NotificationProbe() {
  const { notifications, unreadCount } = useNotifications(0);
  return (
    <div>
      <ConnectionStatus />
      <span data-testid="unread-count">{unreadCount}</span>
      <span data-testid="notif-count">{notifications.length}</span>
    </div>
  );
}

describe('Phase 14 Real-Time Notifications Frontend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { id: 42, role: 'PATIENT' };
    mockAuthState.isAuthenticated = true;
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects with single-use ticket (never persisted in browser storage), deduplicates events, recovers on reconnect, and cleans up on unmount', async () => {
    const sockets = [];
    const fetchTicket = vi.fn().mockImplementation(async () => ({
      ticket: `ticket-${sockets.length + 1}`,
      expires_in: 60,
      socket_path: '/socket.io/',
    }));
    const createSocket = vi.fn((_url, opts) => {
      const s = createMockSocket();
      s.opts = opts;
      sockets.push(s);
      return s;
    });

    const client = new RealtimeSocketClient({
      createSocket,
      fetchTicket,
      baseReconnectDelayMs: 10,
      maxReconnectDelayMs: 50,
    });

    notificationsApi.getNotifications
      .mockResolvedValueOnce({ items: [], total: 0, unread_count: 0 })
      .mockResolvedValueOnce({
        items: [{ id: 101, title: 'Appointment Confirmed', message: 'Confirmed', read_at: null }],
        total: 1,
        unread_count: 1,
      })
      .mockResolvedValueOnce({
        items: [
          { id: 102, title: 'Missed During Disconnect', message: 'Recovered', read_at: null },
          { id: 101, title: 'Appointment Confirmed', message: 'Confirmed', read_at: null },
        ],
        total: 2,
        unread_count: 2,
      });

    const { unmount } = render(
      <RealtimeProvider client={client}>
        <NotificationProbe />
      </RealtimeProvider>
    );

    await waitFor(() => expect(createSocket).toHaveBeenCalledTimes(1));
    expect(sockets[0].opts.auth.ticket).toBe('ticket-1');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    // Connect socket -> status becomes Live
    act(() => {
      sockets[0].trigger('connect');
    });
    expect(screen.getByTestId('realtime-connection-status')).toHaveAttribute('data-status', CONNECTION_STATUS.CONNECTED);
    expect(screen.getByTestId('realtime-connection-status')).toHaveTextContent('Live');

    // Deliver same eventId twice -> deduplicated (REST refresh triggered only once!)
    const eventPayload = {
      eventId: 'evt-dup-1',
      eventType: 'appointment.confirmed',
      notificationId: 101,
      appointmentId: 500,
      status: 'confirmed',
      occurredAt: '2026-11-20T10:00:00Z',
    };

    act(() => {
      sockets[0].trigger('appointment.confirmed', eventPayload);
      sockets[0].trigger('appointment.confirmed', eventPayload);
    });

    await waitFor(() => expect(screen.getByTestId('unread-count')).toHaveTextContent('1'));
    expect(notificationsApi.getNotifications).toHaveBeenCalledTimes(2);

    // Simulate temporary disconnect -> status becomes Reconnecting -> reconnects with fresh ticket -> REST recovery runs
    act(() => {
      sockets[0].trigger('disconnect', 'transport close');
    });
    expect(screen.getByTestId('realtime-connection-status')).toHaveAttribute('data-status', CONNECTION_STATUS.RECONNECTING);

    await waitFor(() => expect(createSocket).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(sockets[1].opts.auth.ticket).toBe('ticket-2');

    act(() => {
      sockets[1].trigger('connect');
    });

    await waitFor(() => expect(screen.getByTestId('unread-count')).toHaveTextContent('2'));
    expect(screen.getByTestId('notif-count')).toHaveTextContent('2');

    // Unmount cleans up socket & listeners cleanly
    unmount();
    expect(sockets[1].removeAllListeners).toHaveBeenCalled();
    expect(sockets[1].disconnect).toHaveBeenCalled();
  });

  it('disconnects immediately when unauthorized event fires (logout/session expiry)', async () => {
    const mockSocket = createMockSocket();
    const client = new RealtimeSocketClient({
      createSocket: () => mockSocket,
      fetchTicket: vi.fn().mockResolvedValue({ ticket: 't-logout', socket_path: '/socket.io/' }),
    });
    notificationsApi.getNotifications.mockResolvedValue({ items: [], total: 0, unread_count: 0 });

    render(
      <RealtimeProvider client={client}>
        <NotificationProbe />
      </RealtimeProvider>
    );

    await waitFor(() => expect(mockSocket.on).toHaveBeenCalled());
    act(() => {
      mockSocket.trigger('connect');
    });
    expect(screen.getByTestId('realtime-connection-status')).toHaveAttribute('data-status', CONNECTION_STATUS.CONNECTED);

    act(() => {
      window.dispatchEvent(new CustomEvent('toothcare:unauthorized'));
    });

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(screen.getByTestId('realtime-connection-status')).toHaveAttribute('data-status', CONNECTION_STATUS.DISCONNECTED);
  });
});
