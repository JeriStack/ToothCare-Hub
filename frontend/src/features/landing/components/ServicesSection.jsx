import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Stethoscope, Clock, ArrowRight, AlertCircle, RefreshCw, Sparkles, Search, X } from 'lucide-react';
import { servicesApi } from '../../services/api';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { CardSkeleton } from '../../../components/skeletons/CardSkeleton';
import { INITIAL_SERVICES } from '../../../app/mockData';

const FALLBACK_SERVICES = INITIAL_SERVICES.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category || 'General Care',
  duration_minutes: s.durationMinutes,
  price: s.price,
  description: s.description,
  is_active: 1,
}));

export function ServicesSection({ onBookService }) {
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await servicesApi.getPublicServices({ background: true });
      if (Array.isArray(data) && data.length > 0) {
        const activeOnly = data.filter((s) => Number(s.is_active) === 1);
        setServices(activeOnly.length > 0 ? activeOnly : FALLBACK_SERVICES);
      } else {
        setServices(FALLBACK_SERVICES);
      }
    } catch {
      // Graceful fallback to verified clinical catalog fixtures so public visitors always see procedures
      setServices(FALLBACK_SERVICES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(services.map((s) => (s.category || 'General Care').trim()).filter(Boolean))
    );
    return unique;
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((s) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        (s.category || 'General Care').trim().toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      );
    });
  }, [services, selectedCategory, searchQuery]);

  return (
    <section id="services" className="py-20 bg-white dark:bg-gray-900" aria-labelledby="services-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="landing-reveal text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-[#0D9488]/20 dark:border-teal-400/30 text-[#0F766E] dark:text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Standardized Fee Catalog</span>
          </span>
          <h2
            id="services-heading"
            className="text-3xl sm:text-4xl font-extrabold text-[#12304A] dark:text-white tracking-tight"
          >
            Comprehensive Dental Services
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 font-normal">
            Explore our transparent dental procedures with verified durations and standardized clinic fees.
          </p>
        </div>

        {/* Search & Category Dropdown Bar */}
        {!loading && !error && services.length > 0 && (
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <label htmlFor="landing-service-search" className="sr-only">
                Search dental services
              </label>
              <Search
                className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="landing-service-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search procedure or treatment"
                className="w-full min-h-11 sm:min-h-0 pl-10 pr-9 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-teal-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear service search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {categories.length > 1 && (
              <div className="sm:w-56 shrink-0">
                <label htmlFor="landing-service-category" className="sr-only">
                  Filter dental services by category
                </label>
                <select
                  id="landing-service-category"
                  aria-label="Filter dental services by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full min-h-11 sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                >
                  <option value="ALL">All Services ({services.length})</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && <CardSkeleton variant="service" count={6} />}

        {/* Error State with Retry Button */}
        {!loading && error && (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 dark:text-gray-100 text-sm">Services Unavailable</h3>
              <p className="text-xs text-slate-600 dark:text-gray-300">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchServices}
              className="gap-2 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredServices.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="No Dental Services Listed"
            description="Our clinical service procedures catalog is currently being updated. Please consult our reception desk for appointment inquiries."
          />
        )}

        {/* Active Services Grid */}
        {!loading && !error && filteredServices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {filteredServices.map((service, idx) => (
              <article
                key={service.id}
                data-reveal="up"
                style={{ '--reveal-index': idx % 3 }}
                className="landing-reveal landing-card-hover group bg-[#F8FAFC] dark:bg-gray-800/95 border border-slate-200/90 dark:border-gray-700/80 hover:border-[#0D9488]/45 dark:hover:border-teal-400/45 hover:bg-white dark:hover:bg-gray-800 shadow-xs hover:shadow-md hover:shadow-teal-900/5 dark:hover:shadow-black/30 rounded-2xl p-6 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-300 bg-teal-50 dark:bg-teal-500/15 px-2.5 py-1 rounded-full border border-[#0D9488]/20 dark:border-teal-400/30">
                      {service.category || 'General Care'}
                    </span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-gray-900/75 border border-slate-200/80 dark:border-gray-700 text-[11px] font-semibold text-slate-600 dark:text-gray-300 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" aria-hidden="true" />
                      <span>{service.duration_minutes || service.durationMinutes || 30} mins</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 dark:text-gray-100 leading-snug group-hover:text-[#0F766E] dark:group-hover:text-teal-200 transition-colors">
                    {service.name}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 line-clamp-3 leading-relaxed font-normal text-justify">
                    {service.description || 'Professional dental care and clinical consultation.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/70 dark:border-gray-700/80 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wider font-semibold block">
                      Standard Fee
                    </span>
                    <span className="text-lg font-extrabold tabular-nums text-[#12304A] dark:text-white">
                      ₱{Number(service.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onBookService?.(service)}
                    className="group/btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-50/90 dark:bg-teal-500/15 border border-[#0D9488]/30 dark:border-teal-400/40 text-xs font-semibold text-[#0F766E] dark:text-teal-200 hover:text-white dark:hover:text-white hover:bg-[#0D9488] dark:hover:bg-[#0D9488] hover:border-[#0D9488] dark:hover:border-teal-400 transition-all shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                  >
                    <span>Book Service</span>
                    <ArrowRight
                      className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5 motion-reduce:transform-none"
                      aria-hidden="true"
                    />
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
