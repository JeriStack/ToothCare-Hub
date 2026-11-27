export const THEME_STORAGE_KEY = 'toothcare_theme';
const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_VIEW_TRANSITION_CLASS = 'theme-view-transition';
const THEME_FALLBACK_DURATION_MS = 240;
const THEME_VIEW_TRANSITION_DURATION_MS = 380;

let fallbackTransitionTimer = null;
let activeViewTransitionSeq = 0;
let activeViewTransition = null;
let activeViewAnimation = null;

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
 * Runs a theme change with a smooth GPU-composited circular View Transition reveal
 * (when supported and reduced-motion is off) or a lightweight synchronized CSS fallback.
 * Safely cancels in-flight transitions on rapid toggles to prevent mid-animation flicker.
 */
export function runThemeTransition(applyUpdate, originSource = null) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || prefersReducedMotion()) {
    applyUpdate();
    return;
  }

  const root = document.documentElement;
  const origin = extractTransitionOrigin(originSource);

  if (fallbackTransitionTimer !== null) {
    window.clearTimeout(fallbackTransitionTimer);
    fallbackTransitionTimer = null;
    root.classList.remove(THEME_TRANSITION_CLASS);
  }

  if (typeof document.startViewTransition === 'function' && typeof root.animate === 'function' && origin) {
    const x = Math.round(origin.x);
    const y = Math.round(origin.y);
    const endRadius = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    );

    // Abort any in-flight theme view transition cleanly so rapid toggles never fight or flash
    if (activeViewAnimation) {
      try {
        activeViewAnimation.cancel();
      } catch {
        // Ignore already-finished animation
      }
      activeViewAnimation = null;
    }
    if (activeViewTransition && typeof activeViewTransition.skipTransition === 'function') {
      try {
        activeViewTransition.skipTransition();
      } catch {
        // Ignore already-settled transition
      }
      activeViewTransition = null;
    }

    const seq = ++activeViewTransitionSeq;
    root.classList.add(THEME_VIEW_TRANSITION_CLASS);

    try {
      const transition = document.startViewTransition(() => {
        applyUpdate();
      });
      activeViewTransition = transition;

      Promise.resolve(transition?.ready)
        .then(() => {
          if (seq !== activeViewTransitionSeq) {
            return;
          }
          activeViewAnimation = root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
              opacity: [0.92, 1],
            },
            {
              duration: THEME_VIEW_TRANSITION_DURATION_MS,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              fill: 'both',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => {
          // Ignore aborted transitions (e.g. rapid toggles or backgrounded tabs)
        });

      Promise.resolve(transition?.finished)
        .catch(() => {})
        .finally(() => {
          if (seq === activeViewTransitionSeq) {
            activeViewTransition = null;
            activeViewAnimation = null;
            root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
          }
        });
      return;
    } catch {
      if (seq === activeViewTransitionSeq) {
        activeViewTransition = null;
        activeViewAnimation = null;
        root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
      }
    }
  }

  // Graceful lightweight CSS cross-fade fallback for browsers without View Transitions API
  root.classList.add(THEME_TRANSITION_CLASS);
  applyUpdate();
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

  if (root.classList.contains('dark') !== isDark) {
    root.classList.toggle('dark', isDark);
  }
  if (root.dataset.theme !== normalized) {
    root.dataset.theme = normalized;
  }
  if (root.style.colorScheme !== normalized) {
    root.style.colorScheme = normalized;
  }

  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta && meta.getAttribute('content') !== normalized) {
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
