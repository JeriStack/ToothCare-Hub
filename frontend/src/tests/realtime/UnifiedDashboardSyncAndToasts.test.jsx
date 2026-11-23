import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { RealtimeSocketClient } from '../../services/realtime/socket-client';
import { RealtimeProvider } from '../../contexts/RealtimeProvider';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import {
  DASHBOARD_SYNC_DOMAINS,
  dashboardSyncMetrics,
  resolveAffectedDomains,
} from '../../services/realtime/dashboardSync';
import { REALTIME_EVENTS } from '../../services/realtime/socket-events';
import { NotificationToastContainer } from '../../components/notifications/NotificationToastContainer';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import notificationsApi from '../../features/notifications/api';

const mockAuthState = {
  user: { id: 1, role: 'ADMIN' },
  isAuthenticated: true,
};

vi.mock('../../features/auth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../features/notifications/api', () => ({
  default: {
    getNotifications: vi.fn(),
    syncNotifications: vi.fn(),
    getNotification: vi.fn(),
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
      if (set) set.forEach((fn) => fn(...args));
    },
  };
}

function DashboardSyncProbe({ role, domains, onRefresh, debounceMs = 20 }) {
  useDashboardSync({ role, domains, onRefresh, debounceMs });
  return <div data-testid="sync-probe" />;
}

describe('Unified Real-Time Notifications, Toasts, and Dashboard Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardSyncMetrics.reset();
    mockAuthState.user = { id: 1, role: 'ADMIN' };
    mockAuthState.isAuthenticated = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces role-scoped event-to-domain mapping across all four roles', () => {
    expect(resolveAffectedDomains(REALTIME_EVENTS.SERVICE_UPDATED, 'ADMIN')).toContain(DASHBOARD_SYNC_DOMAINS.ADMIN_DASHBOARD);
    expect(resolveAffectedDomains(REALTIME_EVENTS.SERVICE_UPDATED, 'RECEPTIONIST')).toContain(DASHBOARD_SYNC_DOMAINS.RECEPTIONIST_DASHBOARD);
    expect(resolveAffectedDomains(REALTIME_EVENTS.SERVICE_UPDATED, 'DENTIST')).toEqual([]);
    expect(resolveAffectedDomains(REALTIME_EVENTS.SERVICE_UPDATED, 'PATIENT')).toEqual([]);

    expect(resolveAffectedDomains(REALTIME_EVENTS.SCHEDULE_UPDATED, 'DENTIST')).toContain(DASHBOARD_SYNC_DOMAINS.DENTIST_DASHBOARD);
    expect(resolveAffectedDomains(REALTIME_EVENTS.SCHEDULE_UPDATED, 'PATIENT')).toEqual([]);

    expect(resolveAffectedDomains(REALTIME_EVENTS.APPOINTMENT_CONFIRMED, 'PATIENT')).toContain(DASHBOARD_SYNC_DOMAINS.PATIENT_DASHBOARD);
    expect(resolveAffectedDomains(REALTIME_EVENTS.ACCOUNT_CREATED, 'ADMIN')).toContain(DASHBOARD_SYNC_DOMAINS.ADMIN_DASHBOARD);
    expect(resolveAffectedDomains(REALTIME_EVENTS.ACCOUNT_CREATED, 'DENTIST')).toEqual([]);
  });

  it('batches rapid domain events via debouncing, ignores unauthorized domains, and refreshes on reconnect without page reload', async () => {
    const sockets = [];
    const client = new RealtimeSocketClient({
      createSocket: () => {
        const s = createMockSocket();
        sockets.push(s);
        return s;
      },
      fetchTicket: vi.fn().mockResolvedValue({ ticket: 't-sync-1', socket_path: '/socket.io/' }),
      baseReconnectDelayMs: 10,
      maxReconnectDelayMs: 30,
    });

    const onAdminRefresh = vi.fn();
    const onPatientRefresh = vi.fn();

    render(
      <RealtimeProvider client={client}>
        <DashboardSyncProbe
          role="ADMIN"
          domains={[DASHBOARD_SYNC_DOMAINS.ADMIN_DASHBOARD, DASHBOARD_SYNC_DOMAINS.SERVICES]}
          onRefresh={onAdminRefresh}
          debounceMs={30}
        />
        <DashboardSyncProbe
          role="PATIENT"
          domains={[DASHBOARD_SYNC_DOMAINS.PATIENT_DASHBOARD]}
          onRefresh={onPatientRefresh}
          debounceMs={30}
        />
      </RealtimeProvider>
    );

    await waitFor(() => expect(sockets.length).toBe(1));
    act(() => sockets[0].trigger('connect'));

    // Emit 3 rapid service.updated events -> Admin batches into ONE refresh; Patient receives ZERO refreshes
    act(() => {
      sockets[0].trigger('service.updated', { eventId: 'evt-svc-1', eventType: 'service.updated', entityType: 'services', entityId: 1 });
      sockets[0].trigger('service.updated', { eventId: 'evt-svc-2', eventType: 'service.updated', entityType: 'services', entityId: 2 });
      sockets[0].trigger('service.updated', { eventId: 'evt-svc-3', eventType: 'service.updated', entityType: 'services', entityId: 3 });
    });

    await waitFor(() => expect(onAdminRefresh).toHaveBeenCalledTimes(1));
    expect(onPatientRefresh).not.toHaveBeenCalled();

    // Disconnect and reconnect -> both active dashboards trigger reconnect recovery sync
    act(() => sockets[0].trigger('disconnect', 'transport close'));
    await waitFor(() => expect(sockets.length).toBe(2), { timeout: 2000 });
    act(() => sockets[1].trigger('connect'));

    await waitFor(() => {
      expect(onAdminRefresh).toHaveBeenCalledTimes(2);
      expect(onPatientRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('displays non-intrusive deduplicated toasts, suppresses silent self-sync events, and supports NotificationCenter actions', async () => {
    const socket = createMockSocket();
    const client = new RealtimeSocketClient({
      createSocket: () => socket,
      fetchTicket: vi.fn().mockResolvedValue({ ticket: 't-toast-1', socket_path: '/socket.io/' }),
    });

    notificationsApi.getNotifications.mockResolvedValue({
      items: [
        {
          id: 50,
          type: 'APPOINTMENT_REQUESTED',
          title: 'New Appointment Pending Review',
          message: 'Appointment request #99 requires front-desk review.',
          reference_type: 'appointments',
          reference_id: 99,
          read_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
      unread_count: 1,
      latest_id: 50,
    });
    notificationsApi.markAsRead.mockResolvedValue({ success: true });
    notificationsApi.markAllAsRead.mockResolvedValue({ success: true });

    const onSelectNotification = vi.fn();
    render(
      <RealtimeProvider client={client}>
        <NotificationCenter onSelectNotification={onSelectNotification} onViewAllNotifications={vi.fn()} />
        <NotificationToastContainer autoDismissMs={0} />
      </RealtimeProvider>
    );

    await waitFor(() => expect(socket.on).toHaveBeenCalled());
    act(() => socket.trigger('connect'));

    // Silent actor self-sync (notificationId: null) should NOT spam a toast
    act(() => {
      socket.trigger('appointment.confirmed', {
        eventId: 'evt-silent-1',
        eventType: 'appointment.confirmed',
        notificationId: null,
        appointmentId: 99,
      });
    });
    expect(screen.queryByTestId('realtime-notification-toast')).not.toBeInTheDocument();

    // Persisted notification event triggers ONE toast even if delivered twice
    const persistedEvt = {
      eventId: 'evt-toast-dup-1',
      eventType: 'appointment.requested',
      notificationId: 51,
      appointmentId: 100,
    };
    act(() => {
      socket.trigger('appointment.requested', persistedEvt);
      socket.trigger('appointment.requested', persistedEvt);
    });

    const toasts = await screen.findAllByTestId('realtime-notification-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toHaveTextContent('New Appointment Request');

    // Dismiss toast cleanly
    fireEvent.click(screen.getByRole('button', { name: /dismiss new appointment request/i }));
    expect(screen.queryByTestId('realtime-notification-toast')).not.toBeInTheDocument();

    // Open NotificationCenter bell popover and click mark-all-as-read
    fireEvent.click(screen.getByRole('button', { name: /view notifications/i }));
    expect(await screen.findByText('New Appointment Pending Review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }));
    await waitFor(() => expect(notificationsApi.markAllAsRead).toHaveBeenCalledTimes(1));
  });
});
