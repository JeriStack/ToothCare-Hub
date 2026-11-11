import React from 'react';
import { ShieldCheck, Clock, CheckCircle2, HeartHandshake } from 'lucide-react';

export function AboutSection({ onBookAppointment }) {
  const highlights = [
    {
      title: 'Reliable Scheduling Engine',
      description: 'Calculates live bookable slots accounting for dentist working shifts, buffer times, and clinic holidays.',
    },
    {
      title: 'Transparent Clinic Catalog',
      description: 'View service descriptions, standard procedural durations, and clinic fees upfront.',
    },
    {
      title: 'Direct Patient Control',
      description: 'Manage upcoming consultations, review past visits, and request schedule adjustments easily.',
    },
  ];

  return (
    <section id="about" className="py-20 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Mission & Highlights */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
              A Better Way to Manage Your Dental Appointments
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              ToothCare Hub brings essential dental appointment information into one convenient platform.
              Patients can discover verified services, explore attending dentist profiles, and request consultations
              with ease, while clinic staff coordinate operatory chairs and review requests through an organized digital workflow.
            </p>

            <div className="pt-2 space-y-4">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 font-normal leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={onBookAppointment}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                Schedule a Consultation
              </button>
            </div>
          </div>

          {/* Right Column: Platform Quality Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Patient-Centered Focus</h3>
                  <p className="text-xs text-slate-500">Built for seamless clinic visits</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-slate-600">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-800 text-xs">Zero Double Booking</span>
                  <p className="text-slate-500">
                    Pessimistic transaction locking serializes requests so you never arrive to find an overlapping patient in your chair.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-800 text-xs">Turnaround Sanitization Buffers</span>
                  <p className="text-slate-500">
                    Our scheduling automatically enforces turn-around buffers between patients for thorough operatory disinfection.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-800 text-xs">Clear Request Lifecycle</span>
                  <p className="text-slate-500">
                    Track your booking as it progresses from review to confirmed, completed, or rescheduled states.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
