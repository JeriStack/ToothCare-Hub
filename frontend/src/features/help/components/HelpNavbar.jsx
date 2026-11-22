import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Calendar, User, LogIn, ArrowLeft, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../auth';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

const SECTION_LINKS = [
  { id: 'help-topics', label: 'Topics' },
  { id: 'help-faq', label: 'FAQs' },
  { id: 'help-guides', label: 'User Guides' },
  { id: 'help-contact', label: 'Contact' },
];

export function HelpNavbar({ onNavigateHome, onBookAppointment, onLogin }) {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const mobileToggleRef = useRef(null);

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

  const scrollToHelpSection = (e, id) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-gray-800 shadow-xs"
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

          {/* Desktop Center Navigation */}
          <nav
            aria-label="Help Center Navigation"
            className="hidden lg:flex items-center gap-1 bg-slate-50/90 dark:bg-gray-800/80 border border-slate-200/90 dark:border-gray-700/80 rounded-full p-1.5"
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome?.();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-white dark:hover:bg-gray-700/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Home</span>
            </a>

            <a
              href="/help-support"
              aria-current="page"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/35 dark:border-teal-400/50 text-[#0F766E] dark:text-teal-200 underline decoration-[#0D9488]/60 dark:decoration-teal-300/60 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
            >
              <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Help &amp; Support</span>
            </a>

            {SECTION_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => scrollToHelpSection(e, link.id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-white dark:hover:bg-gray-700/70 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden sm:flex items-center gap-2.5 lg:gap-3">
            <ThemeToggle variant="surface" />
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold text-[#0D9488] dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                <span>
                  Portal ({user?.patient?.first_name || user?.dentist?.first_name || user?.first_name || 'Account'})
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold border border-[#0D9488]/30 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 hover:bg-teal-100/90 dark:hover:bg-teal-500/25 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBookAppointment}
              className="landing-cta-shine inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-md shadow-teal-900/15 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>Book Appointment</span>
            </button>
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

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="help-mobile-drawer"
          className="lg:hidden max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 shadow-xl px-5 py-5 space-y-4 tch-safe-bottom"
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
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold bg-[#CCFBF1] dark:bg-teal-500/20 border border-[#0D9488]/25 dark:border-teal-400/40 text-[#0F766E] dark:text-teal-200"
            >
              <span className="inline-flex items-center gap-2">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                <span>Help &amp; Support</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-[#0D9488] dark:bg-teal-400" aria-hidden="true" />
            </a>

            {SECTION_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => scrollToHelpSection(e, link.id)}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span>{link.label}</span>
              </a>
            ))}
          </nav>

          <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogin?.();
              }}
              className="w-full flex items-center justify-center gap-2 min-h-11 py-3 rounded-xl border border-[#0D9488]/30 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-200 text-sm font-semibold hover:bg-teal-100 dark:hover:bg-teal-500/25 transition-colors cursor-pointer"
            >
              {isAuthenticated ? <User className="w-4 h-4" aria-hidden="true" /> : <LogIn className="w-4 h-4" aria-hidden="true" />}
              <span>{isAuthenticated ? 'Go to Portal' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onBookAppointment?.();
              }}
              className="w-full flex items-center justify-center gap-2 min-h-11 py-3 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-md shadow-teal-900/15 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>Book an Appointment</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default HelpNavbar;
