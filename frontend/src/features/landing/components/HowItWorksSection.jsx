import React from 'react';
import { Stethoscope, UserCheck, CalendarCheck, FileCheck, ArrowRight } from 'lucide-react';

export function HowItWorksSection({ onBookAppointment }) {
  const steps = [
    {
      number: '1',
      icon: Stethoscope,
      title: 'Explore Services',
      description: 'Review standard clinic procedures, expected visit durations, and locked fee snapshots.',
    },
    {
      number: '2',
      icon: UserCheck,
      title: 'Choose Your Dentist',
      description: 'Select your attending practitioner based on specialization, room allocation, and working shifts.',
    },
    {
      number: '3',
      icon: CalendarCheck,
      title: 'Select Live Time Slot',
      description: 'Pick an open consultation slot calculated in real time against doctor shifts and sanitization buffers.',
    },
    {
      number: '4',
      icon: FileCheck,
      title: 'Submit & Track Request',
      description: 'Your request is recorded as Pending for reception review. Receive instant updates as your visit is confirmed.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Request your consultation in four straightforward steps with full visibility every step of the way.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="relative bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Step Header */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-[#0D9488] flex items-center justify-center shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-200">
                    0{step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-base">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>

                <div className="pt-2 text-[11px] font-semibold text-slate-400">
                  Step {step.number} of 4
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-slate-900 text-base">
              Ready to schedule your dental visit?
            </h4>
            <p className="text-xs text-slate-500 font-normal">
              Zero phone tag. View available dates and pick the slot that fits your schedule.
            </p>
          </div>

          <button
            type="button"
            onClick={onBookAppointment}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-md shadow-teal-900/15 transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          >
            <span>Start Booking Request</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
}
