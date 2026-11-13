import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { createLoadingManager, globalLoadingManager } from '../../lib/loadingManager';
import {
  LoadingProvider,
  useGlobalLoading,
  useRouteLoading,
  useLoadingTask,
} from '../../contexts/LoadingContext';
import { GlobalLoadingBar } from '../../components/ui/GlobalLoadingBar';
import {
  apiClient,
  shouldTrackGlobalLoading,
  clearCsrfToken,
  setCsrfToken,
} from '../../lib/apiClient';
import { notificationsApi } from '../../features/notifications/api';
import { authApi } from '../../features/auth/api';

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function RouteHarness({ settleMs = 80 }) {
  const { triggerRouteTransition, clearPendingTransition } = useRouteLoading(settleMs);
  const { phase, activeCount } = useGlobalLoading();

  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="active-count">{activeCount}</span>
      <button type="button" onClick={() => triggerRouteTransition('admin:users')}>
        Fast Nav
      </button>
      <button
        type="button"
        onClick={() => triggerRouteTransition('admin:reports', { settleMs: 300 })}
      >
        Slow Nav
      </button>
      <button type="button" onClick={() => clearPendingTransition()}>
        Clear Nav
      </button>
    </div>
  );
}

function TaskHarness({ deferredPromise }) {
  const { runTask } = useLoadingTask();
  return (
    <button
      type="button"
      onClick={() => {
        runTask(() => deferredPromise, { id: 'component-task', type: 'action' }).catch(() => {});
      }}
    >
      Run Task
    </button>
  );
}

describe('GlobalLoadingBar & LoadingManager', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    globalLoadingManager.reset();
    globalLoadingManager.configure({
      showDelayMs: 150,
      minVisibleMs: 300,
      completeDurationMs: 250,
    });
    clearCsrfToken();
    setCsrfToken('test-csrf-token');
  });

  afterEach(() => {
    cleanup();
    globalLoadingManager.reset();
    clearCsrfToken();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. stays hidden initially and appears only after the 150ms anti-flicker delay', () => {
    const manager = createLoadingManager();
    render(
      <LoadingProvider manager={manager}>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    act(() => {
      manager.start('slow-req');
    });

    expect(manager.getSnapshot().phase).toBe('pending');
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const bar = screen.getByTestId('global-loading-bar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('data-phase', 'visible');
    expect(screen.getByRole('status')).toHaveTextContent('Loading page content...');
  });

  it('2. completes short requests under 150ms without flashing the loading bar', () => {
    const manager = createLoadingManager();
    render(
      <LoadingProvider manager={manager}>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    let reqId;
    act(() => {
      reqId = manager.start('fast-req');
    });
    expect(manager.getSnapshot().phase).toBe('pending');

    act(() => {
      vi.advanceTimersByTime(80);
      manager.stop(reqId);
    });

    expect(manager.getSnapshot().phase).toBe('idle');
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();
  });

  it('3. completes asymptotically, enforces minimum visible duration, then fades out cleanly', () => {
    const manager = createLoadingManager();
    render(
      <LoadingProvider manager={manager}>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    let reqId;
    act(() => {
      reqId = manager.start('normal-req');
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    // Advance asymptotic trickle a little, then finish before minVisibleMs (300ms)
    act(() => {
      vi.advanceTimersByTime(50);
      manager.stop(reqId);
    });

    // Still stays visible until 300ms minimum visible window finishes
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    const completingBar = screen.getByTestId('global-loading-bar');
    expect(completingBar).toHaveAttribute('data-phase', 'completing');
    expect(completingBar.className).toContain('opacity-0');
    expect(screen.getByTestId('global-loading-bar-fill').style.transform).toBe('scaleX(1)');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(manager.getSnapshot().phase).toBe('idle');
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();
  });

  it('4. cleans up tracking state after HTTP 500 and network errors', async () => {
    render(
      <LoadingProvider>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    let rejectFetch;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject;
        })
    );

    let networkPromise;
    act(() => {
      networkPromise = apiClient.get('/patients/me').catch((err) => err);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    await act(async () => {
      rejectFetch(new TypeError('Failed to fetch'));
      await networkPromise;
    });

    const networkErr = await networkPromise;
    expect(networkErr.isNetworkError).toBe(true);
    expect(globalLoadingManager.getSnapshot().activeCount).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    // Verify server 500 error also cleans up cleanly
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: { message: 'Server error' } }, 500));
    let serverErr;
    await act(async () => {
      serverErr = await apiClient.get('/appointments').catch((err) => err);
    });
    expect(serverErr.response.status).toBe(500);
    expect(globalLoadingManager.getSnapshot().activeCount).toBe(0);
  });

  it('5. cleans up cancelled AbortController requests without getting stuck', async () => {
    render(
      <LoadingProvider>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    const controller = new AbortController();
    globalThis.fetch = vi.fn(
      (_url, init) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            const abortErr = new DOMException('The operation was aborted.', 'AbortError');
            reject(abortErr);
          });
        })
    );

    let reqPromise;
    act(() => {
      reqPromise = apiClient.get('/appointments', { signal: controller.signal }).catch((err) => err);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    await act(async () => {
      controller.abort();
      await reqPromise;
    });

    const err = await reqPromise;
    expect(err.name).toBe('AbortError');
    expect(err.isCancelled).toBe(true);
    expect(globalLoadingManager.getSnapshot().activeCount).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    // Pre-aborted signals are excluded from registration altogether
    expect(shouldTrackGlobalLoading('GET', '/appointments', null, { signal: controller.signal })).toBe(false);
  });

  it('6. tracks concurrent requests reliably, ignores duplicates, and prevents negative counts', () => {
    const manager = createLoadingManager();
    render(
      <LoadingProvider manager={manager}>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    act(() => {
      manager.start('req-1');
      manager.start('req-1'); // duplicate ID should not double-count
      manager.start('req-2');
      vi.advanceTimersByTime(150);
    });

    expect(manager.getSnapshot().activeCount).toBe(2);
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    // Completing req-1 keeps bar visible while req-2 remains active
    act(() => {
      manager.stop('req-1');
      manager.stop('req-1'); // redundant stop is a safe no-op
      manager.stop('non-existent');
    });

    expect(manager.getSnapshot().activeCount).toBe(1);
    expect(manager.getSnapshot().phase).toBe('visible');
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    act(() => {
      vi.advanceTimersByTime(350);
      manager.stop('req-2');
    });

    expect(manager.getSnapshot().activeCount).toBe(0);
    expect(manager.getSnapshot().phase).toBe('completing');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(manager.getSnapshot().phase).toBe('idle');
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();
  });

  it('7. excludes background polling, CSRF prefetches, uploads, and explicit opt-outs while allowing opt-in overrides', async () => {
    expect(shouldTrackGlobalLoading('GET', '/auth/csrf-token')).toBe(false);
    expect(shouldTrackGlobalLoading('GET', '/notifications/unread-count')).toBe(false);
    expect(shouldTrackGlobalLoading('POST', '/user/profile/avatar')).toBe(false);
    expect(shouldTrackGlobalLoading('GET', '/notifications', null, { background: true })).toBe(false);
    expect(shouldTrackGlobalLoading('GET', '/dashboard', null, { skipGlobalLoading: true })).toBe(false);
    expect(shouldTrackGlobalLoading('GET', '/dashboard', null, { globalLoading: false })).toBe(false);
    expect(shouldTrackGlobalLoading('GET', '/auth/me', null, { silent: true })).toBe(false);
    expect(shouldTrackGlobalLoading('POST', '/files', null, { onUploadProgress: () => {} })).toBe(false);

    const formData = new FormData();
    formData.append('avatar', new Blob(['img'], { type: 'image/png' }), 'avatar.png');
    expect(shouldTrackGlobalLoading('POST', '/uploads', formData)).toBe(false);

    // Explicit opt-in overrides default path exclusion unless opt-out flags are set
    expect(
      shouldTrackGlobalLoading('GET', '/notifications/unread-count', null, { globalLoading: true })
    ).toBe(true);

    let observedInit;
    globalThis.fetch = vi.fn(async (_url, init) => {
      observedInit = init;
      return jsonResponse({ data: { items: [] } });
    });

    const spyStart = vi.spyOn(globalLoadingManager, 'start');
    await notificationsApi.getNotifications({ per_page: 20 }, { background: true });
    await authApi.getMe({ background: true });
    await apiClient.post('/user/profile/avatar', formData);

    expect(spyStart).not.toHaveBeenCalled();
    // Custom loading options must never leak onto fetch RequestInit
    expect(observedInit).not.toHaveProperty('background');
    expect(observedInit).not.toHaveProperty('skipGlobalLoading');
    expect(observedInit).not.toHaveProperty('globalLoading');
  });

  it('8. handles route transitions without flashing on quick switches and shows bar on slow transitions', () => {
    render(
      <LoadingProvider>
        <GlobalLoadingBar />
        <RouteHarness settleMs={80} />
      </LoadingProvider>
    );

    // Fast transition settles in 80ms (< 150ms delay) -> never becomes visible
    fireEvent.click(screen.getByText('Fast Nav'));
    expect(screen.getByTestId('phase')).toHaveTextContent('pending');

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(screen.getByTestId('phase')).toHaveTextContent('idle');
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();

    // Slow transition (300ms) -> becomes visible at 150ms and completes after finishing
    fireEvent.click(screen.getByText('Slow Nav'));
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'visible');

    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByTestId('global-loading-bar')).toHaveAttribute('data-phase', 'completing');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId('global-loading-bar')).not.toBeInTheDocument();
  });

  it('9. cleans up route and component loading tasks when components unmount mid-operation', () => {
    const neverResolves = new Promise(() => {});
    const { unmount } = render(
      <LoadingProvider>
        <GlobalLoadingBar />
        <RouteHarness settleMs={1000} />
        <TaskHarness deferredPromise={neverResolves} />
      </LoadingProvider>
    );

    fireEvent.click(screen.getByText('Slow Nav'));
    fireEvent.click(screen.getByText('Run Task'));

    expect(globalLoadingManager.getSnapshot().activeCount).toBe(2);

    unmount();

    expect(globalLoadingManager.getSnapshot().activeCount).toBe(0);
    expect(globalLoadingManager.getSnapshot().phase).toBe('idle');
  });

  it('10. enforces theme tokens, reduced motion, pointer-events-none, accessibility, and no fake numeric percentages', () => {
    const manager = createLoadingManager();
    const { container } = render(
      <LoadingProvider manager={manager}>
        <GlobalLoadingBar />
      </LoadingProvider>
    );

    act(() => {
      manager.start('ui-check');
      vi.advanceTimersByTime(150);
    });

    const bar = screen.getByTestId('global-loading-bar');
    const fill = screen.getByTestId('global-loading-bar-fill');
    const sheen = fill.querySelector('span');
    const status = screen.getByRole('status');

    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveAttribute('role', 'presentation');
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('top-0');
    expect(bar.className).toContain('pointer-events-none');
    expect(bar.className).toContain('z-[9999]');
    expect(bar.className).toContain('dark:bg-slate-900/40');
    expect(bar.className).toContain('motion-reduce:transition-none');

    expect(fill.className).toContain('from-[#0D9488]');
    expect(fill.className).toContain('dark:from-[#14B8A6]');
    expect(fill.className).toContain('motion-reduce:transition-none');
    expect(sheen.className).toContain('motion-reduce:animate-none');

    expect(status).toHaveClass('sr-only');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  it('11. preserves CSRF injection and 401 unauthorized event dispatch without duplicating tracking', async () => {
    clearCsrfToken();

    const unauthorizedListener = vi.fn();
    window.addEventListener('toothcare:unauthorized', unauthorizedListener);

    try {
      const trackedIds = [];
      const origStart = globalLoadingManager.start.bind(globalLoadingManager);
      const startSpy = vi.spyOn(globalLoadingManager, 'start').mockImplementation((id, meta) => {
        const res = origStart(id, meta);
        trackedIds.push(res);
        return res;
      });

      globalThis.fetch = vi.fn(async (url) => {
        if (String(url).includes('/auth/csrf-token')) {
          return jsonResponse({ data: { csrf_token: 'fresh-csrf-123' } });
        }
        return jsonResponse(
          { error: { code: 'UNAUTHENTICATED', message: 'Session expired' } },
          401
        );
      });

      const err = await apiClient.post('/appointments', { service_id: 1 }).catch((e) => e);

      expect(err.response.status).toBe(401);
      expect(unauthorizedListener).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledTimes(1); // single registration for POST, not CSRF fetch
      expect(trackedIds).toHaveLength(1);
      expect(globalLoadingManager.getSnapshot().activeCount).toBe(0);

      const postCall = globalThis.fetch.mock.calls.find(([url]) =>
        String(url).endsWith('/appointments')
      );
      expect(postCall[1].headers['X-CSRF-Token']).toBe('fresh-csrf-123');
    } finally {
      window.removeEventListener('toothcare:unauthorized', unauthorizedListener);
    }
  });
});
