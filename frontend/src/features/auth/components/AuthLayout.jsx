import React from 'react';
import { ArrowLeft, ShieldCheck, HeartHandshake } from 'lucide-react';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';

export function AuthLayout({ children, onNavigateHome, title, subtitle }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-gray-900 flex flex-col justify-between selection:bg-[#CCFBF1] selection:text-[#0F766E] dark:selection:bg-teal-900/70 dark:selection:text-teal-100">
      {/* Top Minimal Header */}
      <header className="w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-gray-800 py-3 px-3 sm:px-8 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 rounded-lg min-w-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
              <img
                src="/images/logo-icon.png"
                alt="ToothCare Hub Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left min-w-0">
              <span className="font-bold text-base sm:text-lg tracking-tight text-[#12304A] dark:text-white whitespace-nowrap">
                Tooth<span className="text-[#0D9488] dark:text-teal-400">Care</span> Hub
              </span>
              <span className="hidden sm:block text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                Healthier Smiles. Brighter Futures.
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <ThemeToggle variant="surface" />
            <button
              type="button"
              onClick={onNavigateHome}
              aria-label="Back to website"
              title="Back to website"
              className="group inline-flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#12304A] dark:text-slate-100 hover:bg-teal-50 dark:hover:bg-teal-900/35 hover:border-[#0D9488]/40 dark:hover:border-teal-400/50 hover:text-[#0D9488] dark:hover:text-teal-300 shadow-sm active:scale-[0.97] transition-all duration-200 motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
            >
              <ArrowLeft
                className="w-[18px] h-[18px] stroke-[2.25] transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Form Center Area */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md">
          {/* Header text if supplied */}
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#12304A] dark:text-gray-50">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700 shadow-sm p-5 sm:p-8">
            {children}
          </div>

          {/* Healthcare Trust Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
              <span>256-bit SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" />
              <span>HIPAA Compliant Care</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center text-xs text-slate-500 dark:text-gray-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} ToothCare Hub. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a href="#privacy" className="tch-tap hover:text-slate-800 dark:hover:text-gray-200 transition-colors">Privacy Policy</a>
            <span className="text-slate-300 dark:text-gray-600">&bull;</span>
            <a href="#terms" className="tch-tap hover:text-slate-800 dark:hover:text-gray-200 transition-colors">Terms of Service</a>
            <span className="text-slate-300 dark:text-gray-600">&bull;</span>
            <a href="#contact" className="tch-tap hover:text-slate-800 dark:hover:text-gray-200 transition-colors">Contact Clinic</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuthLayout;
