import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useOptionalTheme } from '../../contexts/ThemeContext';
import { applyThemeToDocument, persistTheme, readStoredTheme } from '../../utils/theme';

const VARIANT_CLASSES = {
  header:
    'text-slate-200 hover:text-white hover:bg-white/10 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12304A]',
  surface:
    'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#12304A] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
};

/**
 * Accessible two-state theme toggle (Light <-> Dark).
 * Renders a Sun icon when Light Mode is active and a Moon icon when Dark Mode is active.
 */
export function ThemeToggle({
  variant = 'surface',
  showLabel = false,
  className = '',
}) {
  const themeContext = useOptionalTheme();
  const isDark = themeContext
    ? themeContext.isDark
    : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const handleToggle = () => {
    if (themeContext) {
      themeContext.toggleTheme();
      return;
    }
    const next = readStoredTheme() === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    applyThemeToDocument(next);
  };

  const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const currentLabel = isDark ? 'Dark' : 'Light';
  const variantClasses = VARIANT_CLASSES[variant] || VARIANT_CLASSES.surface;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isDark}
      aria-label={nextLabel}
      title={nextLabel}
      data-testid="theme-toggle"
      data-theme-state={isDark ? 'dark' : 'light'}
      className={`inline-flex items-center justify-center gap-2 min-h-10 ${
        showLabel ? 'px-3 py-2' : 'w-10 h-10 p-2'
      } rounded-xl text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 ${variantClasses} ${className}`}
    >
      {isDark ? (
        <Moon className="w-4 h-4 shrink-0 text-teal-300" aria-hidden="true" />
      ) : (
        <Sun
          className={`w-4 h-4 shrink-0 ${
            variant === 'header' ? 'text-amber-300' : 'text-amber-500'
          }`}
          aria-hidden="true"
        />
      )}
      {showLabel && <span className="whitespace-nowrap">{currentLabel}</span>}
    </button>
  );
}

export default ThemeToggle;
