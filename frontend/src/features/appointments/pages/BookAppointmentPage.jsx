import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { servicesApi } from '../../services/api';
import { dentistsApi } from '../../dentists/api';
import { appointmentsApi } from '../api';
import { AvailabilitySlotPicker } from '../../schedules/components/AvailabilitySlotPicker';
import { BookingStepSkeleton } from '../../../components/skeletons/BookingStepSkeleton';

const CLINIC_TIME_ZONE = 'Asia/Manila';

/** YYYY-MM-DD for date as seen on the clinic's wall calendar (not the browser's or UTC). */
function clinicIsoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Adds whole days to a YYYY-MM-DD string without any time-zone drift. */
function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function BookAppointmentPage({
  initialService = null,
  initialDentist = null,
  onNavigateToAppointments,
}) {
  // Wizard steps: 1: Service, 2: Dentist, 3: Date & Slot, 4: Review, 5: Confirmed
  const [step, setStep] = useState(initialService && initialDentist ? 3 : initialService ? 2 : 1);

  // Catalogs
  const [services, setServices] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  // Selections
  const [selectedService, setSelectedService] = useState(initialService);
  const [selectedDentist, setSelectedDentist] = useState(initialDentist);
  // Tomorrow on the clinic calendar as a sensible default
  const [selectedDate, setSelectedDate] = useState(() => addDaysIso(clinicIsoDate(), 1));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [agreedPolicy, setAgreedPolicy] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isConflict, setIsConflict] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState(null);

  // On phones the "Next" button sits far below the fold; without this the new step would
  // render with the viewport still at the bottom of the page.
  const wizardTopRef = useRef(null);
  const alertRef = useRef(null);
  const previousStepRef = useRef(step);
  const scrollBehavior = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    const el = wizardTopRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView?.({ block: 'start', behavior: scrollBehavior() });
    }
  }, [step]);

  // Submission errors render above the form; bring them into view and announce them.
  useEffect(() => {
    if (!isConflict && !submitError) return;
    const el = alertRef.current;
    if (!el) return;
    el.scrollIntoView?.({ block: 'start', behavior: scrollBehavior() });
    el.focus?.({ preventScroll: true });
  }, [isConflict, submitError]);

  // Fetch active catalogs on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingCatalogs(true);
    setCatalogError(null);

    Promise.all([servicesApi.getPublicServices(), dentistsApi.getPublicDentists()])
      .then(([srvList, dntList]) => {
        if (!isMounted) return;
        const activeSrv = (srvList || []).filter((s) => Number(s.is_active) === 1);
        const activeDnt = (dntList || []).filter((d) => Number(d.is_active) === 1);
        setServices(activeSrv);
        setDentists(activeDnt);

        if (initialService) {
          const matchSrv = activeSrv.find((s) => s.id === initialService.id) || initialService;
          setSelectedService(matchSrv);
        } else if (activeSrv.length > 0) {
          setSelectedService(activeSrv[0]);
        }

        if (initialDentist) {
          const matchDnt = activeDnt.find((d) => d.id === initialDentist.id) || initialDentist;
          setSelectedDentist(matchDnt);
        } else if (activeDnt.length > 0) {
          setSelectedDentist(activeDnt[0]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setCatalogError(err.response?.data?.error?.message || err.message || 'Failed to load clinic catalogs.');
      })
      .finally(() => {
        if (isMounted) setLoadingCatalogs(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleServiceChange = (service) => {
    setSelectedService(service);
    setSelectedSlot(null);
    setSubmitError(null);
    setIsConflict(false);
  };

  const handleDentistChange = (dentist) => {
    setSelectedDentist(dentist);
    setSelectedSlot(null);
    setSubmitError(null);
    setIsConflict(false);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSubmitError(null);
    setIsConflict(false);
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedService || !selectedDentist || !selectedSlot) {
      setSubmitError('Please complete all booking selections.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setIsConflict(false);

    try {
      const payload = {
        service_id: selectedService.id,
        dentist_id: selectedDentist.id,
        start_at: selectedSlot.start_at,
        chief_complaint: chiefComplaint.trim() || undefined,
      };

      const result = await appointmentsApi.book(payload);
      setCreatedAppointment(result);
      setStep(5); // Success step
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message || 'Failed to submit appointment request.';
      setSubmitError(msg);
      if (status === 409) {
        setIsConflict(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedSlot(null);
    setChiefComplaint('');
    setAgreedPolicy(false);
    setSubmitError(null);
    setIsConflict(false);
    setCreatedAppointment(null);
  };

  const formatSlotTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      // Match AvailabilitySlotPicker: always show clinic wall-clock time
      return d.toLocaleTimeString('en-US', {
        timeZone: CLINIC_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  if (loadingCatalogs) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Book Dental Appointment</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Secure patient scheduling with real-time slot reservation and clinic validation.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300 self-start sm:self-auto">
              Step 1 of 4: Service
            </span>
          </div>
          <div className="pt-4">
            <div className="w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700 h-1.5">
              <div className="h-full bg-[#0D9488]" style={{ width: '25%' }} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
          <BookingStepSkeleton step={1} />
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-rose-200 dark:border-rose-800 p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to Load Booking Engine</h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{catalogError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header & Stepper (scroll target on step change; clears the sticky 4rem app header) */}
      <div
        ref={wizardTopRef}
        className="scroll-mt-20 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Book Dental Appointment</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Secure patient scheduling with real-time slot reservation and clinic validation.
            </p>
          </div>
          {step < 5 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300 self-start sm:self-auto">
              Step {step} of 4: {['Service', 'Dentist', 'Date & Time', 'Review'][step - 1]}
            </span>
          )}
        </div>

        {/* Stepper Progress Bar */}
        {step < 5 && (
          <div className="pt-4">
            <div className="w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700 h-1.5">
              <div
                className="h-full bg-[#0D9488] dark:bg-teal-400 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Conflict / Stale Slot Banner */}
      {isConflict && (
        <div ref={alertRef} role="alert" tabIndex={-1} className="scroll-mt-20 focus:outline-none bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 shadow-sm tch-animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-amber-950 dark:text-amber-100 text-sm">Selected Time Slot No Longer Available</h4>
            <p className="mt-1">
              Another patient just reserved this appointment slot. Please return to Step 3 and pick another available time.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSlot(null);
                setIsConflict(false);
                setStep(3);
              }}
              className="mt-3 inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 w-full sm:w-auto px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Select Another Time Slot
            </button>
          </div>
        </div>
      )}

      {/* General Submission Error */}
      {submitError && !isConflict && (
        <div ref={alertRef} role="alert" tabIndex={-1} className="scroll-mt-20 focus:outline-none bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-200 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-rose-950 dark:text-rose-100 text-sm">Booking Submission Error</h4>
            <p className="mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* ================= STEP 1: SERVICE SELECTION ================= */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Select a Dental Service</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose the procedure or treatment you need. Duration determines required slot length.
            </p>
          </div>

          <div className="portal-grid-3 pt-2">
            {services.map((srv) => {
              const isSelected = selectedService?.id === srv.id;
              return (
                <button
                  type="button"
                  key={srv.id}
                  aria-pressed={isSelected}
                  onClick={() => handleServiceChange(srv)}
                  className={`w-full cursor-pointer rounded-xl p-4 border transition-all text-left flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                    isSelected
                      ? 'border-[#0D9488] dark:border-teal-500 bg-[#F0FDFA] dark:bg-teal-950/50 ring-2 ring-[#0D9488]/20 dark:ring-teal-500/30'
                      : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50/50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{srv.name}</h4>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300">
                        {srv.category || 'General Dentistry'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-[#0D9488] dark:text-teal-400">
                        ₱{Number(srv.price).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {srv.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 w-full text-justify">{srv.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-gray-700 font-medium w-full">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Duration: {srv.duration_minutes} minutes</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-700">
            <button
              type="button"
              disabled={!selectedService}
              onClick={() => setStep(2)}
              className="w-full sm:w-auto min-h-11 justify-center px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              Next: Choose Dentist <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: DENTIST SELECTION ================= */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Select a Dentist Practitioner</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Our board-certified dentists adhere to strict sterilization and operatory standards.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Service: <strong className="text-slate-800 dark:text-slate-100">{selectedService?.name}</strong></span>
          </div>

          <div className="portal-grid-3 pt-2">
            {dentists.map((dnt) => {
              const isSelected = selectedDentist?.id === dnt.id;
              return (
                <button
                  type="button"
                  key={dnt.id}
                  aria-pressed={isSelected}
                  onClick={() => handleDentistChange(dnt)}
                  className={`w-full cursor-pointer rounded-xl p-4 border transition-all text-left flex items-start gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                    isSelected
                      ? 'border-[#0D9488] dark:border-teal-500 bg-[#F0FDFA] dark:bg-teal-950/50 ring-2 ring-[#0D9488]/20 dark:ring-teal-500/30'
                      : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50/50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0F766E] dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-sm">
                    {dnt.first_name?.[0]}{dnt.last_name?.[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Dr. {dnt.first_name} {dnt.last_name}
                    </h4>
                    <p className="text-xs text-[#0D9488] dark:text-teal-400 font-medium mt-0.5">{dnt.specialization}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">License: {dnt.license_number}</p>
                    {dnt.bio && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 text-justify">{dnt.bio}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto min-h-11 justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Services
            </button>
            <button
              type="button"
              disabled={!selectedDentist}
              onClick={() => setStep(3)}
              className="w-full sm:w-auto min-h-11 justify-center px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              Next: Select Date & Time <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: DATE & TIME SLOT SELECTION ================= */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-gray-700">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Choose Appointment Date & Time</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Slots are calculated in real time based on Dr. {selectedDentist?.last_name}'s schedule and buffer time.
              </p>
            </div>
            <div className="text-xs bg-slate-50 dark:bg-gray-900/60 border border-slate-100 dark:border-gray-700 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 self-start sm:self-auto">
              <strong className="text-slate-900 dark:text-slate-100">{selectedService?.name}</strong> · {selectedService?.duration_minutes} mins
            </div>
          </div>

          {/* Date Picker Input */}
          <div className="w-full sm:max-w-xs space-y-1.5">
            <label htmlFor="booking-date" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Appointment Date</label>
            <div className="relative">
              <input
                id="booking-date"
                type="date"
                value={selectedDate}
                min={clinicIsoDate()}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full min-h-11 text-base sm:text-xs font-medium border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>

          {/* Dynamic Slot Picker */}
          <div className="pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Available Time Slots</label>
            <AvailabilitySlotPicker
              dentistId={selectedDentist?.id}
              serviceId={selectedService?.id}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
                setIsConflict(false);
                setSubmitError(null);
              }}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full sm:w-auto min-h-11 justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dentists
            </button>
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={() => setStep(4)}
              className="w-full sm:w-auto min-h-11 justify-center px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              Next: Review & Confirm <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: REVIEW & CONFIRM ================= */}
      {step === 4 && (
        <form onSubmit={handleSubmitBooking} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Review Appointment Summary</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Please inspect your appointment details before submitting your request.
            </p>
          </div>

          {/* Summary Card */}
          <div className="bg-slate-50/70 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 rounded-xl p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Service</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{selectedService?.name}</span>
                <span className="text-slate-500 dark:text-slate-400">Duration: {selectedService?.duration_minutes} minutes</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Dentist</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  Dr. {selectedDentist?.first_name} {selectedDentist?.last_name}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{selectedDentist?.specialization}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Scheduled Time</span>
                <span className="text-sm font-bold text-[#0D9488] dark:text-teal-400 mt-0.5 block">
                  {new Date(`${selectedDate}T12:00:00+08:00`).toLocaleDateString('en-US', { timeZone: CLINIC_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {formatSlotTime(selectedSlot?.start_at)} – {formatSlotTime(selectedSlot?.end_at)}
                </span>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  (Turnaround buffer: 10 mins allocated for room sterilization)
                </p>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Estimated Fee</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  ₱{Number(selectedService?.price).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Payable at clinic upon consultation</span>
              </div>
            </div>
          </div>

          {/* Chief Complaint / Optional Reason */}
          <div className="space-y-1.5">
            <label htmlFor="booking-chief-complaint" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
              <span>Reason for Visit / Chief Complaint (Optional)</span>
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-normal">{chiefComplaint.length}/1000</span>
            </label>
            <textarea
              id="booking-chief-complaint"
              rows={3}
              maxLength={1000}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Describe any symptoms, tooth sensitivity, or specific concern..."
              className="w-full text-base sm:text-xs border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488] resize-none"
            />
          </div>

          {/* Clinic Cancellation Policy Agreement */}
          <div className="bg-teal-50/50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/70 rounded-xl p-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="policy-agree"
              checked={agreedPolicy}
              onChange={(e) => setAgreedPolicy(e.target.checked)}
              className="tch-check mt-0.5 text-[#0D9488] focus:ring-[#0D9488] border-slate-300 dark:border-gray-600 rounded cursor-pointer"
            />
            <label htmlFor="policy-agree" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <strong className="text-slate-800 dark:text-slate-100">Clinic Scheduling Policy:</strong> I understand that my appointment request will be placed in <span className="font-semibold text-amber-700 dark:text-amber-400">PENDING</span> status until reviewed by clinic staff. Cancellations must be made at least 2 hours in advance.
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-slate-100 dark:border-gray-700">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(3)}
              className="w-full sm:w-auto min-h-11 justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Slot Selection
            </button>
            <button
              type="submit"
              disabled={submitting || !agreedPolicy}
              className="w-full sm:w-auto min-h-11 justify-center px-6 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Reserving Slot...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Confirm & Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ================= STEP 5: SUCCESS CONFIRMATION ================= */}
      {step === 5 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 sm:p-8 text-center shadow-sm space-y-6">
          <div className="w-16 h-16 bg-[#CCFBF1] dark:bg-teal-900/60 text-[#0D9488] dark:text-teal-300 rounded-full flex items-center justify-center mx-auto ring-8 ring-teal-50 dark:ring-teal-950/60">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Appointment Request Submitted!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your appointment request has been safely recorded in the clinic system under reference{' '}
              <strong className="text-slate-800 dark:text-slate-100">#{createdAppointment?.id}</strong>.
            </p>
          </div>

          {/* Details Box */}
          <div className="max-w-md mx-auto bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 rounded-xl p-4 text-xs text-left space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-[11px]">
                PENDING REVIEW
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Service:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tch-wrap-anywhere sm:text-right">{createdAppointment?.service_name || selectedService?.name}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Dentist:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tch-wrap-anywhere sm:text-right">
                Dr. {createdAppointment?.dentist_first_name || selectedDentist?.first_name} {createdAppointment?.dentist_last_name || selectedDentist?.last_name}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Scheduled:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tch-wrap-anywhere sm:text-right">
                {createdAppointment?.start_at} ({createdAppointment?.operatory_chair || 'Chair 1'})
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto min-h-11 justify-center px-4 py-2 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            >
              Book Another Appointment
            </button>
            <button
              type="button"
              onClick={() => onNavigateToAppointments && onNavigateToAppointments()}
              className="w-full sm:w-auto min-h-11 justify-center px-5 py-2.5 bg-[#0D9488] dark:bg-[#0F766E] hover:bg-[#0F766E] dark:hover:bg-[#0D9488] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              View My Appointments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
