export const THEME_STORAGE_KEY = 'toothcare_theme';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const DEFAULT_THEME = THEMES.LIGHT;

/**
 * Normalizes any persisted or caller-provided value into a supported theme.
 * Strict Light-default policy: only an explicit `'dark'` enables dark mode.
 */
export function normalizeTheme(value) {
  return value === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

/**
 * Safely reads the saved user theme preference from localStorage.
 * Falls back to Light Mode when storage is missing, disabled, or corrupt.
 */
export function readStoredTheme() {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeTheme(raw);
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Safely persists the selected theme preference to localStorage.
 */
export function persistTheme(theme) {
  const normalized = normalizeTheme(theme);

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies the active theme class, dataset marker, and root `color-scheme`
 * metadata cleanly on `document.documentElement` and `<meta name="color-scheme">`.
 */
export function applyThemeToDocument(theme) {
  const normalized = normalizeTheme(theme);

  if (typeof document === 'undefined') {
    return normalized;
  }

  const root = document.documentElement;
  const isDark = normalized === THEMES.DARK;

  root.classList.toggle('dark', isDark);
  root.dataset.theme = normalized;
  root.style.colorScheme = normalized;

  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', normalized);
  }

  return normalized;
}

/**
 * Reads any persisted theme and applies it immediately before mounting.
 */
export function initializeTheme() {
  return applyThemeToDocument(readStoredTheme());
}
