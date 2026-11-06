import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
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

export function PatientDashboard({ user, onNavigateToBook, onNavigateToAppointments }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.list();
      setAppointments(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error('Failed to load patient appointments:', err);
      setError(
        err.response?.data?.error?.message ||
          'Unable to load your appointment history from the database.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const patientName = user?.patient
    ? `${user.patient.first_name} ${user.patient.last_name}`
    : user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : 'Patient';

  const upcomingConfirmed = appointments.find(
    (a) => a.status === 'CONFIRMED' && new Date(a.start_at || a.date) >= new Date()
  );

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">
            Welcome, {patientName}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your personal dental appointments, view upcoming visits, and schedule consultations.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToBook}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
        >
          <Plus className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Error State */}
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
          {/* Upcoming Visit Highlight */}
          {upcomingConfirmed ? (
            <div className="bg-white rounded-2xl border-2 border-[#0D9488]/40 p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFBF1]/30 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold tracking-wider uppercase text-[#0D9488] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Next Confirmed Visit
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                  Confirmed
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#12304A]">
                    {upcomingConfirmed.service_name || 'Dental Consultation'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      {upcomingConfirmed.start_at || upcomingConfirmed.date} (Asia/Manila)
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dentist:{' '}
                    <strong>
                      {upcomingConfirmed.dentist_first_name
                        ? `Dr. ${upcomingConfirmed.dentist_first_name} ${upcomingConfirmed.dentist_last_name}`
                        : 'Assigned Clinician'}
                    </strong>
                    {upcomingConfirmed.operatory_chair && ` • ${upcomingConfirmed.operatory_chair}`}
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
                    Ready to schedule your next appointment?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                    Choose from available teeth cleaning, restorative fillings, root canal therapy, and cosmetic dentistry.
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

          {/* Appointments Table / List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#12304A]">Recent Appointments</h3>
              {appointments.length > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToAppointments}
                  className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1 transition-colors"
                >
                  <span>View full history</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#12304A]">No appointments recorded</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  You do not have any past or upcoming appointments recorded in your account yet.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToBook}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Your First Visit</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt.id}
                    className="p-4 hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
                        #{appt.id}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#12304A]">
                          {appt.service_name || 'Dental Service'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {appt.dentist_first_name
                            ? `Dr. ${appt.dentist_first_name} ${appt.dentist_last_name}`
                            : 'Assigned Dentist'}{' '}
                          • 📅 {appt.start_at || appt.date}
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
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PatientDashboard;
