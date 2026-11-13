import React from 'react';
import { CalendarCheck, Shield, Clock, FileText, Smartphone, History } from 'lucide-react';

export function BenefitsSection() {
  const benefits = [
    {
      icon: CalendarCheck,
      title: 'Availability-Based Scheduling',
      description: 'Slots are calculated live directly from practitioner shifts, approved leaves, and clinic operating schedules.',
    },
    {
      icon: Clock,
      title: 'Turnaround Sanitization Buffers',
      description: 'Mandatory clinical turnaround buffers between consultations ensure complete operatory room hygiene.',
    },
    {
      icon: History,
      title: 'Complete Lifecycle History',
      description: 'Audit trails record every state transition (Pending, Confirmed, Completed, Cancelled) with timestamps.',
    },
    {
      icon: Shield,
      title: 'Immutable Price Snapshots',
      description: 'Your estimated fee is locked at the moment of booking so prices remain predictable on consultation day.',
    },
    {
      icon: FileText,
      title: 'Symptom & Chief Complaint Notes',
      description: 'Share symptoms and specific accommodation needs securely with the dentist in advance.',
    },
    {
      icon: Smartphone,
      title: 'Accessible Mobile Interface',
      description: 'Book, review, or reschedule on your phone, tablet, or desktop with full responsive support.',
    },
  ];

  return (
    <section className="py-20 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Designed for Modern Patient Care
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            ToothCare Hub balances clinical precision with an intuitive, comfortable patient scheduling journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F8FAFC]/80 border border-slate-200/80 hover:border-slate-300 transition-colors space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#0D9488] flex items-center justify-center shadow-xs">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{b.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
