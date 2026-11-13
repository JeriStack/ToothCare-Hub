import React from 'react';
import { Stethoscope, UserCheck, CalendarCheck, FileCheck, ArrowRight, Sparkles } from 'lucide-react';

const STEPS = [
  {
    number: 1,
    icon: Stethoscope,
    title: 'Explore Services',
    description: 'Review standard clinic procedures, expected visit durations, and locked fee snapshots.',
  },
  {
    number: 2,
    icon: UserCheck,
    title: 'Choose Your Dentist',
    description: 'Select your attending practitioner based on specialization, room allocation, and working shifts.',
  },
  {
    number: 3,
    icon: CalendarCheck,
    title: 'Select Live Time Slot',
    description: 'Pick an open consultation slot calculated in real time against doctor shifts and sanitization buffers.',
  },
  {
    number: 4,
    icon: FileCheck,
    title: 'Submit & Track Request',
    description: 'Your request is recorded as Pending for reception review. Receive instant updates as your visit is confirmed.',
  },
];

export function HowItWorksSection({ onBookAppointment }) {
  return (
    <section
      id="how-it-works"
      className="py-20 bg-white dark:bg-gray-900"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>4-Step Booking Flow</span>
          </span>
          <h2
            id="how-it-works-heading"
            className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
          >
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 font-normal">
            Request your consultation in four straightforward steps with full visibility every step of the way.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 relative">
          <div
            className="hidden lg:block pointer-events-none absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-[#0D9488]/20 via-[#0D9488]/45 to-[#0D9488]/20 dark:from-teal-500/20 dark:via-teal-400/45 dark:to-teal-500/20"
            aria-hidden="true"
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                className="group relative z-10 bg-[#F8FAFC] dark:bg-gray-800/95 border border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 rounded-2xl p-6 shadow-xs hover:shadow-md hover:shadow-teal-900/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 motion-reduce:transform-none transition-all duration-200 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-[#0D9488] group-hover:text-white dark:group-hover:bg-teal-400/25 dark:group-hover:text-teal-200 transition-all duration-200 motion-reduce:transform-none">
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="text-2xl font-black tabular-nums text-slate-300/90 dark:text-gray-600 group-hover:text-[#0D9488]/45 dark:group-hover:text-teal-400/50 transition-colors">
                      0{step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-gray-100 text-base sm:text-lg leading-snug group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Step Progress Footer */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-gray-700/70 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                    Step {step.number} of 4
                  </span>
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {STEPS.map((s) => (
                      <span
                        key={s.number}
                        className={`h-1 rounded-full transition-all ${
                          s.number <= step.number
                            ? 'w-3.5 bg-[#0D9488] dark:bg-teal-400'
                            : 'w-2 bg-slate-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="bg-gradient-to-r from-[#F8FAFC] to-teal-50/60 dark:from-gray-800/95 dark:to-teal-950/35 border border-slate-200/90 dark:border-teal-500/25 rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-lg dark:shadow-black/20 flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
          <div className="flex items-start gap-3.5 text-center sm:text-left">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 items-center justify-center shrink-0 mt-0.5">
              <CalendarCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-gray-100 text-base sm:text-lg">
                Ready to schedule your dental visit?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-normal">
                Zero phone tag. View available dates and pick the slot that fits your schedule.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBookAppointment}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] dark:hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-900/15 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <span>Start Booking Request</span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
export default HowItWorksSection;
