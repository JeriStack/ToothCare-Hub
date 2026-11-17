import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  normalizeTheme,
  persistTheme,
  readStoredTheme,
} from '../utils/theme';

const ThemeContext = createContext(null);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Centralized ThemeProvider supporting explicit `'light'` (default) and `'dark'` modes.
 * Persists user preference in localStorage and syncs across browser tabs without OS sniffing.
 */
export function ThemeProvider({ children, defaultTheme }) {
  const [theme, setThemeState] = useState(() => {
    if (defaultTheme === THEMES.LIGHT || defaultTheme === THEMES.DARK) {
      return defaultTheme;
    }
    return readStoredTheme();
  });

  useIsomorphicLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorageChange = (event) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }
      setThemeState(normalizeTheme(event.newValue));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme) => {
    const resolved = normalizeTheme(
      typeof nextTheme === 'function' ? nextTheme(theme) : nextTheme
    );
    persistTheme(resolved);
    applyThemeToDocument(resolved);
    setThemeState(resolved);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) => {
      const next = prevTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      persistTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: theme || DEFAULT_THEME,
      isDark: theme === THEMES.DARK,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Accessor hook for the active theme state and switcher controls.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Safe optional accessor for shared chrome components that may render in isolated unit specs.
 */
export function useOptionalTheme() {
  return useContext(ThemeContext);
}
