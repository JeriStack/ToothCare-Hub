import React, { useState } from 'react';
import { ArrowUp, ShieldCheck, X } from 'lucide-react';

export function LandingFooter({ onLogin, onBookAppointment, onAdminLogin }) {
  const [legalModal, setLegalModal] = useState(null); // 'privacy' | 'terms' | null

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm bg-slate-950 border border-slate-800 flex items-center justify-center">
                <img
                  src="/images/logo-icon-dark.jpg"
                  alt="ToothCare Hub Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold text-xl text-white tracking-tight leading-tight">
                  Tooth<span className="text-[#0D9488]">Care</span> Hub
                </span>
                <span className="text-[10px] text-teal-400 font-medium">
                  Healthier Smiles. Brighter Futures.
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-normal">
              A comprehensive dental appointment and clinic management platform designed to help patients discover
              dental services, find available dentists, and request appointments seamlessly.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] text-teal-400">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Standardized Clinical Data Isolation & Protection</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Platform Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#home" className="hover:text-white transition-colors">Home</a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">Services & Pricing</a>
              </li>
              <li>
                <a href="#dentists" className="hover:text-white transition-colors">Dentist Profiles</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#about" className="hover:text-white transition-colors">About Platform</a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors">Operating Hours</a>
              </li>
            </ul>
          </div>

          {/* Patient Portal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Patient Services</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onBookAppointment}
                  className="hover:text-white transition-colors text-left font-medium text-teal-400"
                >
                  Book an Appointment
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onLogin}
                  className="hover:text-white transition-colors text-left"
                >
                  Sign In to Patient Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onLogin}
                  className="hover:text-white transition-colors text-left"
                >
                  View Appointment Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onAdminLogin}
                  className="hover:text-white transition-colors text-left text-slate-500 hover:text-slate-400"
                >
                  Staff & Admin Login
                </button>
              </li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Policies & Care</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="hover:text-white transition-colors text-left"
                >
                  Patient Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="hover:text-white transition-colors text-left"
                >
                  Appointment Terms & Conditions
                </button>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors">
                  Emergency Support
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} ToothCare Hub. All rights reserved. Professional Dental Clinic Management.
          </p>

          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll back to top of page"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* LEGAL / PRIVACY MODAL */}
      {legalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {legalModal === 'privacy' ? 'Patient Privacy Policy' : 'Appointment Terms & Conditions'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
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
                    Online appointment requests are initially recorded with a <strong>Pending</strong> status and are
                    subject to clinic reception verification of operatory chair availability and dentist schedules.
                  </p>
                  <p>
                    Cancellations and rescheduling must be performed prior to consultation time through the patient
                    dashboard. Estimated procedural fees are snapshotted at booking time for transparent billing.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
