import React from 'react';
import { CalendarCheck, Shield, Clock, FileText, Smartphone, History, Sparkles } from 'lucide-react';

const BENEFITS = [
  {
    icon: CalendarCheck,
    tag: 'Real-Time',
    title: 'Availability-Based Scheduling',
    description: 'Slots are calculated live directly from practitioner shifts, approved leaves, and clinic operating schedules.',
  },
  {
    icon: Clock,
    tag: 'Hygiene',
    title: 'Turnaround Sanitization Buffers',
    description: 'Mandatory clinical turnaround buffers between consultations ensure complete operatory room hygiene.',
  },
  {
    icon: History,
    tag: 'Auditability',
    title: 'Complete Lifecycle History',
    description: 'Audit trails record every state transition (Pending, Confirmed, Completed, Cancelled) with timestamps.',
  },
  {
    icon: Shield,
    tag: 'Transparency',
    title: 'Immutable Price Snapshots',
    description: 'Your estimated fee is locked at the moment of booking so prices remain predictable on consultation day.',
  },
  {
    icon: FileText,
    tag: 'Clinical Prep',
    title: 'Symptom & Chief Complaint Notes',
    description: 'Share symptoms and specific accommodation needs securely with the dentist in advance.',
  },
  {
    icon: Smartphone,
    tag: 'Responsive',
    title: 'Accessible Mobile Interface',
    description: 'Book, review, or reschedule on your phone, tablet, or desktop with full responsive support.',
  },
];

export function BenefitsSection() {
  return (
    <section
      className="py-20 bg-white dark:bg-gray-900 border-t border-slate-100 dark:border-gray-800"
      aria-labelledby="benefits-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Patient-First Clinical Standards</span>
          </span>
          <h2
            id="benefits-heading"
            className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
          >
            Designed for Modern Patient Care
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 font-normal">
            ToothCare Hub balances clinical precision with an intuitive, comfortable patient scheduling journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <article
                key={b.title}
                className="group relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-[#F8FAFC] dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 shadow-xs hover:shadow-md hover:shadow-teal-900/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 motion-reduce:transform-none transition-all duration-200 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0D9488] dark:text-teal-300 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-[#0D9488] group-hover:text-white dark:group-hover:bg-teal-400/25 dark:group-hover:text-teal-200 transition-all duration-200 motion-reduce:transform-none">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-900/80 text-slate-600 dark:text-gray-400 border border-slate-200/80 dark:border-gray-700/80 group-hover:text-[#0F766E] dark:group-hover:text-teal-300 group-hover:border-[#0D9488]/30 dark:group-hover:border-teal-400/35 transition-colors">
                      {b.tag}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-gray-100 text-base sm:text-lg leading-snug group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                      {b.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-normal text-justify">
                      {b.description}
                    </p>
                  </div>
                </div>

                <div
                  className="h-0.5 w-10 rounded-full bg-slate-200 dark:bg-gray-700 group-hover:w-16 group-hover:bg-[#0D9488] dark:group-hover:bg-teal-400 transition-all duration-300 motion-reduce:transition-none"
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
export default BenefitsSection;
