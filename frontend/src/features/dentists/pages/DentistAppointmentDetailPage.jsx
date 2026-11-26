import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertTriangle,
  Stethoscope,
  CheckCircle2,
  FileText,
  MapPin,
  PlusCircle,
  Phone,
  Mail,
  RefreshCw,
  X,
} from 'lucide-react';
import { appointmentsApi } from '../../appointments/api';
import { TreatmentRecordViewer } from '../../treatment-records/components/TreatmentRecordViewer';
import { TreatmentRecordEditor } from '../../treatment-records/components/TreatmentRecordEditor';
import { AppointmentDetailSkeleton } from '../../../components/skeletons';
import { DialogOverlay } from '../../../components/ui/DialogOverlay';
import { useDashboardSync } from '../../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../../services/realtime/dashboardSync';

const CLINIC_TIME_ZONE = 'Asia/Manila';

const EMPTY_ALERT_PLACEHOLDERS = new Set([
  'none',
  'none recorded',
  'none reported',
  'no allergies',
  'no known allergies',
  'n/a',
  'na',
  'nil',
  '-',
]);

const STATUS_BADGE_MAP = {
  CONFIRMED: {
    label: 'Confirmed',
    pill: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/30',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
  PENDING: {
    label: 'Pending Review',
    pill: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-100 dark:bg-gray-700/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-gray-600',
    dot: 'bg-slate-400',
  },
  REJECTED: {
    label: 'Declined',
    pill: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30',
    dot: 'bg-rose-500 dark:bg-rose-400',
  },
};

function getInitials(firstName = '', lastName = '') {
  const f = (firstName || '').trim().charAt(0);
  const l = (lastName || '').trim().charAt(0);
  return (f + l).toUpperCase() || 'PT';
}

function formatReadableDate(sqlDateTime) {
  if (!sqlDateTime) return 'N/A';
  const datePart = String(sqlDateTime).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    return new Date(`${datePart}T12:00:00+08:00`).toLocaleDateString('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return datePart;
  }
}

function formatTime12h(sqlDateTime) {
  if (!sqlDateTime || String(sqlDateTime).length < 16) return '';
  const hhmm = String(sqlDateTime).slice(11, 16);
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatGender(raw) {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'MALE') return 'Male';
  if (upper === 'FEMALE') return 'Female';
  if (upper === 'OTHER') return 'Other';
  return '';
}

export function DentistAppointmentDetailPage({ appointmentId, onBack }) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Treatment record state
  const [treatmentRecord, setTreatmentRecord] = useState(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);

  // Completion Modal State
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(null);

  const fetchAppointmentDetails = useCallback(async (isSilentRefresh = false) => {
    if (isSilentRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getDentistAppointment(appointmentId);
      setAppointment(data);
      setTreatmentRecord(data?.treatment_record || null);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'You are not authorized to view this appointment, or it does not exist.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (appointmentId) {
      fetchAppointmentDetails();
    }
  }, [appointmentId, fetchAppointmentDetails]);

  useDashboardSync({
    role: 'DENTIST',
    domains: [DASHBOARD_SYNC_DOMAINS.APPOINTMENTS],
    enabled: Boolean(appointmentId && !isEditingRecord),
    onRefresh: () => fetchAppointmentDetails(true),
  });

  const handleCompleteAppointment = async () => {
    setCompleting(true);
    setCompletionError(null);
    try {
      const updated = await appointmentsApi.completeDentistAppointment(appointmentId);
      setAppointment(updated);
      setIsCompletionModalOpen(false);
      fetchAppointmentDetails(true);
    } catch (err) {
      setCompletionError(
        err.response?.data?.error?.message ||
          'Failed to mark appointment as completed.'
      );
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <AppointmentDetailSkeleton onBack={onBack} />;
  }

  if (error || !appointment) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 dark:text-rose-400 mx-auto" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Appointment Inaccessible</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {error || 'Unable to retrieve clinical appointment details.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-gray-700 rounded-xl hover:bg-slate-200 dark:hover:bg-gray-600 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Assigned Appointments</span>
        </button>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'CONFIRMED';
  const isCompleted = appointment.status === 'COMPLETED';
  const normalizedAlert = String(appointment.patient_medical_alerts || '').trim().toLowerCase();
  const hasMedicalAlerts = Boolean(
    normalizedAlert && !EMPTY_ALERT_PLACEHOLDERS.has(normalizedAlert)
  );
  const badge = STATUS_BADGE_MAP[appointment.status] || {
    label: appointment.status,
    pill: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-gray-600',
    dot: 'bg-slate-400',
  };
  const genderLabel = formatGender(appointment.patient_gender);
  const durationMins = appointment.duration_snapshot || appointment.service_duration || 45;

  return (
    <div className="space-y-5">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Assigned Appointments</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            #{appointment.id}
          </span>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchAppointmentDetails(true)}
            aria-label="Refresh appointment details"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Critical Medical Alerts Banner */}
      {hasMedicalAlerts && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/35 border-l-4 border-l-rose-500 text-rose-950 dark:text-rose-100 flex items-start gap-3 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Medical Alert
            </h4>
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              {appointment.patient_medical_alerts}
            </p>
          </div>
        </div>
      )}

      {/* Appointment Overview Card */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-gray-700/80 pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
                {appointment.service_name || 'Dental Consultation'}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.pill}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
                {badge.label}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {formatReadableDate(appointment.start_at)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>
                  {formatTime12h(appointment.start_at)} · {durationMins}m
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>{appointment.operatory_chair || 'Operatory Chair 1'}</span>
              </span>
            </div>
          </div>

          {isConfirmed && (
            <button
              type="button"
              onClick={() => setIsCompletionModalOpen(true)}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Complete Visit</span>
            </button>
          )}

          {isCompleted && (
            <div className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/15 border border-sky-200/80 dark:border-sky-500/30">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Treatment Completed</span>
            </div>
          )}
        </div>

        {/* Patient & Visit Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50/75 dark:bg-gray-900/55 border border-slate-200/75 dark:border-gray-700/75 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-[#12304A] dark:text-slate-100 flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(appointment.patient_first_name, appointment.patient_last_name)}
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Patient
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                {appointment.patient_first_name} {appointment.patient_last_name}
              </p>
              <p className="text-slate-600 dark:text-slate-300 tabular-nums">
                {appointment.patient_date_of_birth ? `Born ${formatReadableDate(appointment.patient_date_of_birth)}` : 'DOB not recorded'}
                {genderLabel ? ` · ${genderLabel}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400 pt-0.5">
                {appointment.patient_phone && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {appointment.patient_phone}
                  </span>
                )}
                {appointment.patient_email && (
                  <span className="inline-flex items-center gap-1 break-all">
                    <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {appointment.patient_email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/75 dark:bg-gray-900/55 border border-slate-200/75 dark:border-gray-700/75 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Chief Complaint
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {appointment.chief_complaint || 'No chief complaint provided.'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/70 dark:border-gray-700/70 flex items-center justify-between text-xs tabular-nums">
              <span className="text-slate-500 dark:text-slate-400">Service Fee</span>
              <span className="font-bold text-[#0F766E] dark:text-teal-300">
                ₱{Number(appointment.price_snapshot || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Treatment Record Section */}
      <div className="bg-white dark:bg-gray-800/95 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-gray-700/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/15 ring-1 ring-inset ring-teal-200/80 dark:ring-teal-500/25 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4" aria-hidden="true" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#12304A] dark:text-slate-50 tracking-tight">
              {isEditingRecord
                ? treatmentRecord
                  ? 'Edit Treatment Record'
                  : 'Create Treatment Record'
                : 'Treatment Record'}
            </h3>
          </div>
        </div>

        {isEditingRecord ? (
          <TreatmentRecordEditor
            appointmentId={appointment.id}
            initialRecord={treatmentRecord}
            onSaved={(saved) => {
              setTreatmentRecord(saved);
              setIsEditingRecord(false);
              fetchAppointmentDetails(true);
            }}
            onCancel={() => setIsEditingRecord(false)}
          />
        ) : treatmentRecord ? (
          <TreatmentRecordViewer
            record={treatmentRecord}
            canEdit={true}
            onEdit={() => setIsEditingRecord(true)}
          />
        ) : (
          <div className="py-10 px-6 text-center rounded-xl bg-slate-50/50 dark:bg-gray-900/40 border border-dashed border-slate-200 dark:border-gray-700/80 space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">No Treatment Record Yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isConfirmed || isCompleted
                ? 'Record treated teeth, diagnosis, procedure notes, and post-op instructions.'
                : 'Charting becomes available once this appointment is confirmed or completed.'}
            </p>
            {(isConfirmed || isCompleted) && (
              <button
                type="button"
                onClick={() => setIsEditingRecord(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                <span>Start Clinical Charting</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Complete Appointment Modal */}
      {isCompletionModalOpen && (
        <DialogOverlay
          onClose={() => !completing && setIsCompletionModalOpen(false)}
          dismissible={!completing}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Mark Visit as Completed</h3>
              <button
                type="button"
                disabled={completing}
                onClick={() => setIsCompletionModalOpen(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
              Mark this visit for <strong className="text-slate-900 dark:text-slate-100">{appointment.patient_first_name} {appointment.patient_last_name}</strong> as <strong className="text-slate-900 dark:text-slate-100">Completed</strong>?
            </p>

            {completionError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs font-medium"
              >
                {completionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-gray-700">
              <button
                type="button"
                disabled={completing}
                onClick={() => setIsCompletionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing}
                onClick={handleCompleteAppointment}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{completing ? 'Completing...' : 'Confirm Completion'}</span>
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
