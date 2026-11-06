import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ArrowRight, AlertCircle, RefreshCw, Stethoscope } from 'lucide-react';
import { dentistsApi } from '../../dentists/api';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';

export function DentistsSection({ onSelectDentist }) {
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDentists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await dentistsApi.getPublicDentists();
      if (Array.isArray(data)) {
        const activeOnly = data.filter((d) => Number(d.is_active) === 1);
        setDentists(activeOnly);
      } else {
        setDentists([]);
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Unable to load dentist roster. Please check your connection and try again.');
      setDentists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDentists();
  }, [fetchDentists]);

  return (
    <section id="dentists" className="py-20 bg-slate-50/60 border-t border-slate-100" aria-labelledby="dentists-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 id="dentists-heading" className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Meet the People Behind Your Smile
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Certified practitioners dedicated to patient comfort, preventive care, and clinical excellence.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 animate-pulse"
              >
                <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto" />
                <div className="h-5 bg-slate-200 rounded w-1/2 mx-auto" />
                <div className="h-4 bg-slate-100 rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {!loading && error && (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-rose-50/70 border border-rose-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Dentists Unavailable</h3>
              <p className="text-xs text-slate-600">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDentists}
              className="gap-2 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && dentists.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="No Dentists Currently Available"
            description="Our licensed dentist roster is currently being updated. Please contact our reception desk to inquire about clinical availability."
          />
        )}

        {/* Active Dentists Grid */}
        {!loading && !error && dentists.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {dentists.map((dentist) => {
              const fullName = dentist.first_name && dentist.last_name
                ? `Dr. ${dentist.first_name} ${dentist.last_name}, DMD`
                : dentist.name || 'Dr. Dental Specialist';

              return (
                <article
                  key={dentist.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/60 transition-all flex flex-col justify-between space-y-6 group"
                >
                  <div className="space-y-4 text-center">
                    {/* Doctor Avatar / Icon Frame */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-teal-50 to-slate-100 border border-slate-100 flex items-center justify-center mx-auto text-3xl shadow-xs group-hover:scale-105 transition-transform">
                      {dentist.avatar || '🩺'}
                    </div>

                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{fullName}</h3>
                      <p className="text-xs font-semibold text-[#0D9488] mt-0.5">
                        {dentist.specialization || 'General Dentistry'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Operatory: {dentist.room_number || dentist.default_operatory_chair || 'Operatory Chair 1'}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-normal">
                      {dentist.bio || 'Committed to delivering gentle, state-of-the-art oral healthcare.'}
                    </p>
                  </div>

                  {/* Clinic Schedule Shifts & Booking CTA */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    {dentist.shifts && Array.isArray(dentist.shifts) && dentist.shifts.length > 0 && (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          Clinic Days:
                        </span>
                        {dentist.shifts.map((shift) => (
                          <span
                            key={shift}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700"
                          >
                            {shift}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectDentist?.(dentist)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-[#0D9488] hover:text-white hover:border-[#0D9488] transition-all shadow-2xs group/btn focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Consult with Doctor</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}

export default DentistsSection;
