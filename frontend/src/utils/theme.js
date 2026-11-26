export const THEME_STORAGE_KEY = 'toothcare_theme';
const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_VIEW_TRANSITION_CLASS = 'theme-view-transition';
const THEME_FALLBACK_DURATION_MS = 320;
const THEME_VIEW_TRANSITION_DURATION_MS = 480;

let fallbackTransitionTimer = null;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const DEFAULT_THEME = THEMES.LIGHT;

/**
 * Checks whether the user prefers reduced motion.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Extracts viewport coordinates (x, y) from either an explicit `{ x, y }` object
 * or a DOM/React click event so circular theme transitions originate at the toggle.
 */
export function extractTransitionOrigin(source) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (source && typeof source === 'object') {
    if (typeof source.x === 'number' && typeof source.y === 'number') {
      return { x: source.x, y: source.y };
    }

    const rect =
      typeof source.currentTarget?.getBoundingClientRect === 'function'
        ? source.currentTarget.getBoundingClientRect()
        : null;

    // Keyboard activation reports clientX === 0 && clientY === 0; anchor to button center
    if (typeof source.clientX === 'number' && typeof source.clientY === 'number') {
      if (source.clientX !== 0 || source.clientY !== 0) {
        return { x: source.clientX, y: source.clientY };
      }
    }

    if (rect && (rect.width > 0 || rect.height > 0)) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}

/**
 * Runs a theme change with a smooth global circular View Transition ripple
 * (when supported and reduced-motion is off) or a synchronized CSS cross-fade fallback.
 */
export function runThemeTransition(applyUpdate, originSource = null) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || prefersReducedMotion()) {
    applyUpdate();
    return;
  }

  const root = document.documentElement;
  const origin = extractTransitionOrigin(originSource);

  if (typeof document.startViewTransition === 'function' && typeof root.animate === 'function' && origin) {
    const x = origin.x;
    const y = origin.y;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    root.classList.add(THEME_VIEW_TRANSITION_CLASS);

    try {
      const transition = document.startViewTransition(() => {
        applyUpdate();
      });

      Promise.resolve(transition?.ready)
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: THEME_VIEW_TRANSITION_DURATION_MS,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => {
          // Ignore aborted transitions (e.g. rapid toggles)
        });

      Promise.resolve(transition?.finished)
        .catch(() => {})
        .finally(() => {
          root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
        });
      return;
    } catch {
      root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
    }
  }

  // Graceful CSS cross-fade fallback for browsers without View Transitions API
  root.classList.add(THEME_TRANSITION_CLASS);
  applyUpdate();
  if (fallbackTransitionTimer !== null) {
    window.clearTimeout(fallbackTransitionTimer);
  }
  fallbackTransitionTimer = window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
    fallbackTransitionTimer = null;
  }, THEME_FALLBACK_DURATION_MS);
}

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
