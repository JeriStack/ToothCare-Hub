import React, { useState } from 'react';
import { ArrowUp, ShieldCheck, X } from 'lucide-react';


import { DialogOverlay } from '../../../components/ui/DialogOverlay';
export function LandingFooter({
  onLogin,
  onBookAppointment,
  onAdminLogin,
  onHelpSupport,
  onNavigateSection,
  emergencyContactHref = '#contact',
}) {
  const [legalModal, setLegalModal] = useState(null); // 'privacy' | 'terms' | null

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionLinkClick = (e, sectionId) => {
    if (onNavigateSection) {
      e.preventDefault();
      onNavigateSection(sectionId);
    }
  };

  return (
    <footer className="landing-deferred-section bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        
        {/* Top Grid */}
        <div data-reveal="footer" className="landing-reveal grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-center">
          
          {/* Brand Info */}
          <div className="md:col-span-2 lg:col-span-2 space-y-4 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img
                  src="/images/logo-icon.png"
                  alt="ToothCare Hub Logo"
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-bold text-xl text-white tracking-tight leading-tight">
                  Tooth<span className="text-[#0D9488]">Care</span> Hub
                </span>
                <span className="text-[10px] text-teal-400 font-medium">
                  Healthier Smiles. Brighter Futures.
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-normal text-center">
              A comprehensive dental appointment and clinic management platform designed to help patients discover
              dental services, find available dentists, and request appointments seamlessly.
            </p>
            <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-teal-400 text-center">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Standardized Clinical Data Isolation & Protection</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3 text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Platform Navigation</h4>
            <ul className="space-y-2 text-xs flex flex-col items-center">
              <li>
                <a href="#home" onClick={(e) => handleSectionLinkClick(e, 'home')} className="hover:text-white transition-colors">Home</a>
              </li>
              <li>
                <a href="#about" onClick={(e) => handleSectionLinkClick(e, 'about')} className="hover:text-white transition-colors">About Platform</a>
              </li>
              <li>
                <a href="#services" onClick={(e) => handleSectionLinkClick(e, 'services')} className="hover:text-white transition-colors">Services &amp; Pricing</a>
              </li>
              <li>
                <a href="#dentists" onClick={(e) => handleSectionLinkClick(e, 'dentists')} className="hover:text-white transition-colors">Dentist Profiles</a>
              </li>
              <li>
                <a href="#how-it-works" onClick={(e) => handleSectionLinkClick(e, 'how-it-works')} className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#contact" onClick={(e) => handleSectionLinkClick(e, 'contact')} className="hover:text-white transition-colors">Operating Hours</a>
              </li>
            </ul>
          </div>

          {/* Patient Portal Links */}
          <div className="space-y-3 text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Patient Services</h4>
            <ul className="space-y-2 text-xs flex flex-col items-center">
              <li>
                <button
                  type="button"
                  onClick={onBookAppointment}
                  className="tch-tap hover:text-teal-300 transition-colors text-center font-medium text-teal-400 cursor-pointer"
                >
                  Book an Appointment
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onLogin}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  Sign In to Patient Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onLogin}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  View Appointment Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onAdminLogin}
                  className="tch-tap text-slate-400 hover:text-white transition-colors text-center cursor-pointer"
                >
                  Staff & Admin Login
                </button>
              </li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div className="space-y-3 md:col-span-2 lg:col-span-1 text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Policies &amp; Care</h4>
            <ul className="space-y-2 text-xs flex flex-col items-center">
              <li>
                <a
                  href="/help-support"
                  onClick={(e) => {
                    e.preventDefault();
                    onHelpSupport?.();
                  }}
                  className="tch-tap hover:text-teal-300 transition-colors text-center font-medium text-teal-400 cursor-pointer"
                >
                  Help &amp; Support
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  Patient Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  Appointment Terms & Conditions
                </button>
              </li>
              <li>
                <a href={emergencyContactHref} className="hover:text-white transition-colors">
                  Emergency Support
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center sm:text-left">
          <p>
            © {new Date().getFullYear()} ToothCare Hub. All rights reserved. Professional Dental Clinic Management.
          </p>

          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll back to top of page"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs cursor-pointer"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* LEGAL / PRIVACY MODAL */}
      {legalModal && (
        <DialogOverlay
          onClose={() => setLegalModal(null)} className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-gray-50 text-base">
                {legalModal === 'privacy' ? 'Patient Privacy Policy' : 'Appointment Terms & Conditions'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1 rounded-lg text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-gray-300 space-y-3 leading-relaxed">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    ToothCare Hub prioritizes patient confidentiality and data integrity. All demographic data,
                    chief complaints, and appointment histories are stored with role-based access control and
                    pessimistic transactional protection.
                  </p>
                  <p>
                    We never disclose patient personal contact numbers or treatment details to unauthorized third
                    parties. Sessions use secure HttpOnly cookies with CSRF token authentication.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Online appointment requests are initially recorded with a <strong className="dark:text-white">Pending</strong> status and are
                    subject to clinic reception verification of operatory chair availability and dentist schedules.
                  </p>
                  <p>
                    Cancellations and rescheduling must be performed prior to consultation time through the patient
                    dashboard. Estimated procedural fees are snapshotted at booking time for transparent billing.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </footer>
  );
}
