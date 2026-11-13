import React from 'react';
import { Clock, Phone, Mail, MapPin, AlertCircle, Calendar } from 'lucide-react';

export function ContactSection({ onBookAppointment }) {
  return (
    <section id="contact" className="py-20 bg-white dark:bg-gray-900 border-t border-slate-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight">
            Clinic Hours & Support
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 font-normal">
            We are here to support your dental health journey. Contact reception or book directly online.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Operating Hours Card */}
          <div className="lg:col-span-6 bg-[#F8FAFC] dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0D9488] dark:text-teal-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-gray-100 text-lg">Practice Operating Hours</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Asia/Manila (UTC+08:00) Clinic Timezone</p>
                </div>
              </div>

              <div className="divide-y divide-slate-200/70 dark:divide-gray-700 text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-gray-300">Monday – Friday</span>
                  <span className="font-bold text-slate-900 dark:text-white">08:00 AM – 05:00 PM</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-gray-300">Saturday</span>
                  <span className="font-bold text-slate-900 dark:text-white">08:00 AM – 05:00 PM</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-rose-700 dark:text-rose-300">
                  <span className="font-semibold">Sunday</span>
                  <span className="font-bold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded text-xs border border-rose-100 dark:border-rose-800/70">
                    Closed (Facility Sanitization)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Dental Emergencies</span>
              </div>
              <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-normal">
                If you are experiencing severe oral pain, trauma, or swelling outside standard hours, please proceed
                to your nearest emergency medical facility.
              </p>
            </div>
          </div>

          {/* Right Column: Reception & Booking Assistance */}
          <div className="lg:col-span-6 bg-[#12304A] dark:bg-slate-950 dark:border dark:border-gray-800 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-2xl text-white tracking-tight">Need Assistance?</h3>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  Our reception team is available during operating hours to assist with appointment adjustments,
                  first-time registration inquiries, or special accommodation requirements.
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">Reception Desk</span>
                    <span className="font-bold text-white">+63 (02) 8123-4567</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">Clinic Support Email</span>
                    <span className="font-bold text-white">reception@toothcarehub.local</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onBookAppointment}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D9488] text-white font-semibold text-xs hover:bg-[#0F766E] shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Consultation Online</span>
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
