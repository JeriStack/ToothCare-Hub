import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  User,
  Shield,
  Clock,
  Sparkles,
  Calendar,
  X,
  Stethoscope,
  Info,
  CheckCircle2,
  MapPin,
  Award,
} from 'lucide-react';
import { dentistsApi } from '../api';
import { CardSkeleton } from '../../../components/skeletons';

import { DialogOverlay } from '../../../components/ui/DialogOverlay';
export function PatientDentistsPage({ onBookDentist }) {
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('ALL');
  const [detailDentist, setDetailDentist] = useState(null);

  const fetchDentists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dentistsApi.getPublicDentists();
      // Ensure only active dentists are presented for patient booking
      const active = (Array.isArray(data) ? data : []).filter((d) => Number(d.is_active) === 1);
      setDentists(active);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load our dental practitioners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDentists();
  }, []);

  // Distinct specializations for filter pills
  const specializations = useMemo(() => {
    const set = new Set();
    dentists.forEach((d) => {
      if (d.specialization) set.add(d.specialization.trim());
    });
    return ['ALL', ...Array.from(set)];
  }, [dentists]);

  // Filtered dentists
  const filteredDentists = useMemo(() => {
    return dentists.filter((d) => {
      const fullName = `Dr. ${d.first_name} ${d.last_name}`.toLowerCase();
      const spec = (d.specialization || '').toLowerCase();
      const bio = (d.bio || '').toLowerCase();
      const chair = (d.default_operatory_chair || '').toLowerCase();
      const q = search.trim().toLowerCase();

      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        spec.includes(q) ||
        bio.includes(q) ||
        chair.includes(q);

      const matchesSpec =
        selectedSpecialization === 'ALL' ||
        (d.specialization && d.specialization.trim().toLowerCase() === selectedSpecialization.toLowerCase());

      return matchesSearch && matchesSpec;
    });
  }, [dentists, search, selectedSpecialization]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-6 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold mb-2">
              <Stethoscope className="w-3.5 h-3.5 text-[#0D9488] dark:text-[#2DD4BF]" />
              Licensed Dental Practitioners
            </div>
            <h1 className="text-2xl font-bold text-[#12304A] dark:text-slate-50">Meet Our Dentists</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Comprehensive care from routine checkups to specialized treatments.
            </p>
          </div>
        </div>

        {/* Search & Specialty Dropdown Toolbar */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 pt-6 border-t border-slate-100 dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dentist or specialty"
              className="w-full min-h-11 sm:min-h-0 pl-10 pr-14 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 text-xs sm:text-sm bg-slate-50/50 dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-[#2DD4BF] focus:border-transparent transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Specialty Dropdown */}
          <div className="sm:w-64 shrink-0">
            <label htmlFor="patient-dentist-specialty" className="sr-only">
              Filter by specialty
            </label>
            <select
              id="patient-dentist-specialty"
              aria-label="Filter by specialty"
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="w-full min-h-11 sm:min-h-0 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 text-xs sm:text-sm font-medium bg-slate-50/50 dark:bg-gray-700 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488] dark:focus:ring-[#2DD4BF] focus:border-transparent transition-all"
            >
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec === 'ALL' ? 'All Specialties' : spec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchDentists}
            className="px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-900/70 text-rose-800 dark:text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <CardSkeleton variant="dentist" count={6} className="portal-grid-3 gap-6" />
      ) : filteredDentists.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-12 text-center shadow-xs transition-colors">
          <div className="w-14 h-14 rounded-full bg-teal-50 dark:bg-teal-900/40 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#12304A] dark:text-slate-50">No dentists found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {search || selectedSpecialization !== 'ALL'
              ? 'No dental practitioners matched your search criteria. Try clearing your filters.'
              : 'Our clinical roster is currently being updated. Please check back shortly.'}
          </p>
          {(search || selectedSpecialization !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedSpecialization('ALL');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        /* Dentist Cards Grid */
        <div className="portal-grid-3 gap-6">
          {filteredDentists.map((dentist) => {
            const initials = `${dentist.first_name?.[0] || 'D'}${dentist.last_name?.[0] || 'S'}`.toUpperCase();
            return (
              <div
                key={dentist.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-5 shadow-xs hover:shadow-md hover:border-[#0D9488]/40 dark:hover:border-[#2DD4BF]/50 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-[#0F766E] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 overflow-hidden">
                      {dentist.avatar_url ? (
                        <img
                          src={dentist.avatar_url}
                          alt={`Dr. ${dentist.first_name} ${dentist.last_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-[#12304A] dark:text-slate-50 group-hover:text-[#0D9488] dark:group-hover:text-[#2DD4BF] transition-colors truncate">
                        Dr. {dentist.first_name} {dentist.last_name}, DMD
                      </h3>
                      <p className="text-xs font-medium text-[#0D9488] dark:text-[#2DD4BF] flex items-center gap-1 mt-0.5">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{dentist.specialization || 'General Dentistry'}</span>
                      </p>
                      {dentist.license_number && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                          PRC Lic. #{dentist.license_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {dentist.default_operatory_chair && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300 mb-3 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{dentist.default_operatory_chair}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-4 leading-relaxed text-justify">
                    {dentist.bio || 'Dedicated dental practitioner committed to providing high-quality, patient-centered oral health care and dental hygiene consultations.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-gray-700 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailDentist(dentist)}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                    <span>View Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onBookDentist?.(dentist)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-teal-600 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Visit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dentist Profile Dialog / Modal */}
      {detailDentist && (
        <DialogOverlay
          onClose={() => setDetailDentist(null)}
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDetailDentist(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailDentist(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-[#0F766E] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0 overflow-hidden">
                {detailDentist.avatar_url ? (
                  <img
                    src={detailDentist.avatar_url}
                    alt={`Dr. ${detailDentist.first_name} ${detailDentist.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  `${detailDentist.first_name?.[0] || 'D'}${detailDentist.last_name?.[0] || 'S'}`.toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-1">
                  {detailDentist.specialization || 'General Dentistry'}
                </span>
                <h3 className="text-xl font-bold text-[#12304A] dark:text-slate-50">
                  Dr. {detailDentist.first_name} {detailDentist.last_name}, DMD
                </h3>
                {detailDentist.license_number && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-[#2DD4BF]" />
                    <span>PRC Professional License #{detailDentist.license_number}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Practice Suite:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {detailDentist.default_operatory_chair || 'Operatory Chair 1'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Practice Status:</span>
                  <span className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accepting New Patients
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Timezone:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Asia/Manila (PHT)</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-50 mb-1 text-sm">About the Practitioner</h4>
                <p className="leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line text-justify">
                  {detailDentist.bio ||
                    'Dr. ' +
                      detailDentist.first_name +
                      ' ' +
                      detailDentist.last_name +
                      ' specializes in patient-centric oral healthcare, preventive treatments, and advanced cosmetic solutions. Committed to gentle, pain-free dental procedures with modern sterilization and clinical protocols.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/60 flex items-start gap-2 text-teal-800 dark:text-teal-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0D9488] dark:text-[#2DD4BF] mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Real-time chair and shift availability are calculated dynamically when you select your preferred date in the booking workflow.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailDentist(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetDentist = detailDentist;
                  setDetailDentist(null);
                  onBookDentist?.(targetDentist);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-teal-600 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Appointment with Dr. {detailDentist.last_name}</span>
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default PatientDentistsPage;
