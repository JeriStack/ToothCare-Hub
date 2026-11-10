import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Stethoscope,
  Sparkles,
  FileText,
  ShieldCheck,
  Award,
  ChevronRight,
} from 'lucide-react';
import { appointmentsApi } from '../appointments/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';

const STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-[#CCFBF1] text-[#0F766E] border-teal-200',
  COMPLETED: 'bg-sky-100 text-sky-800 border-sky-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const STATUS_LABELS = {
  PENDING: 'Awaiting Clinic Review',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
};

// Formats a date string in Asia/Manila timezone
function formatManilaDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function PatientDashboard({
  user,
  onNavigateToBook,
  onNavigateToAppointments,
  onNavigateToServices,
  onNavigateToDentists,
  onNavigateToProfile,
}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeListTab, setActiveListTab] = useState('upcoming');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.list();
      const list = Array.isArray(data) ? data : data?.items || [];
      setAppointments(list);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load your appointments. Please verify clinic server status.'
      );
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const patientName = user?.patient?.first_name
    ? user.patient.first_name
    : user?.first_name
    ? user.first_name
    : 'Patient';

  // Current clinic date in Asia/Manila
  const currentManilaDateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  // Compute live statistics based on real persisted records
  const now = new Date();

  const upcomingConfirmedList = useMemo(() => {
    return appointments
      .filter((a) => {
        if (a.status !== 'CONFIRMED') return false;
        const d = new Date((a.start_at || a.date || '').replace(' ', 'T'));
        return isNaN(d.getTime()) || d >= now;
      })
      .sort((a, b) => {
        const da = new Date((a.start_at || a.date || '').replace(' ', 'T')).getTime() || 0;
        const db = new Date((b.start_at || b.date || '').replace(' ', 'T')).getTime() || 0;
        return da - db;
      });
  }, [appointments, now]);

  const pendingList = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'PENDING')
      .sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [appointments]);

  const completedList = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'COMPLETED')
      .sort((a, b) => {
        const da = new Date((a.start_at || a.date || '').replace(' ', 'T')).getTime() || 0;
        const db = new Date((b.start_at || b.date || '').replace(' ', 'T')).getTime() || 0;
        return db - da;
      });
  }, [appointments]);

  // Next confirmed appointment hero
  const nextVisit = upcomingConfirmedList[0] || null;

  return (
    <div className="space-y-6">
      {/* 5.1 Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9488] mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{currentManilaDateStr} • Clinic Time (Asia/Manila)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">
            Welcome back, {patientName}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Track your appointments, discover clinical services, and manage your oral health profile.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToBook}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-all shadow-sm shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
        >
          <Plus className="w-4 h-4" />
          <span>Book an Appointment</span>
        </button>
      </div>

      {/* Error Alert State */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            className="px-3 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <DashboardSkeleton role="patient" />
      ) : (
        <>
          {/* 5.2 Dashboard Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveListTab('upcoming')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'upcoming'
                  ? 'bg-teal-50/70 border-[#0D9488] shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Upcoming Visits
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-[#0F766E] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {upcomingConfirmedList.length}
                </span>
                <span className="text-xs text-slate-500">Confirmed scheduled</span>
              </div>
            </div>

            <div
              onClick={() => setActiveListTab('pending')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'pending'
                  ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pending Requests
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {pendingList.length}
                </span>
                <span className="text-xs text-slate-500">Awaiting triage</span>
              </div>
            </div>

            <div
              onClick={() => setActiveListTab('completed')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeListTab === 'completed'
                  ? 'bg-sky-50/70 border-sky-400 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Completed Treatments
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#12304A]">
                  {completedList.length}
                </span>
                <span className="text-xs text-slate-500">Past dental visits</span>
              </div>
            </div>
          </div>

          {/* 5.3 Next Confirmed Visit Hero Card */}
          {nextVisit ? (
            <div className="bg-white rounded-2xl border-2 border-[#0D9488]/40 p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#CCFBF1]/40 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold tracking-wider uppercase text-[#0D9488] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Next Confirmed Visit
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                  Confirmed #{nextVisit.appointment_number || nextVisit.id}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#12304A]">
                    {nextVisit.service_name || 'Dental Consultation'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{formatManilaDate(nextVisit.start_at || nextVisit.date)}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Practitioner:{' '}
                    <strong>
                      {nextVisit.dentist_first_name
                        ? `Dr. ${nextVisit.dentist_first_name} ${nextVisit.dentist_last_name}`
                        : 'Assigned Clinician'}
                    </strong>
                    {nextVisit.operatory_chair && ` • ${nextVisit.operatory_chair}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onNavigateToAppointments}
                    className="px-4 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] transition-colors shadow-xs"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-teal-50/70 to-slate-50 rounded-2xl border border-teal-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#12304A]">
                    No upcoming confirmed appointments
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                    Keep your smile healthy and radiant. Check available dates and book your next consultation in minutes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToBook}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
              >
                <span>Book now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Discovery Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={onNavigateToServices}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    Explore Services
                  </h4>
                  <p className="text-[11px] text-slate-400">Procedures, pricing & duration</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>

            <button
              type="button"
              onClick={onNavigateToDentists}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    Our Dentists
                  </h4>
                  <p className="text-[11px] text-slate-400">Credentials, specialties & chairs</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>

            <button
              type="button"
              onClick={onNavigateToProfile}
              className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-[#0D9488]/40 hover:shadow-xs transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12304A] group-hover:text-[#0D9488] transition-colors">
                    My Medical Profile
                  </h4>
                  <p className="text-[11px] text-slate-400">Allergies & contact information</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0D9488] transition-colors" />
            </button>
          </div>

          {/* Appointments Multi-Tab Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveListTab('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeListTab === 'upcoming'
                      ? 'bg-teal-50 text-[#0D9488] font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Upcoming ({upcomingConfirmedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeListTab === 'pending'
                      ? 'bg-amber-50 text-amber-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pending Requests ({pendingList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeListTab === 'completed'
                      ? 'bg-sky-50 text-sky-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Completed ({completedList.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onNavigateToAppointments}
                className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                <span>View full history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Tab Content */}
            {activeListTab === 'upcoming' && (
              upcomingConfirmedList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No upcoming visits scheduled</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You have no active confirmed appointments. Schedule your next dental checkup now.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateToBook}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Book Appointment</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingConfirmedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A]">
                            {appt.service_name || 'Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {appt.dentist_first_name
                              ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                              : 'Assigned Dentist'}{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            STATUS_BADGE[appt.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                        <button
                          type="button"
                          onClick={onNavigateToAppointments}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                          aria-label="View Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeListTab === 'pending' && (
              pendingList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No pending requests</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All your booking requests have been processed by clinic administration.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingList.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A]">
                            {appt.service_name || 'Requested Service'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Preferred Dr:{' '}
                            {appt.dentist_first_name
                              ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                              : 'First Available Clinician'}{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Awaiting Review
                        </span>
                        <button
                          type="button"
                          onClick={onNavigateToAppointments}
                          className="text-xs text-[#0D9488] hover:underline font-semibold"
                        >
                          Review Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeListTab === 'completed' && (
              completedList.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#12304A]">No past treatments recorded</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Your completed appointments and dental care history will be shown here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {completedList.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #{appt.appointment_number ? appt.appointment_number.slice(-4) : appt.id}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#12304A]">
                            {appt.service_name || 'Completed Dental Service'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {appt.dentist_first_name
                              ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                              : 'Attending Dentist'}{' '}
                            • 📅 {formatManilaDate(appt.start_at || appt.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                          Completed
                        </span>
                        <button
                          type="button"
                          onClick={onNavigateToAppointments}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                          aria-label="View Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PatientDashboard;
