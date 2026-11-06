import React, { useState, useEffect } from 'react';
import { Stethoscope, Calendar, ArrowRight, UserCheck } from 'lucide-react';
import { dentistsApi } from '../../dentists/api';
import { INITIAL_DENTISTS } from '../../../app/mockData';

export function DentistsSection({ onSelectDentist }) {
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    dentistsApi
      .getPublicDentists()
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const activeOnly = data.filter((d) => Number(d.is_active) === 1);
          setDentists(activeOnly.length > 0 ? activeOnly : data);
        } else {
          // Fallback to verified fixtures
          setDentists(
            INITIAL_DENTISTS.map((d) => ({
              id: d.id,
              first_name: d.name.split(' ')[1] || d.name,
              last_name: d.name.split(' ')[2] || '',
              specialization: d.specialty,
              room_number: `Chair ${d.id}`,
              bio: d.bio || 'Dedicated to comfortable and precise dental procedures for the whole family.',
              shifts: d.shifts,
              avatar: d.avatar,
            }))
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setDentists(
          INITIAL_DENTISTS.map((d) => ({
            id: d.id,
            first_name: d.name.split(' ')[1] || d.name,
            last_name: d.name.split(' ')[2] || '',
            specialization: d.specialty,
            room_number: `Chair ${d.id}`,
            bio: d.bio || 'Dedicated to comfortable and precise dental procedures for the whole family.',
            shifts: d.shifts,
            avatar: d.avatar,
          }))
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="dentists" className="py-20 bg-slate-50/60 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Meet the People Behind Your Smile
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Certified practitioners dedicated to patient comfort, preventive care, and clinical excellence.
          </p>
        </div>

        {/* Dentists Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {dentists.map((dentist) => {
              const fullName = dentist.first_name && dentist.last_name
                ? `Dr. ${dentist.first_name} ${dentist.last_name}, DMD`
                : dentist.name || 'Dr. Dental Specialist';

              return (
                <div
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
                    {dentist.shifts && (
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
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-[#0D9488] hover:text-white hover:border-[#0D9488] transition-all shadow-2xs group/btn"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Consult with Doctor</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
