import React from 'react';
import { Calendar, UserCheck, BellRing, Stethoscope } from 'lucide-react';

export function TrustSection() {
  const valueProps = [
    {
      icon: Calendar,
      title: 'Convenient Scheduling',
      description: 'Request appointments online with real-time slot calculation that respects clinic operating hours.',
      accent: 'text-teal-700 bg-teal-50 border-teal-100',
    },
    {
      icon: UserCheck,
      title: 'Dentist Information',
      description: 'Explore certified dentist profiles, specialties, and assigned operatory rooms before booking.',
      accent: 'text-teal-600 bg-teal-50 border-teal-100',
    },
    {
      icon: BellRing,
      title: 'Clear Appointment Updates',
      description: 'Follow your consultation status from initial triage review to confirmation and clinical completion.',
      accent: 'text-sky-600 bg-sky-50 border-sky-100',
    },
    {
      icon: Stethoscope,
      title: 'Organized Dental Services',
      description: 'Transparent catalog featuring treatment durations and official clinic fees locked at booking time.',
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
  ];

  return (
    <section className="py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueProps.map((prop, idx) => {
            const Icon = prop.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F8FAFC]/70 border border-slate-100 hover:border-slate-200 transition-all space-y-3"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border ${prop.accent}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{prop.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
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
