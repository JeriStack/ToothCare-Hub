import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { GlobalLoadingBar } from '../../components/ui/GlobalLoadingBar';
import { THEME_STORAGE_KEY } from '../../utils/theme';

const mockUseGlobalLoading = vi.fn();

vi.mock('../../contexts/LoadingContext', () => ({
  useGlobalLoading: () => mockUseGlobalLoading(),
}));

describe('ThemeToggle & Themed UI Primitives', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    mockUseGlobalLoading.mockReturnValue({ phase: 'idle' });
  });

  it('toggles Light <-> Dark mode via ThemeToggle with accessible ARIA attributes and labels', () => {
    render(
      <ThemeProvider>
        <ThemeToggle showLabel={true} variant="surface" />
      </ThemeProvider>
    );

    const toggle = screen.getByTestId('theme-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(toggle).toHaveAttribute('data-theme-state', 'light');
    expect(toggle).toHaveTextContent('Light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Switch to light mode');
    expect(toggle).toHaveAttribute('data-theme-state', 'dark');
    expect(toggle).toHaveTextContent('Dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('supports header variant and standalone fallback toggling without ThemeProvider', () => {
    render(<ThemeToggle variant="header" />);
    const toggle = screen.getByTestId('theme-toggle');

    expect(toggle.className).toContain('text-slate-200');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('includes semantic dark-mode utility classes on Button, Input, Modal, StatusBadge, EmptyState, Skeleton, and GlobalLoadingBar', () => {
    mockUseGlobalLoading.mockReturnValue({ phase: 'visible' });

    render(
      <ThemeProvider defaultTheme="dark">
        <div>
          <GlobalLoadingBar />
          <Button variant="primary">Book Visit</Button>
          <Button variant="outline">Cancel</Button>
          <Input label="Patient Email" placeholder="patient@toothcare.com" />
          <StatusBadge status="CONFIRMED" />
          <EmptyState title="No Appointments" description="No upcoming visits found." />
          <Skeleton data-testid="skeleton-box" className="h-4 w-24" />
          <Modal isOpen={true} title="Visit Summary" footer={<span>Footer</span>}>
            <p>Appointment details</p>
          </Modal>
        </div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Book Visit' }).className).toContain('dark:bg-[#0F766E]');
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('dark:bg-gray-800');

    const input = screen.getByPlaceholderText('patient@toothcare.com');
    expect(input.className).toContain('dark:bg-gray-800');
    expect(input.className).toContain('dark:text-gray-100');

    const badge = screen.getAllByRole('status').find((el) => el.textContent?.includes('Confirmed'));
    expect(badge?.className).toContain('dark:text-teal-300');

    const emptyRegion = screen.getByRole('region', { name: 'No Appointments' });
    expect(emptyRegion.className).toContain('dark:bg-gray-800');

    expect(screen.getByTestId('skeleton-box').className).toContain('dark:bg-slate-700/80');
    expect(screen.getByTestId('global-loading-bar').className).toContain('dark:bg-slate-900/40');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Visit Summary').className).toContain('dark:text-gray-50');
  });

  it('animates theme switches via View Transitions circular ripple when supported, and falls back or respects reduced motion', async () => {
    const animateMock = vi.fn();
    const originalAnimate = document.documentElement.animate;
    const originalStartVT = document.startViewTransition;
    const originalMatchMedia = window.matchMedia;

    // 1. View Transitions API path
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    document.documentElement.animate = animateMock;
    document.startViewTransition = vi.fn((cb) => {
      cb();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });

    const { unmount } = render(
      <ThemeProvider>
        <ThemeToggle variant="surface" />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('theme-toggle'), { clientX: 200, clientY: 40 });
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    expect(animateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clipPath: expect.arrayContaining([expect.stringContaining('circle(0px at 200px 40px)')]),
      }),
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' })
    );
    expect(document.documentElement.classList.contains('theme-view-transition')).toBe(false);

    // 2. Reduced motion skips view transition and CSS fallback
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    document.startViewTransition.mockClear();
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    unmount();

    // 3. CSS fallback when startViewTransition is unavailable
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    delete document.startViewTransition;
    vi.useFakeTimers();

    render(
      <ThemeProvider>
        <ThemeToggle variant="surface" />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true);
    vi.advanceTimersByTime(350);
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);

    vi.useRealTimers();
    document.documentElement.animate = originalAnimate;
    document.startViewTransition = originalStartVT;
    window.matchMedia = originalMatchMedia;
  });
});
