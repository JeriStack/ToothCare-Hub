import React from 'react';
import { Calendar, UserCheck, BellRing, Stethoscope } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: Calendar,
    tag: 'Scheduling',
    title: 'Convenient Scheduling',
    description:
      'Request appointments online with real-time slot calculation that respects clinic operating hours.',
    accent:
      'text-teal-700 bg-teal-50 border-teal-200/80 dark:text-teal-300 dark:bg-teal-500/15 dark:border-teal-400/30',
  },
  {
    icon: UserCheck,
    tag: 'Doctors',
    title: 'Dentist Information',
    description:
      'Explore certified dentist profiles, specialties, and assigned operatory rooms before booking.',
    accent:
      'text-teal-600 bg-teal-50 border-teal-200/80 dark:text-teal-300 dark:bg-teal-500/15 dark:border-teal-400/30',
  },
  {
    icon: BellRing,
    tag: 'Tracking',
    title: 'Clear Appointment Updates',
    description:
      'Follow your consultation status from initial triage review to confirmation and clinical completion.',
    accent:
      'text-sky-600 bg-sky-50 border-sky-200/80 dark:text-sky-300 dark:bg-sky-500/15 dark:border-sky-400/30',
  },
  {
    icon: Stethoscope,
    tag: 'Pricing',
    title: 'Organized Dental Services',
    description:
      'Transparent catalog featuring treatment durations and official clinic fees locked at booking time.',
    accent:
      'text-emerald-600 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-400/30',
  },
];

export function TrustSection() {
  return (
    <section
      className="py-16 bg-white dark:bg-gray-900 border-y border-slate-100 dark:border-gray-800"
      aria-label="Core clinic platform highlights"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUE_PROPS.map((prop, idx) => {
            const Icon = prop.icon;
            return (
              <article
                key={prop.title}
                style={{ '--reveal-index': idx }}
                className="landing-reveal group p-6 rounded-2xl bg-[#F8FAFC] dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 shadow-xs hover:shadow-md hover:shadow-teal-900/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 motion-reduce:transform-none transition-all duration-200 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-xs group-hover:scale-105 transition-transform duration-200 motion-reduce:transform-none ${prop.accent}`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-gray-400 border border-slate-200/80 dark:border-gray-700/80 group-hover:text-[#0F766E] dark:group-hover:text-teal-300 group-hover:border-[#0D9488]/30 dark:group-hover:border-teal-400/35 transition-colors">
                      {prop.tag}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-gray-100 text-base leading-snug group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                      {prop.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
                      {prop.description}
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
    </section>
  );
}
export default TrustSection;
