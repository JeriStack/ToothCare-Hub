import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useOptionalTheme } from '../../contexts/ThemeContext';
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  runThemeTransition,
} from '../../utils/theme';

const VARIANT_CLASSES = {
  header:
    'text-slate-200 hover:text-white hover:bg-white/10 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12304A]',
  surface:
    'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#12304A] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
};

/**
 * Accessible two-state theme toggle (Light <-> Dark) with animated icon morph
 * and smooth global circular View Transition ripple (with CSS cross-fade fallback).
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

  const handleToggle = (event) => {
    if (themeContext) {
      themeContext.toggleTheme(event);
      return;
    }
    const next = readStoredTheme() === 'dark' ? 'light' : 'dark';
    runThemeTransition(() => {
      persistTheme(next);
      applyThemeToDocument(next);
    }, event);
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
      className={`group inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-10 ${
        showLabel ? 'px-3 py-2' : 'w-11 h-11 sm:w-10 sm:h-10 p-2'
      } rounded-xl text-xs font-semibold transition-[transform,background-color,color,border-color] duration-200 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer focus:outline-none focus-visible:ring-2 ${variantClasses} ${className}`}
    >
      <span className="relative w-4 h-4 shrink-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <Sun
          className={`w-4 h-4 absolute transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
            variant === 'header' ? 'text-amber-300' : 'text-amber-500'
          } ${
            isDark
              ? 'opacity-0 -rotate-90 scale-0'
              : 'opacity-100 rotate-0 scale-100 group-hover:rotate-12'
          }`}
        />
        <Moon
          className={`w-4 h-4 absolute text-teal-300 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 group-hover:-rotate-12'
              : 'opacity-0 rotate-90 scale-0'
          }`}
        />
      </span>
      {showLabel && <span className="whitespace-nowrap">{currentLabel}</span>}
    </button>
  );
}

export default ThemeToggle;
