import React, { useState } from 'react';
import { Calendar, ArrowRight, ShieldCheck, Clock, Users, TrendingUp } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';

const TRUST_STATS = [
  {
    value: '12K',
    badge: '↑',
    title: 'Smiles Protected',
    description: 'Trusted by families for reliable and caring dental consultations.',
    icon: Users,
    valueClass: 'text-[#12304A] dark:text-white',
  },
  {
    value: '99%',
    badge: '↑',
    title: 'Schedule Precision',
    description: 'Delivering comfortable, on-time visits with zero double-booking.',
    icon: Clock,
    valueClass: 'text-[#0D9488] dark:text-teal-400',
  },
];

export function HeroSection({ onBookAppointment, onExploreServices }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  return (
    <section
      id="home"
      className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden bg-gradient-to-b from-[#F5F8FA] via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900"
    >
      {/* Background Soft Glow Elements */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-teal-100/40 dark:bg-teal-900/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-24 right-10 w-96 h-96 bg-teal-50/50 dark:bg-sky-900/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headline, Copy, Action, and Stats */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#12304A] dark:text-white tracking-tight leading-[1.12]">
                Your trusted partner in dental health
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-gray-300 leading-relaxed max-w-xl font-normal text-justify">
                We prioritize preventive care and personalized treatment plans that safeguard your oral health,
                address your individual needs, and provide convenient online appointment scheduling.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onBookAppointment}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white font-semibold text-sm hover:bg-[#0F766E] dark:hover:bg-[#0D9488] active:bg-[#115E59] shadow-lg shadow-teal-900/15 hover:shadow-teal-900/25 transition-all transform hover:-translate-y-0.5 motion-reduce:transform-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
              >
                <Calendar className="w-4 h-4" aria-hidden="true" />
                Book Your Appointment
              </button>
              <a
                href="#services"
                onClick={(e) => {
                  e.preventDefault();
                  onExploreServices?.();
                }}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-slate-700 dark:text-gray-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-gray-800 hover:border-[#0D9488]/35 dark:hover:border-teal-400/40 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <span>Explore Services</span>
                <ArrowRight
                  className="w-4 h-4 text-slate-400 dark:text-gray-400 group-hover:text-[#0D9488] dark:group-hover:text-teal-300 transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </a>
            </div>

            {/* Trust Stats Cards */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TRUST_STATS.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <article
                    key={stat.title}
                    className="group bg-[#F8FAFC] dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 rounded-2xl p-5 shadow-xs hover:shadow-md hover:shadow-teal-900/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 motion-reduce:transform-none transition-all duration-200 flex flex-col justify-between gap-3.5"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${stat.valueClass}`}>
                            {stat.value}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-500/15 text-[#0F766E] dark:text-teal-300 border border-[#0D9488]/20 dark:border-teal-400/30"
                            aria-hidden="true"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>{stat.badge}</span>
                          </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 motion-reduce:transform-none">
                          <StatIcon className="w-4 h-4" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                          {stat.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
                          {stat.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className="h-0.5 w-8 rounded-full bg-slate-200 dark:bg-gray-700 group-hover:w-14 group-hover:bg-[#0D9488] dark:group-hover:bg-teal-400 transition-all duration-300 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </article>
                );
              })}
            </div>
          </div>

          {/* Right Column: Hero Photograph with Organic Masking */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Asymmetric Organic Decorative Container */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/80 dark:shadow-slate-950/70 border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                {!imageLoaded && (
                  <Skeleton className="absolute inset-0 w-full h-[380px] sm:h-[460px] lg:h-[500px] rounded-3xl z-0" />
                )}
                <img
                  src="/images/hero-dentist-photo.jpg"
                  alt="Dentist consulting with patient and reviewing digital dental X-ray on tablet in modern clinic operatory"
                  className={`w-full h-[380px] sm:h-[460px] lg:h-[500px] object-cover object-center transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="eager"
                  onLoad={() => setImageLoaded(true)}
                />

                {/* Subtle Inner Gradient Overlay for Depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />

                {/* Floating Micro-Badge */}
                <div className="absolute bottom-5 left-5 right-5 sm:right-auto bg-white/95 dark:bg-gray-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 dark:border-gray-700 shadow-lg shadow-slate-900/15 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-gray-50">Real-Time Chair Availability</p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">Pessimistic locking prevents conflicting slots</p>
                  </div>
                </div>
              </div>

              {/* Decorative Background Accent */}
              <div className="absolute -top-4 -right-4 -bottom-4 -left-4 rounded-[2.5rem] border border-teal-200/40 dark:border-teal-500/20 -z-10 pointer-events-none" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
