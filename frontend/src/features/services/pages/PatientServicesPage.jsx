import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Stethoscope,
  Info,
  Calendar,
} from 'lucide-react';
import { servicesApi } from '../api';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CardSkeleton } from '../../../components/skeletons';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
function formatDuration(minutes) {
  if (!minutes) return '30 mins';
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${hrs} hr ${rem} mins`;
}

export function PatientServicesPage({ onBookService }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [detailService, setDetailService] = useState(null);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await servicesApi.getPublicServices();
      // Ensure only active services are bookable
      const active = (Array.isArray(data) ? data : []).filter((s) => Number(s.is_active) === 1);
      setServices(active);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load dental services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [services]);

  // Filtered list
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        (s.category || '').toLowerCase() === selectedCategory.toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A] dark:text-slate-100">Dental Services & Procedures</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Transparent dental treatments, verified clinical durations, and standardized clinic fees.
          </p>
        </div>
      </div>

      {/* Search and Category Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search procedure or treatment"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 sm:min-h-0 pl-10 pr-14 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="sm:w-56 shrink-0">
          <label htmlFor="patient-service-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="patient-service-category"
            aria-label="Filter by category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full min-h-11 sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Procedures' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <CardSkeleton variant="service" count={6} className="portal-grid-3" />
      ) : error ? (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-2xl text-center space-y-2">
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={fetchServices}
            className="px-4 py-2 bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-semibold"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-12 text-center shadow-xs">
          <Stethoscope className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">No matching dental services found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting your search query or selecting another category.</p>
        </div>
      ) : (
        <div className="portal-grid-3">
          {filteredServices.map((svc) => (
            <div
              key={svc.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F7F5] dark:bg-teal-950/60 text-[#0D9488] dark:text-teal-300 border border-teal-100 dark:border-teal-800/70">
                    {svc.category || 'General'}
                  </span>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{formatDuration(svc.duration_minutes)}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#12304A] dark:text-slate-100 group-hover:text-[#0D9488] dark:group-hover:text-teal-300 transition-colors leading-snug">
                  {svc.name}
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed text-justify">
                  {svc.description || 'Comprehensive dental procedure administered by our licensed clinic dentists.'}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Standard Clinic Fee</p>
                  <p className="text-base font-bold text-[#12304A] dark:text-slate-100">
                    {formatCurrency(svc.price)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailService(svc)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                    title="View details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBookService?.(svc)}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <span>Book</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Details Modal */}
      {detailService && (
        <DialogOverlay
          onClose={() => setDetailService(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setDetailService(null)}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7F5] dark:bg-teal-950/60 text-[#0D9488] dark:text-teal-300 border border-teal-100 dark:border-teal-800/70">
                {detailService.category || 'General'}
              </span>

              <h3 className="text-xl font-bold text-[#12304A] dark:text-slate-100">{detailService.name}</h3>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200/80 dark:border-gray-700 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Verified Duration</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-[#0D9488] dark:text-teal-400" />
                    {formatDuration(detailService.duration_minutes)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Standard Clinic Fee</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5">
                    {formatCurrency(detailService.price)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#12304A] dark:text-slate-100 mb-1">Clinical Overview</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                  {detailService.description ||
                    'Standard in-clinic procedure. Pre-appointment briefing and diagnostic review will be conducted by your assigned dentist prior to beginning treatment.'}
                </p>
              </div>

              <div className="p-3 bg-teal-50/60 dark:bg-teal-950/50 rounded-xl border border-teal-100 dark:border-teal-800/70 text-[11px] text-[#0F766E] dark:text-teal-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0D9488] dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  All procedures follow strict infection control and clinic sanitation standards verified by the Philippine Dental Association.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDetailService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const svc = detailService;
                    setDetailService(null);
                    onBookService?.(svc);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book This Procedure</span>
                </button>
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
