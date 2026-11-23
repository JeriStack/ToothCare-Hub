import React from 'react';
import { ArrowUp, ShieldCheck } from 'lucide-react';

export function LandingFooter({
  onLogin,
  onBookAppointment,
  onAdminLogin,
  onHelpSupport,
  onTermsOfService,
  onPrivacyPolicy,
  onNavigateSection,
  emergencyContactHref = '#contact',
}) {
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
                <a
                  href="/privacy-policy"
                  onClick={(e) => {
                    if (onPrivacyPolicy) {
                      e.preventDefault();
                      onPrivacyPolicy();
                    }
                  }}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms-of-service"
                  onClick={(e) => {
                    if (onTermsOfService) {
                      e.preventDefault();
                      onTermsOfService();
                    }
                  }}
                  className="tch-tap hover:text-white transition-colors text-center cursor-pointer"
                >
                  Terms of Service
                </a>
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
    </footer>
  );
}
