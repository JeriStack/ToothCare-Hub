import React, { useState, useEffect } from 'react';
import { Stethoscope, Clock, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { servicesApi } from '../../services/api';
import { INITIAL_SERVICES } from '../../../app/mockData';

export function ServicesSection({ onBookService }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    servicesApi
      .getPublicServices()
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const activeOnly = data.filter((s) => Number(s.is_active) === 1);
          setServices(activeOnly.length > 0 ? activeOnly : data);
        } else {
          // Fallback to active catalog fixtures
          setServices(
            INITIAL_SERVICES.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category || 'General Dentistry',
              description: s.description,
              duration_minutes: s.durationMinutes,
              price: s.price,
              is_active: 1,
            }))
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Graceful fallback to verified fixtures
        setServices(
          INITIAL_SERVICES.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category || 'General Dentistry',
            description: s.description,
            duration_minutes: s.durationMinutes,
            price: s.price,
            is_active: 1,
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
    <section id="services" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Comprehensive Dental Services
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Explore our transparent dental procedures with verified durations and standardized clinic fees.
          </p>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 animate-pulse"
              >
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="h-5 bg-slate-200 rounded w-2/3" />
                <div className="h-12 bg-slate-100 rounded" />
                <div className="h-6 bg-slate-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No active dental services currently listed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-[#F8FAFC] border border-slate-200/80 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-500/5 transition-all rounded-2xl p-6 flex flex-col justify-between space-y-5 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                      {service.category || 'General Care'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{service.duration_minutes || service.durationMinutes || 30} mins</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-[#0D9488] transition-colors">
                    {service.name}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-normal">
                    {service.description || 'Professional dental care and clinical consultation.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Standard Fee</span>
                    <span className="text-base font-extrabold text-slate-900">
                      ₱{Number(service.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onBookService?.(service)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-white hover:bg-[#0D9488] hover:border-[#0D9488] transition-all shadow-2xs group/btn"
                  >
                    <span>Book Service</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-white transition-colors" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
