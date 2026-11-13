import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  Stethoscope,
  CheckCircle2,
  FileText,
  MapPin,
  DollarSign,
  AlertCircle,
  PlusCircle,
  Lock,
  X,
} from 'lucide-react';
import { appointmentsApi } from '../../appointments/api';
import { TreatmentRecordViewer } from '../../treatment-records/components/TreatmentRecordViewer';
import { TreatmentRecordEditor } from '../../treatment-records/components/TreatmentRecordEditor';
import { AppointmentDetailSkeleton } from '../../../components/skeletons';

export function DentistAppointmentDetailPage({ appointmentId, onBack }) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Treatment record state
  const [treatmentRecord, setTreatmentRecord] = useState(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);

  // Completion Modal State
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(null);

  const fetchAppointmentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getDentistAppointment(appointmentId);
      setAppointment(data);
      if (data?.treatment_record) {
        setTreatmentRecord(data.treatment_record);
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        'You are not authorized to view this appointment, or it does not exist.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId) {
      fetchAppointmentDetails();
    }
  }, [appointmentId]);

  const handleCompleteAppointment = async () => {
    setCompleting(true);
    setCompletionError(null);
    try {
      const updated = await appointmentsApi.completeDentistAppointment(appointmentId);
      setAppointment(updated);
      setIsCompletionModalOpen(false);
      fetchAppointmentDetails();
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
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Appointment Inaccessible</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {error || 'Unable to retrieve clinical appointment details.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assigned Appointments</span>
        </button>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'CONFIRMED';
  const isCompleted = appointment.status === 'COMPLETED';
  const hasMedicalAlerts = Boolean(appointment.patient_medical_alerts);

  return (
    <div className="space-y-6">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assigned Appointments</span>
        </button>

        <span className="text-xs text-slate-400">
          Ref ID: #{appointment.id}
        </span>
      </div>

      {/* Critical Medical Alerts Banner */}
      {hasMedicalAlerts && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-3 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
              Patient Medical Alerts & Contraindications
            </h4>
            <p className="text-sm font-semibold text-rose-800 mt-0.5">
              {appointment.patient_medical_alerts}
            </p>
            <p className="text-[11px] text-rose-600 mt-1">
              Verify anesthesia tolerance and medical interactions prior to beginning treatment.
            </p>
          </div>
        </div>
      )}

      {/* Appointment Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#12304A]">
                {appointment.service_name || 'Clinical Dental Consultation'}
              </h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isConfirmed
                    ? 'bg-emerald-100 text-emerald-800'
                    : isCompleted
                    ? 'bg-blue-100 text-blue-800'
                    : appointment.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {appointment.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {appointment.start_at}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {appointment.operatory_chair || 'Operatory Chair 1'}
              </span>
            </p>
          </div>

          {/* Action Button: Complete Appointment */}
          {isConfirmed && (
            <button
              type="button"
              onClick={() => setIsCompletionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Visit</span>
            </button>
          )}

          {isCompleted && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Treatment Completed</span>
            </div>
          )}
        </div>

        {/* Patient Demographics & Chief Complaint Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Patient Profile
            </span>
            <p className="text-sm font-bold text-slate-900">
              {appointment.patient_first_name} {appointment.patient_last_name}
            </p>
            <p className="text-slate-600">
              DOB: {appointment.patient_date_of_birth || 'N/A'} • Gender: {appointment.patient_gender || 'Unspecified'}
            </p>
            <p className="text-slate-600">
              Contact: {appointment.patient_phone || 'N/A'}
            </p>
            <p className="text-slate-500 text-[11px]">
              Email: {appointment.patient_email || 'Not provided'}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Chief Complaint / Patient Notes
            </span>
            <p className="text-xs text-slate-700 italic">
              {appointment.chief_complaint
                ? `"${appointment.chief_complaint}"`
                : 'No specific chief complaint stated by the patient.'}
            </p>
            <div className="pt-2 text-[11px] text-slate-500">
              Fee snapshot: ₱{Number(appointment.price_snapshot || 0).toLocaleString()} (Standard {appointment.duration_snapshot || 45} mins)
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Treatment Record Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-[#12304A]">
              Clinical Documentation & Treatment Record
            </h3>
          </div>

          {!treatmentRecord && !isEditingRecord && (isConfirmed || isCompleted) && (
            <button
              type="button"
              onClick={() => setIsEditingRecord(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Document Treatment Record</span>
            </button>
          )}
        </div>

        {isEditingRecord ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">
                {treatmentRecord ? 'Edit Treatment Record' : 'Create Treatment Record'}
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingRecord(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
            <TreatmentRecordEditor
              appointmentId={appointment.id}
              initialRecord={treatmentRecord}
              onSaved={(saved) => {
                setTreatmentRecord(saved);
                setIsEditingRecord(false);
                fetchAppointmentDetails();
              }}
              onCancel={() => setIsEditingRecord(false)}
            />
          </div>
        ) : treatmentRecord ? (
          <TreatmentRecordViewer
            record={treatmentRecord}
            canEdit={true}
            onEdit={() => setIsEditingRecord(true)}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No Treatment Record Documented</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isConfirmed || isCompleted
                ? 'Clinical treatment records document teeth treated, procedures performed, prescriptions, and home care advice.'
                : 'Treatment records can be documented once the appointment is confirmed or completed.'}
            </p>
            {(isConfirmed || isCompleted) && (
              <button
                type="button"
                onClick={() => setIsEditingRecord(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-lg transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Start Clinical Charting</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Complete Appointment Modal */}
      {isCompletionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Mark Visit as Completed</h3>
              <button
                type="button"
                onClick={() => setIsCompletionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to transition this appointment to <strong>COMPLETED</strong>? This indicates that the clinical visit has taken place and treatment has been administered.
            </p>

            {completionError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
              >
                {completionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={completing}
                onClick={() => setIsCompletionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing}
                onClick={handleCompleteAppointment}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{completing ? 'Completing Visit...' : 'Confirm Completion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
