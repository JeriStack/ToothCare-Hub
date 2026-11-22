import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Menu, X, User, LogIn, ArrowLeft, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../auth';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

const SECTION_LINKS = [
  { id: 'help-topics', label: 'Topics' },
  { id: 'help-faq', label: 'FAQs' },
  { id: 'help-guides', label: 'User Guides' },
  { id: 'help-contact', label: 'Contact' },
];

const TRACKED_SECTION_IDS = ['help-hero', ...SECTION_LINKS.map((link) => link.id)];
const HEADER_SCROLL_OFFSET = 80;
const SECTION_ACTIVATION_THRESHOLD = 150;

export function HelpNavbar({ onNavigateHome, onLogin }) {
  const { user, isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('help-hero');

  const navRef = useRef(null);
  const headerRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const linkRefs = useRef({});
  const sectionElsRef = useRef({});
  const progressRef = useRef(null);
  const scrollLockRef = useRef({ targetId: null, targetY: 0, until: 0 });
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileToggleRef.current?.focus();
      }
    };

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  const getSectionEl = useCallback((id) => {
    const cached = sectionElsRef.current[id];
    if (cached && cached.isConnected) {
      return cached;
    }
    const found = document.getElementById(id);
    if (found) {
      sectionElsRef.current[id] = found;
    }
    return found;
  }, []);

  const resolveActiveSection = useCallback(() => {
    const scrollY = window.scrollY || 0;
    if (scrollY <= 24) {
      return 'help-hero';
    }

    const docEl = document.documentElement;
    const isNearBottom =
      docEl.scrollHeight > window.innerHeight &&
      scrollY + window.innerHeight >= docEl.scrollHeight - 24;

    if (isNearBottom) {
      for (let i = TRACKED_SECTION_IDS.length - 1; i >= 0; i -= 1) {
        if (getSectionEl(TRACKED_SECTION_IDS[i])) {
          return TRACKED_SECTION_IDS[i];
        }
      }
    }

    let currentSection = 'help-hero';
    for (const id of TRACKED_SECTION_IDS) {
      const el = getSectionEl(id);
      if (el && el.getBoundingClientRect().top <= SECTION_ACTIVATION_THRESHOLD) {
        currentSection = id;
      }
    }
    return currentSection;
  }, [getSectionEl]);

  const updateIndicator = useCallback(() => {
    const activeEl = linkRefs.current[activeSection];
    if (activeEl && activeEl.offsetWidth > 0) {
      setIndicator((prev) => {
        if (prev.ready && prev.left === activeEl.offsetLeft && prev.width === activeEl.offsetWidth) {
          return prev;
        }
        return {
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          ready: true,
        };
      });
    }
  }, [activeSection]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      resizeObserver = new ResizeObserver(() => updateIndicator());
      resizeObserver.observe(navRef.current);
    }
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => updateIndicator()).catch(() => {});
    }
    return () => {
      window.removeEventListener('resize', updateIndicator);
      resizeObserver?.disconnect();
    };
  }, [updateIndicator]);

  useEffect(() => {
    let frameId = null;
    const supportsNativeScrollProgress =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timeline', 'scroll()');
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const syncScrollState = () => {
      frameId = null;
      const scrollY = window.scrollY || 0;
      setIsScrolled(scrollY > 20);

      if (!supportsNativeScrollProgress && !prefersReducedMotion && progressRef.current) {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
        progressRef.current.style.transform = `scaleX(${progress})`;
      }

      const lock = scrollLockRef.current;
      if (lock.targetId) {
        const reachedTarget = Math.abs(scrollY - lock.targetY) <= 12;
        if (!reachedTarget && Date.now() <= lock.until) {
          return;
        }
        scrollLockRef.current = { targetId: null, targetY: 0, until: 0 };
      }

      const nextSection = resolveActiveSection();
      setActiveSection((prev) => (prev === nextSection ? prev : nextSection));
    };

    const handleScroll = () => {
      if (frameId === null) {
        let ranSync = false;
        const scheduledId = window.requestAnimationFrame(() => {
          ranSync = true;
          syncScrollState();
        });
        if (!ranSync) {
          frameId = scheduledId;
        }
      }
    };

    const releaseScrollLock = () => {
      if (scrollLockRef.current.targetId) {
        scrollLockRef.current = { targetId: null, targetY: 0, until: 0 };
      }
    };

    syncScrollState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('wheel', releaseScrollLock, { passive: true });
    window.addEventListener('touchstart', releaseScrollLock, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('wheel', releaseScrollLock);
      window.removeEventListener('touchstart', releaseScrollLock);
    };
  }, [resolveActiveSection]);

  const scrollToHelpSection = (e, id) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    setActiveSection(id);

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (id === 'help-hero') {
      scrollLockRef.current = {
        targetId: 'help-hero',
        targetY: 0,
        until: Date.now() + (prefersReducedMotion ? 100 : 900),
      };
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      return;
    }

    const el = document.getElementById(id);
    if (el) {
      const currentScrollY = window.scrollY || 0;
      const rawTargetY = el.getBoundingClientRect().top + currentScrollY - HEADER_SCROLL_OFFSET;
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY =
        document.documentElement.scrollHeight > window.innerHeight
          ? Math.min(Math.max(0, rawTargetY), maxScrollY)
          : Math.max(0, rawTargetY);

      scrollLockRef.current = {
        targetId: id,
        targetY,
        until: Date.now() + (prefersReducedMotion ? 100 : 900),
      };

      window.scrollTo({
        top: targetY,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-300 backdrop-blur-md border-b ${
        isScrolled
          ? 'bg-white/95 dark:bg-gray-900/95 border-slate-200/90 dark:border-gray-800 shadow-sm'
          : 'bg-white/90 dark:bg-gray-900/90 border-slate-200/70 dark:border-gray-800/80 shadow-xs'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Brand Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome?.();
            }}
            className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 rounded-lg min-w-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 motion-reduce:transform-none transition-transform flex items-center justify-center shrink-0">
              <img
                src="/images/logo-icon.png"
                alt="ToothCare Hub Emblem"
                width="40"
                height="40"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-xl tracking-tight text-[#12304A] dark:text-white whitespace-nowrap">
                Tooth<span className="text-[#0D9488] dark:text-teal-400">Care</span> Hub
              </span>
              <span className="hidden sm:block text-[10px] tracking-wide text-slate-500 dark:text-gray-400 font-medium">
                Help Center &amp; Support
              </span>
            </div>
          </a>

          {/* Desktop Center Navigation with Sliding Scroll-Spy Indicator */}
          <nav
            ref={navRef}
            aria-label="Help Center Navigation"
            className="hidden lg:flex relative items-center gap-0.5 bg-slate-50/90 dark:bg-gray-800/80 border border-slate-200/90 dark:border-gray-700/80 rounded-full p-1.5 shadow-sm shadow-slate-900/5 dark:shadow-black/30 backdrop-blur-md"
          >
            {indicator.ready && (
              <span
                aria-hidden="true"
                data-testid="help-nav-active-indicator"
                style={{
                  width: `${indicator.width}px`,
                  transform: `translateX(${indicator.left}px)`,
                }}
                className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/30 dark:border-teal-400/50 shadow-sm shadow-teal-900/10 dark:shadow-[0_0_16px_rgba(45,212,191,0.2)] transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
              >
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#0D9488] dark:bg-teal-400" />
              </span>
            )}

            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="relative z-10 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Home</span>
            </a>

            <a
              ref={(el) => {
                linkRefs.current['help-hero'] = el;
              }}
              href="/help-support"
              aria-current="page"
              onClick={(e) => scrollToHelpSection(e, 'help-hero')}
              className={`relative z-10 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
                activeSection === 'help-hero'
                  ? `font-bold text-[#0F766E] dark:text-teal-200 ${
                      !indicator.ready
                        ? 'bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/35 dark:border-teal-400/50 shadow-sm'
                        : ''
                    }`
                  : 'font-semibold text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/5'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Help &amp; Support</span>
            </a>

            {SECTION_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  ref={(el) => {
                    linkRefs.current[link.id] = el;
                  }}
                  href={`#${link.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(e) => scrollToHelpSection(e, link.id)}
                  className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
                    isActive
                      ? `font-bold text-[#0F766E] dark:text-teal-200 ${
                          !indicator.ready
                            ? 'bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/35 dark:border-teal-400/50 shadow-sm'
                            : ''
                        }`
                      : 'font-semibold text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden sm:flex items-center gap-2.5 lg:gap-3 shrink-0">
            <ThemeToggle variant="surface" />
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 text-[#0D9488] dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Portal ({user?.patient?.first_name || user?.dentist?.first_name || user?.first_name || 'Account'})
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="group inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border border-[#0D9488]/30 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 shadow-sm shadow-teal-900/5 dark:shadow-teal-950/30 hover:bg-teal-100/90 dark:hover:bg-teal-500/25 hover:border-[#0D9488]/55 dark:hover:border-teal-300/65 hover:text-[#115E59] dark:hover:text-white active:scale-[0.98] transition-all duration-200 motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#0D9488]/12 dark:bg-teal-400/20 text-[#0D9488] dark:text-teal-300 transition-colors group-hover:bg-[#0D9488]/20 dark:group-hover:bg-teal-400/30 shrink-0">
                  <LogIn className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </span>
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <div className="sm:hidden">
              <ThemeToggle variant="surface" />
            </div>
            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="help-mobile-drawer"
              aria-label="Toggle Help Center navigation menu"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Scroll Progress Indicator */}
      <div
        ref={progressRef}
        aria-hidden="true"
        data-testid="help-scroll-progress"
        className="landing-scroll-progress pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0D9488] via-teal-400 to-emerald-400 dark:from-teal-400 dark:via-emerald-300 dark:to-sky-400 shadow-[0_0_8px_rgba(13,148,136,0.45)]"
      />

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="help-mobile-drawer"
          className="lg:hidden landing-hero-enter max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-slate-200 dark:border-gray-800 shadow-xl px-5 py-5 space-y-4 tch-safe-bottom"
        >
          <nav aria-label="Mobile Help Center Navigation" className="flex flex-col space-y-1">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                onNavigateHome?.();
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
              <span>Back to Home</span>
            </a>

            <a
              href="/help-support"
              aria-current="page"
              onClick={(e) => scrollToHelpSection(e, 'help-hero')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${
                activeSection === 'help-hero'
                  ? 'font-bold bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/25 dark:border-teal-400/40 text-[#0F766E] dark:text-teal-200'
                  : 'font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                <span>Help &amp; Support</span>
              </span>
              {activeSection === 'help-hero' && (
                <span className="w-2 h-2 rounded-full bg-[#0D9488] dark:bg-teal-400" aria-hidden="true" />
              )}
            </a>

            {SECTION_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(e) => scrollToHelpSection(e, link.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'font-bold bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/25 dark:border-teal-400/40 text-[#0F766E] dark:text-teal-200'
                      : 'font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#0D9488] dark:bg-teal-400" aria-hidden="true" />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogin?.();
              }}
              className="group w-full flex items-center justify-center gap-2 min-h-11 py-3 rounded-xl border border-[#0D9488]/30 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 text-sm font-semibold hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-all duration-200 motion-reduce:transition-none cursor-pointer"
            >
              {isAuthenticated ? <User className="w-4 h-4" aria-hidden="true" /> : <LogIn className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />}
              <span>{isAuthenticated ? 'Go to Portal' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default HelpNavbar;
