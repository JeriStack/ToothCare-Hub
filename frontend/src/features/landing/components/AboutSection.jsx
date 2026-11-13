import React from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  HeartHandshake,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

const HIGHLIGHTS = [
  {
    title: 'Reliable Scheduling Engine',
    description:
      'Calculates live bookable slots accounting for dentist working shifts, buffer times, and clinic holidays.',
  },
  {
    title: 'Transparent Clinic Catalog',
    description:
      'View service descriptions, standard procedural durations, and clinic fees upfront.',
  },
  {
    title: 'Direct Patient Control',
    description:
      'Manage upcoming consultations, review past visits, and request schedule adjustments easily.',
  },
];

const QUALITY_PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Zero Double Booking',
    description:
      'Pessimistic transaction locking serializes requests so you never arrive to find an overlapping patient in your chair.',
  },
  {
    icon: Clock,
    title: 'Turnaround Sanitization Buffers',
    description:
      'Our scheduling automatically enforces turn-around buffers between patients for thorough operatory disinfection.',
  },
  {
    icon: RefreshCw,
    title: 'Clear Request Lifecycle',
    description:
      'Track your booking as it progresses from review to confirmed, completed, or rescheduled states.',
  },
];

export function AboutSection({ onBookAppointment }) {
  return (
    <section
      id="about"
      className="py-20 bg-slate-50/60 dark:bg-gray-950/60"
      aria-labelledby="about-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Mission & Highlights */}
          <div className="landing-reveal lg:col-span-7 space-y-6" style={{ '--reveal-index': 0 }}>
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Why ToothCare Hub</span>
              </span>
              <h2
                id="about-heading"
                className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
              >
                A Better Way to Manage Your Dental Appointments
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
              ToothCare Hub brings essential dental appointment information into one convenient platform.
              Patients can discover verified services, explore attending dentist profiles, and request consultations
              with ease, while clinic staff coordinate operatory chairs and review requests through an organized digital workflow.
            </p>

            <div className="pt-2 space-y-3.5">
              {HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/80 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-800 hover:border-[#0D9488]/35 dark:hover:border-teal-400/35 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-gray-100 text-sm sm:text-base leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-normal leading-relaxed text-justify">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onBookAppointment}
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] text-white text-xs sm:text-sm font-semibold hover:bg-[#0F766E] dark:hover:bg-[#0D9488] shadow-md shadow-teal-900/15 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950"
              >
                <span>Schedule a Consultation</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* Right Column: Platform Quality Card */}
          <div className="landing-reveal lg:col-span-5" style={{ '--reveal-index': 2 }}>
            <div className="bg-white dark:bg-gray-800/95 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-gray-700/80 shadow-xl shadow-slate-200/50 dark:shadow-black/30 space-y-6">
              <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-gray-700/80 pb-5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-gray-100 text-base sm:text-lg leading-snug">
                    Patient-Centered Focus
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Built for seamless clinic visits
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {QUALITY_PILLARS.map((pillar) => {
                  const Icon = pillar.icon;
                  return (
                    <div
                      key={pillar.title}
                      className="p-4 rounded-2xl bg-slate-50/90 dark:bg-gray-900/75 border border-slate-200/70 dark:border-gray-700/80 hover:border-[#0D9488]/35 dark:hover:border-teal-400/35 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span className="font-bold text-slate-900 dark:text-gray-100 text-xs sm:text-sm">
                          {pillar.title}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
                        {pillar.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export default AboutSection;
