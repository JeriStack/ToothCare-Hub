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
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">Dental Services & Procedures</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Transparent dental treatments, verified clinical durations, and standardized clinic fees.
          </p>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search procedure name or treatment description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#0D9488] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat === 'ALL' ? 'All Procedures' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-14 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
          <p className="text-sm font-semibold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={fetchServices}
            className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-semibold"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#12304A]">No matching dental services found</h3>
          <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or selecting another category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((svc) => (
            <div
              key={svc.id}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-teal-300 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F7F5] text-[#0D9488] border border-teal-100">
                    {svc.category || 'General'}
                  </span>
                  <div className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDuration(svc.duration_minutes)}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors leading-snug">
                  {svc.name}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {svc.description || 'Comprehensive dental procedure administered by our licensed clinic dentists.'}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Standard Clinic Fee</p>
                  <p className="text-base font-bold text-[#12304A]">
                    {formatCurrency(svc.price)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailService(svc)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="View details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBookService?.(svc)}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-2xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setDetailService(null)}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7F5] text-[#0D9488] border border-teal-100">
                {detailService.category || 'General'}
              </span>

              <h3 className="text-xl font-bold text-[#12304A]">{detailService.name}</h3>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Verified Duration</span>
                  <p className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-[#0D9488]" />
                    {formatDuration(detailService.duration_minutes)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Standard Clinic Fee</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {formatCurrency(detailService.price)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#12304A] mb-1">Clinical Overview</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {detailService.description ||
                    'Standard in-clinic procedure. Pre-appointment briefing and diagnostic review will be conducted by your assigned dentist prior to beginning treatment.'}
                </p>
              </div>

              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-[11px] text-[#0F766E] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>
                  All procedures follow strict infection control and clinic sanitation standards verified by the Philippine Dental Association.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDetailService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
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
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book This Procedure</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
