import React, { useEffect, useState } from 'react';
import { useGlobalLoading } from '../../contexts/LoadingContext';

/**
 * Global Top Loading Bar
 *
 * Non-intrusive fixed horizontal indicator mounted at the top edge of the viewport.
 * Reflects qualifying page navigation and API activity from LoadingContext without
 * interrupting user interactions, introducing layout shifts, or displaying fake percentages.
 */
export function GlobalLoadingBar({ className = '', label = 'Loading page content...' }) {
  const { phase } = useGlobalLoading();
  const [progress, setProgress] = useState(0);

  const isShown = phase === 'visible' || phase === 'completing';

  useEffect(() => {
    if (phase === 'idle' || phase === 'pending') {
      setProgress(0);
      return undefined;
    }

    if (phase === 'completing') {
      setProgress(1);
      return undefined;
    }

    // phase === 'visible': begin with an immediate subtle lead-in and advance asymptotically
    setProgress((prev) => (prev > 0.15 && prev < 0.92 ? prev : 0.18));

    const trickleTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.92) return 0.92;
        const step = (0.92 - prev) * 0.18;
        return Math.min(0.92, Number((prev + Math.max(0.015, step)).toFixed(4)));
      });
    }, 220);

    return () => {
      clearInterval(trickleTimer);
    };
  }, [phase]);

  if (!isShown) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    );
  }

  const isCompleting = phase === 'completing';

  return (
    <>
      {/* Screen-reader polite status announcement (hidden visually) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {phase === 'visible' ? label : ''}
      </div>

      {/* Decorative fixed top progress track */}
      <div
        data-testid="global-loading-bar"
        data-phase={phase}
        role="presentation"
        aria-hidden="true"
        className={`fixed top-0 left-0 right-0 z-[9999] h-[3px] w-full pointer-events-none overflow-hidden bg-slate-200/30 dark:bg-slate-900/40 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          isCompleting ? 'opacity-0 delay-75' : 'opacity-100'
        } ${className}`}
      >
        {/* Active asymptotic progress bar */}
        <div
          data-testid="global-loading-bar-fill"
          className="relative h-full w-full origin-left bg-gradient-to-r from-[#0D9488] via-[#14B8A6] to-[#2DD4BF] dark:from-[#14B8A6] dark:via-[#2DD4BF] dark:to-[#5EEAD4] shadow-[0_0_8px_rgba(20,184,166,0.45)] dark:shadow-[0_0_10px_rgba(45,212,191,0.5)] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        >
          {/* Subtle moving sheen at the leading edge */}
          <span
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[shimmer_1.4s_infinite] motion-reduce:animate-none"
          />
        </div>
      </div>
    </>
  );
}

export default GlobalLoadingBar;
