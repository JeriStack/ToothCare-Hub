import React, { useState, useEffect, useCallback } from 'react';
import { Stethoscope, Clock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { servicesApi } from '../../services/api';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';

export function ServicesSection({ onBookService }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await servicesApi.getPublicServices();
      if (Array.isArray(data)) {
        const activeOnly = data.filter((s) => Number(s.is_active) === 1);
        setServices(activeOnly);
      } else {
        setServices([]);
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Unable to load clinical services. Please check your connection and try again.');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return (
    <section id="services" className="py-20 bg-white" aria-labelledby="services-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 id="services-heading" className="text-3xl sm:text-4xl font-extrabold text-[#12304A] tracking-tight">
            Comprehensive Dental Services
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            Explore our transparent dental procedures with verified durations and standardized clinic fees.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
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
        )}

        {/* Error State with Retry Button */}
        {!loading && error && (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-rose-50/70 border border-rose-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Services Unavailable</h3>
              <p className="text-xs text-slate-600">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchServices}
              className="gap-2 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && services.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="No Dental Services Listed"
            description="Our clinical service procedures catalog is currently being updated. Please consult our reception desk for appointment inquiries."
          />
        )}

        {/* Active Services Grid */}
        {!loading && !error && services.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <article
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-white hover:bg-[#0D9488] hover:border-[#0D9488] transition-all shadow-2xs group/btn focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
                  >
                    <span>Book Service</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-white transition-colors" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}

export default ServicesSection;
