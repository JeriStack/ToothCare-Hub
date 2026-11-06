import React from 'react';
import { ArrowLeft, ShieldCheck, HeartHandshake } from 'lucide-react';

export function AuthLayout({ children, onNavigateHome, title, subtitle }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      {/* Top Minimal Header */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 py-3.5 px-4 sm:px-8 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0D9488] flex items-center justify-center text-white shadow-xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2 .8 4.2 1.5 6.5.8 2.5 1.5 5 2 8 0 .5.5 1 1 1s1-.5 1-1c.5-3 1.2-5.5 2-8 .7-2.3 1.5-4.5 1.5-6.5C18 4.5 15.5 2 12 2z" />
                <path d="M9 10c1.5-1 4.5-1 6 0" />
              </svg>
            </div>
            <div className="text-left">
              <span className="font-bold text-lg tracking-tight text-[#12304A]">
                ToothCare<span className="text-[#0D9488]">Hub</span>
              </span>
              <span className="hidden sm:block text-[11px] text-slate-500 font-medium">
                Patient Portal
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#12304A] py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to website</span>
          </button>
        </div>
      </header>

      {/* Main Form Center Area */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md">
          {/* Header text if supplied */}
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#12304A]">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-slate-600">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
            {children}
          </div>

          {/* Healthcare Trust Badges */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
              <span>256-bit SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-[#0D9488]" />
              <span>HIPAA Compliant Care</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} ToothCare Hub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-slate-800 transition-colors">Privacy Policy</a>
            <span className="text-slate-300">&bull;</span>
            <a href="#terms" className="hover:text-slate-800 transition-colors">Terms of Service</a>
            <span className="text-slate-300">&bull;</span>
            <a href="#contact" className="hover:text-slate-800 transition-colors">Contact Clinic</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuthLayout;
