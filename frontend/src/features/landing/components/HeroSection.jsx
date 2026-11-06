import React from 'react';
import { Calendar, ArrowRight, CheckCircle2, ShieldCheck, Clock, Star } from 'lucide-react';

export function HeroSection({ onBookAppointment, onExploreServices }) {
  return (
    <section
      id="home"
      className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden bg-gradient-to-b from-[#F5F8FA] via-white to-white"
    >
      {/* Background Soft Glow Elements */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-24 right-10 w-96 h-96 bg-teal-50/50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headline, Copy, Action, and Stats */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#12304A] tracking-tight leading-[1.12]">
                Your trusted partner in dental health
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
                We prioritize preventive care and personalized treatment plans that safeguard your oral health,
                address your individual needs, and provide convenient online appointment scheduling.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onBookAppointment}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] active:bg-[#115E59] shadow-lg shadow-teal-900/15 hover:shadow-teal-900/25 transition-all transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
              >
                <Calendar className="w-4 h-4" />
                Book Your Appointment
              </button>
              <a
                href="#services"
                onClick={(e) => {
                  e.preventDefault();
                  onExploreServices?.();
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                Explore Services
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            {/* Trust Stats Cards (Echoing the visual reference) */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-2xl font-bold text-[#12304A]">
                  <span>12K</span>
                  <span className="text-base text-teal-600 font-semibold">↑</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">Smiles Protected</p>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Trusted by families for reliable and caring dental consultations.
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-2xl font-bold text-[#0D9488]">
                  <span>99%</span>
                  <span className="text-base text-teal-500 font-semibold">↑</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">Schedule Precision</p>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Delivering comfortable, on-time visits with zero double-booking.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Photograph with Organic Masking */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Asymmetric Organic Decorative Container */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/80 border border-slate-100 bg-white">
                <img
                  src="/images/hero-dentist-photo.jpg"
                  alt="Dentist consulting with patient and reviewing digital dental X-ray on tablet in modern clinic operatory"
                  className="w-full h-[380px] sm:h-[460px] lg:h-[500px] object-cover object-center"
                  loading="eager"
                />

                {/* Subtle Inner Gradient Overlay for Depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />

                {/* Floating Micro-Badge */}
                <div className="absolute bottom-5 left-5 right-5 sm:right-auto bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 shadow-lg shadow-slate-900/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Real-Time Chair Availability</p>
                    <p className="text-[11px] text-slate-500">Pessimistic locking prevents conflicting slots</p>
                  </div>
                </div>
              </div>

              {/* Decorative Background Accent */}
              <div className="absolute -top-4 -right-4 -bottom-4 -left-4 rounded-[2.5rem] border border-teal-200/40 -z-10 pointer-events-none" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
