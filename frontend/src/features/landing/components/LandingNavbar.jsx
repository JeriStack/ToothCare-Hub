import React, { useState, useEffect } from 'react';
import { Menu, X, Calendar, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../features/auth';

export function LandingNavbar({ onBookAppointment, onLogin }) {
  const { user, isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = ['home', 'services', 'dentists', 'how-it-works', 'about', 'contact'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setActiveSection(sectionId);
    }
  };

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services' },
    { id: 'dentists', label: 'Our Dentists' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/80 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <a
            href="#home"
            onClick={(e) => scrollToSection(e, 'home')}
            className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg"
          >
            <div className="w-10 h-10 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
              <img
                src="/images/logo-icon.png"
                alt="ToothCare Hub Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-[#12304A]">
                Tooth<span className="text-[#0D9488]">Care</span> Hub
              </span>
              <span className="hidden sm:block text-[10px] tracking-wide text-slate-500 font-medium">
                Healthier Smiles. Brighter Futures.
              </span>
            </div>
          </a>

          {/* Desktop Center Pill Navigation */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center bg-white/80 border border-slate-200/90 rounded-full px-2 py-1 shadow-xs backdrop-blur-xs"
          >
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={(e) => scrollToSection(e, link.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-100 text-[#12304A]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop Right Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0D9488] bg-teal-50 hover:bg-teal-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <User className="w-4 h-4 text-[#0D9488]" />
                <span>
                  Portal ({user?.patient?.first_name || user?.dentist?.first_name || user?.first_name || 'Account'})
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <User className="w-4 h-4 text-slate-500" />
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={onBookAppointment}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] active:bg-[#115E59] shadow-md shadow-teal-900/15 hover:shadow-teal-900/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/98 backdrop-blur-md border-b border-slate-200 shadow-xl px-5 py-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => scrollToSection(e, link.id)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeSection === link.id
                    ? 'bg-[#CCFBF1] text-[#0F766E]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-50 text-[#0D9488] text-sm font-semibold hover:bg-teal-100 transition-colors"
              >
                <User className="w-4 h-4 text-[#0D9488]" />
                Go to Portal ({user?.patient?.first_name || user?.dentist?.first_name || user?.first_name || 'My Account'})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                <User className="w-4 h-4" />
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onBookAppointment?.();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] shadow-md shadow-teal-900/15 transition-all"
            >
              <Calendar className="w-4 h-4" />
              Book an Appointment
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
