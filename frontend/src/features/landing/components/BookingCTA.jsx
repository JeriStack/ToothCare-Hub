import React from 'react';
import { Calendar, User, ArrowRight, ShieldCheck } from 'lucide-react';

export function BookingCTA({ onBookAppointment, onLogin }) {
  return (
    <section className="py-20 bg-slate-50/70">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-[#12304A] via-[#0B1D2D] to-[#12304A] text-white p-8 sm:p-14 overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-800 text-center space-y-8">
          
          {/* Subtle Decorative Background Ring */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-teal-500/10 pointer-events-none" />

          {/* Content */}
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Ready to Take the Next Step Toward Better Dental Care?
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              Explore available procedures, choose an attending dentist, and submit your appointment request
              with zero phone wait times.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10 pt-2">
            <button
              type="button"
              onClick={onBookAppointment}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] shadow-lg shadow-teal-900/30 transition-all transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12304A]"
            >
              <Calendar className="w-4 h-4" />
              Book Your Appointment
            </button>

            <button
              type="button"
              onClick={onLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <User className="w-4 h-4 text-slate-300" />
              Access Patient Portal
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Certified Dental Practitioners</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Pessimistic Locking Concurrency Safe</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Real-Time Status Visibility</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
