import React from 'react';
import { Calendar, UserCheck, BellRing, Stethoscope } from 'lucide-react';

export function TrustSection() {
  const valueProps = [
    {
      icon: Calendar,
      title: 'Convenient Scheduling',
      description: 'Request appointments online with real-time slot calculation that respects clinic operating hours.',
      accent: 'text-teal-700 bg-teal-50 border-teal-100 dark:text-teal-300 dark:bg-teal-950/60 dark:border-teal-800/70',
    },
    {
      icon: UserCheck,
      title: 'Dentist Information',
      description: 'Explore certified dentist profiles, specialties, and assigned operatory rooms before booking.',
      accent: 'text-teal-600 bg-teal-50 border-teal-100 dark:text-teal-300 dark:bg-teal-950/60 dark:border-teal-800/70',
    },
    {
      icon: BellRing,
      title: 'Clear Appointment Updates',
      description: 'Follow your consultation status from initial triage review to confirmation and clinical completion.',
      accent: 'text-sky-600 bg-sky-50 border-sky-100 dark:text-sky-300 dark:bg-sky-950/60 dark:border-sky-800/70',
    },
    {
      icon: Stethoscope,
      title: 'Organized Dental Services',
      description: 'Transparent catalog featuring treatment durations and official clinic fees locked at booking time.',
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/70',
    },
  ];

  return (
    <section className="py-16 bg-white dark:bg-gray-900 border-y border-slate-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueProps.map((prop, idx) => {
            const Icon = prop.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F8FAFC]/70 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700 hover:border-slate-200 dark:hover:border-gray-600 transition-all space-y-3"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border ${prop.accent}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-gray-100 text-base">{prop.title}</h3>
                <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed font-normal">
                  {prop.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
