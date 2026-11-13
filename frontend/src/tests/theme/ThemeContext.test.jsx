import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  initializeTheme,
  normalizeTheme,
  persistTheme,
  readStoredTheme,
} from '../../utils/theme';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

function ThemeProbe() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="active-theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <button type="button" onClick={toggleTheme}>
        Toggle Theme
      </button>
      <button type="button" onClick={() => setTheme('dark')}>
        Force Dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Force Light
      </button>
    </div>
  );
}

describe('Theme Utilities & ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    document.head.innerHTML = '<meta name="color-scheme" content="light" />';
    vi.restoreAllMocks();
  });

  it('defaults strictly to Light Mode when no preference is stored', () => {
    expect(DEFAULT_THEME).toBe(THEMES.LIGHT);
    expect(readStoredTheme()).toBe('light');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light');
  });

  it('ignores OS prefers-color-scheme and unsupported storage values by defaulting to light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(normalizeTheme('system')).toBe('light');
    expect(normalizeTheme('midnight')).toBe('light');
    expect(readStoredTheme()).toBe('light');

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    window.matchMedia = originalMatchMedia;
  });

  it('switches to Dark Mode, updates root attributes, and persists across remounts', () => {
    const { unmount } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }));

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');

    unmount();

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches cleanly back to Light Mode and persists the light selection', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Force Light' }));

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('handles unavailable or throwing localStorage safely without breaking state updates', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(readStoredTheme()).toBe('light');
    expect(persistTheme('dark')).toBe(false);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    fireEvent.click(screen.getByRole('button', { name: 'Force Dark' }));
    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('synchronizes theme changes across browser tabs via storage events', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: THEME_STORAGE_KEY,
          newValue: 'dark',
        })
      );
    });

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'unrelated_key',
          newValue: 'light',
        })
      );
    });

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
  });

  it('initializes saved document theme synchronously before React mounts', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(initializeTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    expect(applyThemeToDocument('invalid-value')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('throws a clear error when useTheme is called outside ThemeProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow('useTheme must be used within a ThemeProvider');
    consoleErrorSpy.mockRestore();
  });
});
