import { useEffect } from 'react';

/**
 * Progressive-enhancement scroll reveal helper for the public landing page.
 *
 * Uses native CSS Scroll-Driven Animations (`animation-timeline: view()`) where supported
 * with zero runtime overhead, and gracefully falls back to `IntersectionObserver` +
 * `MutationObserver` on browsers without `view()` + `animation-range: entry` support.
 * Elements stay visible (`opacity: 1`) in reduced-motion mode, SSR, and tests.
 */
export function useScrollReveal(rootRef) {
  useEffect(() => {
    const root = rootRef?.current;
    if (!root || typeof window === 'undefined') {
      return undefined;
    }

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motionQuery?.matches) {
      root.removeAttribute('data-reveal-fallback');
      return undefined;
    }

    const supportsViewTimeline =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('(animation-timeline: view()) and (animation-range: entry)');

    if (supportsViewTimeline || typeof IntersectionObserver !== 'function') {
      root.removeAttribute('data-reveal-fallback');
      return undefined;
    }

    root.setAttribute('data-reveal-fallback', 'true');

    const observed = new WeakSet();
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.boundingClientRect.top <= 0) {
            entry.target.classList.add('is-revealed');
            intersectionObserver.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -6% 0px',
      }
    );

    const registerElement = (el) => {
      if (!(el instanceof HTMLElement) || observed.has(el)) {
        return;
      }
      observed.add(el);

      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 800;
      if (rect.top <= viewportHeight * 0.94) {
        el.classList.add('is-revealed');
        return;
      }

      intersectionObserver.observe(el);
    };

    const scanSubtree = (container) => {
      if (container instanceof HTMLElement && container.classList.contains('landing-reveal')) {
        registerElement(container);
      }
      container.querySelectorAll?.('.landing-reveal').forEach(registerElement);
    };

    scanSubtree(root);

    let mutationObserver = null;
    if (typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              scanSubtree(node);
            }
          });
        }
      });
      mutationObserver.observe(root, { childList: true, subtree: true });
    }

    const handleMotionPreferenceChange = (event) => {
      if (event.matches) {
        root.removeAttribute('data-reveal-fallback');
        intersectionObserver.disconnect();
        mutationObserver?.disconnect();
      }
    };

    motionQuery?.addEventListener?.('change', handleMotionPreferenceChange);

    return () => {
      intersectionObserver.disconnect();
      mutationObserver?.disconnect();
      motionQuery?.removeEventListener?.('change', handleMotionPreferenceChange);
      root.removeAttribute('data-reveal-fallback');
    };
  }, [rootRef]);
}
